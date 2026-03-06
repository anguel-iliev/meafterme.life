'use client';
/**
 * AvatarSetup — Настройка на AI аватар (v2 — интуитивен UX)
 *
 * Поток:
 *  1. Избери ЕДНА главна снимка (кликни → избрана)
 *  2. Избери ЕДИН аудио/видео запис за гласа (кликни → избран)
 *  3. Натисни "Клонирай гласа" — 30–60 сек
 *  4. Готово — в "AI Аватар" виждаш видео отговори
 *
 * Активният аватар (снимка + глас) се пази в Firestore: avatar_configs/{uid}
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useLang } from '@/components/LangContext';
import type { AppUser, MemoryItem, AvatarConfig } from '@/lib/clientStore';
import {
  getMemoryItems,
  getAvatarConfig, saveAvatarConfig,
  waitForAuthReady,
} from '@/lib/clientStore';
import { isFirebaseClientConfigured } from '@/lib/firebaseClient';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getApp } from 'firebase/app';

// ─── i18n ──────────────────────────────────────────────────────────────────────
const T = {
  bg: {
    title:         '🎬 Настройка на AI Аватар',
    subtitle:      'Три стъпки за да създадете вашия дигитален двойник.',
    step1Title:    'Стъпка 1 — Изберете снимка',
    step1Desc:     'Кликнете на снимка с ясно видимо лице. Тя ще бъде използвана за видео анимацията.',
    step2Title:    'Стъпка 2 — Изберете аудио за гласа',
    step2Desc:     'Кликнете на аудио/видео запис с ясен глас (поне 1 минута). ElevenLabs ще клонира гласа.',
    step3Title:    'Стъпка 3 — Клонирайте гласа',
    step3Desc:     'Натиснете бутона. Процесът отнема 30–60 секунди.',
    noPhotos:      '📂 Нямате качени снимки. Отидете в "Мултимедия" и качете снимки на лицето си.',
    noAudio:       '📂 Нямате качени аудио/видео файлове.',
    selectHint:    'Кликнете за избор',
    selected:      '✓ Избран',
    activeAvatar:  '🤖 Активен аватар',
    photo:         'Снимка',
    voice:         'Глас',
    notSet:        'не е зададен',
    voiceReady:    'Готов ✓',
    voiceNone:     'Не е клониран',
    btnClone:      '🔊 Клонирай гласа',
    btnCloning:    '⏳ Клонирането тече… (30–60 сек)',
    btnVoiceReady: '✅ Гласът е клониран — Клонирай отново',
    btnSave:       '💾 Запази избора',
    btnSaving:     'Запазване…',
    btnSaved:      '✓ Запазено!',
    statusReady:   '✅ Аватарът е готов! Отидете в "AI Аватар" за да чатите.',
    statusSetup:   '⚙️ Завършете настройката: изберете снимка + аудио + клонирайте гласа.',
    statusPartial: '⚙️ Почти готово: ',
    errNoAudio:    'Моля изберете аудио файл.',
    errNoFirebase: 'Firebase не е конфигуриран.',
    cloneOk:       '✅ Гласът е клониран успешно!',
    cloneErr:      '❌ Грешка при клониране: ',
    loading:       'Зареждане…',
    size:          'Размер',
    changePhoto:   'Сменете снимката',
    changeAudio:   'Сменете аудиото',
  },
  en: {
    title:         '🎬 AI Avatar Setup',
    subtitle:      'Three steps to create your digital twin.',
    step1Title:    'Step 1 — Choose a photo',
    step1Desc:     'Click a photo with a clearly visible face. It will be used for video animation.',
    step2Title:    'Step 2 — Choose audio for voice',
    step2Desc:     'Click an audio/video recording with a clear voice (at least 1 minute). ElevenLabs will clone it.',
    step3Title:    'Step 3 — Clone the voice',
    step3Desc:     'Press the button. The process takes 30–60 seconds.',
    noPhotos:      '📂 No photos uploaded. Go to "Multimedia" and upload face photos.',
    noAudio:       '📂 No audio/video files uploaded.',
    selectHint:    'Click to select',
    selected:      '✓ Selected',
    activeAvatar:  '🤖 Active avatar',
    photo:         'Photo',
    voice:         'Voice',
    notSet:        'not set',
    voiceReady:    'Ready ✓',
    voiceNone:     'Not cloned',
    btnClone:      '🔊 Clone Voice',
    btnCloning:    '⏳ Cloning… (30–60 sec)',
    btnVoiceReady: '✅ Voice cloned — Clone again',
    btnSave:       '💾 Save selection',
    btnSaving:     'Saving…',
    btnSaved:      '✓ Saved!',
    statusReady:   '✅ Avatar is ready! Go to "AI Avatar" to start chatting.',
    statusSetup:   '⚙️ Complete setup: choose photo + audio + clone voice.',
    statusPartial: '⚙️ Almost done: ',
    errNoAudio:    'Please select an audio file.',
    errNoFirebase: 'Firebase not configured.',
    cloneOk:       '✅ Voice cloned successfully!',
    cloneErr:      '❌ Clone error: ',
    loading:       'Loading…',
    size:          'Size',
    changePhoto:   'Change photo',
    changeAudio:   'Change audio',
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtSize = (b?: number) => !b ? '' : b < 1024*1024
  ? `${(b/1024).toFixed(0)} KB`
  : `${(b/1024/1024).toFixed(1)} MB`;

// ─── Component ────────────────────────────────────────────────────────────────
export default function AvatarSetup({
  user,
  ownerUid,
}: {
  user:     AppUser;
  ownerUid: string;
}) {
  const { locale } = useLang();
  const t = T[locale as 'bg' | 'en'] || T.bg;

  const [memories,       setMemories]      = useState<MemoryItem[]>([]);
  const [avatarConfig,   setAvatarConfig]  = useState<AvatarConfig | null>(null);
  const [loading,        setLoading]       = useState(true);
  const [selectedPhoto,  setSelectedPhoto] = useState<MemoryItem | null>(null);
  const [selectedAudio,  setSelectedAudio] = useState<MemoryItem | null>(null);
  const [cloning,        setCloning]       = useState(false);
  const [cloneMsg,       setCloneMsg]      = useState('');
  const [cloneErr,       setCloneErr]      = useState('');
  const [saving,         setSaving]        = useState(false);
  const [saveMsg,        setSaveMsg]       = useState('');

  // ── Load ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const firebaseUser = await waitForAuthReady();
        const uid = firebaseUser?.uid || ownerUid;
        const [mems, cfg] = await Promise.all([
          getMemoryItems(uid).catch(() => [] as MemoryItem[]),
          getAvatarConfig(uid).catch(() => null),
        ]);
        setMemories(mems);
        setAvatarConfig(cfg);
        // Pre-select from saved config
        if (cfg?.photoMemoryId) {
          const p = mems.find(m => m.id === cfg.photoMemoryId);
          if (p) setSelectedPhoto(p);
        }
        if (cfg?.audioMemoryId) {
          const a = mems.find(m => m.id === cfg.audioMemoryId);
          if (a) setSelectedAudio(a);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [ownerUid]);

  const photos = memories.filter(m => m.type === 'photo');
  const audios = memories.filter(m => m.type === 'audio' || m.type === 'video');

  const voiceReady = avatarConfig?.voiceStatus === 'ready';
  const isFullyReady = voiceReady && !!selectedPhoto;

  // ── Save selection ────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true); setSaveMsg('');
    try {
      const firebaseUser = await waitForAuthReady();
      const uid = firebaseUser?.uid || ownerUid;
      const cfg: Partial<AvatarConfig> = { uid };
      if (selectedPhoto) {
        cfg.photoMemoryId = selectedPhoto.id;
        cfg.photoUrl      = selectedPhoto.url;
        cfg.photoName     = selectedPhoto.name;
      }
      if (selectedAudio) {
        cfg.audioMemoryId    = selectedAudio.id;
        cfg.audioUrl         = selectedAudio.url;
        cfg.audioName        = selectedAudio.name;
        cfg.audioStoragePath = selectedAudio.storagePath;
      }
      cfg.setupComplete = isFullyReady;
      await saveAvatarConfig(uid, cfg);
      setAvatarConfig(prev => ({ ...(prev || { uid }), ...cfg } as AvatarConfig));
      setSaveMsg(t.btnSaved);
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (e: any) {
      setSaveMsg('❌ ' + (e?.message || 'Error'));
    } finally {
      setSaving(false);
    }
  };

  // ── Clone voice ───────────────────────────────────────────────────────────
  const handleCloneVoice = async () => {
    if (!selectedAudio) { setCloneErr(t.errNoAudio); return; }
    if (!isFirebaseClientConfigured()) { setCloneErr(t.errNoFirebase); return; }

    setCloning(true); setCloneMsg(''); setCloneErr('');
    try {
      const firebaseUser = await waitForAuthReady();
      const uid = firebaseUser?.uid || ownerUid;

      // Save current selection first
      const preCfg: Partial<AvatarConfig> = {
        audioMemoryId:    selectedAudio.id,
        audioUrl:         selectedAudio.url,
        audioName:        selectedAudio.name,
        audioStoragePath: selectedAudio.storagePath,
      };
      if (selectedPhoto) {
        preCfg.photoMemoryId = selectedPhoto.id;
        preCfg.photoUrl      = selectedPhoto.url;
        preCfg.photoName     = selectedPhoto.name;
      }
      await saveAvatarConfig(uid, preCfg);

      // Call Cloud Function — deployed in us-central1
      const fns = getFunctions(getApp(), 'us-central1');
      const cloneFn = httpsCallable<
        { audioStoragePath: string; voiceName: string },
        { voiceId: string; status: string }
      >(fns, 'cloneVoice');

      const result = await cloneFn({
        audioStoragePath: selectedAudio.storagePath,
        voiceName: `avatar_${uid.slice(0, 8)}`,
      });

      const voiceId = result.data.voiceId;
      await saveAvatarConfig(uid, {
        voiceId,
        voiceStatus:   'ready',
        setupComplete: !!selectedPhoto,
      });
      setAvatarConfig(prev => ({
        ...(prev || { uid }),
        voiceId,
        voiceStatus:   'ready',
        setupComplete: !!selectedPhoto,
      } as AvatarConfig));
      setCloneMsg(t.cloneOk);
      setTimeout(() => setCloneMsg(''), 5000);
    } catch (e: any) {
      const msg = e?.message || e?.details || String(e);
      setCloneErr(t.cloneErr + msg.slice(0, 300));
    } finally {
      setCloning(false);
    }
  };

  // ── Styles ────────────────────────────────────────────────────────────────
  const amber  = 'hsl(36 80% 55%)';
  const cream  = 'hsl(38 50% 92%)';
  const dimmed = 'hsl(38 50% 92% / 0.55)';
  const dark   = 'hsl(30 15% 7%)';
  const card   = {
    background:   'hsl(30 12% 11%)',
    border:       '1px solid hsl(30 10% 18%)',
    borderRadius: '1rem',
    padding:      '1.25rem',
  } as React.CSSProperties;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 max-w-2xl">

      {/* ── Header ── */}
      <div>
        <h2 className="font-display text-xl font-bold" style={{ color: cream }}>{t.title}</h2>
        <p className="font-body text-sm mt-1" style={{ color: dimmed }}>{t.subtitle}</p>
      </div>

      {/* ── Active Avatar Status Card ── */}
      <div style={{
        ...card,
        background: isFullyReady ? 'hsl(142 35% 10%)' : 'hsl(36 25% 9%)',
        border: `1px solid ${isFullyReady ? 'hsl(142 50% 25%)' : 'hsl(36 80% 55% / 0.25)'}`,
      }}>
        <p className="font-display text-sm font-bold mb-3" style={{ color: isFullyReady ? 'hsl(142 70% 65%)' : amber }}>
          {t.activeAvatar}
        </p>

        <div className="flex items-center gap-4 flex-wrap">
          {/* Active photo preview */}
          <div className="flex items-center gap-2">
            <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0"
                 style={{ border: `2px solid ${selectedPhoto ? amber : 'hsl(30 10% 22%)'}` }}>
              {selectedPhoto
                ? <img src={selectedPhoto.url} alt="" className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center text-xl"
                       style={{ background: 'hsl(30 10% 16%)' }}>📸</div>
              }
            </div>
            <div>
              <p className="text-xs font-body" style={{ color: dimmed }}>{t.photo}</p>
              <p className="text-sm font-body font-medium" style={{ color: cream }}>
                {selectedPhoto ? selectedPhoto.name.slice(0, 20) : <span style={{ color: dimmed }}>{t.notSet}</span>}
              </p>
            </div>
          </div>

          <div style={{ width: '1px', height: '36px', background: 'hsl(30 10% 20%)' }} />

          {/* Active voice */}
          <div className="flex items-center gap-2">
            <div className="w-12 h-12 rounded-lg flex items-center justify-center text-xl flex-shrink-0"
                 style={{ background: 'hsl(30 10% 16%)', border: `2px solid ${voiceReady ? 'hsl(142 50% 30%)' : 'hsl(30 10% 22%)'}` }}>
              {voiceReady ? '✅' : '🎤'}
            </div>
            <div>
              <p className="text-xs font-body" style={{ color: dimmed }}>{t.voice}</p>
              <p className="text-sm font-body font-medium"
                 style={{ color: voiceReady ? 'hsl(142 70% 65%)' : cream }}>
                {selectedAudio
                  ? (voiceReady ? t.voiceReady : selectedAudio.name.slice(0, 20))
                  : <span style={{ color: dimmed }}>{t.notSet}</span>
                }
              </p>
            </div>
          </div>
        </div>

        {/* Overall status */}
        <p className="mt-3 text-xs font-body rounded-lg px-3 py-2"
           style={{
             background: isFullyReady ? 'hsl(142 40% 8%)' : 'hsl(36 30% 8%)',
             color: isFullyReady ? 'hsl(142 70% 65%)' : amber,
           }}>
          {isFullyReady ? t.statusReady : t.statusSetup}
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-6" style={{ color: amber }}>
          <span className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
          <span className="font-body text-sm">{t.loading}</span>
        </div>
      ) : (<>

        {/* ══ STEP 1: Photo ══════════════════════════════════════════════════ */}
        <div style={card}>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center"
                  style={{ background: selectedPhoto ? amber : 'hsl(30 10% 22%)', color: selectedPhoto ? dark : dimmed }}>
              {selectedPhoto ? '✓' : '1'}
            </span>
            <h3 className="font-display text-base font-bold" style={{ color: cream }}>{t.step1Title}</h3>
          </div>
          <p className="font-body text-xs mb-4 ml-8" style={{ color: dimmed }}>{t.step1Desc}</p>

          {photos.length === 0 ? (
            <p className="font-body text-sm py-3 px-4 rounded-lg"
               style={{ background: 'hsl(36 30% 8%)', color: amber }}>{t.noPhotos}</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {photos.map(photo => {
                const isSelected = selectedPhoto?.id === photo.id;
                return (
                  <div key={photo.id}
                       onClick={() => setSelectedPhoto(isSelected ? null : photo)}
                       className="relative rounded-xl overflow-hidden cursor-pointer transition-all hover:scale-[1.02]"
                       style={{
                         border:     `2px solid ${isSelected ? amber : 'hsl(30 10% 20%)'}`,
                         boxShadow:  isSelected ? `0 0 20px ${amber}44` : 'none',
                         outline:    isSelected ? `2px solid ${amber}33` : 'none',
                         outlineOffset: '2px',
                       }}>
                    {/* Image */}
                    <div style={{ aspectRatio: '1/1', background: dark }}>
                      <img src={photo.url} alt={photo.name} className="w-full h-full object-cover" />
                    </div>
                    {/* Selected overlay */}
                    {isSelected && (
                      <div className="absolute inset-0 flex items-center justify-center"
                           style={{ background: `${amber}20` }}>
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-xl font-bold"
                             style={{ background: amber, color: dark }}>✓</div>
                      </div>
                    )}
                    {/* Name bar */}
                    <div className="px-2 py-1.5"
                         style={{ background: isSelected ? `${amber}22` : 'hsl(30 12% 9%)' }}>
                      <p className="font-body text-xs truncate" style={{ color: isSelected ? amber : dimmed }}>
                        {isSelected ? `✓ ${photo.name.slice(0, 14)}` : photo.name.slice(0, 16)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {selectedPhoto && (
            <button onClick={() => setSelectedPhoto(null)}
                    className="mt-3 text-xs font-body underline"
                    style={{ color: dimmed }}>
              {t.changePhoto}
            </button>
          )}
        </div>

        {/* ══ STEP 2: Audio ══════════════════════════════════════════════════ */}
        <div style={card}>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center"
                  style={{ background: selectedAudio ? amber : 'hsl(30 10% 22%)', color: selectedAudio ? dark : dimmed }}>
              {selectedAudio ? '✓' : '2'}
            </span>
            <h3 className="font-display text-base font-bold" style={{ color: cream }}>{t.step2Title}</h3>
          </div>
          <p className="font-body text-xs mb-4 ml-8" style={{ color: dimmed }}>{t.step2Desc}</p>

          {audios.length === 0 ? (
            <p className="font-body text-sm py-3 px-4 rounded-lg"
               style={{ background: 'hsl(36 30% 8%)', color: amber }}>{t.noAudio}</p>
          ) : (
            <div className="space-y-2">
              {audios.map(audio => {
                const isSelected = selectedAudio?.id === audio.id;
                return (
                  <div key={audio.id}
                       onClick={() => setSelectedAudio(isSelected ? null : audio)}
                       className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all"
                       style={{
                         background: isSelected ? `${amber}14` : 'hsl(30 10% 14%)',
                         border:     `2px solid ${isSelected ? amber : 'hsl(30 10% 20%)'}`,
                         boxShadow:  isSelected ? `0 0 14px ${amber}33` : 'none',
                       }}>
                    {/* Icon */}
                    <div className="w-11 h-11 rounded-lg flex items-center justify-center text-xl flex-shrink-0"
                         style={{ background: isSelected ? `${amber}33` : 'hsl(30 10% 20%)' }}>
                      {audio.type === 'video' ? '🎬' : '🎵'}
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-body text-sm font-semibold truncate" style={{ color: isSelected ? amber : cream }}>
                        {audio.name}
                      </p>
                      <p className="font-body text-xs" style={{ color: dimmed }}>
                        {audio.type === 'video' ? 'video' : 'audio'}
                        {audio.size ? ` · ${fmtSize(audio.size)}` : ''}
                      </p>
                    </div>
                    {/* Selected badge */}
                    <div className="flex-shrink-0">
                      {isSelected ? (
                        <span className="text-sm px-3 py-1 rounded-full font-body font-bold"
                              style={{ background: amber, color: dark }}>✓</span>
                      ) : (
                        <span className="text-xs px-3 py-1 rounded-full font-body"
                              style={{ background: 'hsl(30 10% 20%)', color: dimmed }}>{t.selectHint}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Audio preview */}
          {selectedAudio && (
            <div className="mt-3 space-y-2">
              <audio controls src={selectedAudio.url} className="w-full rounded-lg" />
              <button onClick={() => setSelectedAudio(null)}
                      className="text-xs font-body underline"
                      style={{ color: dimmed }}>
                {t.changeAudio}
              </button>
            </div>
          )}
        </div>

        {/* ══ STEP 3: Actions ════════════════════════════════════════════════ */}
        <div style={card}>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center"
                  style={{ background: voiceReady ? amber : 'hsl(30 10% 22%)', color: voiceReady ? dark : dimmed }}>
              {voiceReady ? '✓' : '3'}
            </span>
            <h3 className="font-display text-base font-bold" style={{ color: cream }}>{t.step3Title}</h3>
          </div>
          <p className="font-body text-xs mb-4 ml-8" style={{ color: dimmed }}>{t.step3Desc}</p>

          <div className="flex flex-col sm:flex-row gap-3">
            {/* Save button */}
            <button
              onClick={handleSave}
              disabled={saving || (!selectedPhoto && !selectedAudio)}
              className="font-body font-semibold text-sm px-5 py-2.5 rounded-xl transition-all disabled:opacity-40"
              style={{ background: 'hsl(30 10% 20%)', color: cream, border: '1px solid hsl(30 10% 28%)' }}>
              {saving ? t.btnSaving : saveMsg || t.btnSave}
            </button>

            {/* Clone voice button */}
            <button
              onClick={handleCloneVoice}
              disabled={cloning || !selectedAudio}
              className="font-body font-semibold text-sm px-6 py-2.5 rounded-xl transition-all disabled:opacity-40 flex items-center gap-2"
              style={{
                background: cloning ? 'hsl(36 30% 15%)' : voiceReady ? 'hsl(142 40% 14%)' : amber,
                color:      cloning ? amber : voiceReady ? 'hsl(142 80% 70%)' : dark,
                border:     voiceReady ? '1px solid hsl(142 50% 28%)' : 'none',
              }}>
              {cloning && <span className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />}
              {cloning ? t.btnCloning : voiceReady ? t.btnVoiceReady : t.btnClone}
            </button>
          </div>

          {/* Messages */}
          {cloneMsg && !cloneErr && (
            <div className="mt-3 text-sm font-body px-4 py-2.5 rounded-xl"
                 style={{ background: 'hsl(142 40% 9%)', color: 'hsl(142 80% 70%)', border: '1px solid hsl(142 50% 22%)' }}>
              {cloneMsg}
            </div>
          )}
          {cloneErr && (
            <div className="mt-3 text-sm font-body px-4 py-2.5 rounded-xl"
                 style={{ background: 'hsl(0 40% 9%)', color: 'hsl(0 80% 70%)', border: '1px solid hsl(0 50% 22%)' }}>
              {cloneErr}
            </div>
          )}
        </div>

      </>)}
    </div>
  );
}
