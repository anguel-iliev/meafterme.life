'use client';
/**
 * AvatarChat — AI Avatar with Video Response
 *
 * Pipeline:
 *  1. User asks a question
 *  2. If avatar is configured (photo + voice): calls generateAvatarVideo Cloud Function
 *     → RAG finds answer → ElevenLabs clones voice → D-ID animates photo → video
 *  3. If avatar is NOT configured: falls back to Gemini text response
 *
 * Video mode shows a central video player with the talking avatar.
 * Text mode shows standard chat bubbles.
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useLang } from '@/components/LangContext';
import type { AppUser, MemoryItem, AvatarConfig } from '@/lib/clientStore';
import { getAnswers, getMemoryItems, waitForAuthReady, getAvatarConfig } from '@/lib/clientStore';
import { LIFE_QUESTIONS } from '@/lib/questions';
import { isFirebaseClientConfigured, getClientAuth } from '@/lib/firebaseClient';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getApp } from 'firebase/app';

const _GEMINI_KEY = "AIzaSyCfvvEnh5V2ZrXWoqpSbGEAakCY5RKyxlg";
function getGeminiKey(): string {
  const envKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  return (envKey && envKey !== '' && envKey !== 'undefined') ? envKey : _GEMINI_KEY;
}

const GEMINI_MODELS = [
  { model: 'gemini-2.5-flash', api: 'v1beta' },
  { model: 'gemini-1.5-flash', api: 'v1'     },
  { model: 'gemini-2.0-flash', api: 'v1beta' },
];
function getGeminiUrl(model = GEMINI_MODELS[0].model, api = GEMINI_MODELS[0].api) {
  return `https://generativelanguage.googleapis.com/${api}/models/${model}:generateContent?key=${getGeminiKey()}`;
}
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// ─── i18n ──────────────────────────────────────────────────────────────────────
const i18n = {
  en: {
    title:          '🎬 AI Avatar',
    subtitle:       'Video answers with your voice and face.',
    subtitleText:   'Text answers based on your memories.',
    placeholder:    'Ask something… e.g. "Where were you born?"',
    send:           'Ask',
    thinking:       'Generating video…',
    thinkingText:   'Thinking…',
    emptyState:     'Start a conversation with the AI avatar.',
    youLabel:       'You',
    avatarLabel:    'Avatar',
    clearChat:      'Clear',
    loadingCtx:     'Loading memories…',
    answers:        'answers',
    files:          'files',
    noSetup:        'Avatar not set up yet. Go to the "🎬 Avatar Setup" tab to configure a reference photo and voice sample.',
    videoError:     'Video generation failed. Showing text response instead.',
    suggestedQ: [
      'Tell me about yourself.',
      'What was your childhood like?',
      'What do you want your loved ones to remember?',
      'What is your greatest achievement?',
      'What are your values?',
    ],
  },
  bg: {
    title:          '🎬 AI Аватар',
    subtitle:       'Видео отговори с вашия глас и лице.',
    subtitleText:   'Текстови отговори въз основа на вашите спомени.',
    placeholder:    'Задайте въпрос… напр. "Къде си роден/а?"',
    send:           'Питай',
    thinking:       'Генерирам видео…',
    thinkingText:   'Мисля…',
    emptyState:     'Започнете разговор с AI аватара.',
    youLabel:       'Вие',
    avatarLabel:    'Аватар',
    clearChat:      'Изчисти',
    loadingCtx:     'Зареждам спомени…',
    answers:        'отговора',
    files:          'файла',
    noSetup:        'Аватарът не е настроен. Отидете в таба „🎬 Настройка на аватар" за да изберете снимка и аудио за глас.',
    videoError:     'Видеото не можа да се генерира. Показвам текстов отговор.',
    suggestedQ: [
      'Разкажи ми за себе си.',
      'Какво беше детството ти?',
      'Какво искаш близките ти да помнят?',
      'Кое е най-голямото ти постижение?',
      'Какви са твоите ценности?',
    ],
  },
};

// ─── Types ──────────────────────────────────────────────────────────────────────
interface Message {
  id:        string;
  role:      'user' | 'avatar';
  text:      string;
  videoUrl?: string;   // if video was generated
  error?:    boolean;
}

interface ProfileContext {
  answersText:    string;
  answeredCount:  number;
  files:          MemoryItem[];
  docsText:       string;
  imagesAnalysis: string;
  mediaDesc:      string;
}

// ─── localStorage cache ────────────────────────────────────────────────────────
const CACHE_VERSION = 'v4';
function cacheKey(id: string) { return `avatar_file_cache_${CACHE_VERSION}_${id}`; }
function getCached(id: string): string | null {
  try {
    const val = localStorage.getItem(cacheKey(id));
    if (!val || val.length < 20) return null;
    return val;
  } catch { return null; }
}
function setCached(id: string, text: string) {
  if (!text || text.length < 20) return;
  try { localStorage.setItem(cacheKey(id), text); } catch {}
}

// ─── Gemini image analysis ─────────────────────────────────────────────────────
async function analyzeImageWithGemini(url: string, filename: string, description: string): Promise<string> {
  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const mimeType = resp.headers.get('content-type') || 'image/jpeg';
    const buffer   = await resp.arrayBuffer();
    const bytes    = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    const base64 = btoa(binary);

    const body = {
      contents: [{ parts: [
        { inlineData: { mimeType, data: base64 } },
        { text: `Анализирай тази снимка детайлно. Опиши хора, места, емоции, епоха, текст. Контекст: "${description || filename}". До 200 думи на български.` }
      ]}],
      generationConfig: { temperature: 0.3, maxOutputTokens: 300 },
    };
    for (const { model, api } of GEMINI_MODELS) {
      const r = await fetch(getGeminiUrl(model, api), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (r.status === 429 || r.status === 404) { await sleep(800); continue; }
      if (!r.ok) throw new Error(`Gemini ${r.status}`);
      const d = await r.json();
      return d?.candidates?.[0]?.content?.parts?.[0]?.text || '(no analysis)';
    }
    return `[Снимка: ${filename}]`;
  } catch {
    return `[СНИМКА: ${filename}] Описание: ${description || 'без описание'}`;
  }
}

// ─── Load profile context ──────────────────────────────────────────────────────
async function loadProfileContext(ownerUid: string, onProgress?: (msg: string) => void): Promise<ProfileContext> {
  onProgress?.('Зареждам…');
  const firebaseUser = await waitForAuthReady();
  const uid = firebaseUser?.uid || ownerUid;

  const [answersMap, memories] = await Promise.all([
    getAnswers(uid).catch(() => ({} as Record<number, { answer: string }>)),
    getMemoryItems(uid).catch(() => [] as MemoryItem[]),
  ]);

  const answersLines: string[] = [];
  LIFE_QUESTIONS.forEach(q => {
    const ans = (answersMap as any)[q.id];
    if (ans?.answer?.trim()) answersLines.push(`Въпрос ${q.id} (${q.bg}): ${ans.answer.trim()}`);
  });

  const extractedFiles: { item: MemoryItem; content: string }[] = [];
  for (let i = 0; i < memories.length; i++) {
    const item = memories[i];
    onProgress?.(`Файл ${i+1}/${memories.length}: ${item.name}`);
    let content = getCached(item.id) || '';
    if (!content) {
      if (item.type === 'photo') {
        content = await analyzeImageWithGemini(item.url, item.name, item.description || '').catch(() => `[${item.name}]`);
      } else {
        content = `[${item.type.toUpperCase()}: ${item.name}] ${item.description || ''}`;
      }
      if (content.length >= 20) setCached(item.id, content);
    }
    extractedFiles.push({ item, content });
  }

  const docsText       = extractedFiles.filter(f => f.item.type === 'document').map(f => `=== ${f.item.name} ===\n${f.content.slice(0,4000)}`).join('\n\n').slice(0,12000);
  const imagesAnalysis = extractedFiles.filter(f => f.item.type === 'photo').map(f => `=== ${f.item.name} ===\n${f.content.slice(0,800)}`).join('\n\n').slice(0,4000);
  const mediaDesc      = extractedFiles.filter(f => f.item.type === 'video' || f.item.type === 'audio').map(f => `=== ${f.item.name} ===\n${f.content.slice(0,400)}`).join('\n\n').slice(0,2000);
  const answersText    = answersLines.join('\n\n').slice(0,8000);

  return { answersText, answeredCount: answersLines.length, files: memories, docsText, imagesAnalysis, mediaDesc };
}

// ─── Build system prompt ───────────────────────────────────────────────────────
function buildSystemPrompt(ownerName: string, ctx: ProfileContext, lang: string): string {
  const base = `Ти си дигиталният аватар на ${ownerName}. Говориш от ПЪРВО лице. Отговаряй САМО въз основа на предоставения контекст. Ако нямаш информация — кажи: "Не съм оставил/а спомен за това."\n\n`;
  const context = [
    ctx.answersText && `═══ ОТГОВОРИ (${ctx.answeredCount}) ═══\n${ctx.answersText}`,
    ctx.docsText    && `═══ ДОКУМЕНТИ ═══\n${ctx.docsText}`,
    ctx.imagesAnalysis && `═══ СНИМКИ ═══\n${ctx.imagesAnalysis}`,
    ctx.mediaDesc   && `═══ МЕДИЯ ═══\n${ctx.mediaDesc}`,
  ].filter(Boolean).join('\n\n');
  return base + (context || '(Няма качено съдържание)');
}

// ─── Gemini text fallback ──────────────────────────────────────────────────────
async function callGeminiText(systemPrompt: string, question: string): Promise<string> {
  const body = {
    contents: [{ parts: [{ text: `${systemPrompt}\n\n---\n\nВъпрос: ${question}` }] }],
    generationConfig: { temperature: 0.7, maxOutputTokens: 600 },
  };
  for (const { model, api } of GEMINI_MODELS) {
    const resp = await fetch(getGeminiUrl(model, api), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (resp.status === 429) { await sleep(1500); continue; }
    if (resp.status === 404) continue;
    if (!resp.ok) throw new Error(`Gemini ${resp.status}`);
    const data = await resp.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text) return text;
  }
  throw new Error('Gemini quota exhausted');
}

// ─── Video Player Component ────────────────────────────────────────────────────
function VideoPlayer({ videoUrl, avatarPhotoUrl, onEnded }: {
  videoUrl:       string;
  avatarPhotoUrl?: string;
  onEnded?:       () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  }, [videoUrl]);

  return (
    <div className="relative w-full max-w-sm mx-auto rounded-2xl overflow-hidden"
         style={{ aspectRatio: '16/9', background: 'hsl(30 15% 7%)' }}>
      <video
        ref={videoRef}
        src={videoUrl}
        controls
        autoPlay
        playsInline
        onEnded={onEnded}
        className="w-full h-full object-cover"
        poster={avatarPhotoUrl}
      />
    </div>
  );
}

// ─── Generating animation ─────────────────────────────────────────────────────
function GeneratingVideo({ photoUrl, t }: { photoUrl?: string; t: typeof i18n.bg }) {
  return (
    <div className="flex flex-col items-center gap-4 py-6">
      <div className="relative">
        {photoUrl ? (
          <img src={photoUrl} alt="avatar" className="w-24 h-24 rounded-full object-cover"
               style={{ border: '3px solid hsl(36 80% 55%)', boxShadow: '0 0 30px hsl(36 80% 55% / 0.4)' }} />
        ) : (
          <div className="w-24 h-24 rounded-full flex items-center justify-center text-4xl"
               style={{ background: 'linear-gradient(135deg, hsl(36 80% 55% / 0.3), hsl(30 12% 11%))', border: '3px solid hsl(36 80% 55%)' }}>
            🎬
          </div>
        )}
        {/* Pulsing ring */}
        <div className="absolute inset-0 rounded-full animate-ping"
             style={{ border: '2px solid hsl(36 80% 55% / 0.4)', animationDuration: '1.5s' }} />
      </div>
      <div className="flex items-center gap-2" style={{ color: 'hsl(36 80% 55%)' }}>
        <span className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
        <span className="font-body text-sm font-medium">{t.thinking}</span>
      </div>
      {/* Step indicators */}
      <div className="flex flex-col gap-1 text-center">
        {['1. Намирам отговора…', '2. Синтезирам гласа…', '3. Анимирам аватара…'].map((step, i) => (
          <span key={i} className="font-body text-xs" style={{ color: 'hsl(38 50% 92% / 0.4)' }}>{step}</span>
        ))}
      </div>
    </div>
  );
}

// ─── Message bubble (text mode) ───────────────────────────────────────────────
function MessageBubble({ msg, avatarPhotoUrl, t }: {
  msg: Message;
  avatarPhotoUrl?: string;
  t: typeof i18n.bg;
}) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar icon */}
      <div className="flex-shrink-0 w-9 h-9 rounded-full overflow-hidden flex items-center justify-center text-sm font-bold"
           style={isUser
             ? { background: 'hsl(30 10% 20%)', color: 'hsl(38 50% 92%)' }
             : { border: '2px solid hsl(36 80% 55% / 0.5)' }
           }>
        {isUser ? '👤' : (
          avatarPhotoUrl
            ? <img src={avatarPhotoUrl} alt="avatar" className="w-full h-full object-cover" />
            : <span style={{ background: 'linear-gradient(135deg, hsl(36 80% 55%), hsl(30 12% 11%))', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>🎬</span>
        )}
      </div>

      <div className={`flex flex-col gap-1 max-w-[82%] ${isUser ? 'items-end' : 'items-start'}`}>
        <span className="text-xs font-medium px-1" style={{ color: 'hsl(38 50% 92% / 0.4)' }}>
          {isUser ? t.youLabel : t.avatarLabel}
        </span>

        {/* Video response */}
        {msg.videoUrl && !isUser ? (
          <div className="w-full">
            <VideoPlayer videoUrl={msg.videoUrl} avatarPhotoUrl={avatarPhotoUrl} />
            {msg.text && (
              <p className="mt-3 font-body text-sm leading-relaxed px-1"
                 style={{ color: 'hsl(38 50% 92% / 0.7)' }}>
                {msg.text}
              </p>
            )}
          </div>
        ) : (
          <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed
            ${isUser ? 'rounded-tr-sm' : msg.error ? 'rounded-tl-sm' : 'rounded-tl-sm'}`}
               style={isUser
                 ? { backgroundColor: 'hsl(36 80% 55%)', color: 'hsl(30 15% 7%)' }
                 : msg.error
                   ? { backgroundColor: 'hsl(0 50% 15%)', color: 'hsl(0 80% 70%)', border: '1px solid hsl(0 60% 30%)' }
                   : { backgroundColor: 'hsl(30 12% 11%)', color: 'hsl(38 50% 92% / 0.9)', border: '1px solid hsl(30 10% 18%)' }
               }>
            {msg.text.split('\n').map((line, i, arr) => (
              <React.Fragment key={i}>{line}{i < arr.length - 1 && <br />}</React.Fragment>
            ))}
          </div>
        )}
      </div>
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

  const CHAT_KEY = `avatar_chat_${ownerUid}`;

  const [messages,     setMessages]     = useState<Message[]>(() => {
    try { return JSON.parse(localStorage.getItem(CHAT_KEY) || '[]'); } catch { return []; }
  });
  const [input,        setInput]        = useState('');
  const [loading,      setLoading]      = useState(false);
  const [generating,   setGenerating]   = useState(false); // video in progress
  const [ctx,          setCtx]          = useState<ProfileContext | null>(null);
  const [loadMsg,      setLoadMsg]      = useState('');
  const [avatarConfig, setAvatarConfig] = useState<AvatarConfig | null>(null);
  const [configLoaded, setConfigLoaded] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  // Save messages
  useEffect(() => {
    try { localStorage.setItem(CHAT_KEY, JSON.stringify(messages.slice(-80))); } catch {}
  }, [messages, CHAT_KEY]);

  // Load avatar config
  useEffect(() => {
    const load = async () => {
      const firebaseUser = await waitForAuthReady();
      const uid = firebaseUser?.uid || ownerUid;
      const config = await getAvatarConfig(uid).catch(() => null);
      setAvatarConfig(config);
      setConfigLoaded(true);
    };
    load();
  }, [ownerUid]);

  // Load context
  useEffect(() => {
    const load = async () => {
      const firebaseUser = await waitForAuthReady();
      const uid = firebaseUser?.uid || ownerUid;
      loadProfileContext(uid, setLoadMsg)
        .then(c => { setCtx(c); setLoadMsg(''); })
        .catch(() => {
          setCtx({ answersText: '', answeredCount: 0, files: [], docsText: '', imagesAnalysis: '', mediaDesc: '' });
          setLoadMsg('');
        });
    };
    load();
  }, [ownerUid]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, generating]);

  const reloadContext = useCallback(async () => {
    setCtx(null);
    const firebaseUser = await waitForAuthReady();
    const uid = firebaseUser?.uid || ownerUid;
    const memories = await getMemoryItems(uid).catch(() => [] as MemoryItem[]);
    memories.forEach(m => { try { localStorage.removeItem(cacheKey(m.id)); } catch {} });
    loadProfileContext(uid, setLoadMsg)
      .then(c => { setCtx(c); setLoadMsg(''); })
      .catch(() => {
        setCtx({ answersText: '', answeredCount: 0, files: [], docsText: '', imagesAnalysis: '', mediaDesc: '' });
        setLoadMsg('');
      });
  }, [ownerUid]);

  // ── Main send handler ──────────────────────────────────────────────────────
  async function handleSend(question?: string) {
    const q = (question || input).trim();
    if (!q || loading || generating) return;

    setInput('');
    setLoading(true);
    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', text: q }]);

    const isAvatarReady = avatarConfig?.setupComplete &&
                          avatarConfig?.voiceStatus === 'ready' &&
                          avatarConfig?.photoUrl &&
                          avatarConfig?.voiceId;

    try {
      if (isAvatarReady && isFirebaseClientConfigured()) {
        // ── VIDEO MODE ─────────────────────────────────────────────────────
        setLoading(false);
        setGenerating(true);

        try {
          const functions = getFunctions(getApp(), 'europe-west1');
          const generateFn = httpsCallable<
            { question: string; ownerUid: string; ownerName: string; language: string },
            { videoUrl: string; answerText: string }
          >(functions, 'generateAvatarVideo');

          const result = await generateFn({
            question:   q,
            ownerUid,
            ownerName,
            language: locale,
          });

          setMessages(prev => [...prev, {
            id:       Date.now() + '-v',
            role:     'avatar',
            text:     result.data.answerText,
            videoUrl: result.data.videoUrl,
          }]);

        } catch (videoErr: any) {
          console.error('[AvatarChat] Video generation failed:', videoErr);
          // Fallback to text
          const profileCtx = ctx ?? { answersText: '', answeredCount: 0, files: [], docsText: '', imagesAnalysis: '', mediaDesc: '' };
          const systemPrompt = buildSystemPrompt(ownerName, profileCtx, locale);
          const answer = await callGeminiText(systemPrompt, q);
          setMessages(prev => [...prev, {
            id:   Date.now() + '-tf',
            role: 'avatar',
            text: `⚠️ ${t.videoError}\n\n${answer}`,
          }]);
        } finally {
          setGenerating(false);
        }

      } else {
        // ── TEXT MODE ──────────────────────────────────────────────────────
        const profileCtx = ctx ?? { answersText: '', answeredCount: 0, files: [], docsText: '', imagesAnalysis: '', mediaDesc: '' };
        const systemPrompt = buildSystemPrompt(ownerName, profileCtx, locale);
        const answer = await callGeminiText(systemPrompt, q);
        setMessages(prev => [...prev, { id: Date.now() + '-a', role: 'avatar', text: answer }]);
        setLoading(false);
      }

    } catch (err: any) {
      console.error('[AvatarChat] handleSend error:', err);
      const errMsg = err?.message || '';
      let msg = locale === 'bg'
        ? `⚠️ Нещо се обърка.\n[${errMsg.slice(0, 120)}]`
        : `⚠️ Something went wrong.\n[${errMsg.slice(0, 120)}]`;
      setMessages(prev => [...prev, { id: Date.now() + '-err', role: 'avatar', text: msg, error: true }]);
      setLoading(false);
      setGenerating(false);
    }

    setTimeout(() => inputRef.current?.focus(), 100);
  }

  const isAvatarReady = avatarConfig?.setupComplete && avatarConfig?.voiceStatus === 'ready';

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-h-[820px] rounded-2xl overflow-hidden"
         style={{ background: 'hsl(30 12% 11%)', border: '1px solid hsl(30 10% 18%)' }}>

      {/* ── Header ── */}
      <div className="px-5 py-4" style={{ backgroundColor: 'hsl(30 10% 14%)', borderBottom: '1px solid hsl(30 10% 18%)' }}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="font-display text-base font-bold" style={{ color: 'hsl(38 50% 92%)' }}>
                {t.title}
              </h2>
              {/* Mode badge */}
              <span className="px-2 py-0.5 rounded-full text-xs font-body font-medium"
                    style={isAvatarReady
                      ? { backgroundColor: 'hsl(36 80% 55% / 0.2)', color: 'hsl(36 80% 55%)', border: '1px solid hsl(36 80% 55% / 0.3)' }
                      : { backgroundColor: 'hsl(30 10% 20%)', color: 'hsl(38 50% 92% / 0.5)', border: '1px solid hsl(30 10% 25%)' }
                    }>
                {isAvatarReady ? '🎬 Видео режим' : '💬 Текстов режим'}
              </span>
            </div>
            <p className="font-body text-xs mt-0.5" style={{ color: 'hsl(38 50% 92% / 0.5)' }}>
              {isAvatarReady ? t.subtitle : t.subtitleText}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Context badge */}
            {ctx && (
              <div className="flex items-center gap-1.5 text-xs px-3 py-1 rounded-full"
                   style={{ backgroundColor: 'hsl(30 15% 7%)', color: 'hsl(38 50% 92% / 0.5)', border: '1px solid hsl(30 10% 18%)' }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: ctx.answeredCount > 0 ? 'hsl(142 70% 50%)' : 'hsl(38 50% 40%)' }} />
                {ctx.answeredCount} {t.answers} · {ctx.files.length} {t.files}
              </div>
            )}
            <button onClick={reloadContext} title="Reload context"
                    className="text-xs px-2 py-1.5 rounded-lg transition-colors"
                    style={{ color: 'hsl(38 50% 92% / 0.4)' }}>🔄</button>
            {messages.length > 0 && (
              <button onClick={() => { setMessages([]); try { localStorage.removeItem(CHAT_KEY); } catch {} }}
                      className="text-xs px-3 py-1.5 rounded-lg transition-colors"
                      style={{ color: 'hsl(38 50% 92% / 0.4)' }}>
                {t.clearChat}
              </button>
            )}
          </div>
        </div>

        {/* Loading progress */}
        {loadMsg && (
          <div className="mt-2 flex items-center gap-2 text-xs px-3 py-2 rounded-lg"
               style={{ backgroundColor: 'hsl(36 80% 55% / 0.1)', color: 'hsl(36 80% 55%)' }}>
            <span className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin flex-shrink-0" />
            <span className="truncate">{loadMsg}</span>
          </div>
        )}

        {/* No setup warning */}
        {configLoaded && !isAvatarReady && (
          <div className="mt-2 text-xs px-3 py-2 rounded-lg"
               style={{ backgroundColor: 'hsl(36 80% 55% / 0.08)', color: 'hsl(38 50% 92% / 0.6)', border: '1px solid hsl(36 80% 55% / 0.2)' }}>
            💡 {t.noSetup}
          </div>
        )}
      </div>

      {/* ── Messages area ── */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
        {messages.length === 0 && !loading && !generating ? (
          <div className="flex flex-col items-center justify-center h-full gap-5 py-4">
            {/* Avatar preview */}
            <div className="relative">
              {avatarConfig?.photoUrl ? (
                <img src={avatarConfig.photoUrl} alt="avatar"
                     className="w-24 h-24 rounded-full object-cover"
                     style={{ border: '3px solid hsl(36 80% 55% / 0.5)', boxShadow: '0 0 40px hsl(36 80% 55% / 0.2)' }} />
              ) : (
                <div className="w-24 h-24 rounded-full flex items-center justify-center text-4xl"
                     style={{ background: 'linear-gradient(135deg, hsl(36 80% 55% / 0.15), hsl(30 10% 14%))', border: '2px solid hsl(36 80% 55% / 0.3)' }}>
                  🎬
                </div>
              )}
              {isAvatarReady && (
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-xs"
                     style={{ backgroundColor: 'hsl(142 70% 50%)', border: '2px solid hsl(30 12% 11%)' }}>
                  ✓
                </div>
              )}
            </div>

            <div className="text-center max-w-xs">
              <p className="font-body text-sm" style={{ color: 'hsl(38 50% 92% / 0.7)' }}>
                {t.emptyState}
              </p>
            </div>

            {/* Suggested questions */}
            <div className="flex flex-col gap-2 w-full max-w-sm">
              {t.suggestedQ.map((q, i) => (
                <button key={i} onClick={() => handleSend(q)}
                        className="text-left text-sm px-4 py-2.5 rounded-xl transition-all font-body"
                        style={{ backgroundColor: 'hsl(30 10% 14%)', color: 'hsl(38 50% 92% / 0.8)', border: '1px solid hsl(30 10% 20%)' }}>
                  💬 {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map(msg => (
              <MessageBubble key={msg.id} msg={msg} avatarPhotoUrl={avatarConfig?.photoUrl} t={t} />
            ))}
            {/* Video generating animation */}
            {generating && <GeneratingVideo photoUrl={avatarConfig?.photoUrl} t={t} />}
            {/* Text thinking */}
            {loading && !generating && (
              <div className="flex gap-3">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm flex-shrink-0"
                     style={{ border: '2px solid hsl(36 80% 55% / 0.4)' }}>
                  {avatarConfig?.photoUrl
                    ? <img src={avatarConfig.photoUrl} alt="avatar" className="w-full h-full rounded-full object-cover" />
                    : '🎬'}
                </div>
                <div className="px-4 py-3 rounded-2xl rounded-tl-sm"
                     style={{ backgroundColor: 'hsl(30 10% 14%)', border: '1px solid hsl(30 10% 18%)' }}>
                  <div className="flex gap-1.5 items-center h-5">
                    {[0,1,2].map(i => (
                      <div key={i} className="w-2 h-2 rounded-full animate-bounce"
                           style={{ backgroundColor: 'hsl(36 80% 55%)', animationDelay: `${i*0.15}s` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Input ── */}
      <div className="px-5 py-4" style={{ borderTop: '1px solid hsl(30 10% 18%)', backgroundColor: 'hsl(30 10% 14%)' }}>
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder={t.placeholder}
            disabled={loading || generating}
            className="flex-1 rounded-xl px-4 py-2.5 text-sm font-body focus:outline-none disabled:opacity-50"
            style={{ backgroundColor: 'hsl(30 15% 7%)', color: 'hsl(38 50% 92%)', border: '1px solid hsl(30 10% 22%)', caretColor: 'hsl(36 80% 55%)' }}
          />
          <button
            onClick={() => handleSend()}
            disabled={loading || generating || !input.trim()}
            className="font-body font-semibold px-5 py-2.5 rounded-xl transition-all text-sm flex items-center gap-2 disabled:opacity-50"
            style={{ backgroundColor: 'hsl(36 80% 55%)', color: 'hsl(30 15% 7%)' }}>
            {(loading || generating)
              ? <><span className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />{generating ? t.thinking : t.thinkingText}</>
              : t.send}
          </button>
        </div>
      </div>
    </div>
  );
}
