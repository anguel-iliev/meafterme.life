/**
 * MEafterMe — Firebase Cloud Functions
 * RAG Pipeline: Index → Chunk → Embed → Store → Query → Answer
 *
 * Functions exported:
 *  1. onMemoryUploaded   — Firestore trigger: indexes a file when memory doc is created
 *  2. queryAvatar        — HTTPS callable: vector search + Claude streaming answer
 *  3. transcribeAudio    — HTTPS callable: transcribes audio/video via OpenAI Whisper
 *  4. deleteVectorIndex  — Firestore trigger: cleans up vectors when memory is deleted
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
const OPENAI_API_KEY    = defineSecret('OPENAI_API_KEY');
const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');

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
      ownerUid,        // whose profile to query
      ownerName = 'this person',
      language  = 'bg', // 'bg' or 'en'
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
    // Allow: owner themselves OR someone with a profile_share
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

    // ── Step 1: Embed the question ─────────────────────────────────────────────
    const [questionEmbedding] = await getEmbeddings([question], OPENAI_API_KEY.value());

    // ── Step 2: Load all vectors for this owner ────────────────────────────────
    const vectorSnap = await db.collection('vectors')
      .where('uid', '==', ownerUid)
      .get();

    if (vectorSnap.empty) {
      return {
        answer: language === 'bg'
          ? 'Все още няма качено съдържание в този профил, върху което да базирам отговора си.'
          : 'There is no uploaded content in this profile yet to base my answer on.',
        context: [],
        chunks:  0,
      };
    }

    // ── Step 3: Cosine similarity ranking ─────────────────────────────────────
    const scored = vectorSnap.docs.map(doc => {
      const d = doc.data() as VectorDoc;
      return { ...d, score: cosineSimilarity(questionEmbedding, d.embedding) };
    });

    scored.sort((a, b) => b.score - a.score);
    const topChunks = scored.slice(0, topK).filter(c => c.score > 0.3);

    // ── Step 4: Build context ─────────────────────────────────────────────────
    const context = topChunks.map((c, i) =>
      `[Source ${i + 1} — ${c.fileName}]\n${c.chunkText}`
    ).join('\n\n---\n\n');

    // ── Step 5: Also load life-question answers ───────────────────────────────
    const answersSnap = await db.collection('answers')
      .where('uid', '==', ownerUid)
      .get();
    const answersContext = answersSnap.docs
      .map(d => d.data())
      .filter(d => d.answer?.trim())
      .map(d => `Q${d.questionId}: ${d.answer}`)
      .join('\n');

    // ── Step 6: Constraint-based system prompt ────────────────────────────────
    const systemPrompt = language === 'bg'
      ? buildSystemPromptBG(ownerName, context, answersContext)
      : buildSystemPromptEN(ownerName, context, answersContext);

    // ── Step 7: Call Claude ───────────────────────────────────────────────────
    const Anthropic = require('@anthropic-ai/sdk').default;
    const claude    = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() });

    const message = await claude.messages.create({
      model:      'claude-3-5-haiku-20241022', // fast + cheap; upgrade to sonnet for quality
      max_tokens: 1024,
      system:     systemPrompt,
      messages:   [{ role: 'user', content: question }],
    });

    const answer = (message.content[0] as { type: string; text: string }).text;

    return {
      answer,
      context: topChunks.map(c => ({ file: c.fileName, score: Math.round(c.score * 100) / 100, snippet: c.chunkText.slice(0, 120) + '…' })),
      chunks:  topChunks.length,
    };
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
