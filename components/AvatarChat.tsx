'use client';
/**
 * AvatarChat — Client-side AI Avatar with full media analysis
 *
 * Supported content sources:
 *  1. Life question answers (from Firestore)
 *  2. Text/document files (TXT, PDF*, DOCX* — fetched via URL, text extracted)
 *  3. Images (JPG, PNG, WebP, GIF) — sent to Gemini Vision for analysis
 *  4. Video/Audio — description + filename used as context
 *
 * All extracted content is cached in localStorage (per-file hash) for speed.
 * Uses Google Gemini 2.0 Flash (multimodal) — free tier: 1500 req/day.
 *
 * NO server, NO Cloud Functions needed.
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useLang } from '@/components/LangContext';
import type { AppUser, MemoryItem } from '@/lib/clientStore';
import { getAnswers, getMemoryItems, waitForAuthReady } from '@/lib/clientStore';
import { LIFE_QUESTIONS } from '@/lib/questions';

// NOTE: In Next.js static export, process.env.NEXT_PUBLIC_* is replaced at build-time
// only when used directly as a string literal in JSX expressions.
// For helper functions outside components, we hardcode the key via next.config.js fallback.
// The actual substitution happens through __GEMINI_KEY__ replaced by webpack DefinePlugin.
const _GEMINI_KEY = "AIzaSyCfvvEnh5V2ZrXWoqpSbGEAakCY5RKyxlg";

function getGeminiKey(): string {
  const envKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  return (envKey && envKey !== '' && envKey !== 'undefined') ? envKey : _GEMINI_KEY;
}

// Model preference order — try each on quota/404 error.
// gemini-2.5-flash is the working free-tier model as of 2025
const GEMINI_MODELS = [
  { model: 'gemini-2.5-flash',        api: 'v1beta' },
  { model: 'gemini-2.5-pro',          api: 'v1beta' },
  { model: 'gemini-1.5-flash',        api: 'v1'     },
  { model: 'gemini-1.5-pro',          api: 'v1'     },
  { model: 'gemini-2.0-flash',        api: 'v1beta' },
];

function getGeminiUrl(model = GEMINI_MODELS[0].model, api = GEMINI_MODELS[0].api): string {
  return `https://generativelanguage.googleapis.com/${api}/models/${model}:generateContent?key=${getGeminiKey()}`;
}

// Sleep helper for retry delays
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// ─── i18n ──────────────────────────────────────────────────────────────────────
const i18n = {
  en: {
    title:           '🤖 AI Avatar',
    subtitle:        'Answers based on your memories, documents and life answers.',
    placeholder:     'Ask something… e.g. "Where were you born?"',
    send:            'Ask',
    thinking:        'Thinking…',
    emptyState:      'Start a conversation with the AI avatar.',
    youLabel:        'You',
    avatarLabel:     'Avatar',
    noApiKey:        '⚠️ Gemini API key not configured.',
    noContent:       'No answers or memories yet. Fill in the Life Questions tab first.',
    errorGeneric:    'Something went wrong. Please try again.',
    clearChat:       'Clear chat',
    loadingCtx:      'Loading your memories…',
    ctxReady:        'Context ready',
    answers:         'answers',
    files:           'files',
    analyzingFiles:  'Analyzing files…',
    noKeySetup:      'Setup: get a free key at https://aistudio.google.com/app/apikey and add NEXT_PUBLIC_GEMINI_API_KEY to .env.local',
    suggestedQ: [
      'Tell me about yourself.',
      'What was your childhood like?',
      'What do you want your loved ones to remember?',
      'What is your greatest achievement?',
      'What are your values?',
    ],
  },
  bg: {
    title:           '🤖 AI Аватар',
    subtitle:        'Отговаря въз основа на вашите спомени, документи и житейски отговори.',
    placeholder:     'Задайте въпрос… напр. "Къде си роден/а?"',
    send:            'Питай',
    thinking:        'Мисля…',
    emptyState:      'Започнете разговор с AI аватара.',
    youLabel:        'Вие',
    avatarLabel:     'Аватар',
    noApiKey:        '⚠️ Gemini API ключът не е конфигуриран.',
    noContent:       'Все още няма отговори или спомени. Попълнете Житейски въпроси.',
    errorGeneric:    'Нещо се обърка. Моля, опитайте отново.',
    clearChat:       'Изчисти чата',
    loadingCtx:      'Зареждам вашите спомени…',
    ctxReady:        'Контекстът е готов',
    answers:         'отговора',
    files:           'файла',
    analyzingFiles:  'Анализирам файловете…',
    noKeySetup:      'Настройка: вземете безплатен ключ от https://aistudio.google.com/app/apikey и добавете NEXT_PUBLIC_GEMINI_API_KEY в .env.local',
    suggestedQ: [
      'Разкажи ми за себе си.',
      'Какво беше детството ти?',
      'Какво искаш близките ти да помнят?',
      'Кое е най-голямото ти постижение?',
      'Какви са твоите ценности?',
    ],
  },
};

// ─── Types ─────────────────────────────────────────────────────────────────────
interface Message {
  id:    string;
  role:  'user' | 'avatar';
  text:  string;
  error?: boolean;
}

interface ExtractedFile {
  id:       string;        // memory doc id
  name:     string;
  type:     MemoryItem['type'];
  mimeType: string;
  description: string;
  content:  string;        // extracted/analyzed text
  url:      string;
}

interface ProfileContext {
  answersText:    string;
  answeredCount:  number;
  files:          ExtractedFile[];
  docsText:       string;   // combined text from docs
  imagesAnalysis: string;   // combined Gemini vision analysis
  mediaDesc:      string;   // video/audio descriptions
}

// ─── localStorage cache helpers ───────────────────────────────────────────────
// Cache version — bump this to invalidate all old caches
const CACHE_VERSION = 'v4';
function cacheKey(id: string) { return `avatar_file_cache_${CACHE_VERSION}_${id}`; }
function getCached(id: string): string | null {
  try {
    const val = localStorage.getItem(cacheKey(id));
    // Reject empty/placeholder cache entries so we re-try
    if (!val || val.length < 20 || val.includes('не може да се прочете') || val.includes('cannot be read')) return null;
    return val;
  } catch { return null; }
}
function setCached(id: string, text: string) {
  // Only cache non-empty real content
  if (!text || text.length < 20) return;
  try { localStorage.setItem(cacheKey(id), text); } catch {}
}

// ─── Fetch text from URL (for plain text files) ───────────────────────────────
async function fetchTextFile(url: string): Promise<string> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const text = await resp.text();
  // Return first 8000 chars max (fits comfortably in Gemini context)
  return text.slice(0, 8000);
}

// ─── Fetch file as base64 (for images) ────────────────────────────────────────
async function fetchAsBase64(url: string): Promise<{ base64: string; mimeType: string }> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const mimeType = resp.headers.get('content-type') || 'image/jpeg';
  const buffer   = await resp.arrayBuffer();
  const bytes    = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return { base64: btoa(binary), mimeType };
}

// ─── Analyze image with Gemini Vision ────────────────────────────────────────
async function analyzeImageWithGemini(
  url: string,
  filename: string,
  description: string
): Promise<string> {
  // Try to fetch as base64 first (works if CORS allows it)
  // If CORS fails, fall back to URL reference in prompt
  let imagePart: object;
  try {
    const { base64, mimeType } = await fetchAsBase64(url);
    imagePart = { inlineData: { mimeType, data: base64 } };
  } catch (corsErr) {
    console.warn('[AvatarChat] CORS prevented base64 fetch, using URL reference instead');
    // Fall back to URL-only description
    return `[СНИМКА: ${filename}]\nОписание: ${description || 'без описание'}\nURL: ${url}\n(Директният анализ не е достъпен поради CORS ограничения)`;
  }

  const body = {
    contents: [{
      parts: [
        imagePart,
        {
          text: `Анализирай тази снимка детайлно. Опиши:
1. Какво виждаш (хора, места, предмети, обстановка)
2. Емоционалният тон / настроение
3. Приблизителна епоха / период
4. Всякакъв видим текст
5. Контекст, свързан с описанието: "${description || filename}"

Отговори на български. Бъди конкретен — до 300 думи.`
        }
      ]
    }],
    generationConfig: { temperature: 0.3, maxOutputTokens: 400 },
  };

  // Try each model in order (quota/404 fallback)
  for (const { model, api } of GEMINI_MODELS) {
    const resp = await fetch(getGeminiUrl(model, api), {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    });

    if (resp.status === 429 || resp.status === 404) {
      console.warn(`[Gemini Vision] ${resp.status} on ${model}, trying next...`);
      await sleep(800);
      continue;
    }

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Gemini Vision error: ${err.slice(0, 200)}`);
    }

    const data = await resp.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || '(no analysis)';
  }
  return `[Снимка: ${filename}] Анализът не е достъпен (quota изчерпана).`;
}

// ─── Extract content from a single MemoryItem ─────────────────────────────────
// ─── Fetch file bytes with retry and CORS handling ────────────────────────────
async function fetchFileBytes(url: string): Promise<ArrayBuffer> {
  // Try with credentials (works for Firebase Storage signed URLs)
  const attempts = [
    () => fetch(url, { mode: 'cors', credentials: 'omit' }),
    () => fetch(url, { mode: 'no-cors' }),  // fallback — limited
    () => fetch(url),  // browser default
  ];
  let lastErr: any;
  for (const attempt of attempts) {
    try {
      const r = await attempt();
      if (r.ok || r.type === 'opaque') {
        const buf = await r.arrayBuffer();
        if (buf.byteLength > 0) return buf;
      }
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('All fetch attempts failed');
}

// ─── Convert ArrayBuffer to base64 safely (chunked to avoid stack overflow) ──
function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const CHUNK = 0x8000; // 32KB chunks
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + CHUNK, bytes.length)));
  }
  return btoa(binary);
}

// ─── Ask Gemini to extract text from a file sent as inline base64 ─────────────
async function extractWithGeminiInline(
  url: string,
  mimeType: string,
  filename: string,
  description: string
): Promise<string> {
  console.log(`[AvatarChat] Fetching file: ${filename} (${mimeType})`);
  const buffer = await fetchFileBytes(url);
  console.log(`[AvatarChat] Fetched ${Math.round(buffer.byteLength / 1024)} KB for ${filename}`);

  // Gemini has 20MB inline limit — skip huge files
  if (buffer.byteLength > 18 * 1024 * 1024) {
    throw new Error(`File too large for inline (${Math.round(buffer.byteLength / 1024 / 1024)} MB)`);
  }

  const base64Data = bufferToBase64(buffer);

  // For DOCX files Gemini needs the correct MIME
  const effectiveMime =
    mimeType === 'application/octet-stream' && filename.toLowerCase().endsWith('.docx')
      ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      : mimeType;

  const prompt = `Файлът се казва "${filename}".${description ? ` Описание: "${description}".` : ''}
Извлечи ЦЯЛОТО текстово съдържание — имена, дати, адреси, образование, работа, умения, всякакви факти.
Ако не можеш да прочетеш формата, опиши какво виждаш.
Отговори на ЕЗИКА на документа (не превеждай). Бъди максимално подробен.`;

  const body = {
    contents: [{
      parts: [
        { inline_data: { mime_type: effectiveMime, data: base64Data } },
        { text: prompt }
      ]
    }],
    generationConfig: { temperature: 0.1, maxOutputTokens: 3000 },
  };

  const geminiResp = await fetch(getGeminiUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!geminiResp.ok) {
    const errText = await geminiResp.text();
    throw new Error(`Gemini ${geminiResp.status}: ${errText.slice(0, 300)}`);
  }
  const data = await geminiResp.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  console.log(`[AvatarChat] ✅ Gemini extracted ${text.length} chars from ${filename}`);
  return text;
}

// ─── Ask Gemini to describe file from URL only (no fetch) ─────────────────────
async function extractWithGeminiUrlHint(
  filename: string,
  mimeType: string,
  description: string,
  url: string
): Promise<string> {
  const prompt = `Имаме файл с име "${filename}" (тип: ${mimeType}).${description ? ` Описание: "${description}".` : ''}
URL на файла: ${url}

Ако можеш да достъпиш URL-а — прочети и извлечи съдържанието.
Ако не можеш — опиши какво знаеш за файла от името и описанието.
Отговори подробно.`;

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 1000 },
  };
  const r = await fetch(getGeminiUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Gemini URL hint ${r.status}`);
  const d = await r.json();
  return d?.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function extractFileContent(item: MemoryItem): Promise<string> {
  // Check cache — v4 cache rejects old empty entries automatically
  const cached = getCached(item.id);
  if (cached !== null) {
    console.log(`[AvatarChat] Cache hit for ${item.name} (${cached.length} chars)`);
    return cached;
  }

  let content = '';
  const mime = item.mimeType?.toLowerCase() || '';
  const name = item.name?.toLowerCase() || '';

  // Resolve best MIME type from extension when stored type is missing/generic
  function resolveMime(): string {
    if (mime && mime !== 'application/octet-stream' && mime !== 'application/x-www-form-urlencoded') return mime;
    if (name.endsWith('.pdf'))  return 'application/pdf';
    if (name.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    if (name.endsWith('.doc'))  return 'application/msword';
    if (name.endsWith('.rtf'))  return 'application/rtf';
    if (name.endsWith('.odt'))  return 'application/vnd.oasis.opendocument.text';
    if (name.endsWith('.txt'))  return 'text/plain';
    if (name.endsWith('.md'))   return 'text/markdown';
    if (name.endsWith('.csv'))  return 'text/csv';
    if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';
    if (name.endsWith('.png'))  return 'image/png';
    if (name.endsWith('.webp')) return 'image/webp';
    return mime || 'application/octet-stream';
  }

  const resolvedMime = resolveMime();
  console.log(`[AvatarChat] Processing: ${item.name} | mime: ${resolvedMime} | url: ${item.url?.slice(0, 60)}...`);

  try {

    // ── Images ──────────────────────────────────────────────────────────────
    if (resolvedMime.startsWith('image/') ||
        ['jpg','jpeg','png','webp','gif','bmp'].some(ext => name.endsWith('.'+ext))) {
      content = await analyzeImageWithGemini(item.url, item.name, item.description || '');
    }

    // ── Video ────────────────────────────────────────────────────────────────
    else if (resolvedMime.startsWith('video/') ||
             ['mp4','mov','avi','mkv','webm'].some(ext => name.endsWith('.'+ext))) {
      content = `[ВИДЕО: ${item.name}] Описание: ${item.description || 'без описание'}`;
    }

    // ── Audio ────────────────────────────────────────────────────────────────
    else if (resolvedMime.startsWith('audio/') ||
             ['mp3','wav','m4a','ogg','flac'].some(ext => name.endsWith('.'+ext))) {
      content = `[АУДИО: ${item.name}] Описание: ${item.description || 'без описание'}`;
    }

    // ── Plain text — fetch directly ──────────────────────────────────────────
    else if (resolvedMime === 'text/plain' || name.endsWith('.txt') || name.endsWith('.md') || name.endsWith('.csv')) {
      try {
        const text = await fetchTextFile(item.url);
        content = `=== ${item.name} ===\n${text}`;
        console.log(`[AvatarChat] ✅ Plain text fetched: ${content.length} chars`);
      } catch (e: any) {
        console.warn(`[AvatarChat] Plain text fetch failed, trying Gemini inline:`, e?.message);
        content = await extractWithGeminiInline(item.url, resolvedMime, item.name, item.description || '');
      }
    }

    // ── PDF, DOCX, RTF, ODT — send to Gemini as inline base64 ───────────────
    else if (
      resolvedMime === 'application/pdf' ||
      resolvedMime.includes('word') ||
      resolvedMime.includes('officedocument') ||
      resolvedMime === 'application/rtf' ||
      resolvedMime === 'text/rtf' ||
      resolvedMime.includes('opendocument') ||
      ['pdf','docx','doc','rtf','odt'].some(ext => name.endsWith('.'+ext))
    ) {
      try {
        content = await extractWithGeminiInline(item.url, resolvedMime, item.name, item.description || '');
      } catch (e1: any) {
        console.warn(`[AvatarChat] Inline extract failed: ${e1?.message} — trying URL hint fallback`);
        try {
          content = await extractWithGeminiUrlHint(item.name, resolvedMime, item.description || '', item.url);
          console.log(`[AvatarChat] ✅ URL hint fallback OK: ${content.length} chars`);
        } catch (e2: any) {
          console.warn(`[AvatarChat] URL hint also failed: ${e2?.message}`);
          content = item.description
            ? `[${item.name}]: ${item.description}`
            : `[${item.name}]: (файлът не може да се прочете — опитайте да го качите отново)`;
        }
      }
    }

    // ── Unknown — use metadata ───────────────────────────────────────────────
    else {
      content = `[ФАЙЛ: ${item.name}] Тип: ${resolvedMime} | Описание: ${item.description || 'без описание'}`;
    }

  } catch (err: any) {
    console.error(`[AvatarChat] extractFileContent error for ${item.name}:`, err?.message);
    content = item.description
      ? `[${item.name}]: ${item.description}`
      : `[${item.name}]: (грешка при четене)`;
  }

  // Cache only meaningful content
  if (content && content.length >= 20) {
    setCached(item.id, content);
  }
  return content;
}

// ─── Load full profile context ────────────────────────────────────────────────
async function loadProfileContext(
  ownerUid: string,
  onProgress?: (msg: string) => void
): Promise<ProfileContext> {

  onProgress?.('Зареждам отговори…');
  // Wait for Firebase Auth before any Firestore queries
  const firebaseUser = await waitForAuthReady();
  const resolvedUid = firebaseUser?.uid || ownerUid;
  console.log('[AvatarChat] loadProfileContext uid:', resolvedUid);

  const [answersMap, memories] = await Promise.all([
    getAnswers(resolvedUid).catch((e) => { console.error('[AvatarChat] getAnswers error:', e); return {} as Record<number, { answer: string }>; }),
    getMemoryItems(resolvedUid).catch((e) => { console.error('[AvatarChat] getMemoryItems error:', e); return [] as MemoryItem[]; }),
  ]);

  // ── Build answers text ──────────────────────────────────────────────────────
  const answersLines: string[] = [];
  LIFE_QUESTIONS.forEach(q => {
    const ans = (answersMap as any)[q.id];
    if (ans?.answer?.trim()) {
      answersLines.push(`Въпрос ${q.id} (${q.bg}): ${ans.answer.trim()}`);
    }
  });

  // ── Extract content from each file ─────────────────────────────────────────
  const extractedFiles: ExtractedFile[] = [];

  for (let i = 0; i < memories.length; i++) {
    const item = memories[i];
    onProgress?.(`📄 Четя файл ${i + 1}/${memories.length}: ${item.name}…`);
    const content = await extractFileContent(item);
    const chars = content?.length || 0;
    const status = chars > 50 ? `✅ ${chars} символа` : `⚠️ празно`;
    console.log(`[AvatarChat] File ${i+1}/${memories.length}: ${item.name} → ${status}`);
    onProgress?.(`${status} — ${item.name}`);
    extractedFiles.push({
      id:          item.id,
      name:        item.name,
      type:        item.type,
      mimeType:    item.mimeType,
      description: item.description || '',
      content,
      url:         item.url,
    });
  }

  // ── Categorize extracted content ─────────────────────────────────────────────
  // Higher limits — Gemini 2.5 Flash supports 1M token context
  const MAX_DOCS   = 12000;
  const MAX_IMAGES = 4000;
  const MAX_MEDIA  = 2000;
  const MAX_ANS    = 8000;

  const docsText = extractedFiles
    .filter(f => f.type === 'document' || f.type === 'other')
    .map(f => `=== ДОКУМЕНТ: ${f.name} ===\n${f.content.slice(0, 4000)}`)
    .join('\n\n')
    .slice(0, MAX_DOCS);

  const imagesAnalysis = extractedFiles
    .filter(f => f.type === 'photo')
    .map(f => `=== СНИМКА: ${f.name} ===\n${f.content.slice(0, 800)}`)
    .join('\n\n')
    .slice(0, MAX_IMAGES);

  const mediaDesc = extractedFiles
    .filter(f => f.type === 'video' || f.type === 'audio')
    .map(f => `=== МЕДИЯ: ${f.name} ===\n${f.content.slice(0, 400)}`)
    .join('\n\n')
    .slice(0, MAX_MEDIA);

  const answersText = answersLines.join('\n\n').slice(0, MAX_ANS);

  return {
    answersText,
    answeredCount:  answersLines.length,
    files:          extractedFiles,
    docsText,
    imagesAnalysis,
    mediaDesc,
  };
}

// ─── Build system prompt ───────────────────────────────────────────────────────
function buildSystemPrompt(ownerName: string, ctx: ProfileContext, lang: string): string {
  const totalFiles = ctx.files.length;

  const bg = `Ти си дигиталният аватар на ${ownerName}. Говориш от ПЪРВО лице — като самия него/нея.

═══ ЗАДЪЛЖИТЕЛНИ ПРАВИЛА ═══

ПРАВИЛО 1 — САМО КОНТЕКСТ:
Отговаряй ЕДИНСТВЕНО въз основа на предоставената информация по-долу.
Ако в контекста няма информация за даден въпрос — кажи: "Не съм оставил/а спомен за това."
НИКОГА не измисляй факти извън предоставения контекст.

ПРАВИЛО 2 — ГЛАС И СТИЛ:
- Говори от ПЪРВО лице ("аз", "моят", "помня", "бях")
- Бъди топъл/а, личен/а и емоционално автентичен/на
- Ако информацията е кратка — бъди кратък/а; ако е детайлна — бъди детайлен/на

ПРАВИЛО 3 — ИЗПОЛЗВАЙ ВСИЧКИ ИЗТОЧНИЦИ:
Комбинирай информацията от: отговори на въпроси + документи/CV + снимки + медия файлове
При противоречие между източници — предпочитай директните отговори пред анализа на снимки.

═══ ОТГОВОРИ НА ЖИТЕЙСКИ ВЪПРОСИ (${ctx.answeredCount} отговора) ═══

${ctx.answersText || '(Все още няма попълнени отговори)'}

${ctx.docsText ? `═══ ДОКУМЕНТИ И ТЕКСТОВИ ФАЙЛОВЕ (включително CV/биография) ═══

${ctx.docsText}` : ''}

${ctx.imagesAnalysis ? `═══ АНАЛИЗ НА КАЧЕНИ СНИМКИ ═══

${ctx.imagesAnalysis}` : ''}

${ctx.mediaDesc ? `═══ ВИДЕО И АУДИО ФАЙЛОВЕ ═══

${ctx.mediaDesc}` : ''}

═══ ОБОБЩЕНИЕ ═══
Общо файлове: ${totalFiles} | Отговорени въпроси: ${ctx.answeredCount}

Отговори на въпроса само въз основа на горното.`;

  const en = `You are the digital avatar of ${ownerName}. You speak in the FIRST PERSON — as that person themselves.

═══ MANDATORY RULES ═══

RULE 1 — CONTEXT ONLY:
Answer ONLY based on the information provided below.
If the context has no information — say: "I haven't left a memory about that."
NEVER invent facts outside the provided context.

RULE 2 — VOICE AND STYLE:
- Speak in FIRST PERSON ("I", "my", "I remember", "I was")
- Be warm, personal and emotionally authentic
- Match the brevity/detail of the available information

RULE 3 — USE ALL SOURCES:
Combine information from: question answers + documents/CV + photos + media files.
When sources conflict — prefer direct answers over photo analysis.

═══ LIFE QUESTION ANSWERS (${ctx.answeredCount} answers) ═══

${ctx.answersText || '(No answers filled in yet)'}

${ctx.docsText ? `═══ DOCUMENTS & TEXT FILES (including CV/biography) ═══

${ctx.docsText}` : ''}

${ctx.imagesAnalysis ? `═══ PHOTO ANALYSIS ═══

${ctx.imagesAnalysis}` : ''}

${ctx.mediaDesc ? `═══ VIDEO & AUDIO FILES ═══

${ctx.mediaDesc}` : ''}

═══ SUMMARY ═══
Total files: ${totalFiles} | Answered questions: ${ctx.answeredCount}

Now answer the question based solely on the above.`;

  return lang === 'bg' ? bg : en;
}

// ─── Gemini text call with model fallback + retry ─────────────────────────────
async function callGemini(systemPrompt: string, question: string): Promise<string> {
  if (!getGeminiKey()) throw new Error('NO_API_KEY');

  const body = {
    contents: [{
      parts: [{ text: `${systemPrompt}\n\n---\n\nВъпрос / Question: ${question}` }]
    }],
    generationConfig: {
      temperature:     0.7,
      maxOutputTokens: 800,
      topP:            0.9,
    },
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
    ],
  };

  let lastError = '';
  for (const { model, api } of GEMINI_MODELS) {
    try {
      const resp = await fetch(getGeminiUrl(model, api), {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (resp.status === 429) {
        const errText = await resp.text();
        console.warn(`[Gemini] 429 quota on ${model}, trying next model...`);
        lastError = `quota:${errText.slice(0, 100)}`;
        await sleep(1500);
        continue;
      }

      if (resp.status === 404) {
        console.warn(`[Gemini] 404 on ${model} (${api}), trying next model...`);
        lastError = `404:model not found`;
        continue; // no delay needed for 404
      }

      if (!resp.ok) {
        const errText = await resp.text();
        console.error(`[Gemini] Error on ${model}:`, errText);
        throw new Error(`Gemini API ${resp.status}: ${errText.slice(0, 200)}`);
      }

      const data = await resp.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('Empty response from Gemini.');
      console.log(`[Gemini] Success with model: ${model} (${api})`);
      return text;

    } catch (err: any) {
      if (err.message?.includes('429') || err.message?.includes('quota')) {
        lastError = err.message;
        await sleep(1500);
        continue;
      }
      throw err;
    }
  }

  throw new Error(`QUOTA_EXHAUSTED: All models failed. Last: ${lastError}`);
}

// ─── UI Components ─────────────────────────────────────────────────────────────
function MessageBubble({ msg, t }: { msg: Message; t: typeof i18n.bg }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
        ${isUser ? 'bg-gray-200 text-gray-600' : 'bg-gradient-to-br from-blue-500 to-purple-700 text-white shadow-md'}`}>
        {isUser ? '👤' : '🤖'}
      </div>
      <div className={`flex flex-col gap-1 max-w-[82%] ${isUser ? 'items-end' : 'items-start'}`}>
        <span className="text-xs text-gray-400 font-medium px-1">
          {isUser ? t.youLabel : t.avatarLabel}
        </span>
        <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm
          ${isUser
            ? 'bg-blue-600 text-white rounded-tr-sm'
            : msg.error
              ? 'bg-red-50 border border-red-200 text-red-700 rounded-tl-sm'
              : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm'}`}>
          {msg.text.split('\n').map((line, i, arr) => (
            <React.Fragment key={i}>{line}{i < arr.length - 1 && <br />}</React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-700 flex items-center justify-center text-sm flex-shrink-0">🤖</div>
      <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
        <div className="flex gap-1.5 items-center h-5">
          {[0,1,2].map(i => (
            <div key={i} className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Context status badge ──────────────────────────────────────────────────────
function ContextBadge({ ctx, loadMsg, t }: {
  ctx: ProfileContext | null;
  loadMsg: string;
  t: typeof i18n.bg;
}) {
  if (!ctx) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-full">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
        {loadMsg || t.loadingCtx}
      </div>
    );
  }
  const hasContent = ctx.answeredCount > 0 || ctx.files.length > 0;
  return (
    <div className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border font-medium
      ${hasContent
        ? 'text-green-700 bg-green-50 border-green-200'
        : 'text-gray-500 bg-gray-50 border-gray-200'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${hasContent ? 'bg-green-500' : 'bg-gray-400'}`} />
      {ctx.answeredCount} {t.answers} · {ctx.files.length} {t.files}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function AvatarChat({
  user,
  ownerUid,
  ownerName,
}: {
  user:      AppUser;
  ownerUid:  string;
  ownerName: string;
}) {
  const { locale } = useLang();
  const t = i18n[locale as 'en' | 'bg'] || i18n.bg;

  // Persist messages in localStorage so they survive page refresh
  const CHAT_KEY = `avatar_chat_${ownerUid}`;

  const [messages,  setMessages]  = useState<Message[]>(() => {
    try {
      const saved = localStorage.getItem(CHAT_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [input,     setInput]     = useState('');
  const [loading,   setLoading]   = useState(false);
  const [ctx,       setCtx]       = useState<ProfileContext | null>(null);
  const [loadMsg,   setLoadMsg]   = useState('');

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  // Save messages to localStorage whenever they change
  useEffect(() => {
    try {
      // Keep last 100 messages to avoid localStorage overflow
      const toSave = messages.slice(-100);
      localStorage.setItem(CHAT_KEY, JSON.stringify(toSave));
    } catch {}
  }, [messages, CHAT_KEY]);

  // Load context (with file analysis) on mount
  useEffect(() => {
    const load = async () => {
      // Wait for Firebase Auth before loading
      const firebaseUser = await waitForAuthReady();
      const uid = firebaseUser?.uid || ownerUid;

      loadProfileContext(uid, setLoadMsg)
        .then(c => { setCtx(c); setLoadMsg(''); })
        .catch(err => {
          console.error('[AvatarChat] Context load error:', err);
          setCtx({ answersText: '', answeredCount: 0, files: [], docsText: '', imagesAnalysis: '', mediaDesc: '' });
          setLoadMsg('');
        });
    };
    load();
  }, [ownerUid]);

  // Force reload context (clear cache for all files, re-analyze)
  const reloadContext = useCallback(async () => {
    setCtx(null);
    // Wait for Firebase Auth before reloading
    const firebaseUser = await waitForAuthReady();
    const uid = firebaseUser?.uid || ownerUid;
    const memories = await getMemoryItems(uid).catch(() => [] as MemoryItem[]);
    // Clear cache for all files
    memories.forEach(m => {
      try { localStorage.removeItem(cacheKey(m.id)); } catch {}
    });
    loadProfileContext(uid, setLoadMsg)
      .then(c => { setCtx(c); setLoadMsg(''); })
      .catch(() => {
        setCtx({ answersText: '', answeredCount: 0, files: [], docsText: '', imagesAnalysis: '', mediaDesc: '' });
        setLoadMsg('');
      });
  }, [ownerUid]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function handleSend(question?: string) {
    const q = (question || input).trim();
    if (!q || loading) return;

    setInput('');
    setLoading(true);
    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', text: q }]);

    try {
      if (!getGeminiKey()) throw new Error('NO_API_KEY');

      const profileCtx = ctx ?? {
        answersText: '', answeredCount: 0, files: [],
        docsText: '', imagesAnalysis: '', mediaDesc: '',
      };
      const systemPrompt = buildSystemPrompt(ownerName, profileCtx, locale);
      const answer = await callGemini(systemPrompt, q);

      setMessages(prev => [...prev, { id: Date.now() + '-a', role: 'avatar', text: answer }]);
    } catch (err: any) {
      let msg = t.errorGeneric;
      const errMsg = err?.message || '';
      console.error('[AvatarChat] handleSend error:', errMsg);
      if (errMsg === 'NO_API_KEY') {
        msg = t.noApiKey + '\n' + t.noKeySetup;
      } else if (errMsg.startsWith('QUOTA_EXHAUSTED') || errMsg.includes('429')) {
        msg = locale === 'bg'
          ? '⚠️ Gemini API квотата е изчерпана за всички модели.\n\nРешения:\n1. Изчакайте 1 минута и опитайте отново\n2. Вземете нов безплатен ключ от aistudio.google.com/app/apikey\n3. Активирайте Billing в Google Cloud за неограничени заявки'
          : '⚠️ Gemini API quota exhausted for all models.\n\nSolutions:\n1. Wait 1 minute and try again\n2. Get a new free key from aistudio.google.com/app/apikey\n3. Enable Billing in Google Cloud for unlimited requests';
      } else if (errMsg.includes('403') || errMsg.includes('API_KEY_INVALID')) {
        msg = locale === 'bg'
          ? '⚠️ Невалиден Gemini API ключ. Вземете нов от aistudio.google.com/app/apikey'
          : '⚠️ Invalid Gemini API key. Get a new one from aistudio.google.com/app/apikey';
      } else if (errMsg.includes('400')) {
        msg = locale === 'bg'
          ? `⚠️ Грешка в заявката: ${errMsg.slice(0, 120)}`
          : `⚠️ Request error: ${errMsg.slice(0, 120)}`;
      } else if (errMsg.length > 0) {
        msg = `${t.errorGeneric}\n[${errMsg.slice(0, 150)}]`;
      }
      setMessages(prev => [...prev, { id: Date.now() + '-err', role: 'avatar', text: msg, error: true }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-h-[780px] bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

      {/* ── Header ── */}
      <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-purple-50">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-gray-900">{t.title}</h2>
            <p className="text-xs text-gray-500 mt-0.5 truncate">{t.subtitle}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <ContextBadge ctx={ctx} loadMsg={loadMsg} t={t} />
            <button onClick={reloadContext} disabled={!ctx && !!loadMsg}
              title={locale === 'bg' ? 'Презареди контекста (след нови файлове/отговори)' : 'Reload context (after adding files/answers)'}
              className="text-xs text-gray-400 hover:text-blue-600 font-medium px-2.5 py-1.5 rounded-lg hover:bg-white/60 transition-colors whitespace-nowrap">
              🔄
            </button>
            {messages.length > 0 && (
              <button onClick={() => {
                setMessages([]);
                try { localStorage.removeItem(CHAT_KEY); } catch {}
              }}
                className="text-xs text-gray-400 hover:text-gray-600 font-medium px-3 py-1.5 rounded-lg hover:bg-white/60 transition-colors whitespace-nowrap">
                {t.clearChat}
              </button>
            )}
          </div>
        </div>

        {/* File analysis progress */}
        {loadMsg && (
          <div className="mt-2 flex items-center gap-2 text-xs text-blue-600 bg-blue-50 rounded-lg px-3 py-2">
            <span className="w-3 h-3 border-2 border-blue-400/40 border-t-blue-500 rounded-full animate-spin flex-shrink-0" />
            <span className="truncate">{loadMsg}</span>
          </div>
        )}
      </div>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
        {messages.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center h-full gap-5 py-6">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-700 flex items-center justify-center text-4xl shadow-lg">
              🤖
            </div>

            <div className="text-center max-w-xs">
              <p className="text-gray-600 text-sm font-medium">{t.emptyState}</p>
              {ctx && ctx.answeredCount === 0 && ctx.files.length === 0 && (
                <p className="text-amber-600 text-xs mt-2">{t.noContent}</p>
              )}
            </div>

            {/* Context summary */}
            {ctx && (ctx.answeredCount > 0 || ctx.files.length > 0) && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-gray-600 max-w-xs w-full space-y-1">
                <p className="font-semibold text-gray-700 mb-1.5">
                  {locale === 'bg' ? '📚 Зареден контекст:' : '📚 Loaded context:'}
                </p>
                {ctx.answeredCount > 0 && (
                  <p>✅ {ctx.answeredCount} {locale === 'bg' ? 'отговора на въпроси' : 'question answers'}</p>
                )}
                {ctx.files.filter(f => f.type === 'document').length > 0 && (
                  <p>📄 {ctx.files.filter(f => f.type === 'document').length} {locale === 'bg' ? 'документа (CV, текст...)' : 'documents (CV, text...)'}</p>
                )}
                {ctx.files.filter(f => f.type === 'photo').length > 0 && (
                  <p>🖼️ {ctx.files.filter(f => f.type === 'photo').length} {locale === 'bg' ? 'снимки (анализирани)' : 'photos (analyzed)'}</p>
                )}
                {ctx.files.filter(f => f.type === 'video' || f.type === 'audio').length > 0 && (
                  <p>🎬 {ctx.files.filter(f => f.type === 'video' || f.type === 'audio').length} {locale === 'bg' ? 'видео/аудио файла' : 'video/audio files'}</p>
                )}
                <button onClick={reloadContext}
                  className="mt-2 text-xs text-blue-600 hover:text-blue-800 font-medium underline">
                  {locale === 'bg' ? '🔄 Презареди (ако сте добавили нови файлове)' : '🔄 Reload context (if you added new files)'}
                </button>
              </div>
            )}

            {/* Suggested questions */}
            <div className="flex flex-col gap-2 w-full max-w-sm">
              {t.suggestedQ.map((q, i) => (
                <button key={i} onClick={() => handleSend(q)}
                  className="text-left text-sm bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-300 text-gray-700 px-4 py-2.5 rounded-xl transition-all font-medium">
                  💬 {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map(msg => <MessageBubble key={msg.id} msg={msg} t={t} />)}
            {loading && <TypingIndicator />}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Input ── */}
      <div className="px-5 py-4 border-t border-gray-100 bg-gray-50/50">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder={t.placeholder}
            disabled={loading || !getGeminiKey()}
            className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent disabled:opacity-60 bg-white"
          />
          <button
            onClick={() => handleSend()}
            disabled={loading || !input.trim() || !getGeminiKey()}
            className="bg-blue-600 text-white font-bold px-5 py-2.5 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm whitespace-nowrap flex items-center gap-2">
            {loading
              ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />{t.thinking}</>
              : t.send}
          </button>
        </div>
      </div>
    </div>
  );
}
