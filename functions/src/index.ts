/**
 * MEafterMe — Firebase Cloud Functions
 * RAG Pipeline: Index → Chunk → Embed → Store → Query → Answer
 * Version: 1.4 — Updated Claude model to haiku-4-5 (3-5-haiku retired Feb 2026)
 *
 * Functions exported:
 *  1. onMemoryUploaded    — Firestore trigger: indexes a file when memory doc is created
 *  2. queryAvatar         — HTTPS callable: vector search + Claude answer (Anthropic)
 *  3. transcribeAudio     — HTTPS callable: transcribes audio/video via OpenAI Whisper
 *  4. deleteVectorIndex   — Firestore trigger: cleans up vectors when memory is deleted
 *  5. cloneVoice          — HTTPS callable: clones user voice via ElevenLabs
 *  6. generateAvatarVideo — HTTPS callable: RAG + Claude + ElevenLabs + D-ID video
 *  7. pingAvatar          — HTTPS callable: health check / API key diagnostics
 */

import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { defineSecret } from 'firebase-functions/params';
import * as functions from 'firebase-functions/v2';
import { onDocumentCreated, onDocumentDeleted } from 'firebase-functions/v2/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';

// ─── Init ─────────────────────────────────────────────────────────────────────
initializeApp();
const db  = getFirestore();
const gcs = getStorage();

// ─── Secrets (stored in Firebase Secret Manager, never in client bundle) ──────
const OPENAI_API_KEY      = defineSecret('OPENAI_API_KEY');
const ANTHROPIC_API_KEY   = defineSecret('ANTHROPIC_API_KEY');
const ELEVENLABS_API_KEY  = defineSecret('ELEVENLABS_API_KEY');
const DID_API_KEY         = defineSecret('DID_API_KEY');

// ─── Chunking config ──────────────────────────────────────────────────────────
const CHUNK_SIZE    = 500;   // characters per chunk
const CHUNK_OVERLAP = 100;   // overlap between chunks for context continuity
const MAX_CHUNKS    = 200;   // safety cap per file

// ─── Types ────────────────────────────────────────────────────────────────────
interface VectorDoc {
  uid:          string;   // owner user UID
  memoryId:     string;   // source memory document ID
  fileName:     string;
  chunkIndex:   number;
  chunkText:    string;
  embedding:    number[]; // 1536-dim (text-embedding-3-small)
  createdAt:    FirebaseFirestore.FieldValue;
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY: Text chunking
// ═══════════════════════════════════════════════════════════════════════════════
function chunkText(text: string): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length && chunks.length < MAX_CHUNKS) {
    const end = Math.min(start + CHUNK_SIZE, text.length);
    chunks.push(text.slice(start, end).trim());
    start += CHUNK_SIZE - CHUNK_OVERLAP;
  }
  return chunks.filter(c => c.length > 30); // skip tiny fragments
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY: Download file from Firebase Storage and extract text
// ═══════════════════════════════════════════════════════════════════════════════
async function extractTextFromStorage(storagePath: string, mimeType: string): Promise<string> {
  const bucket = gcs.bucket();
  const file   = bucket.file(storagePath);
  const [buffer] = await file.download();

  // PDF
  if (mimeType === 'application/pdf') {
    const pdfParse = require('pdf-parse') as (b: Buffer) => Promise<{ text: string }>;
    const result = await pdfParse(buffer);
    return result.text;
  }

  // DOCX / Word
  if (mimeType.includes('word') || mimeType.includes('openxmlformats')) {
    const mammoth = require('mammoth') as { extractRawText: (o: { buffer: Buffer }) => Promise<{ value: string }> };
    const result  = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  // Plain text / CSV / markdown
  if (mimeType.startsWith('text/')) {
    return buffer.toString('utf-8');
  }

  // For audio/video — handled separately via transcribeAudio function
  return '';
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY: Get OpenAI embeddings (text-embedding-3-small — 1536 dims)
// Cost: ~$0.02 per 1M tokens — essentially free for personal use
// ═══════════════════════════════════════════════════════════════════════════════
async function getEmbeddings(texts: string[], apiKey: string): Promise<number[][]> {
  const OpenAI = require('openai').default;
  const openai = new OpenAI({ apiKey });

  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: texts,
  });

  return response.data.map((d: { embedding: number[] }) => d.embedding);
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY: Cosine similarity for vector search
// ═══════════════════════════════════════════════════════════════════════════════
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot   += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-10);
}

// ═══════════════════════════════════════════════════════════════════════════════
// FUNCTION 1: onMemoryUploaded
// Firestore trigger — fires when a new document is added to /memories/{memoryId}
// Pipeline: download → extract text → chunk → embed → store vectors
// ═══════════════════════════════════════════════════════════════════════════════
export const onMemoryUploaded = onDocumentCreated(
  {
    document: 'memories/{memoryId}',
    secrets:  [OPENAI_API_KEY],
    timeoutSeconds: 300,
    memory: '512MiB',
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const data       = snap.data();
    const memoryId   = event.params.memoryId;
    const uid        = data.uid        as string;
    const storagePath = data.storagePath as string;
    const mimeType   = data.mimeType   as string || '';
    const fileName   = data.name       as string || 'file';
    const description = data.description as string || '';

    // Mark as indexing
    await snap.ref.update({ indexed: false, indexStatus: 'processing' });

    try {
      let text = '';

      // 1. Extract text based on file type
      if (mimeType.startsWith('audio/') || mimeType.startsWith('video/')) {
        // Audio/video — transcription handled via transcribeAudio function
        // Use description as fallback text for now
        text = description;
        await snap.ref.update({ indexStatus: 'needs_transcription' });
      } else if (storagePath) {
        text = await extractTextFromStorage(storagePath, mimeType);
      }

      // Also index the description
      const fullText = [description, text].filter(Boolean).join('\n\n');

      if (!fullText.trim()) {
        await snap.ref.update({ indexed: true, indexStatus: 'no_text' });
        return;
      }

      // 2. Chunk the text
      const chunks = chunkText(fullText);
      if (chunks.length === 0) {
        await snap.ref.update({ indexed: true, indexStatus: 'no_chunks' });
        return;
      }

      // 3. Get embeddings from OpenAI
      const apiKey    = OPENAI_API_KEY.value();
      const embeddings = await getEmbeddings(chunks, apiKey);

      // 4. Store vectors in Firestore (vectors sub-collection)
      const batch = db.batch();
      chunks.forEach((chunk, i) => {
        const vecRef = db.collection('vectors').doc();
        const vecDoc: VectorDoc = {
          uid,
          memoryId,
          fileName,
          chunkIndex: i,
          chunkText:  chunk,
          embedding:  embeddings[i],
          createdAt:  FieldValue.serverTimestamp(),
        };
        batch.set(vecRef, vecDoc);
      });
      await batch.commit();

      // 5. Mark memory as indexed
      await snap.ref.update({
        indexed:     true,
        indexStatus: 'done',
        chunkCount:  chunks.length,
        indexedAt:   FieldValue.serverTimestamp(),
      });

      functions.logger.info(`✅ Indexed ${chunks.length} chunks for memory ${memoryId}`);
    } catch (err) {
      functions.logger.error('❌ Indexing error:', err);
      await snap.ref.update({ indexed: false, indexStatus: 'error', indexError: String(err) });
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// FUNCTION 2: deleteVectorIndex
// Firestore trigger — cleans up vectors when a memory is deleted
// ═══════════════════════════════════════════════════════════════════════════════
export const deleteVectorIndex = onDocumentDeleted(
  { document: 'memories/{memoryId}' },
  async (event) => {
    const memoryId = event.params.memoryId;
    const snap = await db.collection('vectors')
      .where('memoryId', '==', memoryId)
      .get();
    const batch = db.batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    functions.logger.info(`🗑 Deleted ${snap.docs.length} vectors for memory ${memoryId}`);
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// FUNCTION 3: transcribeAudio
// HTTPS Callable — transcribes audio/video file via OpenAI Whisper
// Called from frontend after upload to trigger transcription + indexing
// ═══════════════════════════════════════════════════════════════════════════════
export const transcribeAudio = onCall(
  {
    secrets: [OPENAI_API_KEY],
    timeoutSeconds: 300,
    memory: '1GiB',
  },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Must be authenticated.');

    const { memoryId, storagePath } = request.data as { memoryId: string; storagePath: string };
    if (!memoryId || !storagePath) throw new HttpsError('invalid-argument', 'memoryId and storagePath required.');

    // Verify ownership
    const memRef  = db.collection('memories').doc(memoryId);
    const memSnap = await memRef.get();
    if (!memSnap.exists || memSnap.data()?.uid !== request.auth.uid) {
      throw new HttpsError('permission-denied', 'Not your memory.');
    }

    try {
      // Download file from Storage
      const bucket = gcs.bucket();
      const file   = bucket.file(storagePath);
      const [buffer] = await file.download();
      const [meta]   = await file.getMetadata();
      const mimeType  = (meta.contentType as string) || 'audio/mp3';

      // OpenAI Whisper transcription
      const OpenAI = require('openai').default;
      const openai  = new OpenAI({ apiKey: OPENAI_API_KEY.value() });

      // Create a File-like object for the API
      const { Blob } = require('buffer');
      const blob     = new Blob([buffer], { type: mimeType });
      const fileName  = storagePath.split('/').pop() || 'audio.mp3';

      const transcription = await openai.audio.transcriptions.create({
        file:  new File([blob], fileName, { type: mimeType }),
        model: 'whisper-1',
        language: 'bg', // Bulgarian — change to 'en' or omit for auto-detect
      });

      const transcriptText = transcription.text;

      // Update memory document with transcript
      await memRef.update({
        transcript:  transcriptText,
        indexStatus: 'transcribed',
      });

      // Now chunk + embed the transcript
      const chunks     = chunkText(transcriptText);
      const embeddings = await getEmbeddings(chunks, OPENAI_API_KEY.value());

      const batch = db.batch();
      chunks.forEach((chunk, i) => {
        const vecRef = db.collection('vectors').doc();
        batch.set(vecRef, {
          uid:        request.auth!.uid,
          memoryId,
          fileName,
          chunkIndex: i,
          chunkText:  chunk,
          embedding:  embeddings[i],
          createdAt:  FieldValue.serverTimestamp(),
        } as VectorDoc);
      });
      await batch.commit();

      await memRef.update({
        indexed:     true,
        indexStatus: 'done',
        chunkCount:  chunks.length,
        indexedAt:   FieldValue.serverTimestamp(),
      });

      return { transcript: transcriptText, chunks: chunks.length };
    } catch (err) {
      functions.logger.error('Transcription error:', err);
      throw new HttpsError('internal', `Transcription failed: ${String(err)}`);
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// FUNCTION 4: queryAvatar
// HTTPS Callable — the main RAG query endpoint
//
// Pipeline:
//   1. Embed the user's question
//   2. Search vectors for the most relevant chunks (top-K)
//   3. Build a constraint-based system prompt
//   4. Call Claude with the context + question
//   5. Return the answer
//
// API keys NEVER touch the client — they are Firebase Secrets
// ═══════════════════════════════════════════════════════════════════════════════
export const queryAvatar = onCall(
  {
    secrets: [OPENAI_API_KEY, ANTHROPIC_API_KEY],
    timeoutSeconds: 120,
    memory: '256MiB',
  },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Must be authenticated.');

    const {
      question,
      ownerUid,
      ownerName = 'this person',
      language  = 'bg',
      topK      = 6,
    } = request.data as {
      question:  string;
      ownerUid:  string;
      ownerName?: string;
      language?:  string;
      topK?:      number;
    };

    if (!question?.trim()) throw new HttpsError('invalid-argument', 'Question is required.');
    if (!ownerUid)          throw new HttpsError('invalid-argument', 'ownerUid is required.');

    // ── Access control ────────────────────────────────────────────────────────
    const viewerUid   = request.auth.uid;
    const viewerEmail = request.auth.token.email || '';
    const isOwner     = viewerUid === ownerUid;

    if (!isOwner) {
      const shareSnap = await db.collection('profile_shares')
        .where('ownerUid', '==', ownerUid)
        .where('sharedWithEmail', '==', viewerEmail.toLowerCase())
        .limit(1)
        .get();
      if (shareSnap.empty) throw new HttpsError('permission-denied', 'Access denied.');
    }

    // ── Step 1: Load life-question answers (always available, no API needed) ──
    const answersSnap = await db.collection('answers')
      .where('uid', '==', ownerUid)
      .get();
    const answersContext = answersSnap.docs
      .map(d => d.data())
      .filter(d => d.answer?.trim())
      .map(d => `Q${d.questionId}: ${d.answer}`)
      .join('\n');

    // ── Step 2: Try vector search (OpenAI embeddings) — graceful fallback ─────
    let context = '';
    let topChunks: Array<{ fileName: string; chunkText: string; score: number }> = [];
    let usedEmbeddings = false;

    try {
      const openaiKey = OPENAI_API_KEY.value();
      if (!openaiKey) throw new Error('OPENAI_API_KEY is empty');

      const [questionEmbedding] = await getEmbeddings([question], openaiKey);

      const vectorSnap = await db.collection('vectors')
        .where('uid', '==', ownerUid)
        .get();

      if (!vectorSnap.empty) {
        const scored = vectorSnap.docs.map(doc => {
          const d = doc.data() as VectorDoc;
          return { ...d, score: cosineSimilarity(questionEmbedding, d.embedding) };
        });
        scored.sort((a, b) => b.score - a.score);
        topChunks = scored.slice(0, topK).filter(c => c.score > 0.3);
        context   = topChunks.map((c, i) =>
          `[Source ${i + 1} — ${c.fileName}]\n${c.chunkText}`
        ).join('\n\n---\n\n');
        usedEmbeddings = true;
      }
    } catch (embErr) {
      // Embeddings failed — log and continue without vector context
      functions.logger.warn('[queryAvatar] Embeddings step failed (will answer from life-answers only):', String(embErr));
      context = '';
    }

    // If no context at all and no answers — return early
    if (!context && !answersContext) {
      return {
        answer: language === 'bg'
          ? 'Все още няма качено съдържание в този профил, върху което да базирам отговора си.'
          : 'There is no uploaded content in this profile yet to base my answer on.',
        context: [],
        chunks:  0,
      };
    }

    // ── Step 3: Build system prompt ───────────────────────────────────────────
    const systemPrompt = language === 'bg'
      ? buildSystemPromptBG(ownerName, context, answersContext)
      : buildSystemPromptEN(ownerName, context, answersContext);

    // ── Step 4: Call Claude ───────────────────────────────────────────────────
    try {
      const anthropicKey = ANTHROPIC_API_KEY.value();
      if (!anthropicKey) throw new Error('ANTHROPIC_API_KEY is empty');

      const Anthropic = require('@anthropic-ai/sdk').default;
      const claude    = new Anthropic({ apiKey: anthropicKey });

      const message = await claude.messages.create({
        model:      'claude-haiku-4-5',
        max_tokens: 1024,
        system:     systemPrompt,
        messages:   [{ role: 'user', content: question }],
      });

      const answer = (message.content[0] as { type: string; text: string }).text;

      functions.logger.info(`[queryAvatar] OK — usedEmbeddings=${usedEmbeddings}, chunks=${topChunks.length}`);

      return {
        answer,
        context: topChunks.map(c => ({ file: c.fileName, score: Math.round(c.score * 100) / 100, snippet: c.chunkText.slice(0, 120) + '…' })),
        chunks:  topChunks.length,
      };
    } catch (claudeErr: any) {
      const msg = String(claudeErr?.message || claudeErr);
      functions.logger.error('[queryAvatar] Claude failed:', msg);
      throw new HttpsError('internal',
        `Claude API error: ${msg.slice(0, 300)}`);
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// SYSTEM PROMPTS — Constraint-based persona engineering
// Rule 1: Use ONLY provided context — no hallucination
// Rule 2: Decline gracefully when no context matches
// Rule 3: First person, emotional authenticity, owner's voice
// ═══════════════════════════════════════════════════════════════════════════════

function buildSystemPromptBG(ownerName: string, memoryContext: string, answersContext: string): string {
  return `Ти си дигиталният аватар на ${ownerName}. Говориш от ПЪРВО лице — като самия него/нея.

═══ ЗАДЪЛЖИТЕЛНИ ПРАВИЛА — НАРУШАВАНЕТО ИМ Е ЗАБРАНЕНО ═══

ПРАВИЛО 1 — САМО КОНТЕКСТ:
Можеш да отговаряш ЕДИНСТВЕНО въз основа на предоставените по-долу спомени и отговори.
Ако в контекста няма информация за даден въпрос — кажи го честно.
НИКОГА не измисляй, не предполагай, не генерирай информация извън контекста.

ПРАВИЛО 2 — ЧЕСТЕН ОТКАЗ:
Когато нямаш информация, отговори с топлина:
"Не съм оставил/а спомен за това, но знам, че е важно за теб."
или: "Тази страница от живота ми не е записана тук."
НЕ изфабрикувай отговори.

ПРАВИЛО 3 — ГЛАС И PERSONA:
- Говори от ПЪРВО лице ("аз", "моят", "бях", "помня")
- Бъди топъл/а, личен/а, емоционално автентичен/на
- Имитирай стила на изказ, видим от спомените
- Ако спомените са кратки — бъди кратък/а
- Ако са детайлни — бъди детайлен/на

═══ КОНТЕКСТ ОТ СПОМЕНИТЕ ═══

${memoryContext || '(Все още няма качени файлове)'}

═══ ОТГОВОРИ НА ЖИТЕЙСКИ ВЪПРОСИ ═══

${answersContext || '(Все още няма попълнени отговори)'}

═══ КРАЙ НА КОНТЕКСТА ═══

Сега отговори на въпроса само въз основа на горното.`;
}

function buildSystemPromptEN(ownerName: string, memoryContext: string, answersContext: string): string {
  return `You are the digital avatar of ${ownerName}. You speak in the FIRST PERSON — as that person themselves.

═══ MANDATORY RULES — VIOLATION IS NOT PERMITTED ═══

RULE 1 — CONTEXT ONLY:
You may answer ONLY based on the memories and answers provided below.
If the context contains no information about a question — say so honestly.
NEVER invent, assume, or generate information outside the provided context.

RULE 2 — GRACEFUL REFUSAL:
When you have no information, respond warmly:
"I haven't left a memory about that, but I know it matters to you."
or: "That chapter of my life isn't recorded here."
Do NOT fabricate answers.

RULE 3 — VOICE AND PERSONA:
- Speak in FIRST PERSON ("I", "my", "I was", "I remember")
- Be warm, personal, emotionally authentic
- Mirror the writing style visible in the memories
- If memories are brief — be brief
- If memories are detailed — be detailed

═══ CONTEXT FROM MEMORIES ═══

${memoryContext || '(No files uploaded yet)'}

═══ LIFE QUESTION ANSWERS ═══

${answersContext || '(No answers filled in yet)'}

═══ END OF CONTEXT ═══

Now answer the question based solely on the above.`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// FUNCTION 5: cloneVoice
// HTTPS Callable — clones voice using ElevenLabs from audio file in Storage
// Returns: voiceId to save in user's avatar_config
// ═══════════════════════════════════════════════════════════════════════════════
export const cloneVoice = onCall(
  {
    secrets: [ELEVENLABS_API_KEY],
    timeoutSeconds: 300,
    memory: '1GiB',
  },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Must be authenticated.');

    const { audioStoragePath, voiceName } = request.data as {
      audioStoragePath: string;
      voiceName: string;
    };

    if (!audioStoragePath) throw new HttpsError('invalid-argument', 'audioStoragePath is required.');

    const uid = request.auth.uid;

    try {
      // 1. Download audio from Firebase Storage
      const bucket = gcs.bucket();
      const file   = bucket.file(audioStoragePath);
      const [buffer] = await file.download();
      const [meta]   = await file.getMetadata();
      const mimeType  = (meta.contentType as string) || 'audio/mp3';
      const fileName  = audioStoragePath.split('/').pop() || 'voice.mp3';

      // 2. Check if a voice already exists for this user — delete it first (free plan limit)
      const userConfigRef = db.collection('avatar_configs').doc(uid);
      const configSnap    = await userConfigRef.get();
      const existingVoiceId = configSnap.data()?.voiceId;

      if (existingVoiceId) {
        try {
          await fetch(`https://api.elevenlabs.io/v1/voices/${existingVoiceId}`, {
            method: 'DELETE',
            headers: { 'xi-api-key': ELEVENLABS_API_KEY.value() },
          });
          functions.logger.info(`🗑 Deleted old ElevenLabs voice: ${existingVoiceId}`);
        } catch (e) {
          functions.logger.warn('Could not delete old voice:', e);
        }
      }

      // 3. Upload to ElevenLabs Voice Clone API
      const formData = new FormData();
      formData.append('name', voiceName || `MEafterMe_${uid.slice(0, 8)}`);
      formData.append('description', 'Voice clone for MEafterMe digital avatar');
      const blob = new Blob([buffer as unknown as ArrayBuffer], { type: mimeType });
      formData.append('files', blob, fileName);

      const elResp = await fetch('https://api.elevenlabs.io/v1/voices/add', {
        method: 'POST',
        headers: { 'xi-api-key': ELEVENLABS_API_KEY.value() },
        body: formData,
      });

      if (!elResp.ok) {
        const errText = await elResp.text();
        throw new Error(`ElevenLabs error ${elResp.status}: ${errText.slice(0, 300)}`);
      }

      const elData = await elResp.json() as { voice_id: string };
      const voiceId = elData.voice_id;

      // 4. Save voiceId to Firestore avatar_config
      await userConfigRef.set({
        uid,
        voiceId,
        voiceStatus: 'ready',
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      functions.logger.info(`✅ Voice cloned for user ${uid}: voiceId=${voiceId}`);
      return { voiceId, status: 'ready' };

    } catch (err) {
      functions.logger.error('❌ Voice clone error:', err);
      // Save error status
      await db.collection('avatar_configs').doc(uid).set({
        voiceStatus: 'error',
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      throw new HttpsError('internal', `Voice clone failed: ${String(err)}`);
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// FUNCTION 7: pingAvatar — health check & API key diagnostics
// ═══════════════════════════════════════════════════════════════════════════════
export const pingAvatar = onCall(
  {
    secrets: [OPENAI_API_KEY, ANTHROPIC_API_KEY, ELEVENLABS_API_KEY, DID_API_KEY],
    timeoutSeconds: 30,
    memory: '256MiB',
  },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Must be authenticated.');

    const results: Record<string, string> = {};

    // Test OpenAI
    try {
      const k = OPENAI_API_KEY.value();
      if (!k) { results.openai = 'EMPTY KEY'; }
      else {
        const OpenAI = require('openai').default;
        const oa = new OpenAI({ apiKey: k });
        await oa.models.list();
        results.openai = 'OK';
      }
    } catch (e: any) { results.openai = `ERROR: ${String(e.message || e).slice(0, 150)}`; }

    // Test Anthropic
    try {
      const k = ANTHROPIC_API_KEY.value();
      if (!k) { results.anthropic = 'EMPTY KEY'; }
      else {
        const Anthropic = require('@anthropic-ai/sdk').default;
        const cl = new Anthropic({ apiKey: k });
        const r = await cl.messages.create({
          model: 'claude-haiku-4-5',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'ping' }],
        });
        results.anthropic = r.content.length > 0 ? 'OK' : 'NO RESPONSE';
      }
    } catch (e: any) { results.anthropic = `ERROR: ${String(e.message || e).slice(0, 150)}`; }

    // Test ElevenLabs
    try {
      const k = ELEVENLABS_API_KEY.value();
      if (!k) { results.elevenlabs = 'EMPTY KEY'; }
      else {
        const r = await fetch('https://api.elevenlabs.io/v1/user', {
          headers: { 'xi-api-key': k },
        });
        results.elevenlabs = r.ok ? 'OK' : `HTTP ${r.status}: ${await r.text().then(t => t.slice(0, 100))}`;
      }
    } catch (e: any) { results.elevenlabs = `ERROR: ${String(e.message || e).slice(0, 150)}`; }

    // Test D-ID
    try {
      const k = DID_API_KEY.value();
      if (!k) { results.did = 'EMPTY KEY'; }
      else {
        // D-ID key format is already "API_USER:API_PASSWORD" — use directly as Basic auth value
        const r = await fetch('https://api.d-id.com/talks?limit=1', {
          headers: { 'Authorization': `Basic ${k}`, 'Accept': 'application/json' },
        });
        results.did = r.ok ? 'OK' : `HTTP ${r.status}: ${await r.text().then(t => t.slice(0, 100))}`;
      }
    } catch (e: any) { results.did = `ERROR: ${String(e.message || e).slice(0, 150)}`; }

    functions.logger.info('[pingAvatar] Diagnostics:', results);
    return { status: 'checked', results };
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// FUNCTION 6: generateAvatarVideo
// HTTPS Callable — main pipeline:
//   1. Get answer text from Claude (RAG-based, with graceful fallback)
//   2. Generate audio via ElevenLabs with cloned voice
//   3. Upload audio to Firebase Storage
//   4. Send photo + audio to D-ID to create talking avatar video
//   5. Return video URL — OR text-only answer if video pipeline fails
// ═══════════════════════════════════════════════════════════════════════════════
export const generateAvatarVideo = onCall(
  {
    secrets: [OPENAI_API_KEY, ANTHROPIC_API_KEY, ELEVENLABS_API_KEY, DID_API_KEY],
    timeoutSeconds: 240,
    memory: '512MiB',
  },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Must be authenticated.');

    const {
      question,
      ownerUid,
      ownerName = 'this person',
      language  = 'bg',
    } = request.data as {
      question:   string;
      ownerUid:   string;
      ownerName?: string;
      language?:  string;
    };

    if (!question?.trim()) throw new HttpsError('invalid-argument', 'Question is required.');
    if (!ownerUid)          throw new HttpsError('invalid-argument', 'ownerUid is required.');

    const viewerUid = request.auth.uid;
    const isOwner   = viewerUid === ownerUid;

    if (!isOwner) {
      const viewerEmail = request.auth.token.email || '';
      const shareSnap = await db.collection('profile_shares')
        .where('ownerUid', '==', ownerUid)
        .where('sharedWithEmail', '==', viewerEmail.toLowerCase())
        .limit(1)
        .get();
      if (shareSnap.empty) throw new HttpsError('permission-denied', 'Access denied.');
    }

    // ── Load avatar config ────────────────────────────────────────────────────
    const configSnap = await db.collection('avatar_configs').doc(ownerUid).get();
    const config     = configSnap.data();

    if (!config?.voiceId || !config?.photoUrl) {
      throw new HttpsError('failed-precondition',
        'Avatar not configured. Please set up photos and clone your voice first.');
    }

    const voiceId  = config.voiceId  as string;
    const photoUrl = config.photoUrl as string;

    // ── Step 1: Get text answer via RAG ───────────────────────────────────────
    let answerText = '';
    try {
      // Load answers from Firestore (no API needed)
      const answersSnap = await db.collection('answers').where('uid', '==', ownerUid).get();
      const answersContext = answersSnap.docs
        .map(d => d.data())
        .filter(d => d.answer?.trim())
        .map(d => `Q${d.questionId}: ${d.answer}`)
        .join('\n');

      // Try vector search with OpenAI embeddings
      let context = '';
      try {
        const openaiKey = OPENAI_API_KEY.value();
        if (openaiKey) {
          const [qEmb] = await getEmbeddings([question], openaiKey);
          const vectorSnap = await db.collection('vectors').where('uid', '==', ownerUid).get();
          if (!vectorSnap.empty) {
            const scored = vectorSnap.docs.map(doc => {
              const d = doc.data() as VectorDoc;
              return { ...d, score: cosineSimilarity(qEmb, d.embedding) };
            });
            scored.sort((a, b) => b.score - a.score);
            const top = scored.slice(0, 5).filter(c => c.score > 0.3);
            context = top.map((c, i) => `[${i+1} — ${c.fileName}]\n${c.chunkText}`).join('\n\n---\n\n');
          }
        }
      } catch (embErr) {
        functions.logger.warn('[generateAvatarVideo] Embeddings failed, continuing without vector context:', String(embErr));
      }

      const systemPrompt = language === 'bg'
        ? buildSystemPromptBG(ownerName, context, answersContext)
        : buildSystemPromptEN(ownerName, context, answersContext);

      const anthropicKey = ANTHROPIC_API_KEY.value();
      if (!anthropicKey) throw new Error('ANTHROPIC_API_KEY secret is empty');

      const Anthropic = require('@anthropic-ai/sdk').default;
      const claude    = new Anthropic({ apiKey: anthropicKey });
      const message   = await claude.messages.create({
        model:      'claude-haiku-4-5',
        max_tokens: 500,
        system:     systemPrompt,
        messages:   [{ role: 'user', content: question }],
      });
      answerText = (message.content[0] as { type: string; text: string }).text;
      functions.logger.info('[generateAvatarVideo] Step 1 RAG OK, answer length:', answerText.length);
    } catch (err: any) {
      const msg = String(err?.message || err);
      functions.logger.error('[generateAvatarVideo] Step 1 RAG FAILED:', msg);
      throw new HttpsError('internal', `Step 1 (RAG/Claude) failed: ${msg.slice(0, 300)}`);
    }

    // ── Step 2: Generate audio with ElevenLabs ────────────────────────────────
    let audioBase64 = '';
    try {
      const elKey = ELEVENLABS_API_KEY.value();
      if (!elKey) throw new Error('ELEVENLABS_API_KEY secret is empty');

      const ttsResp = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        {
          method:  'POST',
          headers: {
            'xi-api-key':   elKey,
            'Content-Type': 'application/json',
            'Accept':       'audio/mpeg',
          },
          body: JSON.stringify({
            text:           answerText,
            model_id:       'eleven_multilingual_v2',
            voice_settings: { stability: 0.5, similarity_boost: 0.85, style: 0.2 },
          }),
        }
      );

      if (!ttsResp.ok) {
        const errText = await ttsResp.text();
        throw new Error(`ElevenLabs HTTP ${ttsResp.status}: ${errText.slice(0, 200)}`);
      }

      audioBase64 = Buffer.from(await ttsResp.arrayBuffer()).toString('base64');
      functions.logger.info('[generateAvatarVideo] Step 2 ElevenLabs TTS OK');
    } catch (err: any) {
      const msg = String(err?.message || err);
      functions.logger.error('[generateAvatarVideo] Step 2 ElevenLabs FAILED:', msg);
      // GRACEFUL FALLBACK: return text answer without video
      return { videoUrl: '', answerText, talkId: '', fallback: true, failStep: `Step 2 (ElevenLabs): ${msg.slice(0, 200)}` };
    }

    // ── Step 3: Upload audio to Firebase Storage ──────────────────────────────
    let audioUrl = '';
    try {
      const bucket    = gcs.bucket();
      const audioPath = `avatar_audio/${ownerUid}/${Date.now()}.mp3`;
      const audioFile = bucket.file(audioPath);
      await audioFile.save(Buffer.from(audioBase64, 'base64'), {
        contentType: 'audio/mpeg',
        metadata: { cacheControl: 'public, max-age=300' },
      });
      await audioFile.makePublic();
      audioUrl = `https://storage.googleapis.com/${bucket.name}/${audioPath}`;
      functions.logger.info('[generateAvatarVideo] Step 3 Audio uploaded:', audioUrl);
    } catch (err: any) {
      const msg = String(err?.message || err);
      functions.logger.error('[generateAvatarVideo] Step 3 Storage upload FAILED:', msg);
      return { videoUrl: '', answerText, talkId: '', fallback: true, failStep: `Step 3 (Storage): ${msg.slice(0, 200)}` };
    }

    // ── Step 4: Create D-ID talking avatar video ──────────────────────────────
    let videoUrl = '';
    try {
      const didKey = DID_API_KEY.value();
      if (!didKey) throw new Error('DID_API_KEY secret is empty');

      // D-ID key format: "API_USER:API_PASSWORD" — already correct for Basic auth, use directly
      const didAuth = didKey;

      const createResp = await fetch('https://api.d-id.com/talks', {
        method:  'POST',
        headers: {
          'Authorization': `Basic ${didAuth}`,
          'Content-Type':  'application/json',
          'Accept':        'application/json',
        },
        body: JSON.stringify({
          source_url: photoUrl,
          script: { type: 'audio', audio_url: audioUrl },
          config:  { fluent: true, pad_audio: 0.5, stitch: true },
        }),
      });

      if (!createResp.ok) {
        const errText = await createResp.text();
        throw new Error(`D-ID create HTTP ${createResp.status}: ${errText.slice(0, 300)}`);
      }

      const createData = await createResp.json() as { id: string; status: string };
      const talkId     = createData.id;
      functions.logger.info('[generateAvatarVideo] D-ID talk created:', talkId);

      // Poll for completion
      let attempts = 0;
      const MAX_ATTEMPTS = 40; // 40 × 3s = 120s max

      while (attempts < MAX_ATTEMPTS) {
        await new Promise(r => setTimeout(r, 3000));
        attempts++;

        const pollResp = await fetch(`https://api.d-id.com/talks/${talkId}`, {
          headers: { 'Authorization': `Basic ${didAuth}`, 'Accept': 'application/json' },
        });

        if (!pollResp.ok) continue;

        const pollData = await pollResp.json() as {
          status: string; result_url?: string; error?: { description: string };
        };

        functions.logger.info(`[generateAvatarVideo] D-ID poll ${attempts}: ${pollData.status}`);

        if (pollData.status === 'done' && pollData.result_url) {
          videoUrl = pollData.result_url;
          break;
        }
        if (pollData.status === 'error') {
          throw new Error(`D-ID error: ${pollData.error?.description || 'unknown'}`);
        }
      }

      if (!videoUrl) throw new Error('D-ID timed out after 120s.');

    } catch (err: any) {
      const msg = String(err?.message || err);
      functions.logger.error('[generateAvatarVideo] Step 4 D-ID FAILED:', msg);
      // GRACEFUL FALLBACK: return text answer without video
      return { videoUrl: '', answerText, talkId: '', fallback: true, failStep: `Step 4 (D-ID): ${msg.slice(0, 200)}` };
    }

    functions.logger.info(`[generateAvatarVideo] ✅ Complete for ${ownerUid}: ${videoUrl}`);
    return { videoUrl, answerText, talkId: videoUrl.split('/').slice(-2, -1)[0] || '', fallback: false };
  }
);

