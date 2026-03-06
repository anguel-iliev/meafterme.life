'use client';
/**
 * AvatarSetup v3
 *
 * Логика:
 *  - Снимки: кликни за да добавиш/махнеш от набора (до 5). Всички избрани се пращат на D-ID.
 *  - Аудио:  само 1 файл за клониране. Кликни за да избереш, кликни пак за да смениш.
 *  - Clone:  бутонът е активен когато има поне 1 снимка + 1 аудио.
 *  - Save:   запазва избора без клониране (може да се използва после).
 */
import React, { useState, useEffect } from 'react';
import { useLang } from '@/components/LangContext';
import type { AppUser, MemoryItem, AvatarConfig } from '@/lib/clientStore';
import { getMemoryItems, getAvatarConfig, saveAvatarConfig, waitForAuthReady } from '@/lib/clientStore';
import { isFirebaseClientConfigured } from '@/lib/firebaseClient';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getApp } from 'firebase/app';

// ─── i18n ─────────────────────────────────────────────────────────────────────
const T = {
  bg: {
    title:        '🎬 Настройка на AI Аватар',
    subtitle:     'Изберете снимки и аудио за вашия дигитален двойник.',
    photosTitle:  '📸 Снимки за аватара',
    photosDesc:   'Кликнете за да изберете / отмените снимка. Изберете 1 до 5 ясни снимки с лице.',
    audioTitle:   '🎤 Аудио за клониране на гласа',
    audioDesc:    'Изберете ЕДИН запис с ясен глас (поне 1 мин). Кликнете отново за смяна.',
    cloneTitle:   '🚀 Стартирайте клонирането',
    cloneDesc:    'След като сте избрали снимки и аудио, натиснете бутона.',
    noPhotos:     'Нямате качени снимки. Отидете в „Мултимедия" и качете снимки.',
    noAudio:      'Нямате качени аудио/видео файлове.',
    selected:     'избрани',
    of:           'от',
    max:          '(макс. 5)',
    clickSelect:  'кликни за избор',
    clickDeselect:'кликни за отмяна',
    audioHint:    'Кликнете за да изберете',
    audioChange:  'Кликнете за да смените',
    previewLabel: '▶ Преглед:',
    btnSave:      '💾 Запази',
    btnSaving:    'Запазване…',
    btnSaved:     '✓ Запазено!',
    btnClone:     '🔊 Клонирай гласа',
    btnCloning:   '⏳ Клониране… (30–60 сек)',
    btnReclone:   '🔄 Клонирай отново',
    cloneOk:      '✅ Гласът е клониран успешно!',
    cloneErr:     '❌ Грешка: ',
    needPhoto:    'Изберете поне 1 снимка.',
    needAudio:    'Изберете аудио файл.',
    noFirebase:   'Firebase не е конфигуриран.',
    statusReady:  '✅ Аватарът е готов! Отидете в „AI Аватар".',
    statusSetup:  'Изберете снимки + аудио, после клонирайте гласа.',
    loading:      'Зареждане…',
    voiceReady:   '✅ Гласът е клониран',
    voiceNone:    'Не е клониран',
    photoCount:   'снимки избрани',
    audioSel:     'избрано',
  },
  en: {
    title:        '🎬 AI Avatar Setup',
    subtitle:     'Choose photos and audio for your digital twin.',
    photosTitle:  '📸 Avatar Photos',
    photosDesc:   'Click to select / deselect. Choose 1–5 clear face photos.',
    audioTitle:   '🎤 Voice Cloning Audio',
    audioDesc:    'Select ONE recording with a clear voice (min 1 min). Click again to change.',
    cloneTitle:   '🚀 Start Cloning',
    cloneDesc:    'After selecting photos and audio, press the button.',
    noPhotos:     'No photos uploaded. Go to "Multimedia" to upload face photos.',
    noAudio:      'No audio/video files uploaded.',
    selected:     'selected',
    of:           'of',
    max:          '(max 5)',
    clickSelect:  'click to select',
    clickDeselect:'click to deselect',
    audioHint:    'Click to select',
    audioChange:  'Click to change',
    previewLabel: '▶ Preview:',
    btnSave:      '💾 Save',
    btnSaving:    'Saving…',
    btnSaved:     '✓ Saved!',
    btnClone:     '🔊 Clone Voice',
    btnCloning:   '⏳ Cloning… (30–60 sec)',
    btnReclone:   '🔄 Clone again',
    cloneOk:      '✅ Voice cloned successfully!',
    cloneErr:     '❌ Error: ',
    needPhoto:    'Select at least 1 photo.',
    needAudio:    'Select an audio file.',
    noFirebase:   'Firebase is not configured.',
    statusReady:  '✅ Avatar is ready! Go to "AI Avatar".',
    statusSetup:  'Select photos + audio, then clone the voice.',
    loading:      'Loading…',
    voiceReady:   '✅ Voice cloned',
    voiceNone:    'Not cloned yet',
    photoCount:   'photos selected',
    audioSel:     'selected',
  },
};

const fmtSize = (b?: number) =>
  !b ? '' : b < 1_048_576 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1_048_576).toFixed(1)} MB`;

// ─── Component ────────────────────────────────────────────────────────────────
export default function AvatarSetup({ user, ownerUid }: { user: AppUser; ownerUid: string }) {
  const { locale } = useLang();
  const t = T[locale as 'bg' | 'en'] ?? T.bg;

  // State
  const [memories,      setMemories]     = useState<MemoryItem[]>([]);
  const [config,        setConfig]       = useState<AvatarConfig | null>(null);
  const [loading,       setLoading]      = useState(true);

  // Multi-photo selection (up to 5)
  const [photoIds,      setPhotoIds]     = useState<Set<string>>(new Set());
  // Single audio selection
  const [audioItem,     setAudioItem]    = useState<MemoryItem | null>(null);

  // Actions
  const [saving,        setSaving]       = useState(false);
  const [saveMsg,       setSaveMsg]      = useState('');
  const [cloning,       setCloning]      = useState(false);
  const [cloneMsg,      setCloneMsg]     = useState('');
  const [cloneErr,      setCloneErr]     = useState('');

  // ── Load saved config ──────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const fu = await waitForAuthReady();
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

  const photos = memories.filter(m => m.type === 'photo');
  const audios = memories.filter(m => m.type === 'audio' || m.type === 'video');
  const voiceReady = config?.voiceStatus === 'ready';
  const isReady    = voiceReady && photoIds.size > 0;

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

  // ── Select audio (click to select, click again to deselect) ───────────────
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
      setSaveMsg(t.btnSaved);
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (e: any) {
      setSaveMsg('❌ ' + (e?.message ?? 'Error'));
    } finally {
      setSaving(false);
    }
  };

  // ── Clone voice ───────────────────────────────────────────────────────────
  const handleClone = async () => {
    if (photoIds.size === 0) { setCloneErr(t.needPhoto); return; }
    if (!audioItem)          { setCloneErr(t.needAudio); return; }
    if (!isFirebaseClientConfigured()) { setCloneErr(t.noFirebase); return; }

    setCloning(true); setCloneMsg(''); setCloneErr('');
    try {
      const fu  = await waitForAuthReady();
      const uid = fu?.uid || ownerUid;

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

      // Call Cloud Function
      const fns     = getFunctions(getApp(), 'us-central1');
      const cloneFn = httpsCallable<
        { audioStoragePath: string; voiceName: string },
        { voiceId: string }
      >(fns, 'cloneVoice');

      const res     = await cloneFn({
        audioStoragePath: audioItem.storagePath,
        voiceName:        `avatar_${uid.slice(0, 8)}`,
      });

      await saveAvatarConfig(uid, {
        voiceId:       res.data.voiceId,
        voiceStatus:   'ready',
        setupComplete: true,
      });
      setConfig(prev => ({
        ...(prev ?? { uid }),
        voiceId:       res.data.voiceId,
        voiceStatus:   'ready',
        setupComplete: true,
      } as AvatarConfig));
      setCloneMsg(t.cloneOk);
      setTimeout(() => setCloneMsg(''), 6000);
    } catch (e: any) {
      const msg = e?.message ?? e?.details ?? String(e);
      setCloneErr(t.cloneErr + msg.slice(0, 300));
    } finally {
      setCloning(false);
    }
  };

  // ── Styles ────────────────────────────────────────────────────────────────
  const A  = 'hsl(36 80% 55%)';   // amber
  const CR = 'hsl(38 50% 92%)';   // cream
  const DM = 'hsl(38 40% 92% / 0.5)';
  const DK = 'hsl(30 15% 7%)';
  const card: React.CSSProperties = {
    background:   'hsl(30 12% 11%)',
    border:       '1px solid hsl(30 10% 18%)',
    borderRadius: '1rem',
    padding:      '1.25rem',
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
          {/* Photo status */}
          <div className="flex items-center gap-2">
            <span className="text-lg">{photoIds.size > 0 ? '✅' : '⬜'}</span>
            <span className="font-body text-sm" style={{ color: photoIds.size > 0 ? A : DM }}>
              {photoIds.size > 0
                ? `${photoIds.size} ${t.photoCount}`
                : t.needPhoto}
            </span>
          </div>
          <span style={{ color: 'hsl(30 10% 25%)' }}>|</span>
          {/* Audio status */}
          <div className="flex items-center gap-2">
            <span className="text-lg">{audioItem ? '✅' : '⬜'}</span>
            <span className="font-body text-sm" style={{ color: audioItem ? A : DM }}>
              {audioItem ? audioItem.name.slice(0, 22) : t.needAudio}
            </span>
          </div>
          <span style={{ color: 'hsl(30 10% 25%)' }}>|</span>
          {/* Voice status */}
          <div className="flex items-center gap-2">
            <span className="text-lg">{voiceReady ? '✅' : '⬜'}</span>
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

        {/* ══ SECTION 1: Photos ═════════════════════════════════════════════ */}
        <div style={card}>
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-display text-base font-bold" style={{ color: CR }}>{t.photosTitle}</h3>
            <span className="font-body text-xs px-2 py-0.5 rounded-full"
                  style={{ background: photoIds.size > 0 ? `${A}22` : 'hsl(30 10% 18%)', color: photoIds.size > 0 ? A : DM }}>
              {photoIds.size} {t.of} 5 {t.selected}
            </span>
          </div>
          <p className="font-body text-xs mb-4" style={{ color: DM }}>{t.photosDesc}</p>

          {photos.length === 0 ? (
            <p className="font-body text-sm px-4 py-3 rounded-lg"
               style={{ background: 'hsl(36 25% 8%)', color: A }}>{t.noPhotos}</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {photos.map(p => {
                const sel      = photoIds.has(p.id);
                const disabled = !sel && photoIds.size >= 5;
                return (
                  <div key={p.id}
                       onClick={() => !disabled && togglePhoto(p.id)}
                       className="relative rounded-xl overflow-hidden transition-all"
                       style={{
                         cursor:     disabled ? 'not-allowed' : 'pointer',
                         opacity:    disabled ? 0.4 : 1,
                         border:     `2px solid ${sel ? A : 'hsl(30 10% 20%)'}`,
                         boxShadow:  sel ? `0 0 18px ${A}44` : 'none',
                         transform:  sel ? 'scale(1.02)' : 'scale(1)',
                       }}>
                    {/* Image */}
                    <div style={{ aspectRatio: '1/1' }}>
                      <img src={p.url} alt={p.name} className="w-full h-full object-cover" />
                    </div>
                    {/* Selected overlay */}
                    {sel && (
                      <div className="absolute inset-0 flex items-center justify-center"
                           style={{ background: `${A}18` }}>
                        <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-lg"
                             style={{ background: A, color: DK }}>✓</div>
                      </div>
                    )}
                    {/* Name bar */}
                    <div className="px-2 py-1.5" style={{ background: sel ? `${A}22` : 'hsl(30 12% 9%)' }}>
                      <p className="font-body text-xs truncate" style={{ color: sel ? A : DM }}>
                        {p.name.slice(0, 18)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Selected list */}
          {photoIds.size > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {photos.filter(p => photoIds.has(p.id)).map((p, i) => (
                <span key={p.id}
                      onClick={() => togglePhoto(p.id)}
                      className="cursor-pointer inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-body"
                      style={{ background: `${A}22`, color: A, border: `1px solid ${A}44` }}
                      title={t.clickDeselect}>
                  {i + 1}. {p.name.slice(0, 14)} ×
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ══ SECTION 2: Audio ══════════════════════════════════════════════ */}
        <div style={card}>
          <h3 className="font-display text-base font-bold mb-1" style={{ color: CR }}>{t.audioTitle}</h3>
          <p  className="font-body text-xs mb-4"                style={{ color: DM }}>{t.audioDesc}</p>

          {audios.length === 0 ? (
            <p className="font-body text-sm px-4 py-3 rounded-lg"
               style={{ background: 'hsl(36 25% 8%)', color: A }}>{t.noAudio}</p>
          ) : (
            <div className="space-y-2">
              {audios.map(a => {
                const sel = audioItem?.id === a.id;
                return (
                  <div key={a.id}
                       onClick={() => toggleAudio(a)}
                       className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all"
                       style={{
                         background: sel ? `${A}14` : 'hsl(30 10% 14%)',
                         border:     `2px solid ${sel ? A : 'hsl(30 10% 20%)'}`,
                         boxShadow:  sel ? `0 0 14px ${A}33` : 'none',
                       }}>
                    {/* Icon */}
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl flex-shrink-0"
                         style={{ background: sel ? `${A}33` : 'hsl(30 10% 20%)' }}>
                      {a.type === 'video' ? '🎬' : '🎵'}
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-body text-sm font-semibold truncate"
                         style={{ color: sel ? A : CR }}>
                        {a.name}
                      </p>
                      <p className="font-body text-xs" style={{ color: DM }}>
                        {a.type} {a.size ? `· ${fmtSize(a.size)}` : ''}
                        {sel ? ` · ${t.audioChange}` : ` · ${t.audioHint}`}
                      </p>
                    </div>
                    {/* Badge */}
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
              <p className="font-body text-xs mb-2" style={{ color: A }}>{t.previewLabel} {audioItem.name}</p>
              <audio controls src={audioItem.url} className="w-full" />
            </div>
          )}
        </div>

        {/* ══ SECTION 3: Actions ════════════════════════════════════════════ */}
        <div style={card}>
          <h3 className="font-display text-base font-bold mb-1" style={{ color: CR }}>{t.cloneTitle}</h3>
          <p  className="font-body text-xs mb-4"                style={{ color: DM }}>{t.cloneDesc}</p>

          <div className="flex flex-wrap gap-3 items-center">

            {/* Save button */}
            <button
              onClick={handleSave}
              disabled={saving || (photoIds.size === 0 && !audioItem)}
              className="font-body font-semibold text-sm px-5 py-2.5 rounded-xl transition-all disabled:opacity-40"
              style={{ background: 'hsl(30 10% 20%)', color: CR, border: '1px solid hsl(30 10% 30%)' }}>
              {saving ? t.btnSaving : saveMsg || t.btnSave}
            </button>

            {/* Clone button */}
            <button
              onClick={handleClone}
              disabled={cloning || photoIds.size === 0 || !audioItem}
              className="font-body font-semibold text-sm px-6 py-2.5 rounded-xl transition-all disabled:opacity-40 flex items-center gap-2"
              style={{
                background: cloning
                  ? 'hsl(36 25% 14%)'
                  : voiceReady
                    ? 'hsl(142 40% 13%)'
                    : photoIds.size > 0 && audioItem ? A : 'hsl(30 10% 20%)',
                color: cloning ? A : voiceReady ? 'hsl(142 80% 68%)' : DK,
                border: voiceReady ? '1px solid hsl(142 50% 28%)' : 'none',
              }}>
              {cloning && <span className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />}
              {cloning ? t.btnCloning : voiceReady ? t.btnReclone : t.btnClone}
            </button>
          </div>

          {/* Feedback messages */}
          {cloneMsg && (
            <div className="mt-3 px-4 py-2.5 rounded-xl text-sm font-body"
                 style={{ background: 'hsl(142 40% 9%)', color: 'hsl(142 80% 68%)', border: '1px solid hsl(142 50% 22%)' }}>
              {cloneMsg}
            </div>
          )}
          {cloneErr && (
            <div className="mt-3 px-4 py-2.5 rounded-xl text-sm font-body"
                 style={{ background: 'hsl(0 40% 9%)', color: 'hsl(0 80% 68%)', border: '1px solid hsl(0 50% 22%)' }}>
              {cloneErr}
            </div>
          )}
        </div>

      </>)}
    </div>
  );
}
