/**
 * MEafterMe — Firebase Cloud Functions
 * RAG Pipeline: Index → Chunk → Embed → Store → Query → Answer
 * Version: 2.0 — onRequest architecture (bypasses Cloud Run IAM CORS issue)
 *
 * ARCHITECTURE CHANGE v2.0:
 *   queryAvatar, generateAvatarVideo, cloneVoice, pingAvatar
 *   converted from onCall → onRequest with:
 *     - Explicit CORS headers (all origins allowed)
 *     - Manual Firebase Auth token verification
 *   This completely bypasses the Cloud Run IAM allUsers invoker requirement
 *   that was blocking OPTIONS preflight requests.
 *
 * Functions exported:
 *  1. onMemoryUploaded    — Firestore trigger: indexes a file when memory doc is created
 *  2. queryAvatar         — HTTPS onRequest: vector search + Claude answer (Anthropic)
 *  3. transcribeAudio     — HTTPS onCall: transcribes audio/video via OpenAI Whisper
 *  4. deleteVectorIndex   — Firestore trigger: cleans up vectors when memory is deleted
 *  5. cloneVoice          — HTTPS onRequest: clones user voice via ElevenLabs
 *  6. generateAvatarVideo — HTTPS onRequest: RAG + Claude + ElevenLabs + D-ID video
 *  7. pingAvatar          — HTTPS onRequest: health check / API key diagnostics
 */

import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { getAuth } from 'firebase-admin/auth';
import { defineSecret } from 'firebase-functions/params';
import * as functions from 'firebase-functions/v2';
import { onDocumentCreated, onDocumentDeleted } from 'firebase-functions/v2/firestore';
import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import type { Request, Response } from 'express';

// ─── Init ─────────────────────────────────────────────────────────────────────
initializeApp();
const db   = getFirestore();
const gcs  = getStorage();
const auth = getAuth();

// ─── Secrets ──────────────────────────────────────────────────────────────────
const OPENAI_API_KEY      = defineSecret('OPENAI_API_KEY');
const ANTHROPIC_API_KEY   = defineSecret('ANTHROPIC_API_KEY');
const ELEVENLABS_API_KEY  = defineSecret('ELEVENLABS_API_KEY');
const DID_API_KEY         = defineSecret('DID_API_KEY');

// ─── Chunking config ──────────────────────────────────────────────────────────
const CHUNK_SIZE    = 500;
const CHUNK_OVERLAP = 100;
const MAX_CHUNKS    = 200;

// ─── Types ────────────────────────────────────────────────────────────────────
interface VectorDoc {
  uid:        string;
  memoryId:   string;
  fileName:   string;
  chunkIndex: number;
  chunkText:  string;
  embedding:  number[];
  createdAt:  FirebaseFirestore.FieldValue;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CORS HELPER — sets CORS headers for all onRequest handlers
// Allows all origins (security enforced via Firebase Auth token verification)
// ═══════════════════════════════════════════════════════════════════════════════
function setCORSHeaders(req: Request, res: Response): boolean {
  const origin = req.headers.origin || '*';
  res.set('Access-Control-Allow-Origin', origin);
  res.set('Access-Control-Allow-Credentials', 'true');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-goog-request-params, x-goog-api-client');
  res.set('Access-Control-Max-Age', '3600');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return true; // preflight handled
  }
  return false;
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTH HELPER — verifies Firebase ID token from Authorization header
// Returns decoded token or null
// ═══════════════════════════════════════════════════════════════════════════════
async function verifyFirebaseToken(req: Request): Promise<{ uid: string; email: string } | null> {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) return null;
  try {
    const decoded = await auth.verifyIdToken(token);
    return { uid: decoded.uid, email: decoded.email || '' };
  } catch {
    return null;
  }
}

// ─── JSON response helpers ────────────────────────────────────────────────────
function sendOK(res: Response, data: unknown) {
  res.status(200).json({ result: data });
}
function sendError(res: Response, code: number, message: string) {
  res.status(code).json({ error: { message, status: code } });
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
  return chunks.filter(c => c.length > 30);
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY: Extract text from Firebase Storage
// ═══════════════════════════════════════════════════════════════════════════════
async function extractTextFromStorage(storagePath: string, mimeType: string): Promise<string> {
  const bucket = gcs.bucket();
  const file   = bucket.file(storagePath);
  const [buffer] = await file.download();

  if (mimeType === 'application/pdf') {
    const pdfParse = require('pdf-parse') as (b: Buffer) => Promise<{ text: string }>;
    const result = await pdfParse(buffer);
    return result.text;
  }
  if (mimeType.includes('word') || mimeType.includes('openxmlformats')) {
    const mammoth = require('mammoth') as { extractRawText: (o: { buffer: Buffer }) => Promise<{ value: string }> };
    const result  = await mammoth.extractRawText({ buffer });
    return result.value;
  }
  if (mimeType.startsWith('text/')) {
    return buffer.toString('utf-8');
  }
  return '';
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY: Get OpenAI embeddings
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
// UTILITY: Cosine similarity
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
// SYSTEM PROMPTS
// ═══════════════════════════════════════════════════════════════════════════════
function buildSystemPromptBG(ownerName: string, memoryContext: string, answersContext: string): string {
  return `Ти си дигиталният аватар на ${ownerName}. Говориш от ПЪРВО лице — като самия него/нея.

═══ ЗАДЪЛЖИТЕЛНИ ПРАВИЛА ═══

ПРАВИЛО 1: Можеш да отговаряш ЕДИНСТВЕНО въз основа на предоставените спомени и отговори.
Ако в контекста няма информация — кажи го честно. НИКОГА не измисляй.

ПРАВИЛО 2: Когато нямаш информация, отговори с топлина:
"Не съм оставил/а спомен за това, но знам, че е важно за теб."

ПРАВИЛО 3: Говори от ПЪРВО лице ("аз", "моят", "бях", "помня"). Бъди топъл/а и автентичен/на.

═══ КОНТЕКСТ ОТ СПОМЕНИТЕ ═══
${memoryContext || '(Все още няма качени файлове)'}

═══ ОТГОВОРИ НА ЖИТЕЙСКИ ВЪПРОСИ ═══
${answersContext || '(Все още няма попълнени отговори)'}

═══ КРАЙ НА КОНТЕКСТА ═══
Сега отговори само въз основа на горното.`;
}

function buildSystemPromptEN(ownerName: string, memoryContext: string, answersContext: string): string {
  return `You are the digital avatar of ${ownerName}. You speak in the FIRST PERSON.

═══ MANDATORY RULES ═══

RULE 1: Answer ONLY based on the memories and answers provided. If no info exists — say so honestly. NEVER invent.

RULE 2: When you have no information, respond warmly:
"I haven't left a memory about that, but I know it matters to you."

RULE 3: Speak in FIRST PERSON ("I", "my", "I was", "I remember"). Be warm and authentic.

═══ CONTEXT FROM MEMORIES ═══
${memoryContext || '(No files uploaded yet)'}

═══ LIFE QUESTION ANSWERS ═══
${answersContext || '(No answers filled in yet)'}

═══ END OF CONTEXT ═══
Now answer based solely on the above.`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// FUNCTION 1: onMemoryUploaded — Firestore trigger
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

    const data        = snap.data();
    const memoryId    = event.params.memoryId;
    const uid         = data.uid         as string;
    const storagePath = data.storagePath as string;
    const mimeType    = data.mimeType    as string || '';
    const fileName    = data.name        as string || 'file';
    const description = data.description as string || '';

    await snap.ref.update({ indexed: false, indexStatus: 'processing' });

    try {
      let text = '';
      if (mimeType.startsWith('audio/') || mimeType.startsWith('video/')) {
        text = description;
        await snap.ref.update({ indexStatus: 'needs_transcription' });
      } else if (storagePath) {
        text = await extractTextFromStorage(storagePath, mimeType);
      }

      const fullText = [description, text].filter(Boolean).join('\n\n');
      if (!fullText.trim()) {
        await snap.ref.update({ indexed: true, indexStatus: 'no_text' });
        return;
      }

      const chunks = chunkText(fullText);
      if (chunks.length === 0) {
        await snap.ref.update({ indexed: true, indexStatus: 'no_chunks' });
        return;
      }

      const apiKey     = OPENAI_API_KEY.value();
      const embeddings = await getEmbeddings(chunks, apiKey);

      const batch = db.batch();
      chunks.forEach((chunk, i) => {
        const vecRef = db.collection('vectors').doc();
        batch.set(vecRef, {
          uid, memoryId, fileName,
          chunkIndex: i,
          chunkText:  chunk,
          embedding:  embeddings[i],
          createdAt:  FieldValue.serverTimestamp(),
        } as VectorDoc);
      });
      await batch.commit();

      await snap.ref.update({
        indexed:    true,
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
// FUNCTION 2: deleteVectorIndex — Firestore trigger
// ═══════════════════════════════════════════════════════════════════════════════
export const deleteVectorIndex = onDocumentDeleted(
  { document: 'memories/{memoryId}' },
  async (event) => {
    const memoryId = event.params.memoryId;
    const snap = await db.collection('vectors').where('memoryId', '==', memoryId).get();
    const batch = db.batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    functions.logger.info(`🗑 Deleted ${snap.docs.length} vectors for memory ${memoryId}`);
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// FUNCTION 3: transcribeAudio — HTTPS onCall
// (Kept as onCall — used from AvatarSetup which already handles auth via SDK)
// ═══════════════════════════════════════════════════════════════════════════════
export const transcribeAudio = onCall(
  {
    secrets: [OPENAI_API_KEY],
    timeoutSeconds: 300,
    memory: '1GiB',
    cors: true,
  },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Must be authenticated.');

    const { memoryId, storagePath } = request.data as { memoryId: string; storagePath: string };
    if (!memoryId || !storagePath) throw new HttpsError('invalid-argument', 'memoryId and storagePath required.');

    const memRef  = db.collection('memories').doc(memoryId);
    const memSnap = await memRef.get();
    if (!memSnap.exists || memSnap.data()?.uid !== request.auth.uid) {
      throw new HttpsError('permission-denied', 'Not your memory.');
    }

    try {
      const bucket = gcs.bucket();
      const file   = bucket.file(storagePath);
      const [buffer] = await file.download();
      const [meta]   = await file.getMetadata();
      const mimeType  = (meta.contentType as string) || 'audio/mp3';

      const OpenAI = require('openai').default;
      const openai  = new OpenAI({ apiKey: OPENAI_API_KEY.value() });

      const { Blob } = require('buffer');
      const blob     = new Blob([buffer], { type: mimeType });
      const fileName  = storagePath.split('/').pop() || 'audio.mp3';

      const transcription = await openai.audio.transcriptions.create({
        file:  new File([blob], fileName, { type: mimeType }),
        model: 'whisper-1',
        language: 'bg',
      });

      const transcriptText = transcription.text;

      await memRef.update({ transcript: transcriptText, indexStatus: 'transcribed' });

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
        indexed:    true,
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
// FUNCTION 4: queryAvatar — HTTPS onRequest (replaces onCall for CORS fix)
//
// POST /queryAvatar
// Headers: Authorization: Bearer <firebase-id-token>
// Body: { question, ownerUid, ownerName?, language?, topK? }
// Response: { result: { answer, context, chunks } }
// ═══════════════════════════════════════════════════════════════════════════════
export const queryAvatar = onRequest(
  {
    secrets: [OPENAI_API_KEY, ANTHROPIC_API_KEY],
    timeoutSeconds: 120,
    memory: '256MiB',
    invoker: 'public',
  },
  async (req: Request, res: Response) => {
    if (setCORSHeaders(req, res)) return;

    const user = await verifyFirebaseToken(req);
    if (!user) return sendError(res, 401, 'Unauthenticated. Firebase ID token required.');

    const {
      question,
      ownerUid,
      ownerName = 'this person',
      language  = 'bg',
      topK      = 6,
    } = req.body as {
      question:  string;
      ownerUid:  string;
      ownerName?: string;
      language?:  string;
      topK?:      number;
    };

    if (!question?.trim()) return sendError(res, 400, 'Question is required.');
    if (!ownerUid)          return sendError(res, 400, 'ownerUid is required.');

    const viewerUid   = user.uid;
    const viewerEmail = user.email;
    const isOwner     = viewerUid === ownerUid;

    if (!isOwner) {
      const shareSnap = await db.collection('profile_shares')
        .where('ownerUid', '==', ownerUid)
        .where('sharedWithEmail', '==', viewerEmail.toLowerCase())
        .limit(1)
        .get();
      if (shareSnap.empty) return sendError(res, 403, 'Access denied.');
    }

    // Load life-question answers
    const answersSnap = await db.collection('answers').where('uid', '==', ownerUid).get();
    const answersContext = answersSnap.docs
      .map(d => d.data())
      .filter(d => d.answer?.trim())
      .map(d => `Q${d.questionId}: ${d.answer}`)
      .join('\n');

    // Vector search
    let context = '';
    let topChunks: Array<{ fileName: string; chunkText: string; score: number }> = [];

    try {
      const openaiKey = OPENAI_API_KEY.value();
      if (openaiKey) {
        const [questionEmbedding] = await getEmbeddings([question], openaiKey);
        const vectorSnap = await db.collection('vectors').where('uid', '==', ownerUid).get();

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
        }
      }
    } catch (embErr) {
      functions.logger.warn('[queryAvatar] Embeddings failed, continuing without vector context:', String(embErr));
    }

    if (!context && !answersContext) {
      return sendOK(res, {
        answer: language === 'bg'
          ? 'Все още няма качено съдържание в този профил.'
          : 'There is no uploaded content in this profile yet.',
        context: [],
        chunks: 0,
      });
    }

    const systemPrompt = language === 'bg'
      ? buildSystemPromptBG(ownerName, context, answersContext)
      : buildSystemPromptEN(ownerName, context, answersContext);

    try {
      const anthropicKey = ANTHROPIC_API_KEY.value();
      if (!anthropicKey) return sendError(res, 500, 'ANTHROPIC_API_KEY is not configured.');

      const Anthropic = require('@anthropic-ai/sdk').default;
      const claude    = new Anthropic({ apiKey: anthropicKey });

      const message = await claude.messages.create({
        model:      'claude-haiku-4-5',
        max_tokens: 1024,
        system:     systemPrompt,
        messages:   [{ role: 'user', content: question }],
      });

      const answer = (message.content[0] as { type: string; text: string }).text;
      functions.logger.info(`[queryAvatar] OK — chunks=${topChunks.length}`);

      return sendOK(res, {
        answer,
        context: topChunks.map(c => ({ file: c.fileName, score: Math.round(c.score * 100) / 100, snippet: c.chunkText.slice(0, 120) + '…' })),
        chunks:  topChunks.length,
      });
    } catch (claudeErr: any) {
      const msg = String(claudeErr?.message || claudeErr);
      functions.logger.error('[queryAvatar] Claude failed:', msg);
      return sendError(res, 500, `Claude API error: ${msg.slice(0, 300)}`);
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// FUNCTION 5: cloneVoice — HTTPS onRequest (replaces onCall for CORS fix)
//
// POST /cloneVoice
// Headers: Authorization: Bearer <firebase-id-token>
// Body: { audioStoragePath, voiceName? }
// Response: { result: { voiceId, status } }
// ═══════════════════════════════════════════════════════════════════════════════
export const cloneVoice = onRequest(
  {
    secrets: [ELEVENLABS_API_KEY],
    timeoutSeconds: 300,
    memory: '1GiB',
    invoker: 'public',
  },
  async (req: Request, res: Response) => {
    if (setCORSHeaders(req, res)) return;

    const user = await verifyFirebaseToken(req);
    if (!user) return sendError(res, 401, 'Unauthenticated.');

    const { audioStoragePath, voiceName } = req.body as {
      audioStoragePath: string;
      voiceName?: string;
    };

    if (!audioStoragePath) return sendError(res, 400, 'audioStoragePath is required.');

    const uid = user.uid;

    try {
      const bucket = gcs.bucket();
      const file   = bucket.file(audioStoragePath);
      const [buffer] = await file.download();
      const [meta]   = await file.getMetadata();
      const mimeType  = (meta.contentType as string) || 'audio/mp3';
      const fileName  = audioStoragePath.split('/').pop() || 'voice.mp3';

      const userConfigRef = db.collection('avatar_configs').doc(uid);
      const configSnap    = await userConfigRef.get();
      const existingVoiceId = configSnap.data()?.voiceId;

      if (existingVoiceId) {
        try {
          await fetch(`https://api.elevenlabs.io/v1/voices/${existingVoiceId}`, {
            method: 'DELETE',
            headers: { 'xi-api-key': ELEVENLABS_API_KEY.value() },
          });
        } catch (e) {
          functions.logger.warn('Could not delete old voice:', e);
        }
      }

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

      await userConfigRef.set({
        uid,
        voiceId,
        voiceStatus: 'ready',
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      functions.logger.info(`✅ Voice cloned for user ${uid}: voiceId=${voiceId}`);
      return sendOK(res, { voiceId, status: 'ready' });

    } catch (err) {
      functions.logger.error('❌ Voice clone error:', err);
      await db.collection('avatar_configs').doc(uid).set({
        voiceStatus: 'error',
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      return sendError(res, 500, `Voice clone failed: ${String(err)}`);
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// FUNCTION 6: generateAvatarVideo — HTTPS onRequest (replaces onCall for CORS fix)
//
// POST /generateAvatarVideo
// Headers: Authorization: Bearer <firebase-id-token>
// Body: { question, ownerUid, ownerName?, language? }
// Response: { result: { videoUrl, answerText, talkId, fallback, failStep? } }
// ═══════════════════════════════════════════════════════════════════════════════
export const generateAvatarVideo = onRequest(
  {
    secrets: [OPENAI_API_KEY, ANTHROPIC_API_KEY, ELEVENLABS_API_KEY, DID_API_KEY],
    timeoutSeconds: 300,
    memory: '512MiB',
    invoker: 'public',
  },
  async (req: Request, res: Response) => {
    if (setCORSHeaders(req, res)) return;

    const user = await verifyFirebaseToken(req);
    if (!user) return sendError(res, 401, 'Unauthenticated. Firebase ID token required.');

    const {
      question,
      ownerUid,
      ownerName = 'this person',
      language  = 'bg',
    } = req.body as {
      question:   string;
      ownerUid:   string;
      ownerName?: string;
      language?:  string;
    };

    if (!question?.trim()) return sendError(res, 400, 'Question is required.');
    if (!ownerUid)          return sendError(res, 400, 'ownerUid is required.');

    const viewerUid = user.uid;
    const isOwner   = viewerUid === ownerUid;

    if (!isOwner) {
      const shareSnap = await db.collection('profile_shares')
        .where('ownerUid', '==', ownerUid)
        .where('sharedWithEmail', '==', user.email.toLowerCase())
        .limit(1)
        .get();
      if (shareSnap.empty) return sendError(res, 403, 'Access denied.');
    }

    // Load avatar config
    const configSnap = await db.collection('avatar_configs').doc(ownerUid).get();
    const config     = configSnap.data();

    functions.logger.info('[generateAvatarVideo] Config:', {
      hasVoiceId:  !!config?.voiceId,
      hasPhotoUrl: !!config?.photoUrl,
      voiceStatus: config?.voiceStatus,
    });

    if (!config?.voiceId || !config?.photoUrl) {
      return sendError(res, 412, 'Avatar not configured. Please set up photos and clone your voice first.');
    }

    const voiceId  = config.voiceId  as string;
    const photoUrl = config.photoUrl as string;

    functions.logger.info('[generateAvatarVideo] Starting pipeline for uid:', ownerUid);

    // ── Step 1: Get text answer via RAG ───────────────────────────────────────
    let answerText = '';
    try {
      const answersSnap = await db.collection('answers').where('uid', '==', ownerUid).get();
      const answersContext = answersSnap.docs
        .map(d => d.data())
        .filter(d => d.answer?.trim())
        .map(d => `Q${d.questionId}: ${d.answer}`)
        .join('\n');

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
        functions.logger.warn('[generateAvatarVideo] Embeddings failed, continuing:', String(embErr));
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
        max_tokens: 400,
        system:     systemPrompt,
        messages:   [{ role: 'user', content: question }],
      });
      answerText = (message.content[0] as { type: string; text: string }).text;
      if (answerText.length > 900) answerText = answerText.slice(0, 897) + '...';
      functions.logger.info('[generateAvatarVideo] Step 1 OK, answer length:', answerText.length);
    } catch (err: any) {
      const msg = String(err?.message || err);
      functions.logger.error('[generateAvatarVideo] Step 1 FAILED:', msg);
      return sendError(res, 500, `Step 1 (RAG/Claude) failed: ${msg.slice(0, 300)}`);
    }

    // ── Step 2: Generate audio with ElevenLabs ────────────────────────────────
    let audioBase64 = '';
    try {
      const elKey = ELEVENLABS_API_KEY.value();
      if (!elKey) throw new Error('ELEVENLABS_API_KEY secret is empty');

      functions.logger.info('[generateAvatarVideo] Step 2 TTS: voiceId=', voiceId);

      const ttsResp = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        {
          method: 'POST',
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
        throw new Error(`ElevenLabs HTTP ${ttsResp.status}: ${errText.slice(0, 300)}`);
      }

      audioBase64 = Buffer.from(await ttsResp.arrayBuffer()).toString('base64');
      functions.logger.info('[generateAvatarVideo] Step 2 TTS OK, audioBase64 length:', audioBase64.length);
    } catch (err: any) {
      const msg = String(err?.message || err);
      functions.logger.error('[generateAvatarVideo] Step 2 ElevenLabs FAILED:', msg);
      return sendOK(res, { videoUrl: '', answerText, talkId: '', fallback: true, failStep: `Step 2 (ElevenLabs): ${msg.slice(0, 300)}` });
    }

    // ── Step 3: Upload audio to Firebase Storage ──────────────────────────────
    let audioUrl = '';
    try {
      const bucket    = gcs.bucket();
      const audioPath = `avatar_audio/${ownerUid}/${Date.now()}.mp3`;
      const audioFile = bucket.file(audioPath);
      await audioFile.save(Buffer.from(audioBase64, 'base64'), {
        contentType: 'audio/mpeg',
        metadata: { cacheControl: 'public, max-age=3600' },
      });

      const [signedAudioUrl] = await audioFile.getSignedUrl({
        action:  'read',
        expires: Date.now() + 2 * 60 * 60 * 1000,
      });
      audioUrl = signedAudioUrl;
      functions.logger.info('[generateAvatarVideo] Step 3 Audio uploaded, signed URL length:', audioUrl.length);
    } catch (err: any) {
      const msg = String(err?.message || err);
      functions.logger.error('[generateAvatarVideo] Step 3 Storage FAILED:', msg);
      return sendOK(res, { videoUrl: '', answerText, talkId: '', fallback: true, failStep: `Step 3 (Storage): ${msg.slice(0, 200)}` });
    }

    // ── Step 3b: Get accessible photo URL for D-ID ────────────────────────────
    let publicPhotoUrl = photoUrl;
    try {
      const bucket2 = gcs.bucket();
      let storagePath = '';

      if (photoUrl.startsWith('gs://')) {
        storagePath = photoUrl.replace(`gs://${bucket2.name}/`, '');
      } else if (photoUrl.includes('firebasestorage.googleapis.com')) {
        const match = photoUrl.match(/\/o\/([^?]+)/);
        storagePath = match ? decodeURIComponent(match[1]) : '';
      } else if (photoUrl.includes('storage.googleapis.com')) {
        const match = photoUrl.match(/storage\.googleapis\.com\/[^/]+\/(.+)/);
        storagePath = match ? match[1] : '';
      }

      if (storagePath) {
        const photoFile = bucket2.file(storagePath);
        const [signedPhotoUrl] = await photoFile.getSignedUrl({
          action:  'read',
          expires: Date.now() + 2 * 60 * 60 * 1000,
        });
        publicPhotoUrl = signedPhotoUrl;
        functions.logger.info('[generateAvatarVideo] Step 3b Photo signed URL obtained');
      }
    } catch (photoErr: any) {
      functions.logger.warn('[generateAvatarVideo] Step 3b Photo URL fix failed, using original:', String(photoErr?.message));
    }

    // ── Step 4: Create D-ID talking avatar video ──────────────────────────────
    let videoUrl = '';
    let usedAuthKey = '';
    try {
      const didKey = DID_API_KEY.value();
      if (!didKey) throw new Error('DID_API_KEY secret is empty');

      functions.logger.info('[generateAvatarVideo] Step 4 D-ID start');
      functions.logger.info('[generateAvatarVideo] DID_API_KEY length:', didKey.length, 'has colon:', didKey.includes(':'));
      functions.logger.info('[generateAvatarVideo] publicPhotoUrl starts:', publicPhotoUrl.slice(0, 80));
      functions.logger.info('[generateAvatarVideo] audioUrl starts:', audioUrl.slice(0, 80));

      const didPayload = {
        source_url: publicPhotoUrl,
        script: { type: 'audio', audio_url: audioUrl },
        config: { fluent: true, pad_audio: 0.5, stitch: true },
      };

      const tryDID = async (authValue: string, label: string): Promise<{ ok: boolean; status: number; body: string }> => {
        functions.logger.info(`[generateAvatarVideo] D-ID ${label}`);
        const r = await fetch('https://api.d-id.com/talks', {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${authValue}`,
            'Content-Type':  'application/json',
            'Accept':        'application/json',
          },
          body: JSON.stringify(didPayload),
        });
        const body = await r.text();
        functions.logger.info(`[generateAvatarVideo] D-ID ${label} → HTTP ${r.status}: ${body.slice(0, 300)}`);
        return { ok: r.ok, status: r.status, body };
      };

      // Attempt 1: key as-is
      let createResult = await tryDID(didKey, 'attempt1-direct');
      usedAuthKey = didKey;

      // Attempt 2: base64(key)
      if (createResult.status === 401) {
        const b64Key = Buffer.from(didKey).toString('base64');
        createResult = await tryDID(b64Key, 'attempt2-base64');
        if (createResult.ok) usedAuthKey = b64Key;
      }

      // Attempt 3: base64(":key")
      if (createResult.status === 401) {
        const b64Key2 = Buffer.from(`:${didKey}`).toString('base64');
        createResult = await tryDID(b64Key2, 'attempt3-colon-key');
        if (createResult.ok) usedAuthKey = b64Key2;
      }

      if (!createResult.ok) {
        throw new Error(`D-ID create failed HTTP ${createResult.status}: ${createResult.body.slice(0, 400)}`);
      }

      const createData = JSON.parse(createResult.body) as { id: string; status: string };
      const talkId     = createData.id;
      functions.logger.info('[generateAvatarVideo] D-ID talk created, id:', talkId);

      // Poll for completion
      let attempts  = 0;
      const MAX_ATT = 40;

      while (attempts < MAX_ATT) {
        await new Promise(r => setTimeout(r, 3000));
        attempts++;

        try {
          const pollResp = await fetch(`https://api.d-id.com/talks/${talkId}`, {
            headers: {
              'Authorization': `Basic ${usedAuthKey}`,
              'Accept':        'application/json',
            },
          });
          const pollBody = await pollResp.text();

          if (!pollResp.ok) {
            functions.logger.warn(`[generateAvatarVideo] D-ID poll ${attempts} HTTP ${pollResp.status}`);
            continue;
          }

          const pollData = JSON.parse(pollBody) as {
            status: string; result_url?: string; error?: { description?: string; kind?: string };
          };

          functions.logger.info(`[generateAvatarVideo] D-ID poll ${attempts}: status=${pollData.status}`);

          if (pollData.status === 'done' && pollData.result_url) {
            videoUrl = pollData.result_url;
            functions.logger.info('[generateAvatarVideo] D-ID video DONE:', videoUrl);
            break;
          }
          if (pollData.status === 'error') {
            const errDesc = pollData.error?.description || pollData.error?.kind || 'unknown error';
            throw new Error(`D-ID processing error: ${errDesc}`);
          }
        } catch (pollErr: any) {
          if (String(pollErr?.message || '').startsWith('D-ID processing error:')) throw pollErr;
          functions.logger.warn(`[generateAvatarVideo] D-ID poll ${attempts} exception:`, String(pollErr?.message || pollErr));
        }
      }

      if (!videoUrl) {
        throw new Error(`D-ID timed out after ${MAX_ATT * 3}s.`);
      }

    } catch (err: any) {
      const msg = String(err?.message || err);
      functions.logger.error('[generateAvatarVideo] Step 4 D-ID FAILED:', msg);
      return sendOK(res, { videoUrl: '', answerText, talkId: '', fallback: true, failStep: `Step 4 (D-ID): ${msg.slice(0, 300)}` });
    }

    functions.logger.info(`[generateAvatarVideo] ✅ Complete for ${ownerUid}: ${videoUrl}`);
    return sendOK(res, {
      videoUrl,
      answerText,
      talkId: videoUrl.split('/').slice(-2, -1)[0] || '',
      fallback: false,
    });
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// FUNCTION 7: pingAvatar — HTTPS onRequest (health check)
//
// POST /pingAvatar
// Headers: Authorization: Bearer <firebase-id-token>
// Response: { result: { status, results } }
// ═══════════════════════════════════════════════════════════════════════════════
export const pingAvatar = onRequest(
  {
    secrets: [OPENAI_API_KEY, ANTHROPIC_API_KEY, ELEVENLABS_API_KEY, DID_API_KEY],
    timeoutSeconds: 30,
    memory: '256MiB',
    invoker: 'public',
  },
  async (req: Request, res: Response) => {
    if (setCORSHeaders(req, res)) return;

    const user = await verifyFirebaseToken(req);
    if (!user) return sendError(res, 401, 'Unauthenticated.');

    const results: Record<string, string> = {};

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

    try {
      const k = DID_API_KEY.value();
      if (!k) { results.did = 'EMPTY KEY'; }
      else {
        let r = await fetch('https://api.d-id.com/talks?limit=1', {
          headers: { 'Authorization': `Basic ${k}`, 'Accept': 'application/json' },
        });
        if (r.ok) {
          results.did = `OK (direct key)`;
        } else {
          const b64k = Buffer.from(k).toString('base64');
          r = await fetch('https://api.d-id.com/talks?limit=1', {
            headers: { 'Authorization': `Basic ${b64k}`, 'Accept': 'application/json' },
          });
          results.did = r.ok ? `OK (base64 key)` : `FAIL HTTP ${r.status}`;
        }
      }
    } catch (e: any) { results.did = `ERROR: ${String(e.message || e).slice(0, 150)}`; }

    functions.logger.info('[pingAvatar] Diagnostics:', results);
    return sendOK(res, { status: 'checked', results });
  }
);
