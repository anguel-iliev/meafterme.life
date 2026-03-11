'use client';
/**
 * AvatarSetup v4 — robust with debug info & clear UX
 *
 * Логика:
 *  - Снимки: кликни = избери/отмени. До 5 снимки. Всички се пращат на D-ID.
 *  - Аудио:  1 файл за клониране. Кликни = избери, кликни пак = смени.
 *  - Clone:  активен когато има ≥1 снимка + 1 аудио + audioStoragePath не е празен.
 *  - Debug:  показва storagePath (скрит в production, видим за диагностика).
 */
import React, { useState, useEffect } from 'react';
import { useLang } from '@/components/LangContext';
import type { AppUser, MemoryItem, AvatarConfig } from '@/lib/clientStore';
import { getMemoryItems, getAvatarConfig, saveAvatarConfig, waitForAuthReady } from '@/lib/clientStore';
import { isFirebaseClientConfigured, getFirebaseApp } from '@/lib/firebaseClient';
import { getAuth } from 'firebase/auth';

const CF_BASE = 'https://us-central1-meafterme-d0347.cloudfunctions.net';

async function callFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const app      = getFirebaseApp();
  const fbAuth   = getAuth(app);
  const currentUser = fbAuth.currentUser;
  if (!currentUser) throw new Error('Not authenticated');
  const token = await currentUser.getIdToken();
  const resp  = await fetch(`${CF_BASE}/${name}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const json = await resp.json();
  if (!resp.ok) throw new Error(json?.error?.message || `HTTP ${resp.status}`);
  return (json.result ?? json) as T;
}

// ─── i18n ─────────────────────────────────────────────────────────────────────
const T = {
  bg: {
    title:         '🎬 Настройка на AI Аватар',
    subtitle:      'Изберете снимки и аудио за вашия дигитален двойник.',
    step1:         'Стъпка 1: Избери снимки (1–5)',
    step1desc:     'Кликни върху снимка, за да я добавиш или премахнеш. До 5 снимки.',
    step2:         'Стъпка 2: Избери аудио за гласа',
    step2desc:     'Кликни върху записа, за да го избереш. Кликни отново за смяна.',
    step3:         'Стъпка 3: Клонирай гласа',
    step3desc:     'Натисни бутона след като си избрал снимки и аудио.',
    noPhotos:      'Нямате качени снимки. Отидете в „Мултимедия" → качете снимки с лице.',
    noAudio:       'Нямате качени аудио/видео файлове.',
    selected:      'избрани',
    of:            'от',
    clickSelect:   'кликни за избор',
    clickDeselect: 'кликни за отмяна',
    audioHint:     'Кликни за избор',
    audioChange:   'Кликни за смяна',
    preview:       '▶ Преглед:',
    save:          '💾 Запази',
    saving:        'Запазване…',
    saved:         '✓ Запазено!',
    clone:         '🔊 Клонирай гласа',
    cloning:       '⏳ Клониране… (30–60 сек)',
    reclone:       '🔄 Клонирай отново',
    cloneOk:       '✅ Гласът е клониран успешно!',
    cloneErrPre:   '❌ Грешка: ',
    needPhoto:     'Изберете поне 1 снимка.',
    needAudio:     'Изберете аудио файл.',
    needPath:      '❌ Избраното аудио няма storagePath. Моля презаредете страницата и опитайте отново.',
    noFirebase:    'Firebase не е конфигуриран.',
    notLoggedIn:   '❌ Не сте влезли. Моля влезте отново.',
    statusReady:   '✅ Аватарът е готов! Отидете в „AI Аватар".',
    statusSetup:   'Изберете снимки + аудио, после клонирайте гласа.',
    loading:       'Зареждане…',
    voiceReady:    '✅ Гласът е клониран',
    voiceNone:     'Не е клониран',
    photoCount:    'снимки избрани',
    debugTitle:    '🔧 Диагностика',
    debugPath:     'storagePath:',
    debugEmpty:    '(празно — ще има грешка при клониране!)',
    debugOk:       '(OK)',
  },
  en: {
    title:         '🎬 AI Avatar Setup',
    subtitle:      'Choose photos and audio for your digital twin.',
    step1:         'Step 1: Choose photos (1–5)',
    step1desc:     'Click a photo to add or remove it. Up to 5 photos.',
    step2:         'Step 2: Choose audio for voice',
    step2desc:     'Click a recording to select it. Click again to change.',
    step3:         'Step 3: Clone voice',
    step3desc:     'Press the button after choosing photos and audio.',
    noPhotos:      'No photos uploaded. Go to "Multimedia" → upload face photos.',
    noAudio:       'No audio/video files uploaded.',
    selected:      'selected',
    of:            'of',
    clickSelect:   'click to select',
    clickDeselect: 'click to deselect',
    audioHint:     'Click to select',
    audioChange:   'Click to change',
    preview:       '▶ Preview:',
    save:          '💾 Save',
    saving:        'Saving…',
    saved:         '✓ Saved!',
    clone:         '🔊 Clone Voice',
    cloning:       '⏳ Cloning… (30–60 sec)',
    reclone:       '🔄 Clone again',
    cloneOk:       '✅ Voice cloned successfully!',
    cloneErrPre:   '❌ Error: ',
    needPhoto:     'Select at least 1 photo.',
    needAudio:     'Select an audio file.',
    needPath:      '❌ Selected audio has no storagePath. Please reload the page and try again.',
    noFirebase:    'Firebase is not configured.',
    notLoggedIn:   '❌ Not logged in. Please log in again.',
    statusReady:   '✅ Avatar is ready! Go to "AI Avatar".',
    statusSetup:   'Select photos + audio, then clone the voice.',
    loading:       'Loading…',
    voiceReady:    '✅ Voice cloned',
    voiceNone:     'Not cloned yet',
    photoCount:    'photos selected',
    debugTitle:    '🔧 Debug info',
    debugPath:     'storagePath:',
    debugEmpty:    '(empty — cloning will fail!)',
    debugOk:       '(OK)',
  },
};

const fmt = (b?: number) =>
  !b ? '' : b < 1_048_576 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1_048_576).toFixed(1)} MB`;

// ─── Component ────────────────────────────────────────────────────────────────
export default function AvatarSetup({ user, ownerUid }: { user: AppUser; ownerUid: string }) {
  const { locale } = useLang();
  const t = T[locale as 'bg' | 'en'] ?? T.bg;

  // State
  const [memories,   setMemories]  = useState<MemoryItem[]>([]);
  const [config,     setConfig]    = useState<AvatarConfig | null>(null);
  const [loading,    setLoading]   = useState(true);
  const [photoIds,   setPhotoIds]  = useState<Set<string>>(new Set());
  const [audioItem,  setAudioItem] = useState<MemoryItem | null>(null);
  const [showDebug,  setShowDebug] = useState(false);

  // Action state
  const [saving,     setSaving]    = useState(false);
  const [saveMsg,    setSaveMsg]   = useState('');
  const [cloning,    setCloning]   = useState(false);
  const [cloneMsg,   setCloneMsg]  = useState('');
  const [cloneErr,   setCloneErr]  = useState('');

  // ── Load saved config ──────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const fu  = await waitForAuthReady();
        const uid = fu?.uid || ownerUid;
        const [mems, cfg] = await Promise.all([
          getMemoryItems(uid).catch(() => [] as MemoryItem[]),
          getAvatarConfig(uid).catch(() => null),
        ]);
        setMemories(mems);
        setConfig(cfg);

        // Restore saved photo IDs
        if (cfg?.photoMemoryIds?.length) {
          setPhotoIds(new Set(cfg.photoMemoryIds));
        } else if (cfg?.photoMemoryId) {
          setPhotoIds(new Set([cfg.photoMemoryId]));
        }
        // Restore saved audio
        if (cfg?.audioMemoryId) {
          const a = mems.find(m => m.id === cfg.audioMemoryId);
          if (a) setAudioItem(a);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [ownerUid]);

  const photos    = memories.filter(m => m.type === 'photo');
  const audios    = memories.filter(m => m.type === 'audio' || m.type === 'video');
  const voiceReady = config?.voiceStatus === 'ready';
  const isReady    = voiceReady && photoIds.size > 0;

  const canClone = photoIds.size > 0
    && audioItem != null
    && Boolean(audioItem.storagePath?.trim());

  // ── Toggle photo ──────────────────────────────────────────────────────────
  const togglePhoto = (id: string) => {
    setPhotoIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < 5) {
        next.add(id);
      }
      return next;
    });
  };

  // ── Select audio ──────────────────────────────────────────────────────────
  const toggleAudio = (item: MemoryItem) => {
    setAudioItem(prev => prev?.id === item.id ? null : item);
  };

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true); setSaveMsg('');
    try {
      const fu  = await waitForAuthReady();
      const uid = fu?.uid || ownerUid;
      const selectedPhotos = photos.filter(p => photoIds.has(p.id));
      const mainPhoto      = selectedPhotos[0] ?? null;

      const cfg: Partial<AvatarConfig> & { photoMemoryIds?: string[] } = { uid };
      cfg.photoMemoryIds = [...photoIds];
      if (mainPhoto) {
        cfg.photoMemoryId = mainPhoto.id;
        cfg.photoUrl      = mainPhoto.url;
        cfg.photoName     = mainPhoto.name;
      }
      if (audioItem) {
        cfg.audioMemoryId    = audioItem.id;
        cfg.audioUrl         = audioItem.url;
        cfg.audioName        = audioItem.name;
        cfg.audioStoragePath = audioItem.storagePath;
      }
      cfg.setupComplete = isReady;

      await saveAvatarConfig(uid, cfg);
      setConfig(prev => ({ ...(prev ?? { uid }), ...cfg } as AvatarConfig));
      setSaveMsg(t.saved);
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (e: any) {
      setSaveMsg('❌ ' + (e?.message ?? 'Error'));
    } finally {
      setSaving(false);
    }
  };

  // ── Clone voice ───────────────────────────────────────────────────────────
  const handleClone = async () => {
    setCloneErr(''); setCloneMsg('');

    if (photoIds.size === 0) { setCloneErr(t.needPhoto); return; }
    if (!audioItem)           { setCloneErr(t.needAudio); return; }
    if (!audioItem.storagePath?.trim()) {
      setCloneErr(t.needPath);
      setShowDebug(true);
      return;
    }
    if (!isFirebaseClientConfigured()) { setCloneErr(t.noFirebase); return; }

    setCloning(true);
    try {
      const fu = await waitForAuthReady();
      if (!fu) { setCloneErr(t.notLoggedIn); setCloning(false); return; }
      const uid = fu.uid;

      // Save selection first
      const selectedPhotos = photos.filter(p => photoIds.has(p.id));
      const mainPhoto      = selectedPhotos[0];
      const preCfg: Partial<AvatarConfig> & { photoMemoryIds?: string[] } = {
        photoMemoryIds:   [...photoIds],
        audioMemoryId:    audioItem.id,
        audioUrl:         audioItem.url,
        audioName:        audioItem.name,
        audioStoragePath: audioItem.storagePath,
      };
      if (mainPhoto) {
        preCfg.photoMemoryId = mainPhoto.id;
        preCfg.photoUrl      = mainPhoto.url;
        preCfg.photoName     = mainPhoto.name;
      }
      await saveAvatarConfig(uid, preCfg);

      // Call Cloud Function via fetch (onRequest — bypasses Cloud Run IAM CORS issue)
      const res = await callFunction<{ voiceId: string }>('cloneVoiceV2', {
        audioStoragePath: audioItem.storagePath,
        voiceName:        `avatar_${uid.slice(0, 8)}`,
      });

      await saveAvatarConfig(uid, {
        voiceId:       res.voiceId,
        voiceStatus:   'ready',
        setupComplete: true,
      });
      setConfig(prev => ({
        ...(prev ?? { uid }),
        voiceId:       res.voiceId,
        voiceStatus:   'ready',
        setupComplete: true,
      } as AvatarConfig));
      setCloneMsg(t.cloneOk);
      setTimeout(() => setCloneMsg(''), 8000);
    } catch (e: any) {
      const msg = e?.message ?? e?.details ?? String(e);
      setCloneErr(t.cloneErrPre + msg.slice(0, 400));
      setShowDebug(true);
    } finally {
      setCloning(false);
    }
  };

  // ── Colors ────────────────────────────────────────────────────────────────
  const A  = 'hsl(36 80% 55%)';
  const CR = 'hsl(38 50% 92%)';
  const DM = 'hsl(38 40% 75% / 0.6)';
  const DK = 'hsl(30 15% 7%)';
  const card: React.CSSProperties = {
    background:   'hsl(30 12% 11%)',
    border:       '1px solid hsl(30 10% 18%)',
    borderRadius: '1rem',
    padding:      '1.25rem',
  };
  const stepBadge: React.CSSProperties = {
    background: `${A}22`,
    color: A,
    border: `1px solid ${A}44`,
    borderRadius: '50%',
    width: '1.75rem',
    height: '1.75rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    fontSize: '0.85rem',
    flexShrink: 0,
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 max-w-2xl">

      {/* Header */}
      <div>
        <h2 className="font-display text-xl font-bold" style={{ color: CR }}>{t.title}</h2>
        <p  className="font-body text-sm mt-1"         style={{ color: DM }}>{t.subtitle}</p>
      </div>

      {/* ── Status bar ── */}
      <div style={{
        ...card,
        background: isReady ? 'hsl(142 35% 10%)' : 'hsl(36 20% 9%)',
        border:     `1px solid ${isReady ? 'hsl(142 50% 25%)' : 'hsl(36 60% 45% / 0.3)'}`,
      }}>
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <span>{photoIds.size > 0 ? '✅' : '⬜'}</span>
            <span className="font-body text-sm" style={{ color: photoIds.size > 0 ? A : DM }}>
              {photoIds.size > 0 ? `${photoIds.size} ${t.photoCount}` : t.needPhoto}
            </span>
          </div>
          <span style={{ color: 'hsl(30 10% 30%)' }}>·</span>
          <div className="flex items-center gap-2">
            <span>{audioItem ? '✅' : '⬜'}</span>
            <span className="font-body text-sm" style={{ color: audioItem ? A : DM }}>
              {audioItem ? audioItem.name.slice(0, 24) : t.needAudio}
            </span>
          </div>
          <span style={{ color: 'hsl(30 10% 30%)' }}>·</span>
          <div className="flex items-center gap-2">
            <span>{voiceReady ? '✅' : '⬜'}</span>
            <span className="font-body text-sm" style={{ color: voiceReady ? 'hsl(142 70% 60%)' : DM }}>
              {voiceReady ? t.voiceReady : t.voiceNone}
            </span>
          </div>
        </div>
        <p className="mt-2 text-xs font-body" style={{ color: isReady ? 'hsl(142 70% 60%)' : DM }}>
          {isReady ? t.statusReady : t.statusSetup}
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-6" style={{ color: A }}>
          <span className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
          <span className="font-body text-sm">{t.loading}</span>
        </div>
      ) : (<>

        {/* ══ STEP 1: Photos ═══════════════════════════════════════════════ */}
        <div style={card}>
          <div className="flex items-center gap-3 mb-3">
            <div style={stepBadge}>1</div>
            <div>
              <h3 className="font-display text-base font-bold" style={{ color: CR }}>{t.step1}</h3>
              <p className="font-body text-xs" style={{ color: DM }}>{t.step1desc}</p>
            </div>
            <span className="ml-auto font-body text-xs px-2 py-0.5 rounded-full"
                  style={{ background: photoIds.size > 0 ? `${A}22` : 'hsl(30 10% 18%)', color: photoIds.size > 0 ? A : DM }}>
              {photoIds.size} / 5
            </span>
          </div>

          {photos.length === 0 ? (
            <p className="font-body text-sm px-4 py-3 rounded-lg" style={{ background: 'hsl(36 25% 8%)', color: A }}>{t.noPhotos}</p>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {photos.map(p => {
                  const sel      = photoIds.has(p.id);
                  const disabled = !sel && photoIds.size >= 5;
                  return (
                    <div key={p.id}
                         onClick={() => !disabled && togglePhoto(p.id)}
                         className="relative rounded-xl overflow-hidden transition-all select-none"
                         style={{
                           cursor:    disabled ? 'not-allowed' : 'pointer',
                           opacity:   disabled ? 0.4 : 1,
                           border:    `2px solid ${sel ? A : 'hsl(30 10% 20%)'}`,
                           boxShadow: sel ? `0 0 16px ${A}44` : 'none',
                           transform: sel ? 'scale(1.03)' : 'scale(1)',
                         }}>
                      <div style={{ aspectRatio: '1/1' }}>
                        <img src={p.url} alt={p.name} className="w-full h-full object-cover" />
                      </div>
                      {sel && (
                        <div className="absolute inset-0 flex items-center justify-center"
                             style={{ background: `${A}1A` }}>
                          <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-lg"
                               style={{ background: A, color: DK }}>✓</div>
                        </div>
                      )}
                      <div className="px-2 py-1.5" style={{ background: sel ? `${A}22` : 'hsl(30 12% 9%)' }}>
                        <p className="font-body text-xs truncate" style={{ color: sel ? A : DM }}>{p.name.slice(0, 18)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Selected chips */}
              {photoIds.size > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {photos.filter(p => photoIds.has(p.id)).map((p, i) => (
                    <span key={p.id} onClick={() => togglePhoto(p.id)}
                          className="cursor-pointer inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-body"
                          style={{ background: `${A}22`, color: A, border: `1px solid ${A}44` }}
                          title={t.clickDeselect}>
                      {i + 1}. {p.name.slice(0, 14)} ×
                    </span>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* ══ STEP 2: Audio ════════════════════════════════════════════════ */}
        <div style={card}>
          <div className="flex items-center gap-3 mb-3">
            <div style={stepBadge}>2</div>
            <div>
              <h3 className="font-display text-base font-bold" style={{ color: CR }}>{t.step2}</h3>
              <p className="font-body text-xs" style={{ color: DM }}>{t.step2desc}</p>
            </div>
          </div>

          {audios.length === 0 ? (
            <p className="font-body text-sm px-4 py-3 rounded-lg" style={{ background: 'hsl(36 25% 8%)', color: A }}>{t.noAudio}</p>
          ) : (
            <div className="space-y-2">
              {audios.map(a => {
                const sel = audioItem?.id === a.id;
                const hasPath = Boolean(a.storagePath?.trim());
                return (
                  <div key={a.id} onClick={() => toggleAudio(a)}
                       className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all"
                       style={{
                         background: sel ? `${A}14` : 'hsl(30 10% 14%)',
                         border:     `2px solid ${sel ? A : 'hsl(30 10% 20%)'}`,
                         boxShadow:  sel ? `0 0 14px ${A}33` : 'none',
                       }}>
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl flex-shrink-0"
                         style={{ background: sel ? `${A}33` : 'hsl(30 10% 20%)' }}>
                      {a.type === 'video' ? '🎬' : '🎵'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-body text-sm font-semibold truncate" style={{ color: sel ? A : CR }}>
                        {a.name}
                      </p>
                      <p className="font-body text-xs" style={{ color: DM }}>
                        {a.type}{a.size ? ` · ${fmt(a.size)}` : ''}{' · '}
                        {sel ? t.audioChange : t.audioHint}
                      </p>
                      {/* storagePath indicator */}
                      {sel && (
                        <p className="font-body text-xs mt-0.5"
                           style={{ color: hasPath ? 'hsl(142 60% 50%)' : 'hsl(0 70% 60%)' }}>
                          {hasPath
                            ? `✓ ${t.debugPath} ${a.storagePath.slice(0, 50)}…`
                            : `⚠ ${t.debugPath} ${t.debugEmpty}`}
                        </p>
                      )}
                    </div>
                    <div className="flex-shrink-0 text-sm font-bold px-3 py-1 rounded-full"
                         style={sel
                           ? { background: A, color: DK }
                           : { background: 'hsl(30 10% 20%)', color: DM }}>
                      {sel ? '✓' : '+'}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Audio preview */}
          {audioItem && (
            <div className="mt-3 p-3 rounded-xl" style={{ background: 'hsl(30 10% 9%)', border: `1px solid ${A}33` }}>
              <p className="font-body text-xs mb-2" style={{ color: A }}>{t.preview} {audioItem.name}</p>
              <audio controls src={audioItem.url} className="w-full" />
            </div>
          )}
        </div>

        {/* ══ STEP 3: Actions ══════════════════════════════════════════════ */}
        <div style={card}>
          <div className="flex items-center gap-3 mb-3">
            <div style={stepBadge}>3</div>
            <div>
              <h3 className="font-display text-base font-bold" style={{ color: CR }}>{t.step3}</h3>
              <p className="font-body text-xs" style={{ color: DM }}>{t.step3desc}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 items-center">
            {/* Save button */}
            <button onClick={handleSave}
                    disabled={saving || (photoIds.size === 0 && !audioItem)}
                    className="font-body font-semibold text-sm px-5 py-2.5 rounded-xl transition-all disabled:opacity-40"
                    style={{ background: 'hsl(30 10% 20%)', color: CR, border: '1px solid hsl(30 10% 30%)' }}>
              {saving ? t.saving : saveMsg || t.save}
            </button>

            {/* Clone button */}
            <button onClick={handleClone}
                    disabled={cloning || !canClone}
                    className="font-body font-semibold text-sm px-6 py-2.5 rounded-xl transition-all disabled:opacity-40 flex items-center gap-2"
                    style={{
                      background: cloning
                        ? 'hsl(36 25% 14%)'
                        : voiceReady
                          ? 'hsl(142 40% 13%)'
                          : canClone ? A : 'hsl(30 10% 20%)',
                      color:  cloning ? A : voiceReady ? 'hsl(142 80% 68%)' : canClone ? DK : DM,
                      border: voiceReady ? '1px solid hsl(142 50% 28%)' : 'none',
                    }}>
              {cloning && <span className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />}
              {cloning ? t.cloning : voiceReady ? t.reclone : t.clone}
            </button>
          </div>

          {/* Feedback */}
          {cloneMsg && (
            <div className="mt-3 px-4 py-2.5 rounded-xl text-sm font-body"
                 style={{ background: 'hsl(142 40% 9%)', color: 'hsl(142 80% 68%)', border: '1px solid hsl(142 50% 22%)' }}>
              {cloneMsg}
            </div>
          )}
          {cloneErr && (
            <div className="mt-3 px-4 py-2.5 rounded-xl text-sm font-body whitespace-pre-wrap break-all"
                 style={{ background: 'hsl(0 40% 9%)', color: 'hsl(0 80% 68%)', border: '1px solid hsl(0 50% 22%)' }}>
              {cloneErr}
            </div>
          )}
        </div>

        {/* ══ Debug panel (toggle) ══════════════════════════════════════════ */}
        <div>
          <button onClick={() => setShowDebug(p => !p)}
                  className="font-body text-xs px-3 py-1 rounded-lg transition-opacity opacity-40 hover:opacity-100"
                  style={{ background: 'hsl(30 10% 16%)', color: DM }}>
            {showDebug ? '▲' : '▼'} {t.debugTitle}
          </button>

          {showDebug && (
            <div className="mt-2 p-4 rounded-xl font-mono text-xs space-y-1 overflow-auto"
                 style={{ background: 'hsl(30 10% 8%)', color: 'hsl(142 60% 50%)', border: '1px solid hsl(30 10% 16%)' }}>
              <p>photos: [{photos.map(p => p.id.slice(0, 8)).join(', ')}]</p>
              <p>selected photoIds: [{[...photoIds].join(', ')}]</p>
              <p>audioItem.id: {audioItem?.id ?? 'null'}</p>
              <p>audioItem.storagePath: <span style={{ color: audioItem?.storagePath ? 'hsl(142 60% 50%)' : 'hsl(0 70% 60%)' }}>
                {audioItem?.storagePath || '(empty!)'}
              </span></p>
              <p>voiceId: {config?.voiceId ?? 'null'}</p>
              <p>voiceStatus: {config?.voiceStatus ?? 'null'}</p>
              <p>canClone: {String(canClone)}</p>
              <p>firebase configured: {String(isFirebaseClientConfigured())}</p>
              <p>all audios storagePaths:</p>
              {audios.map(a => (
                <p key={a.id} style={{ color: a.storagePath ? 'hsl(142 60% 50%)' : 'hsl(0 70% 60%)' }}>
                  &nbsp;&nbsp;{a.name.slice(0, 20)}: {a.storagePath || '(EMPTY)'}
                </p>
              ))}
            </div>
          )}
        </div>

      </>)}
    </div>
  );
}
