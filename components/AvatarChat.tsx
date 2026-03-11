'use client';
/**
 * AvatarChat v5 — onRequest fetch() architecture (CORS fix)
 * Uses fetch() + Firebase ID token instead of httpsCallable()
 * This bypasses the Cloud Run IAM allUsers invoker CORS issue.
 *
 * ══ PIPELINE ══
 *
 * VIDEO MODE (avatar fully configured: photo + cloned voice + setupComplete):
 *   User question → generateAvatarVideo Cloud Function
 *     → RAG search (OpenAI embeddings + Firestore vectors)
 *     → Claude answer (Anthropic claude-3-5-haiku)
 *     → ElevenLabs TTS with cloned voice
 *     → D-ID talking avatar video
 *   Result: video plays in the large avatar display area
 *
 * TEXT MODE (no avatar setup yet):
 *   User question → queryAvatar Cloud Function
 *     → RAG search (OpenAI embeddings + Firestore vectors)
 *     → Claude answer (Anthropic claude-3-5-haiku)
 *   Result: text response shown in chat
 *
 * ══ UI LAYOUT ══
 *   ┌─────────────────────────────────────────────┐
 *   │  Header: AI Avatar | mode badge | Clear     │
 *   ├─────────────────────────────────────────────┤
 *   │                                             │
 *   │   LARGE AVATAR DISPLAY                      │
 *   │   • Static photo (before first question)    │
 *   │   • Video player (after video generated)    │
 *   │   • Loading animation (generating)          │
 *   │   [ ~37% of height ]                        │
 *   │                                             │
 *   ├─────────────────────────────────────────────┤
 *   │  Chat transcript (scrollable)               │
 *   │  [ ~30% of height ]                         │
 *   ├─────────────────────────────────────────────┤
 *   │  ┌──────────────────────────────┐ [Питай]  │
 *   │  │  Ask something...            │           │
 *   │  └──────────────────────────────┘           │
 *   └─────────────────────────────────────────────┘
 *
 * NOTE: NO Gemini. All AI runs through Firebase Cloud Functions.
 * If Functions are not deployed, show a clear action-required message.
 */
import React, { useState, useRef, useEffect } from 'react';
import { useLang } from '@/components/LangContext';
import type { AppUser, AvatarConfig } from '@/lib/clientStore';
import { waitForAuthReady, getAvatarConfig } from '@/lib/clientStore';
import { isFirebaseClientConfigured, getFirebaseApp } from '@/lib/firebaseClient';
import { getAuth } from 'firebase/auth';

// ─── Cloud Functions base URL ─────────────────────────────────────────────────
const CF_BASE = 'https://us-central1-meafterme-d0347.cloudfunctions.net';

// ─── Helper: call onRequest Firebase Function with auth token ─────────────────
async function callFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const app   = getFirebaseApp();
  const fbAuth = getAuth(app);
  const currentUser = fbAuth.currentUser;
  if (!currentUser) throw new Error('Not authenticated');

  const token = await currentUser.getIdToken();
  const resp  = await fetch(`${CF_BASE}/${name}`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const json = await resp.json();
  if (!resp.ok) {
    const msg = json?.error?.message || `HTTP ${resp.status}`;
    throw new Error(msg);
  }
  // onRequest functions return { result: ... }
  return (json.result ?? json) as T;
}

// ─── i18n ──────────────────────────────────────────────────────────────────────
const i18n = {
  en: {
    title:          '🎬 AI Avatar',
    videoMode:      '🎬 Video mode',
    textMode:       '💬 Text mode',
    clearChat:      'Clear',
    placeholder:    'Ask something… e.g. "Where were you born?"',
    send:           'Ask',
    thinking:       'Generating video…',
    thinkingText:   'Thinking…',
    youLabel:       'You',
    avatarLabel:    'Avatar',
    step1:          '1. Generating answer (Claude)…',
    step2:          '2. Synthesizing voice (ElevenLabs)…',
    step3:          '3. Animating avatar (D-ID)…',
    emptyHint:      'Ask a question — the avatar will answer in your voice.',
    noSetupTitle:   'Avatar not set up',
    noSetupMsg:     'Go to "🎬 Avatar Setup" to select a reference photo and clone your voice.',
    funcsNotReady:  'The AI avatar service is not active yet.',
    funcsAction:    'Firebase Cloud Functions need to be deployed. Please contact the administrator.',
    videoError:     'Video generation failed. Showing text answer.',
    suggestedQ: [
      'Tell me about yourself.',
      'What was your childhood like?',
      'What do you want your loved ones to remember?',
      'What is your greatest achievement?',
      'What are your core values?',
    ],
  },
  bg: {
    title:          '🎬 AI Аватар',
    videoMode:      '🎬 Видео режим',
    textMode:       '💬 Текстов режим',
    clearChat:      'Изчисти',
    placeholder:    'Задайте въпрос… напр. "Кога си роден/а?"',
    send:           'Питай',
    thinking:       'Генерирам видео…',
    thinkingText:   'Мисля…',
    youLabel:       'Вие',
    avatarLabel:    'Аватар',
    step1:          '1. Генерирам отговор (Claude)…',
    step2:          '2. Синтезирам глас (ElevenLabs)…',
    step3:          '3. Анимирам аватара (D-ID)…',
    emptyHint:      'Задайте въпрос — аватарът ще отговори с вашия глас.',
    noSetupTitle:   'Аватарът не е настроен',
    noSetupMsg:     'Отидете в „🎬 Настройка на аватар" за снимка и клониране на глас.',
    funcsNotReady:  'AI аватар услугата не е активна.',
    funcsAction:    'Firebase Cloud Functions трябва да бъдат деплойнати. Свържете се с администратора.',
    videoError:     'Видеото не се генерира. Показвам текстов отговор.',
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
interface ChatMessage {
  id:        string;
  role:      'user' | 'avatar';
  text:      string;
  videoUrl?: string;
  error?:    boolean;
}

// ─── Colors ────────────────────────────────────────────────────────────────────
const GOLD  = 'hsl(36 80% 55%)';
const CREAM = 'hsl(38 50% 92%)';
const MUTED = 'hsl(38 40% 75% / 0.6)';
const DARK  = 'hsl(30 15% 7%)';
const CARD  = 'hsl(30 12% 11%)';
const HDR   = 'hsl(30 10% 14%)';
const BDR   = 'hsl(30 10% 18%)';

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
  const t = i18n[locale as 'en' | 'bg'] ?? i18n.bg;

  const CHAT_KEY = `avatar_chat_v4_${ownerUid}`;

  const [messages,      setMessages]      = useState<ChatMessage[]>(() => {
    try { return JSON.parse(localStorage.getItem(CHAT_KEY) || '[]'); } catch { return []; }
  });
  const [input,         setInput]         = useState('');
  const [loading,       setLoading]       = useState(false);
  const [generating,    setGenerating]    = useState(false);
  const [genStep,       setGenStep]       = useState(0); // 0=idle 1=claude 2=tts 3=did
  const [avatarConfig,  setAvatarConfig]  = useState<AvatarConfig | null>(null);
  const [configLoaded,  setConfigLoaded]  = useState(false);
  const [activeVideo,   setActiveVideo]   = useState<string | null>(null);
  const [fnError,       setFnError]       = useState<string | null>(null); // Functions not deployed

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);
  const videoRef  = useRef<HTMLVideoElement>(null);

  // Persist chat history
  useEffect(() => {
    try { localStorage.setItem(CHAT_KEY, JSON.stringify(messages.slice(-60))); } catch {}
  }, [messages, CHAT_KEY]);

  // Load avatar config on mount
  useEffect(() => {
    (async () => {
      const fu  = await waitForAuthReady();
      const uid = fu?.uid ?? ownerUid;
      const cfg = await getAvatarConfig(uid).catch(() => null);
      setAvatarConfig(cfg);
      setConfigLoaded(true);
    })();
  }, [ownerUid]);

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, generating]);

  // Auto-play when new video arrives
  useEffect(() => {
    if (activeVideo && videoRef.current) {
      videoRef.current.load();
      videoRef.current.play().catch(() => {});
    }
  }, [activeVideo]);

  // Avatar is "ready" when voice clone + photo are set (setupComplete is optional)
  // NOTE: setupComplete removed from check — voiceId + photoUrl are sufficient
  const isAvatarReady = !!(
    avatarConfig?.voiceStatus === 'ready' &&
    avatarConfig?.photoUrl &&
    avatarConfig?.voiceId
  );

  // ── Send ──────────────────────────────────────────────────────────────────
  async function handleSend(question?: string) {
    const q = (question ?? input).trim();
    if (!q || loading || generating) return;

    setInput('');
    setFnError(null);
    setMessages(prev => [...prev, { id: `u-${Date.now()}`, role: 'user', text: q }]);

    if (!isFirebaseClientConfigured()) {
      setMessages(prev => [...prev, {
        id: `e-${Date.now()}`, role: 'avatar', error: true,
        text: 'Firebase не е конфигуриран. Проверете NEXT_PUBLIC_FIREBASE_* env vars.',
      }]);
      return;
    }

    try {
      if (isAvatarReady) {
        // ══ VIDEO MODE ══════════════════════════════════════════════════════
        setGenerating(true);
        setGenStep(1);

        try {
          // Simulate step progression (approximate timings)
          const stepTimer = setInterval(() => {
            setGenStep(s => Math.min(s + 1, 3));
          }, 8000);

          const result = await callFunction<{
            videoUrl: string; answerText: string; fallback?: boolean; failStep?: string;
          }>('generateAvatarVideoV2', { question: q, ownerUid, ownerName, language: locale });
          clearInterval(stepTimer);

          const { videoUrl, answerText, fallback, failStep } = result;

          if (videoUrl && !fallback) {
            // Full video response ✅
            setActiveVideo(videoUrl);
            setMessages(prev => [...prev, {
              id:       `v-${Date.now()}`,
              role:     'avatar',
              text:     answerText ?? '',
              videoUrl: videoUrl,
            }]);
          } else {
            // Video pipeline had an issue but we have the text answer — show it with debug info
            console.warn('[AvatarChat] Video fallback triggered:', failStep);
            // Show failStep as a separate error message for visibility
            if (failStep) {
              setMessages(prev => [...prev, {
                id:    `fe-${Date.now()}`,
                role:  'avatar',
                error: true,
                text:  `⚠️ ${t.videoError}\n🔍 Debug: ${failStep}`,
              }]);
            }
            setMessages(prev => [...prev, {
              id:   `tf-${Date.now()}`,
              role: 'avatar',
              text: answerText ?? '',
            }]);
          }

        } catch (videoErr: any) {
          // Hard failure → fall back to queryAvatar (text only)
          console.error('[AvatarChat] generateAvatarVideo hard error:', videoErr);
          setMessages(prev => [...prev, {
            id: `fe-${Date.now()}`, role: 'avatar', error: true,
            text: `⚠️ ${t.videoError}\n🔍 ${videoErr?.message ?? String(videoErr)}`,
          }]);
          try {
            const res = await callFunction<{ answer: string }>(
              'queryAvatarV2',
              { question: q, ownerUid, ownerName, language: locale, topK: 6 }
            );
            setMessages(prev => [...prev, {
              id:   `tf-${Date.now()}`,
              role: 'avatar',
              text: res.answer,
            }]);
          } catch (textErr: any) {
            handleFnError(textErr);
          }
        } finally {
          setGenerating(false);
          setGenStep(0);
        }

      } else {
        // ══ TEXT MODE ═══════════════════════════════════════════════════════
        setLoading(true);
        try {
          const res = await callFunction<{ answer: string; chunks: number }>(
            'queryAvatarV2',
            { question: q, ownerUid, ownerName, language: locale, topK: 6 }
          );
          setMessages(prev => [...prev, {
            id:   `a-${Date.now()}`,
            role: 'avatar',
            text: res.answer,
          }]);
        } catch (err: any) {
          handleFnError(err);
        } finally {
          setLoading(false);
        }
      }

    } catch (err: any) {
      handleFnError(err);
      setLoading(false);
      setGenerating(false);
    }

    setTimeout(() => inputRef.current?.focus(), 120);
  }

  function handleFnError(err: any) {
    const code    = err?.code ?? '';
    const message = err?.message ?? String(err);
    const details = err?.details ?? '';

    console.error('[AvatarChat] Error:', { code, message, details, err });

    // Detect "function not found / not deployed" errors
    const isNotDeployed =
      code === 'functions/not-found'    ||
      code === 'functions/unavailable'  ||
      message.includes('NOT_FOUND')     ||
      message.includes('not found')     ||
      message.includes('does not exist');

    // Detect secret/API key errors
    const isSecretError =
      message.includes('Secret') ||
      message.includes('secret') ||
      message.includes('API key') ||
      message.includes('PERMISSION_DENIED') ||
      code === 'functions/permission-denied';

    // Detect auth errors
    const isAuthError =
      code === 'functions/unauthenticated' ||
      message.includes('unauthenticated') ||
      message.includes('Must be authenticated');

    if (isNotDeployed) {
      setFnError('not-deployed');
      setMessages(prev => [...prev, {
        id:    `e-${Date.now()}`,
        role:  'avatar',
        error: true,
        text:  `⚠️ ${t.funcsNotReady}\n${t.funcsAction}`,
      }]);
    } else if (isAuthError) {
      setMessages(prev => [...prev, {
        id:    `e-${Date.now()}`,
        role:  'avatar',
        error: true,
        text:  locale === 'bg'
          ? '⚠️ Трябва да сте влезли в профила си, за да използвате AI аватара.'
          : '⚠️ You must be logged in to use the AI avatar.',
      }]);
    } else if (isSecretError) {
      setMessages(prev => [...prev, {
        id:    `e-${Date.now()}`,
        role:  'avatar',
        error: true,
        text:  locale === 'bg'
          ? '⚠️ API ключовете за AI услугите не са конфигурирани. Свържете се с администратора.'
          : '⚠️ AI service API keys are not configured. Please contact the administrator.',
      }]);
    } else {
      setMessages(prev => [...prev, {
        id:    `e-${Date.now()}`,
        role:  'avatar',
        error: true,
        text:  `⚠️ [${code || 'error'}] ${message.slice(0, 300)}${details ? `\n${String(details).slice(0, 100)}` : ''}`,
      }]);
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const clearChat = () => {
    setMessages([]);
    setActiveVideo(null);
    setFnError(null);
    try { localStorage.removeItem(CHAT_KEY); } catch {}
  };

  // Latest video URL (active or from last message)
  const latestVideo    = [...messages].reverse().find(m => m.videoUrl)?.videoUrl ?? null;
  const displayVideo   = activeVideo ?? latestVideo;
  const currentStep    = [t.step1, t.step2, t.step3][genStep - 1] ?? t.thinking;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="flex flex-col overflow-hidden rounded-2xl"
      style={{
        background: CARD,
        border:     `1px solid ${BDR}`,
        height:     'calc(100vh - 7rem)',
        minHeight:  '600px',
        maxHeight:  '1100px',
      }}
    >

      {/* ══ HEADER ═══════════════════════════════════════════════════════════ */}
      <div
        className="flex-shrink-0 px-5 py-3 flex items-center justify-between gap-3"
        style={{ background: HDR, borderBottom: `1px solid ${BDR}` }}
      >
        <div className="flex items-center gap-3">
          <h2 className="font-display text-base font-bold" style={{ color: CREAM }}>
            {t.title}
          </h2>
          {configLoaded && (
            <span
              className="px-2 py-0.5 rounded-full text-xs font-body font-medium"
              style={isAvatarReady
                ? { background: `${GOLD}22`, color: GOLD,  border: `1px solid ${GOLD}44` }
                : { background: 'hsl(30 10% 20%)', color: MUTED, border: `1px solid ${BDR}` }
              }
            >
              {isAvatarReady ? t.videoMode : t.textMode}
            </span>
          )}
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearChat}
            className="text-xs px-3 py-1.5 rounded-lg opacity-50 hover:opacity-100 transition-opacity"
            style={{ color: MUTED }}
          >
            {t.clearChat}
          </button>
        )}
      </div>

      {/* ══ AVATAR DISPLAY AREA (~37% height) ════════════════════════════════ */}
      <div
        className="flex-shrink-0 relative overflow-hidden"
        style={{ flex: '0 0 37%', background: DARK, borderBottom: `1px solid ${BDR}` }}
      >

        {/* ── No setup banner ── */}
        {configLoaded && !isAvatarReady && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center z-10">
            <div className="text-5xl">🎬</div>
            <div>
              <p className="font-display font-bold text-base mb-1" style={{ color: CREAM }}>
                {t.noSetupTitle}
              </p>
              <p className="font-body text-sm" style={{ color: MUTED }}>
                {t.noSetupMsg}
              </p>
            </div>
            <p className="font-body text-xs" style={{ color: MUTED, opacity: 0.6 }}>
              {t.emptyHint}
            </p>
          </div>
        )}

        {/* ── Generating animation ── */}
        {generating && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-5 z-20"
            style={{ background: 'hsl(30 15% 5% / 0.95)' }}
          >
            {avatarConfig?.photoUrl && (
              <div className="relative">
                <img
                  src={avatarConfig.photoUrl}
                  alt="avatar"
                  className="w-28 h-28 rounded-full object-cover"
                  style={{ border: `3px solid ${GOLD}`, boxShadow: `0 0 40px ${GOLD}55`, filter: 'brightness(0.8)' }}
                />
                <div
                  className="absolute inset-0 rounded-full animate-ping"
                  style={{ border: `3px solid ${GOLD}55`, animationDuration: '1.4s' }}
                />
              </div>
            )}
            <div className="flex items-center gap-2.5" style={{ color: GOLD }}>
              <span className="w-5 h-5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
              <span className="font-body text-sm font-semibold">{currentStep}</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              {[t.step1, t.step2, t.step3].map((s, i) => (
                <span
                  key={i}
                  className="font-body text-xs transition-all duration-300"
                  style={{ color: genStep > i ? GOLD : `${CREAM}33`, fontWeight: genStep > i ? 600 : 400 }}
                >
                  {genStep > i ? '✓' : '○'} {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── Static photo (before first video) ── */}
        {isAvatarReady && !generating && !displayVideo && avatarConfig?.photoUrl && (
          <div className="absolute inset-0">
            <img
              src={avatarConfig.photoUrl}
              alt="Your avatar"
              className="w-full h-full object-cover"
              style={{ opacity: 0.85 }}
            />
            {/* Gradient overlay with hint */}
            <div
              className="absolute bottom-0 left-0 right-0 px-5 py-4 text-center"
              style={{ background: 'linear-gradient(transparent, rgba(10,7,5,0.9))' }}
            >
              <p className="font-body text-sm" style={{ color: `${CREAM}99` }}>
                {t.emptyHint}
              </p>
            </div>
          </div>
        )}

        {/* ── Video player ── */}
        {isAvatarReady && !generating && displayVideo && (
          <video
            ref={videoRef}
            key={displayVideo}
            src={displayVideo}
            controls
            autoPlay
            playsInline
            poster={avatarConfig?.photoUrl}
            className="w-full h-full"
            style={{ objectFit: 'contain', background: '#000', display: 'block' }}
          />
        )}
      </div>

      {/* ══ CHAT TRANSCRIPT (~30% — scrollable) ══════════════════════════════ */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">

        {/* Suggested questions (empty state) */}
        {messages.length === 0 && !loading && !generating && (
          <div className="py-2">
            <p className="font-body text-xs mb-2 px-1" style={{ color: `${CREAM}44` }}>
              {locale === 'bg' ? 'Предложени въпроси:' : 'Suggested questions:'}
            </p>
            <div className="flex flex-wrap gap-2">
              {t.suggestedQ.map((q, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(q)}
                  className="font-body text-xs px-3 py-1.5 rounded-full text-left transition-all hover:opacity-80"
                  style={{ background: `${GOLD}15`, color: GOLD, border: `1px solid ${GOLD}33` }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message bubbles */}
        {messages.map(msg => (
          <MessageBubble
            key={msg.id}
            msg={msg}
            t={t}
            avatarPhotoUrl={avatarConfig?.photoUrl}
          />
        ))}

        {/* Loading spinner (text mode) */}
        {loading && (
          <div className="flex items-center gap-2 py-1" style={{ color: GOLD }}>
            <span className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
            <span className="font-body text-sm">{t.thinkingText}</span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ══ INPUT BAR (always visible at bottom) ══════════════════════════════ */}
      <div
        className="flex-shrink-0 px-4 py-3"
        style={{ background: HDR, borderTop: `1px solid ${BDR}` }}
      >
        <div className="flex gap-2 items-center">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t.placeholder}
            disabled={loading || generating}
            className="flex-1 font-body text-sm px-4 py-2.5 rounded-xl outline-none"
            style={{
              background: 'hsl(30 12% 9%)',
              border:     `1px solid ${loading || generating ? BDR : `${GOLD}55`}`,
              color:      CREAM,
              caretColor: GOLD,
              transition: 'border-color 0.2s',
            }}
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || loading || generating}
            className="font-body font-bold text-sm px-5 py-2.5 rounded-xl flex-shrink-0 transition-all"
            style={{
              background: (!input.trim() || loading || generating) ? 'hsl(30 10% 20%)' : GOLD,
              color:      (!input.trim() || loading || generating) ? MUTED : DARK,
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
function MessageBubble({
  msg,
  t,
  avatarPhotoUrl,
}: {
  msg:            ChatMessage;
  t:              typeof i18n.bg;
  avatarPhotoUrl?: string;
}) {
  const isUser = msg.role === 'user';

  return (
    <div className={`flex gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar thumbnail */}
      <div
        className="flex-shrink-0 w-7 h-7 rounded-full overflow-hidden flex items-center justify-center text-xs"
        style={isUser
          ? { background: 'hsl(30 10% 22%)', color: CREAM }
          : { border: `2px solid ${GOLD}55` }
        }
      >
        {isUser
          ? '👤'
          : avatarPhotoUrl
            ? <img src={avatarPhotoUrl} alt="av" className="w-full h-full object-cover" />
            : <span style={{ background: `${GOLD}33`, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🎬</span>
        }
      </div>

      <div className={`flex flex-col gap-0.5 max-w-[86%] ${isUser ? 'items-end' : 'items-start'}`}>
        <span className="text-xs px-1" style={{ color: `${CREAM}33` }}>
          {isUser ? t.youLabel : t.avatarLabel}
        </span>

        {/* Video message: show transcript preview */}
        {!isUser && msg.videoUrl ? (
          <div
            className="rounded-2xl rounded-tl-sm px-3 py-2 text-xs leading-relaxed"
            style={{ background: `${GOLD}0F`, color: MUTED, border: `1px solid ${GOLD}22` }}
          >
            {msg.text ? <>📝 {msg.text.slice(0, 160)}{msg.text.length > 160 ? '…' : ''}</> : '🎬 Video response'}
          </div>
        ) : (
          <div
            className={`rounded-2xl text-sm leading-relaxed font-body px-3 py-2 ${isUser ? 'rounded-tr-sm' : 'rounded-tl-sm'}`}
            style={isUser
              ? { background: GOLD, color: DARK }
              : msg.error
                ? { background: 'hsl(0 50% 12%)', color: 'hsl(0 80% 70%)', border: '1px solid hsl(0 55% 25%)' }
                : { background: CARD, color: `${CREAM}EE`, border: `1px solid ${BDR}` }
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
// v4.1 deploy trigger 202603091533

// deploy 1773130588
