'use client';
/**
 * AvatarChat v3 — AI Avatar with Video Response + Gemini Fallback
 *
 * Pipeline (VIDEO MODE - avatar configured):
 *  1. User asks a question
 *  2. Calls generateAvatarVideo Cloud Function (RAG → ElevenLabs → D-ID → video)
 *  3. Shows fullscreen video player with the talking avatar
 *  4. Question input at the bottom
 *
 * Pipeline (TEXT MODE via Cloud Functions):
 *  1. Calls queryAvatar Cloud Function (RAG → Claude/Anthropic)
 *  2. Shows text response
 *
 * Pipeline (TEXT MODE via Gemini fallback - when Functions not deployed):
 *  1. Loads answers from Firestore client-side
 *  2. Calls Gemini API directly with answers as context
 *  3. Shows text response
 *
 * Layout:
 *  - Top: header with mode badge + context info
 *  - Middle: FULL HEIGHT avatar video/photo + chat messages below
 *  - Bottom: input field always visible
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useLang } from '@/components/LangContext';
import type { AppUser, AvatarConfig } from '@/lib/clientStore';
import { waitForAuthReady, getAvatarConfig, getAnswers } from '@/lib/clientStore';
import { isFirebaseClientConfigured, getFirebaseApp } from '@/lib/firebaseClient';
import { getFunctions, httpsCallable } from 'firebase/functions';

// ─── Gemini direct fallback (used when Cloud Functions are not deployed) ────────
const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';
const GEMINI_MODEL   = 'gemini-2.0-flash';

async function callGeminiFallback(
  question:       string,
  ownerName:      string,
  answersContext: string,
  language:       string,
): Promise<string> {
  if (!GEMINI_API_KEY) {
    return language === 'bg'
      ? 'AI аватарът все още не е конфигуриран. Моля, свържете се с администратора.'
      : 'The AI avatar is not configured yet. Please contact the administrator.';
  }

  const systemBg = `Ти си дигиталният аватар на ${ownerName}. Говориш от ПЪРВО лице — като самия него/нея.

ПРАВИЛО 1: Отговаряй САМО въз основа на предоставените по-долу отговори на житейски въпроси.
ПРАВИЛО 2: Ако нямаш информация — кажи го честно и топло, не измисляй.
ПРАВИЛО 3: Пиши на БЪЛГАРСКИ език. Отговорите да са кратки (2-4 изречения) и топли.

═══ ОТГОВОРИ НА ЖИТЕЙСКИ ВЪПРОСИ ═══
${answersContext || 'Все още няма попълнени отговори.'}
═══════════════════════════════════════`;

  const systemEn = `You are the digital avatar of ${ownerName}. You speak in FIRST person — as themselves.

RULE 1: Answer ONLY based on the life-question answers provided below.
RULE 2: If you have no information — say so honestly and warmly, do not make things up.
RULE 3: Write in ENGLISH. Keep responses short (2-4 sentences) and warm.

═══ LIFE QUESTION ANSWERS ═══
${answersContext || 'No answers filled in yet.'}
════════════════════════════`;

  const systemPrompt = language === 'bg' ? systemBg : systemEn;

  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: question }] }],
        generationConfig: { maxOutputTokens: 512, temperature: 0.7 },
      }),
    }
  );

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    throw new Error(`Gemini ${resp.status}: ${errText.slice(0, 150)}`);
  }

  const data = await resp.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini returned empty response.');
  return text;
}

// ─── i18n ──────────────────────────────────────────────────────────────────────
const i18n = {
  en: {
    title:        '🎬 AI Avatar',
    videoMode:    '🎬 Video mode',
    textMode:     '💬 Text mode',
    fallbackMode: '💬 Basic mode',
    subtitle:     'Video answers with your voice and face.',
    subtitleText: 'Text answers based on your memories.',
    placeholder:  'Ask something… e.g. "Where were you born?"',
    send:         'Ask',
    thinking:     'Generating video…',
    thinkingText: 'Thinking…',
    youLabel:     'You',
    avatarLabel:  'Avatar',
    clearChat:    'Clear',
    answers:      'answers',
    files:        'files',
    noSetup:      'Avatar not set up. Go to "🎬 Avatar Setup" to configure a photo and voice.',
    videoError:   'Video failed. Showing text response.',
    step1:        '1. Finding answer…',
    step2:        '2. Synthesizing voice…',
    step3:        '3. Animating avatar…',
    emptyHint:    'Ask me anything — I will answer based on your life answers.',
    suggestedQ: [
      'Tell me about yourself.',
      'What was your childhood like?',
      'What do you want loved ones to remember?',
      'What is your greatest achievement?',
      'What are your values?',
    ],
  },
  bg: {
    title:        '🎬 AI Аватар',
    videoMode:    '🎬 Видео режим',
    textMode:     '💬 Текстов режим',
    fallbackMode: '💬 Базов режим',
    subtitle:     'Видео отговори с вашия глас и лице.',
    subtitleText: 'Текстови отговори въз основа на вашите спомени.',
    placeholder:  'Задайте въпрос… напр. "Къде си роден/а?"',
    send:         'Питай',
    thinking:     'Генерирам видео…',
    thinkingText: 'Мисля…',
    youLabel:     'Вие',
    avatarLabel:  'Аватар',
    clearChat:    'Изчисти',
    answers:      'отговора',
    files:        'файла',
    noSetup:      'Аватарът не е настроен. Отидете в „🎬 Настройка на аватар" за снимка и глас.',
    videoError:   'Видеото не се генерира. Показвам текстов отговор.',
    step1:        '1. Намирам отговора…',
    step2:        '2. Синтезирам гласа…',
    step3:        '3. Анимирам аватара…',
    emptyHint:    'Задайте въпрос — ще отговоря въз основа на вашите житейски отговори.',
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
  videoUrl?: string;
  error?:    boolean;
}

// ─── Colors ────────────────────────────────────────────────────────────────────
const A   = 'hsl(36 80% 55%)';   // gold
const CR  = 'hsl(38 50% 92%)';   // cream
const DM  = 'hsl(38 40% 75% / 0.6)';
const DK  = 'hsl(30 15% 7%)';    // dark bg
const C11 = 'hsl(30 12% 11%)';   // card bg
const C14 = 'hsl(30 10% 14%)';   // header bg
const C18 = 'hsl(30 10% 18%)';   // border

// ─── Gemini fallback helper (loads answers from Firestore, then calls Gemini) ──
async function callGeminiFallbackWithAnswers(
  question:  string,
  ownerUid:  string,
  ownerName: string,
  language:  string,
): Promise<string> {
  // Load life answers from Firestore (client-side)
  let answersContext = '';
  try {
    const answers = await getAnswers(ownerUid);
    answersContext = Object.values(answers)
      .filter(a => a.answer?.trim())
      .map(a => `Q${a.questionId}: ${a.answer}`)
      .join('\n');
  } catch (e) {
    console.warn('[Gemini fallback] Could not load answers:', e);
  }
  return callGeminiFallback(question, ownerName, answersContext, language);
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

  const CHAT_KEY = `avatar_chat_v3_${ownerUid}`;

  const [messages,     setMessages]     = useState<Message[]>(() => {
    try { return JSON.parse(localStorage.getItem(CHAT_KEY) || '[]'); } catch { return []; }
  });
  const [input,        setInput]        = useState('');
  const [loading,      setLoading]      = useState(false);
  const [generating,   setGenerating]   = useState(false);
  const [avatarConfig, setAvatarConfig] = useState<AvatarConfig | null>(null);
  const [configLoaded, setConfigLoaded] = useState(false);
  // useFallback: true when Cloud Functions are unavailable → use Gemini directly
  const [useFallback,  setUseFallback]  = useState(false);
  // Track which video is currently playing (latest)
  const [activeVideoUrl, setActiveVideoUrl] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);
  const videoRef  = useRef<HTMLVideoElement>(null);

  // Persist messages
  useEffect(() => {
    try { localStorage.setItem(CHAT_KEY, JSON.stringify(messages.slice(-60))); } catch {}
  }, [messages, CHAT_KEY]);

  // Load avatar config
  useEffect(() => {
    (async () => {
      const fu  = await waitForAuthReady();
      const uid = fu?.uid || ownerUid;
      const cfg = await getAvatarConfig(uid).catch(() => null);
      setAvatarConfig(cfg);
      setConfigLoaded(true);
    })();
  }, [ownerUid]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, generating]);

  // Auto-play new video
  useEffect(() => {
    if (activeVideoUrl && videoRef.current) {
      videoRef.current.load();
      videoRef.current.play().catch(() => {});
    }
  }, [activeVideoUrl]);

  const isAvatarReady = !!(
    avatarConfig?.setupComplete &&
    avatarConfig?.voiceStatus === 'ready' &&
    avatarConfig?.photoUrl &&
    avatarConfig?.voiceId
  );

  // ── Send handler ──────────────────────────────────────────────────────────
  async function handleSend(question?: string) {
    const q = (question || input).trim();
    if (!q || loading || generating) return;

    setInput('');
    const userMsgId = Date.now().toString();
    setMessages(prev => [...prev, { id: userMsgId, role: 'user', text: q }]);

    try {
      if (isAvatarReady && isFirebaseClientConfigured() && !useFallback) {
        // ── VIDEO MODE ──────────────────────────────────────────────────────
        setGenerating(true);
        try {
          const fns = getFunctions(getFirebaseApp(), 'us-central1');
          const generateFn = httpsCallable<
            { question: string; ownerUid: string; ownerName: string; language: string },
            { videoUrl: string; answerText: string }
          >(fns, 'generateAvatarVideo');

          const result = await generateFn({ question: q, ownerUid, ownerName, language: locale });

          const newVideoUrl = result.data.videoUrl;
          setActiveVideoUrl(newVideoUrl);
          setMessages(prev => [...prev, {
            id:       Date.now() + '-v',
            role:     'avatar',
            text:     result.data.answerText || '',
            videoUrl: newVideoUrl,
          }]);

        } catch (videoErr: any) {
          // Fallback to text via queryAvatar Cloud Function
          console.error('[AvatarChat] Video generation failed:', videoErr);
          try {
            const fns = getFunctions(getFirebaseApp(), 'us-central1');
            const queryFn = httpsCallable<
              { question: string; ownerUid: string; ownerName: string; language: string },
              { answer: string }
            >(fns, 'queryAvatar');
            const res = await queryFn({ question: q, ownerUid, ownerName, language: locale });
            setMessages(prev => [...prev, {
              id:   Date.now() + '-tf',
              role: 'avatar',
              text: `⚠️ ${t.videoError}\n\n${res.data.answer}`,
            }]);
          } catch (textErr: any) {
            // Both video AND text Cloud Functions failed → try Gemini fallback
            console.warn('[AvatarChat] Cloud Functions unavailable, switching to Gemini fallback');
            setUseFallback(true);
            const answer = await callGeminiFallbackWithAnswers(q, ownerUid, ownerName, locale);
            setMessages(prev => [...prev, { id: Date.now() + '-gf', role: 'avatar', text: answer }]);
          }
        } finally {
          setGenerating(false);
        }

      } else if (!useFallback && isFirebaseClientConfigured()) {
        // ── TEXT MODE via queryAvatar Cloud Function ─────────────────────────
        setLoading(true);
        try {
          const fns = getFunctions(getFirebaseApp(), 'us-central1');
          const queryFn = httpsCallable<
            { question: string; ownerUid: string; ownerName: string; language: string; topK: number },
            { answer: string; chunks: number }
          >(fns, 'queryAvatar');

          const res = await queryFn({
            question: q,
            ownerUid,
            ownerName,
            language: locale,
            topK:     6,
          });
          setMessages(prev => [...prev, {
            id:   Date.now() + '-a',
            role: 'avatar',
            text: res.data.answer,
          }]);
        } catch (fnErr: any) {
          // Cloud Functions not deployed → switch to Gemini fallback permanently
          console.warn('[AvatarChat] queryAvatar Cloud Function failed, switching to Gemini fallback:', fnErr?.message);
          setUseFallback(true);
          const answer = await callGeminiFallbackWithAnswers(q, ownerUid, ownerName, locale);
          setMessages(prev => [...prev, { id: Date.now() + '-gfb', role: 'avatar', text: answer }]);
        } finally {
          setLoading(false);
        }

      } else {
        // ── GEMINI FALLBACK MODE (Cloud Functions unavailable) ───────────────
        setLoading(true);
        const answer = await callGeminiFallbackWithAnswers(q, ownerUid, ownerName, locale);
        setMessages(prev => [...prev, { id: Date.now() + '-g', role: 'avatar', text: answer }]);
        setLoading(false);
      }

    } catch (err: any) {
      console.error('[AvatarChat] error:', err);
      const errMsg = err?.message || err?.details || String(err);
      setMessages(prev => [...prev, {
        id:    Date.now() + '-err',
        role:  'avatar',
        text:  `⚠️ ${errMsg.slice(0, 200)}`,
        error: true,
      }]);
      setLoading(false);
      setGenerating(false);
    }

    setTimeout(() => inputRef.current?.focus(), 100);
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    setMessages([]);
    setActiveVideoUrl(null);
    try { localStorage.removeItem(CHAT_KEY); } catch {}
  };

  // Latest video from messages
  const latestVideoMsg = [...messages].reverse().find(m => m.videoUrl);
  const displayVideoUrl = activeVideoUrl || latestVideoMsg?.videoUrl || null;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="flex flex-col rounded-2xl overflow-hidden"
      style={{
        background:  C11,
        border:      `1px solid ${C18}`,
        height:      'calc(100vh - 7rem)',
        minHeight:   '600px',
        maxHeight:   '1000px',
      }}
    >
      {/* ══ HEADER ══ */}
      <div
        className="flex-shrink-0 px-5 py-3 flex items-center justify-between gap-3"
        style={{ background: C14, borderBottom: `1px solid ${C18}` }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <h2 className="font-display text-base font-bold" style={{ color: CR }}>
            {t.title}
          </h2>
          <span
            className="px-2 py-0.5 rounded-full text-xs font-body font-medium"
            style={isAvatarReady
              ? { background: `${A}22`, color: A, border: `1px solid ${A}44` }
              : { background: 'hsl(30 10% 20%)', color: DM, border: '1px solid hsl(30 10% 25%)' }
            }
          >
            {isAvatarReady && !useFallback ? t.videoMode : useFallback ? t.fallbackMode : t.textMode}
          </span>
        </div>

        {messages.length > 0 && (
          <button
            onClick={clearChat}
            className="text-xs px-3 py-1.5 rounded-lg transition-opacity opacity-50 hover:opacity-100"
            style={{ color: DM }}
          >
            {t.clearChat}
          </button>
        )}
      </div>

      {/* No setup warning */}
      {configLoaded && !isAvatarReady && (
        <div
          className="flex-shrink-0 mx-4 mt-3 text-xs px-3 py-2 rounded-lg"
          style={{ background: `${A}0D`, color: DM, border: `1px solid ${A}33` }}
        >
          💡 {t.noSetup}
        </div>
      )}

      {/* ══ MAIN CONTENT AREA ══ */}
      <div className="flex-1 overflow-y-auto flex flex-col">

        {/* ── AVATAR DISPLAY (full width, prominent) ── */}
        {isAvatarReady && (
          <div
            className="flex-shrink-0 relative w-full"
            style={{ background: DK }}
          >
            {generating ? (
              /* Generating animation */
              <div
                className="w-full flex flex-col items-center justify-center gap-4 py-10"
                style={{ minHeight: '340px', background: 'hsl(30 15% 6%)' }}
              >
                {avatarConfig?.photoUrl && (
                  <div className="relative">
                    <img
                      src={avatarConfig.photoUrl}
                      alt="avatar"
                      className="w-32 h-32 rounded-full object-cover"
                      style={{
                        border:     `3px solid ${A}`,
                        boxShadow:  `0 0 40px ${A}55`,
                        filter:     'brightness(0.85)',
                      }}
                    />
                    {/* Pulsing ring */}
                    <div
                      className="absolute inset-0 rounded-full animate-ping"
                      style={{ border: `3px solid ${A}55`, animationDuration: '1.5s' }}
                    />
                  </div>
                )}
                <div className="flex items-center gap-2" style={{ color: A }}>
                  <span className="w-5 h-5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                  <span className="font-body text-sm font-medium">{t.thinking}</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  {[t.step1, t.step2, t.step3].map((step, i) => (
                    <span key={i} className="font-body text-xs" style={{ color: `${CR}44` }}>{step}</span>
                  ))}
                </div>
              </div>
            ) : displayVideoUrl ? (
              /* Video player — full width */
              <div className="w-full relative" style={{ background: '#000' }}>
                <video
                  ref={videoRef}
                  key={displayVideoUrl}
                  src={displayVideoUrl}
                  controls
                  autoPlay
                  playsInline
                  poster={avatarConfig?.photoUrl}
                  className="w-full"
                  style={{
                    maxHeight:    '480px',
                    objectFit:    'contain',
                    display:      'block',
                  }}
                />
              </div>
            ) : (
              /* Static photo — full width before first question */
              <div
                className="w-full relative overflow-hidden flex items-center justify-center"
                style={{ minHeight: '320px', maxHeight: '420px', background: 'hsl(30 15% 6%)' }}
              >
                {avatarConfig?.photoUrl ? (
                  <img
                    src={avatarConfig.photoUrl}
                    alt="avatar"
                    className="w-full h-full object-cover"
                    style={{ maxHeight: '420px', objectFit: 'cover', opacity: 0.9 }}
                  />
                ) : (
                  <div
                    className="w-40 h-40 rounded-full flex items-center justify-center text-6xl"
                    style={{ background: `${A}22`, border: `3px solid ${A}` }}
                  >
                    🎬
                  </div>
                )}
                {/* Overlay hint */}
                <div
                  className="absolute bottom-0 left-0 right-0 px-4 py-4 text-center font-body text-sm"
                  style={{
                    background: 'linear-gradient(transparent, rgba(10,8,6,0.85))',
                    color:      DM,
                  }}
                >
                  {t.emptyHint}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── CHAT MESSAGES ── */}
        <div className="flex-1 px-4 py-4 space-y-4">

          {/* Empty state with suggested questions */}
          {messages.length === 0 && !loading && !generating && (
            <div className="pt-2 pb-4">
              {!isAvatarReady && (
                /* Big avatar placeholder for text mode */
                <div
                  className="w-full mb-5 flex items-center justify-center rounded-2xl overflow-hidden"
                  style={{ height: '260px', background: 'hsl(30 15% 6%)', border: `1px solid ${C18}` }}
                >
                  <div className="text-center">
                    <div className="text-6xl mb-3">🎬</div>
                    <p className="font-body text-sm" style={{ color: DM }}>{t.emptyHint}</p>
                  </div>
                </div>
              )}
              <p className="font-body text-xs mb-3 px-1" style={{ color: `${CR}55` }}>
                {locale === 'bg' ? 'Предложени въпроси:' : 'Suggested questions:'}
              </p>
              <div className="flex flex-wrap gap-2">
                {t.suggestedQ.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(q)}
                    className="font-body text-xs px-3 py-2 rounded-full transition-all hover:opacity-80 text-left"
                    style={{ background: `${A}15`, color: A, border: `1px solid ${A}33` }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map(msg => (
            <ChatMessage
              key={msg.id}
              msg={msg}
              t={t}
              avatarPhotoUrl={avatarConfig?.photoUrl}
            />
          ))}

          {/* Loading indicator */}
          {loading && (
            <div className="flex items-center gap-2 py-2" style={{ color: A }}>
              <span className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
              <span className="font-body text-sm">{t.thinkingText}</span>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* ══ INPUT BAR (always at bottom) ══ */}
      <div
        className="flex-shrink-0 px-4 py-4"
        style={{ background: C14, borderTop: `1px solid ${C18}` }}
      >
        <div className="flex gap-3 items-end">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t.placeholder}
            disabled={loading || generating}
            className="flex-1 font-body text-sm px-4 py-3 rounded-xl outline-none transition-colors"
            style={{
              background:   'hsl(30 12% 9%)',
              border:       `1px solid ${loading || generating ? C18 : `${A}44`}`,
              color:        CR,
              caretColor:   A,
            }}
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || loading || generating}
            className="font-body font-semibold text-sm px-5 py-3 rounded-xl transition-all disabled:opacity-40 flex-shrink-0"
            style={{
              background: (!input.trim() || loading || generating) ? 'hsl(30 10% 20%)' : A,
              color:      (!input.trim() || loading || generating) ? DM : DK,
            }}
          >
            {t.send}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Message Bubble ────────────────────────────────────────────────────────────
function ChatMessage({
  msg,
  t,
  avatarPhotoUrl,
}: {
  msg:            Message;
  t:              typeof i18n.bg;
  avatarPhotoUrl?: string;
}) {
  const isUser = msg.role === 'user';

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar icon */}
      <div
        className="flex-shrink-0 w-8 h-8 rounded-full overflow-hidden flex items-center justify-center text-xs font-bold"
        style={isUser
          ? { background: 'hsl(30 10% 22%)', color: CR }
          : { border: `2px solid ${A}55` }
        }
      >
        {isUser ? '👤' : (
          avatarPhotoUrl
            ? <img src={avatarPhotoUrl} alt="av" className="w-full h-full object-cover" />
            : <span style={{ background: `${A}33`, display:'flex', alignItems:'center', justifyContent:'center', width:'100%', height:'100%' }}>🎬</span>
        )}
      </div>

      <div className={`flex flex-col gap-1 max-w-[85%] ${isUser ? 'items-end' : 'items-start'}`}>
        <span className="text-xs px-1" style={{ color: `${CR}44` }}>
          {isUser ? t.youLabel : t.avatarLabel}
        </span>

        {/* Video is shown in the main display area - just show transcript here */}
        {msg.videoUrl && !isUser ? (
          <div
            className="rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed"
            style={{ background: `${A}11`, color: DM, border: `1px solid ${A}22` }}
          >
            {msg.text && (
              <p className="font-body text-sm" style={{ color: `${CR}88` }}>
                📝 {msg.text}
              </p>
            )}
          </div>
        ) : (
          <div
            className={`rounded-2xl px-4 py-3 text-sm leading-relaxed font-body ${isUser ? 'rounded-tr-sm' : 'rounded-tl-sm'}`}
            style={isUser
              ? { background: A, color: DK }
              : msg.error
                ? { background: 'hsl(0 50% 13%)', color: 'hsl(0 80% 70%)', border: '1px solid hsl(0 60% 28%)' }
                : { background: C11, color: `${CR}EE`, border: `1px solid ${C18}` }
            }
          >
            {msg.text.split('\n').map((line, i, arr) => (
              <React.Fragment key={i}>{line}{i < arr.length - 1 && <br />}</React.Fragment>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
