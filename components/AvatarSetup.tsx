'use client';
/**
 * AvatarSetup — Настройка на AI аватар
 *
 * Позволява на потребителя да:
 *  1. Избере 3-5 референтни снимки за аватара (usage: "avatar_reference")
 *  2. Избере аудио/видео записи за клониране на глас
 *  3. Стартира клониране на глас чрез Cloud Function `cloneVoice`
 *  4. Вижда статуса на аватара
 *
 * Метаданни: { usage: "avatar_reference" } — пазят се в Firestore
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useLang } from '@/components/LangContext';
import type { AppUser, MemoryItem, AvatarConfig } from '@/lib/clientStore';
import {
  getMemoryItems, setMemoryUsage,
  getAvatarConfig, saveAvatarConfig,
  waitForAuthReady,
} from '@/lib/clientStore';
import { isFirebaseClientConfigured, getClientAuth } from '@/lib/firebaseClient';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getApp } from 'firebase/app';

// ─── i18n ──────────────────────────────────────────────────────────────────────
const i18n = {
  bg: {
    title:        '🎬 Настройка на AI Аватар',
    subtitle:     'Изберете референтни материали за вашия дигитален двойник.',
    stepPhotos:   'Стъпка 1: Референтни снимки (лице)',
    stepPhotosDesc:'Изберете 1–5 ясни снимки с вашето лице. Те ще бъдат използвани от D-ID за анимация.',
    stepAudio:    'Стъпка 2: Аудио за клониране на глас',
    stepAudioDesc:'Изберете 1–3 аудио/видео записа (поне 1 минута общо). ElevenLabs ще клонира вашия глас.',
    markRef:      '⭐ Маркирай като референция',
    unmarkRef:    '✓ Референция',
    cloneVoice:   '🔊 Клонирай гласа',
    voiceStatus:  'Статус на гласа',
    voiceReady:   '✅ Гласът е готов',
    voiceError:   '❌ Грешка при клониране',
    voicePending: '⏳ Клонирането е в процес…',
    voiceNone:    'Не е конфигуриран',
    avatarReady:  '✅ Аватарът е готов за използване!',
    avatarNotReady: 'Завършете настройката за да активирате видео режима.',
    loading:      'Зареждам медия…',
    noPhotos:     'Нямате качени снимки. Отидете в "Мултимедия" и качете снимки.',
    noAudio:      'Нямате качени аудио/видео файлове.',
    selectPhoto:  'Изберете главна снимка за аватара',
    selectedPhoto:'✓ Избрана снимка за аватар',
    selectAudio:  'Изберете аудио за клониране',
    selectedAudio:'✓ Избрано аудио за клониране',
    cloning:      'Клониране в процес… (30–60 сек)',
    cloneSuccess: '✅ Гласът е клониран успешно!',
    cloneError:   '❌ Грешка: ',
    saveConfig:   '💾 Запази настройките',
    saved:        '✓ Запазено',
    saving:       'Запазване…',
    avatarPhoto:  'Снимка за аватар',
    avatarAudio:  'Аудио за глас',
    refBadge:     '⭐ Референция',
    typePhoto:    'снимка',
    typeAudio:    'аудио',
    typeVideo:    'видео',
    howToTitle:   'Как работи?',
    howToSteps: [
      '1. Изберете главна снимка — ясна снимка на лице, без тъмнина.',
      '2. Изберете аудио — запис с ясен глас, без шум, поне 1 мин.',
      '3. Кликнете „Клонирай гласа" — ще отнеме 30–60 сек.',
      '4. Готово! В таба „AI Аватар" ще виждате видео отговори.',
    ],
  },
  en: {
    title:        '🎬 AI Avatar Setup',
    subtitle:     'Select reference materials for your digital twin.',
    stepPhotos:   'Step 1: Reference Photos (face)',
    stepPhotosDesc:'Select 1–5 clear photos of your face. D-ID will use them for animation.',
    stepAudio:    'Step 2: Audio for Voice Cloning',
    stepAudioDesc:'Select 1–3 audio/video recordings (at least 1 minute total). ElevenLabs will clone your voice.',
    markRef:      '⭐ Mark as reference',
    unmarkRef:    '✓ Reference',
    cloneVoice:   '🔊 Clone Voice',
    voiceStatus:  'Voice Status',
    voiceReady:   '✅ Voice is ready',
    voiceError:   '❌ Clone error',
    voicePending: '⏳ Cloning in progress…',
    voiceNone:    'Not configured',
    avatarReady:  '✅ Avatar is ready to use!',
    avatarNotReady: 'Complete setup to enable video mode.',
    loading:      'Loading media…',
    noPhotos:     'No photos uploaded. Go to "Multimedia" and upload photos.',
    noAudio:      'No audio/video files uploaded.',
    selectPhoto:  'Select main avatar photo',
    selectedPhoto:'✓ Avatar photo selected',
    selectAudio:  'Select audio for cloning',
    selectedAudio:'✓ Audio for cloning selected',
    cloning:      'Cloning in progress… (30–60 sec)',
    cloneSuccess: '✅ Voice cloned successfully!',
    cloneError:   '❌ Error: ',
    saveConfig:   '💾 Save Settings',
    saved:        '✓ Saved',
    saving:       'Saving…',
    avatarPhoto:  'Avatar photo',
    avatarAudio:  'Voice audio',
    refBadge:     '⭐ Reference',
    typePhoto:    'photo',
    typeAudio:    'audio',
    typeVideo:    'video',
    howToTitle:   'How does it work?',
    howToSteps: [
      '1. Select main photo — clear face photo, no darkness.',
      '2. Select audio — clear voice recording, no noise, at least 1 min.',
      '3. Click "Clone Voice" — takes 30–60 sec.',
      '4. Done! In the "AI Avatar" tab you\'ll see video responses.',
    ],
  },
};

// ─── Main Component ────────────────────────────────────────────────────────────
export default function AvatarSetup({
  user,
  ownerUid,
}: {
  user:     AppUser;
  ownerUid: string;
}) {
  const { locale } = useLang();
  const t = i18n[locale as 'en' | 'bg'] || i18n.bg;

  const [memories,     setMemories]     = useState<MemoryItem[]>([]);
  const [avatarConfig, setAvatarConfig] = useState<AvatarConfig | null>(null);
  const [loading,      setLoading]      = useState(true);

  // Selected items for avatar
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [selectedAudioId, setSelectedAudioId] = useState<string | null>(null);

  // Voice clone state
  const [cloning,      setCloning]      = useState(false);
  const [cloneMsg,     setCloneMsg]     = useState('');
  const [cloneError,   setCloneError]   = useState('');

  // Save state
  const [saving,       setSaving]       = useState(false);
  const [saveMsg,      setSaveMsg]      = useState('');

  // ── Load data ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const firebaseUser = await waitForAuthReady();
      const uid = firebaseUser?.uid || ownerUid;
      const [mems, cfg] = await Promise.all([
        getMemoryItems(uid).catch(() => [] as MemoryItem[]),
        getAvatarConfig(uid).catch(() => null),
      ]);
      setMemories(mems);
      setAvatarConfig(cfg);
      if (cfg?.photoMemoryId) setSelectedPhotoId(cfg.photoMemoryId);
      if (cfg?.audioMemoryId) setSelectedAudioId(cfg.audioMemoryId);
      setLoading(false);
    };
    load();
  }, [ownerUid]);

  const photos = memories.filter(m => m.type === 'photo');
  const audios = memories.filter(m => m.type === 'audio' || m.type === 'video');

  // ── Toggle avatar_reference flag ─────────────────────────────────────────────
  const toggleRef = useCallback(async (item: MemoryItem) => {
    const newUsage = item.usage === 'avatar_reference' ? null : 'avatar_reference';
    // Optimistic update
    setMemories(prev => prev.map(m => m.id === item.id ? { ...m, usage: newUsage } : m));
    try {
      await setMemoryUsage(item, newUsage);
    } catch {
      // Revert
      setMemories(prev => prev.map(m => m.id === item.id ? { ...m, usage: item.usage } : m));
    }
  }, []);

  // ── Save config ───────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true); setSaveMsg('');
    try {
      const firebaseUser = await waitForAuthReady();
      const uid = firebaseUser?.uid || ownerUid;
      const photo = memories.find(m => m.id === selectedPhotoId);
      const audio = memories.find(m => m.id === selectedAudioId);
      const cfg: Partial<AvatarConfig> = {
        uid,
        photoMemoryId:   photo?.id,
        photoUrl:        photo?.url,
        photoName:       photo?.name,
        audioMemoryId:   audio?.id,
        audioUrl:        audio?.url,
        audioName:       audio?.name,
        audioStoragePath: audio?.storagePath,
        setupComplete:   !!(photo && audio && avatarConfig?.voiceId),
      };
      await saveAvatarConfig(uid, cfg);
      setAvatarConfig(prev => ({ ...(prev || { uid }), ...cfg } as AvatarConfig));
      setSaveMsg(t.saved);
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (e: any) {
      setSaveMsg('❌ ' + (e?.message || 'Error'));
    } finally {
      setSaving(false);
    }
  };

  // ── Clone voice ───────────────────────────────────────────────────────────────
  const handleCloneVoice = async () => {
    if (!selectedAudioId) return;
    const audio = memories.find(m => m.id === selectedAudioId);
    if (!audio) return;
    if (!isFirebaseClientConfigured()) {
      setCloneError(locale === 'bg'
        ? 'Firebase не е конфигуриран. Клонирането на глас изисква реален Firebase проект.'
        : 'Firebase not configured. Voice cloning requires a real Firebase project.');
      return;
    }

    setCloning(true); setCloneMsg(t.cloning); setCloneError('');
    try {
      const firebaseUser = await waitForAuthReady();
      const uid = firebaseUser?.uid || ownerUid;

      // First, save the selected photo/audio so the config is up to date
      const photo = memories.find(m => m.id === selectedPhotoId);
      await saveAvatarConfig(uid, {
        photoMemoryId: photo?.id,
        photoUrl: photo?.url,
        photoName: photo?.name,
        audioMemoryId: audio.id,
        audioUrl: audio.url,
        audioName: audio.name,
        audioStoragePath: audio.storagePath,
      });

      const functions = getFunctions(getApp(), 'europe-west1');
      const cloneFn = httpsCallable<
        { audioStoragePath: string; voiceName: string },
        { voiceId: string; status: string }
      >(functions, 'cloneVoice');

      const result = await cloneFn({
        audioStoragePath: audio.storagePath,
        voiceName: `${ownerUid.slice(0, 8)}_voice`,
      });

      const voiceId = result.data.voiceId;

      // Save voiceId + mark as complete
      await saveAvatarConfig(uid, {
        voiceId,
        voiceStatus: 'ready',
        setupComplete: !!photo,
      });

      setAvatarConfig(prev => ({
        ...(prev || { uid }),
        voiceId,
        voiceStatus: 'ready',
        setupComplete: !!photo,
      } as AvatarConfig));

      setCloneMsg(t.cloneSuccess);
      setTimeout(() => setCloneMsg(''), 5000);
    } catch (e: any) {
      const msg = e?.message || e?.details || String(e);
      setCloneError(t.cloneError + msg.slice(0, 200));
    } finally {
      setCloning(false);
    }
  };

  const voiceReady = avatarConfig?.voiceStatus === 'ready';
  const isReady    = voiceReady && !!avatarConfig?.photoUrl;

  // ── Styles ────────────────────────────────────────────────────────────────────
  const card   = { background: 'hsl(30 12% 11%)', border: '1px solid hsl(30 10% 18%)', borderRadius: '1rem', padding: '1.25rem' };
  const amber  = 'hsl(36 80% 55%)';
  const cream  = 'hsl(38 50% 92%)';
  const dimmed = 'hsl(38 50% 92% / 0.5)';
  const dark   = 'hsl(30 15% 7%)';

  return (
    <div className="space-y-6">

      {/* ── Page header ── */}
      <div>
        <h2 className="font-display text-xl font-bold" style={{ color: cream }}>{t.title}</h2>
        <p className="font-body text-sm mt-1" style={{ color: dimmed }}>{t.subtitle}</p>
      </div>

      {/* ── Status banner ── */}
      <div style={{
        ...card,
        background: isReady ? 'hsl(142 40% 12%)' : 'hsl(36 30% 10%)',
        border: `1px solid ${isReady ? 'hsl(142 60% 30%)' : 'hsl(36 80% 55% / 0.3)'}`,
      }}>
        <div className="flex items-center gap-3">
          <span className="text-2xl">{isReady ? '✅' : '⚙️'}</span>
          <div>
            <p className="font-body font-semibold text-sm" style={{ color: isReady ? 'hsl(142 80% 70%)' : amber }}>
              {isReady ? t.avatarReady : t.avatarNotReady}
            </p>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className="text-xs font-body" style={{ color: dimmed }}>
                📸 {avatarConfig?.photoName || (locale === 'bg' ? 'не избрана' : 'not selected')}
              </span>
              <span className="text-xs font-body" style={{ color: dimmed }}>
                🎤 {avatarConfig?.voiceStatus === 'ready'
                  ? (locale === 'bg' ? 'Гласът е готов' : 'Voice ready')
                  : (locale === 'bg' ? 'не клониран' : 'not cloned')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── How it works ── */}
      <div style={card}>
        <h3 className="font-display text-sm font-bold mb-3" style={{ color: amber }}>
          {t.howToTitle}
        </h3>
        <ul className="space-y-1.5">
          {t.howToSteps.map((step, i) => (
            <li key={i} className="font-body text-xs" style={{ color: dimmed }}>{step}</li>
          ))}
        </ul>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-4" style={{ color: amber }}>
          <span className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
          <span className="font-body text-sm">{t.loading}</span>
        </div>
      ) : (
        <>
          {/* ── Step 1: Photo selection ── */}
          <div style={card}>
            <h3 className="font-display text-base font-bold mb-1" style={{ color: cream }}>{t.stepPhotos}</h3>
            <p className="font-body text-xs mb-4" style={{ color: dimmed }}>{t.stepPhotosDesc}</p>

            {photos.length === 0 ? (
              <p className="font-body text-sm" style={{ color: 'hsl(36 80% 55% / 0.7)' }}>{t.noPhotos}</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {photos.map(photo => {
                  const isSelected = selectedPhotoId === photo.id;
                  const isRef      = photo.usage === 'avatar_reference';
                  return (
                    <div key={photo.id}
                         className="relative rounded-xl overflow-hidden cursor-pointer transition-all"
                         style={{
                           border: `2px solid ${isSelected ? amber : 'hsl(30 10% 22%)'}`,
                           boxShadow: isSelected ? `0 0 16px ${amber}55` : 'none',
                         }}
                         onClick={() => setSelectedPhotoId(isSelected ? null : photo.id)}>
                      {/* Thumbnail */}
                      <div style={{ aspectRatio: '1/1', background: 'hsl(30 15% 7%)' }}>
                        <img src={photo.url} alt={photo.name}
                             className="w-full h-full object-cover" />
                      </div>

                      {/* Selected overlay */}
                      {isSelected && (
                        <div className="absolute inset-0 flex items-center justify-center"
                             style={{ background: `${amber}22` }}>
                          <span className="text-2xl">✓</span>
                        </div>
                      )}

                      {/* Bottom bar */}
                      <div className="px-2 py-1.5 flex items-center justify-between gap-1"
                           style={{ background: 'hsl(30 12% 9%)' }}>
                        <span className="font-body text-xs truncate" style={{ color: dimmed, maxWidth: '80px' }}>
                          {photo.name.slice(0, 12)}
                        </span>
                        <button
                          onClick={e => { e.stopPropagation(); toggleRef(photo); }}
                          className="text-xs px-1.5 py-0.5 rounded-md flex-shrink-0 transition-colors"
                          title={isRef ? 'Remove avatar reference' : 'Mark as avatar reference'}
                          style={isRef
                            ? { background: `${amber}33`, color: amber, border: `1px solid ${amber}55` }
                            : { background: 'hsl(30 10% 20%)', color: dimmed }
                          }>
                          ⭐
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Reference badges summary */}
            {photos.filter(p => p.usage === 'avatar_reference').length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {photos.filter(p => p.usage === 'avatar_reference').map(p => (
                  <span key={p.id} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-body"
                        style={{ background: `${amber}22`, color: amber, border: `1px solid ${amber}44` }}>
                    ⭐ {p.name.slice(0, 16)}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* ── Step 2: Audio selection ── */}
          <div style={card}>
            <h3 className="font-display text-base font-bold mb-1" style={{ color: cream }}>{t.stepAudio}</h3>
            <p className="font-body text-xs mb-4" style={{ color: dimmed }}>{t.stepAudioDesc}</p>

            {audios.length === 0 ? (
              <p className="font-body text-sm" style={{ color: 'hsl(36 80% 55% / 0.7)' }}>{t.noAudio}</p>
            ) : (
              <div className="space-y-2">
                {audios.map(audio => {
                  const isSelected = selectedAudioId === audio.id;
                  const isRef      = audio.usage === 'avatar_reference';
                  return (
                    <div key={audio.id}
                         className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all"
                         style={{
                           background: isSelected ? `${amber}11` : 'hsl(30 10% 14%)',
                           border: `1px solid ${isSelected ? amber : 'hsl(30 10% 22%)'}`,
                         }}
                         onClick={() => setSelectedAudioId(isSelected ? null : audio.id)}>
                      {/* Icon */}
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-lg"
                           style={{ background: isSelected ? `${amber}33` : 'hsl(30 10% 20%)' }}>
                        {audio.type === 'video' ? '🎬' : '🎵'}
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-body text-sm font-medium truncate" style={{ color: cream }}>{audio.name}</p>
                        <p className="font-body text-xs" style={{ color: dimmed }}>
                          {audio.type === 'video' ? t.typeVideo : t.typeAudio}
                          {audio.size ? ` · ${(audio.size / 1024 / 1024).toFixed(1)} MB` : ''}
                        </p>
                      </div>
                      {/* Badges */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {isSelected && (
                          <span className="text-xs px-2 py-1 rounded-full font-body font-medium"
                                style={{ background: `${amber}33`, color: amber, border: `1px solid ${amber}55` }}>
                            ✓
                          </span>
                        )}
                        <button
                          onClick={e => { e.stopPropagation(); toggleRef(audio); }}
                          className="text-xs px-2 py-1 rounded-full font-body transition-colors"
                          style={isRef
                            ? { background: `${amber}33`, color: amber, border: `1px solid ${amber}55` }
                            : { background: 'hsl(30 10% 22%)', color: dimmed }
                          }>
                          {isRef ? t.unmarkRef : t.markRef}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Audio playback preview */}
            {selectedAudioId && (() => {
              const audio = memories.find(m => m.id === selectedAudioId);
              if (!audio) return null;
              return (
                <div className="mt-3">
                  <audio controls src={audio.url} className="w-full" style={{ filter: 'invert(0)' }} />
                </div>
              );
            })()}
          </div>

          {/* ── Actions ── */}
          <div style={card}>
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">

              {/* Save config */}
              <button
                onClick={handleSave}
                disabled={saving || (!selectedPhotoId && !selectedAudioId)}
                className="font-body font-semibold text-sm px-5 py-2.5 rounded-xl transition-all disabled:opacity-50 flex items-center gap-2"
                style={{ background: amber, color: dark }}>
                {saving ? (
                  <><span className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />{t.saving}</>
                ) : (
                  <>{saveMsg || t.saveConfig}</>
                )}
              </button>

              {/* Clone voice */}
              <button
                onClick={handleCloneVoice}
                disabled={cloning || !selectedAudioId}
                className="font-body font-semibold text-sm px-5 py-2.5 rounded-xl transition-all disabled:opacity-50 flex items-center gap-2"
                style={{
                  background: voiceReady ? 'hsl(142 40% 15%)' : 'hsl(30 10% 18%)',
                  color: voiceReady ? 'hsl(142 80% 70%)' : cream,
                  border: `1px solid ${voiceReady ? 'hsl(142 60% 30%)' : 'hsl(30 10% 28%)'}`,
                }}>
                {cloning ? (
                  <><span className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />{t.cloning}</>
                ) : voiceReady ? (
                  t.voiceReady
                ) : (
                  t.cloneVoice
                )}
              </button>

              {/* Voice status */}
              {avatarConfig?.voiceStatus && (
                <span className="font-body text-xs px-3 py-1.5 rounded-full"
                      style={voiceReady
                        ? { background: 'hsl(142 40% 12%)', color: 'hsl(142 80% 70%)', border: '1px solid hsl(142 60% 30%)' }
                        : avatarConfig.voiceStatus === 'error'
                          ? { background: 'hsl(0 40% 12%)', color: 'hsl(0 80% 70%)', border: '1px solid hsl(0 60% 30%)' }
                          : { background: 'hsl(36 40% 10%)', color: amber, border: `1px solid ${amber}44` }
                      }>
                  {voiceReady ? t.voiceReady : avatarConfig.voiceStatus === 'error' ? t.voiceError : t.voicePending}
                </span>
              )}
            </div>

            {/* Status messages */}
            {cloneMsg && !cloneError && (
              <div className="mt-3 text-sm font-body px-4 py-2.5 rounded-xl"
                   style={{ background: 'hsl(142 40% 10%)', color: 'hsl(142 80% 70%)', border: '1px solid hsl(142 50% 25%)' }}>
                {cloneMsg}
              </div>
            )}
            {cloneError && (
              <div className="mt-3 text-sm font-body px-4 py-2.5 rounded-xl"
                   style={{ background: 'hsl(0 40% 10%)', color: 'hsl(0 80% 70%)', border: '1px solid hsl(0 50% 25%)' }}>
                {cloneError}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
