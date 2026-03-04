'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { AppUser, MemoryItem, ProfileShare } from '@/lib/clientStore';
import {
  uploadMemoryItem, getMemoryItems, deleteMemoryItem,
  requestProfileDeletion, confirmProfileDeletion, signOutUser,
  saveAnswer, getAnswers,
  shareProfileWithEmail, removeProfileShare, getProfileShares,
} from '@/lib/clientStore';
import type { QuestionAnswer } from '@/lib/clientStore';
import { isFirebaseClientConfigured, getClientAuth } from '@/lib/firebaseClient';
import { useLang } from '@/components/LangContext';
import {
  LIFE_QUESTIONS, CATEGORIES_EN, CATEGORIES_BG,
  QUESTIONS_PER_PAGE, TOTAL_QUESTIONS,
} from '@/lib/questions';
import AvatarChat from '@/components/AvatarChat';
import AvatarSetup from '@/components/AvatarSetup';

// ─── i18n ──────────────────────────────────────────────────────────────────────
const i18n = {
  en: {
    // Sidebar
    myLegacy:    'My Legacy',
    multimedia:  '📁 Multimedia',
    questions:   '📝 Life Questions',
    sharing:     '🔗 Sharing',
    avatar:      '🤖 AI Avatar',
    avatarSetup: '🎬 Avatar Setup',
    signOut:     'Sign Out',
    deleteProfile: '🗑 Delete Profile',
    // Multimedia
    addMemory:   '⬆ Upload Memory',
    gallery:     '🖼 Memory Gallery',
    dragDrop:    'Drag a file here or click to choose',
    dragDropSub: 'Photos, videos, audio, documents — up to 50 MB',
    descPlaceholder: 'Description (optional)…',
    uploadBtn:   '⬆ Upload',
    uploading:   'Uploading…',
    formats:     'Supported formats',
    openFile:    '↗ Open',
    all: 'All', photo: 'Photos', video: 'Videos', audio: 'Audio', document: 'Docs',
    emptyAll:    'No memories uploaded yet.',
    emptyType:   'No files of this type.',
    emptySub:    'Upload your first memory using the form above.',
    confirmDeleteItem: 'Delete',
    confirmYes:  '✓ Delete',
    cancel:      'Cancel',
    // Questions
    questionsTitle:   '📝 Life Questions',
    questionsSub:     'Answer at your own pace. Your answers are saved automatically.',
    answered:         'answered',
    of:               'of',
    categoryAll:      'All categories',
    prevPage:         '← Previous',
    nextPage:         'Next →',
    saveAnswer:       'Save',
    saving:           'Saving…',
    saved:            '✓ Saved',
    answerPlaceholder:'Write your answer here…',
    progress:         'Progress',
    questionsComplete:'questions answered',
    // Sharing
    sharingTitle:     '🔗 Share your profile',
    sharingDesc:      'Grant another person access to your answers and memories by entering their email address.',
    shareEmailLabel:  'Email address',
    shareEmailPlaceholder: 'friend@example.com',
    shareBtn:         '+ Grant Access',
    sharedWith:       'Currently shared with',
    noShares:         'Not shared with anyone yet.',
    revokeAccess:     'Revoke',
    alreadyShared:    'Already shared with this email.',
    shareSuccess:     '✓ Access granted!',
    shareError:       'Could not share. Try again.',
    // Delete profile modal
    deleteTitle:      'Delete Profile',
    deleteWarn:       'This will permanently delete all your memories, answers and files. This action is irreversible.',
    deleteWillDelete: 'Will be deleted:',
    deleteList:       ['All uploaded files, photos and videos', 'All your life answers', 'Your MEafterMe account'],
    deleteContinue:   'Continue → Send Code',
    deleteCodeTitle:  'Enter Confirmation Code',
    deleteCodeInfo:   'We sent a 6-digit code to',
    deleteCodeNoEmail:'⚠ Email extension not configured. Your code is:',
    deleteCodePlaceholder: '000000',
    deleteConfirmBtn: '🗑 Confirm Deletion',
    deleting:         'Deleting…',
    codeExpiry:       'Code valid for 10 minutes.',
  },
  bg: {
    myLegacy:    'Моето Наследство',
    multimedia:  '📁 Мултимедия',
    questions:   '📝 Житейски въпроси',
    sharing:     '🔗 Споделяне',
    avatar:      '🤖 AI Аватар',
    avatarSetup: '🎬 Настройка на аватар',
    signOut:     'Изход',
    deleteProfile: '🗑 Изтрий профила',
    addMemory:   '⬆ Качи спомен',
    gallery:     '🖼 Галерия',
    dragDrop:    'Плъзнете файл тук или кликнете за избор',
    dragDropSub: 'Снимки, видео, аудио, документи — до 50 MB',
    descPlaceholder: 'Описание (незадължително)…',
    uploadBtn:   '⬆ Качи',
    uploading:   'Качване…',
    formats:     'Поддържани формати',
    openFile:    '↗ Отвори',
    all: 'Всичко', photo: 'Снимки', video: 'Видео', audio: 'Аудио', document: 'Документи',
    emptyAll:    'Все още няма качени спомени.',
    emptyType:   'Няма файлове от този тип.',
    emptySub:    'Качете първия си спомен от формата по-горе.',
    confirmDeleteItem: 'Изтрий',
    confirmYes:  '✓ Изтрий',
    cancel:      'Отказ',
    questionsTitle:   '📝 Житейски въпроси',
    questionsSub:     'Отговаряйте в собствено темпо. Отговорите се записват автоматично.',
    answered:         'отговорени',
    of:               'от',
    categoryAll:      'Всички категории',
    prevPage:         '← Назад',
    nextPage:         'Напред →',
    saveAnswer:       'Запази',
    saving:           'Запазване…',
    saved:            '✓ Запазено',
    answerPlaceholder:'Напишете отговора си тук…',
    progress:         'Прогрес',
    questionsComplete:'въпроса с отговор',
    sharingTitle:     '🔗 Споделяне на профила',
    sharingDesc:      'Дайте достъп на друг човек до вашите отговори и медия, като въведете неговия имейл адрес.',
    shareEmailLabel:  'Имейл адрес',
    shareEmailPlaceholder: 'приятел@example.com',
    shareBtn:         '+ Дай достъп',
    sharedWith:       'В момента споделено с',
    noShares:         'Все още не е споделено с никого.',
    revokeAccess:     'Премахни',
    alreadyShared:    'Вече е споделено с този имейл.',
    shareSuccess:     '✓ Достъпът е даден!',
    shareError:       'Грешка при споделяне. Опитайте отново.',
    deleteTitle:      'Изтриване на профила',
    deleteWarn:       'Това ще изтрие всички ваши спомени, отговори и файлове — завинаги. Необратимо.',
    deleteWillDelete: 'Ще бъде изтрито:',
    deleteList:       ['Всички качени файлове, снимки и видеа', 'Всички ваши житейски отговори', 'Акаунтът ви в MEafterMe'],
    deleteContinue:   'Продължи → Изпрати код',
    deleteCodeTitle:  'Въведете кода за потвърждение',
    deleteCodeInfo:   'Изпратихме 6-цифрен код на',
    deleteCodeNoEmail:'⚠ Имейл разширението не е конфигурирано. Вашият код е:',
    deleteCodePlaceholder: '000000',
    deleteConfirmBtn: '🗑 Потвърди изтриването',
    deleting:         'Изтриване…',
    codeExpiry:       'Кодът е валиден 10 минути.',
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
function formatDate(iso: string, locale: string): string {
  try {
    return new Date(iso).toLocaleDateString(locale === 'bg' ? 'bg-BG' : 'en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return iso; }
}
const TYPE_ICON: Record<string, string> = { photo: '🖼️', video: '🎬', audio: '🎵', document: '📄', other: '📎', all: '📦' };

function getAuthUid(): string | null {
  if (!isFirebaseClientConfigured()) return null;
  try { return getClientAuth().currentUser?.uid || null; } catch { return null; }
}

// ─── Upload Card ──────────────────────────────────────────────────────────────
function UploadCard({ user, onUploaded, t }: { user: AppUser; onUploaded: (item: MemoryItem) => void; t: typeof i18n.en }) {
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState('');
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const iconForFile = (f: File) => {
    if (f.type.startsWith('image/')) return '🖼️';
    if (f.type.startsWith('video/')) return '🎬';
    if (f.type.startsWith('audio/')) return '🎵';
    return '📄';
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) { setFile(f); setError(''); }
  }, []);

  async function handleUpload() {
    if (!file) return;
    setUploading(true); setProgress(1); setError('');
    try {
      const item = await uploadMemoryItem(getAuthUid() || user.uid, file, description, setProgress);
      onUploaded(item);
      setFile(null); setDescription(''); setProgress(0);
    } catch (e: any) {
      setError(e?.message || 'Upload failed'); setProgress(0);
    } finally { setUploading(false); }
  }

  return (
    <div className="bg-white rounded-2xl border-2 border-dashed border-brand-200 hover:border-brand-400 transition-colors p-5">
      <div
        className={`rounded-xl p-5 text-center cursor-pointer transition-colors ${dragging ? 'bg-brand-50 border-2 border-brand-400' : 'bg-gray-50 hover:bg-brand-50/50'}`}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input ref={inputRef} type="file" className="hidden"
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.xls,.xlsx,.ppt,.pptx"
          onChange={e => { if (e.target.files?.[0]) { setFile(e.target.files[0]); setError(''); } }} />
        {file ? (
          <div className="flex items-center gap-3 justify-center flex-wrap">
            <span className="text-3xl">{iconForFile(file)}</span>
            <div className="text-left min-w-0">
              <p className="font-semibold text-gray-900 text-sm truncate max-w-[180px]">{file.name}</p>
              <p className="text-xs text-gray-400">{formatSize(file.size)}</p>
            </div>
            <button onClick={e => { e.stopPropagation(); setFile(null); setError(''); }}
              className="text-gray-400 hover:text-red-500 text-xl font-bold">×</button>
          </div>
        ) : (
          <><div className="text-4xl mb-3">📤</div>
          <p className="text-gray-700 font-medium text-sm">{t.dragDrop}</p>
          <p className="text-xs text-gray-400 mt-1">{t.dragDropSub}</p></>
        )}
      </div>
      {file && (
        <div className="mt-4 space-y-3">
          <input type="text" placeholder={t.descPlaceholder} value={description}
            onChange={e => setDescription(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
          {uploading && (
            <div>
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>{t.uploading}</span><span>{progress}%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div className="bg-brand-600 h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 space-y-1">
              <p className="text-red-700 text-xs font-semibold">⚠️ Upload failed</p>
              <p className="text-red-600 text-xs">{error}</p>
              {error.includes('signed in') && (
                <p className="text-orange-600 text-xs"><a href="/login/" className="underline font-semibold">Log in again</a></p>
              )}
            </div>
          )}
          <button onClick={handleUpload} disabled={uploading}
            className="w-full bg-brand-600 text-white font-bold py-2.5 rounded-xl hover:bg-brand-700 transition-colors disabled:opacity-60 text-sm">
            {uploading ? `${t.uploading} ${progress}%` : t.uploadBtn}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Memory Card ──────────────────────────────────────────────────────────────
function MemoryCard({ item, onDelete, t, locale }: { item: MemoryItem; onDelete: (item: MemoryItem) => void; t: typeof i18n.en; locale: string }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try { await deleteMemoryItem(item); onDelete(item); }
    catch { setDeleting(false); setConfirmDelete(false); }
  }

  const typeLabel = i18n[locale as 'en'|'bg']?.[item.type as keyof typeof i18n.en] || item.type;

  return (
    <div className={`group bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-all ${confirmDelete ? 'ring-2 ring-red-400' : ''}`}>
      <div className="relative bg-gray-100 aspect-video flex items-center justify-center overflow-hidden">
        {item.type === 'photo' ? (
          <img src={item.url} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
        ) : item.type === 'video' ? (
          <video src={item.url} controls className="w-full h-full object-cover" preload="metadata" />
        ) : item.type === 'audio' ? (
          <div className="flex flex-col items-center gap-2 p-4 w-full">
            <span className="text-4xl">🎵</span>
            <audio src={item.url} controls className="w-full" />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-gray-400 py-8">
            <span className="text-5xl">{TYPE_ICON[item.type] || '📎'}</span>
            <span className="text-xs font-medium uppercase tracking-wide">{item.mimeType?.split('/')?.[1] || item.type}</span>
          </div>
        )}
        <div className="absolute top-2 left-2">
          <span className="bg-white/90 backdrop-blur text-xs font-semibold px-2.5 py-1 rounded-full text-gray-700 shadow-sm">
            {TYPE_ICON[item.type]} {typeLabel}
          </span>
        </div>
        {!confirmDelete && (
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => setConfirmDelete(true)}
              className="bg-red-500 text-white text-xs font-bold px-2.5 py-1.5 rounded-lg hover:bg-red-600 shadow">🗑️</button>
          </div>
        )}
      </div>
      <div className="p-4">
        <p className="font-semibold text-gray-900 text-sm truncate" title={item.name}>{item.name}</p>
        {item.description && <p className="text-gray-500 text-xs mt-1 line-clamp-2">{item.description}</p>}
        <div className="flex items-center justify-between mt-3">
          <span className="text-xs text-gray-400">{formatDate(item.createdAt, locale)}</span>
          <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-600 font-medium hover:underline">{t.openFile}</a>
        </div>
      </div>
      {confirmDelete && (
        <div className="p-4 bg-red-50 border-t border-red-200">
          <p className="text-sm font-semibold text-red-700 mb-3">{t.confirmDeleteItem} „{item.name}"?</p>
          <div className="flex gap-2">
            <button onClick={handleDelete} disabled={deleting}
              className="flex-1 bg-red-500 text-white font-bold py-2 rounded-lg text-sm hover:bg-red-600 disabled:opacity-60">
              {deleting ? '…' : t.confirmYes}
            </button>
            <button onClick={() => setConfirmDelete(false)}
              className="flex-1 bg-white border border-gray-300 text-gray-700 font-medium py-2 rounded-lg text-sm hover:bg-gray-50">{t.cancel}</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Multimedia Tab ───────────────────────────────────────────────────────────
function MultimediaTab({ user, t, locale }: { user: AppUser; t: typeof i18n.en; locale: string }) {
  const [items, setItems] = useState<MemoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const effectiveUid = getAuthUid() || user.uid;

  useEffect(() => {
    getMemoryItems(effectiveUid).then(d => { setItems(d); setLoading(false); }).catch(() => setLoading(false));
  }, [effectiveUid]);

  const counts = {
    all: items.length,
    photo: items.filter(i => i.type === 'photo').length,
    video: items.filter(i => i.type === 'video').length,
    audio: items.filter(i => i.type === 'audio').length,
    document: items.filter(i => i.type === 'document').length,
  };
  const filtered = filter === 'all' ? items : items.filter(i => i.type === filter);
  const FILTERS = [
    { key: 'all', label: t.all },
    { key: 'photo', label: t.photo },
    { key: 'video', label: t.video },
    { key: 'audio', label: t.audio },
    { key: 'document', label: t.document },
  ];

  return (
    <div className="space-y-6">
      {/* Upload */}
      <div>
        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">{t.addMemory}</h2>
        <UploadCard user={{ ...user, uid: effectiveUid }} onUploaded={item => setItems(prev => [item, ...prev])} t={t} />
        <div className="mt-3 bg-white rounded-2xl border border-gray-200 p-4">
          <p className="text-xs font-semibold text-gray-600 mb-2">{t.formats}</p>
          <div className="grid grid-cols-2 gap-1 text-xs text-gray-500">
            <span>🖼️ JPG, PNG, GIF, WebP</span><span>🎬 MP4, MOV, AVI</span>
            <span>🎵 MP3, WAV, M4A</span><span>📄 PDF, DOC, TXT</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-2">
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`bg-white rounded-xl border px-2 py-2.5 text-center transition-all ${filter === f.key ? 'border-brand-400 bg-brand-50 shadow-sm' : 'border-gray-200 hover:border-brand-300'}`}>
            <p className="text-lg font-bold text-gray-900">{counts[f.key as keyof typeof counts] ?? 0}</p>
            <p className="text-xs text-gray-500 mt-0.5">{TYPE_ICON[f.key]} {f.label}</p>
          </button>
        ))}
      </div>

      {/* Gallery */}
      <div>
        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">
          {t.gallery}
          {filtered.length > 0 && <span className="ml-2 bg-brand-100 text-brand-700 text-xs px-2 py-0.5 rounded-full font-semibold">{filtered.length}</span>}
        </h2>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-10 h-10 border-4 border-brand-400/30 border-t-brand-400 rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-14 text-center">
            <div className="text-5xl mb-4">{filter === 'all' ? '📭' : TYPE_ICON[filter]}</div>
            <p className="text-gray-500 font-medium">{filter === 'all' ? t.emptyAll : t.emptyType}</p>
            <p className="text-gray-400 text-sm mt-2">{t.emptySub}</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(item => (
              <MemoryCard key={item.id} item={item}
                onDelete={item => setItems(prev => prev.filter(i => i.id !== item.id))}
                t={t} locale={locale} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Questions Tab ────────────────────────────────────────────────────────────
function QuestionsTab({ user, t, locale }: { user: AppUser; t: typeof i18n.en; locale: string }) {
  const effectiveUid = getAuthUid() || user.uid;
  const [answers, setAnswers] = useState<Record<number, QuestionAnswer>>({});
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [page, setPage] = useState(0);
  const [savingState, setSavingState] = useState<Record<number, 'saving' | 'saved' | 'error' | null>>({});
  // drafts: what's currently in the textarea (undefined = use saved answer)
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  // editing: which questions are in "edit mode" (clicked Edit button)
  const [editing, setEditing] = useState<Record<number, boolean>>({});

  const categories = locale === 'bg' ? CATEGORIES_BG : CATEGORIES_EN;

  const filteredQuestions = selectedCategory === 'all'
    ? LIFE_QUESTIONS
    : LIFE_QUESTIONS.filter(q => q.category === selectedCategory);

  const totalPages = Math.ceil(filteredQuestions.length / QUESTIONS_PER_PAGE);
  const pageQuestions = filteredQuestions.slice(page * QUESTIONS_PER_PAGE, (page + 1) * QUESTIONS_PER_PAGE);
  const answeredCount = Object.keys(answers).filter(k => answers[Number(k)]?.answer?.trim()).length;

  // Load answers from Firestore on mount
  useEffect(() => {
    getAnswers(effectiveUid)
      .then(a => { setAnswers(a); setLoading(false); })
      .catch(() => setLoading(false));
  }, [effectiveUid]);

  const handleCategoryChange = (cat: string) => {
    setSelectedCategory(cat);
    setPage(0);
  };

  // Get current draft value for a question
  const getDraft = (questionId: number): string => {
    if (drafts[questionId] !== undefined) return drafts[questionId];
    return answers[questionId]?.answer ?? '';
  };

  // Save answer — replaces old with new, no composite index needed
  const handleSave = async (questionId: number) => {
    const text = getDraft(questionId).trim();
    setSavingState(prev => ({ ...prev, [questionId]: 'saving' }));
    try {
      await saveAnswer(effectiveUid, questionId, text);
      // Update local state
      setAnswers(prev => ({
        ...prev,
        [questionId]: { questionId, answer: text, updatedAt: new Date().toISOString() },
      }));
      // Clear draft (saved value is now the answer)
      setDrafts(prev => { const next = { ...prev }; delete next[questionId]; return next; });
      // Exit edit mode
      setEditing(prev => ({ ...prev, [questionId]: false }));
      setSavingState(prev => ({ ...prev, [questionId]: 'saved' }));
      setTimeout(() => setSavingState(prev => ({ ...prev, [questionId]: null })), 2500);
    } catch (err) {
      console.error('Save answer error:', err);
      setSavingState(prev => ({ ...prev, [questionId]: 'error' }));
      setTimeout(() => setSavingState(prev => ({ ...prev, [questionId]: null })), 3000);
    }
  };

  // Enter edit mode for an answered question
  const handleEdit = (questionId: number) => {
    setDrafts(prev => ({ ...prev, [questionId]: answers[questionId]?.answer ?? '' }));
    setEditing(prev => ({ ...prev, [questionId]: true }));
  };

  // Cancel editing — restore saved value
  const handleCancelEdit = (questionId: number) => {
    setDrafts(prev => { const next = { ...prev }; delete next[questionId]; return next; });
    setEditing(prev => ({ ...prev, [questionId]: false }));
  };

  const progressPct = Math.round((answeredCount / TOTAL_QUESTIONS) * 100);

  return (
    <div className="space-y-5">
      {/* Header + progress */}
      <div>
        <h2 className="text-lg font-bold text-gray-900">{t.questionsTitle}</h2>
        <p className="text-sm text-gray-500 mt-0.5">{t.questionsSub}</p>
        <div className="mt-4 bg-white rounded-2xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-gray-700">{t.progress}</span>
            <span className="text-sm font-bold text-brand-600">{answeredCount} {t.of} {TOTAL_QUESTIONS} {t.questionsComplete}</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3">
            <div className="bg-gradient-to-r from-brand-500 to-brand-600 h-3 rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }} />
          </div>
          <p className="text-xs text-gray-400 mt-1.5 text-right">{progressPct}% {t.answered}</p>
        </div>
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => handleCategoryChange('all')}
          className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${selectedCategory === 'all' ? 'bg-brand-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-brand-300'}`}>
          {t.categoryAll}
        </button>
        {Object.entries(categories).map(([key, label]) => (
          <button key={key} onClick={() => handleCategoryChange(key)}
            className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${selectedCategory === key ? 'bg-brand-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-brand-300'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Questions list */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-10 h-10 border-4 border-brand-400/30 border-t-brand-400 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          {pageQuestions.map((q) => {
            const questionText = locale === 'bg' ? q.bg : q.en;
            const categoryLabel = categories[q.category] || q.category;
            const savedAnswer = answers[q.id]?.answer?.trim() ?? '';
            const isAnswered = !!savedAnswer;
            const isEditMode = !isAnswered || editing[q.id];
            const currentDraft = getDraft(q.id);
            const isSaving = savingState[q.id] === 'saving';
            const isSaved  = savingState[q.id] === 'saved';
            const isError  = savingState[q.id] === 'error';
            const isDirty  = currentDraft.trim() !== savedAnswer;
            const globalNum = filteredQuestions.indexOf(q) + 1;

            return (
              <div key={q.id}
                className={`bg-white rounded-2xl border-2 transition-all shadow-sm
                  ${isAnswered && !editing[q.id] ? 'border-green-200' : 'border-gray-200'}
                  ${editing[q.id] ? 'ring-2 ring-brand-300' : ''}`}>

                {/* Question header */}
                <div className="px-5 pt-5 pb-3">
                  <div className="flex items-start gap-3">
                    <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold
                      ${isAnswered ? 'bg-green-100 text-green-700' : 'bg-brand-50 text-brand-700'}`}>
                      {isAnswered ? '✓' : globalNum}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="inline-block text-xs font-medium text-gray-400 mb-1">{categoryLabel}</span>
                      <p className="text-gray-900 font-semibold text-base leading-snug">{questionText}</p>
                    </div>
                  </div>
                </div>

                {/* Answer area */}
                <div className="px-5 pb-5">
                  {/* Show saved answer as read-only when answered and not in edit mode */}
                  {isAnswered && !editing[q.id] ? (
                    <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-gray-800 leading-relaxed whitespace-pre-wrap min-h-[60px]">
                      {savedAnswer}
                    </div>
                  ) : (
                    <textarea
                      rows={4}
                      placeholder={t.answerPlaceholder}
                      value={currentDraft}
                      onChange={e => setDrafts(prev => ({ ...prev, [q.id]: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent placeholder-gray-300 transition-all"
                      autoFocus={editing[q.id]}
                    />
                  )}

                  {/* Action row */}
                  <div className="flex items-center justify-between mt-2.5 gap-2">
                    <span className="text-xs text-gray-400">
                      {answers[q.id]?.updatedAt
                        ? `${locale === 'bg' ? 'Последно:' : 'Last:'} ${formatDate(answers[q.id].updatedAt, locale)}`
                        : ''}
                      {isError && <span className="text-red-500 ml-1">{locale === 'bg' ? '⚠ Грешка при запис' : '⚠ Save failed'}</span>}
                    </span>

                    <div className="flex gap-2">
                      {/* Edit / Cancel buttons when answered */}
                      {isAnswered && !editing[q.id] && (
                        <button onClick={() => handleEdit(q.id)}
                          className="text-xs font-semibold px-4 py-2 rounded-xl border border-brand-300 text-brand-700 hover:bg-brand-50 transition-all">
                          ✏️ {locale === 'bg' ? 'Редактирай' : 'Edit'}
                        </button>
                      )}
                      {editing[q.id] && (
                        <button onClick={() => handleCancelEdit(q.id)}
                          className="text-xs font-semibold px-4 py-2 rounded-xl border border-gray-300 text-gray-600 hover:bg-gray-50 transition-all">
                          {t.cancel}
                        </button>
                      )}

                      {/* Save button — show when in edit/write mode */}
                      {isEditMode && (
                        <button
                          onClick={() => handleSave(q.id)}
                          disabled={isSaving || (!isDirty && isAnswered)}
                          className={`text-sm font-bold px-5 py-2 rounded-xl transition-all disabled:opacity-50
                            ${isSaved  ? 'bg-green-500 text-white' :
                              isError  ? 'bg-red-500 text-white' :
                              'bg-brand-600 text-white hover:bg-brand-700'}`}>
                          {isSaving ? (
                            <span className="flex items-center gap-1.5">
                              <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                              {t.saving}
                            </span>
                          ) : isSaved ? t.saved : t.saveAnswer}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <button onClick={() => { setPage(p => Math.max(0, p - 1)); window.scrollTo(0, 0); }}
            disabled={page === 0}
            className="flex items-center gap-2 text-sm font-semibold text-brand-700 bg-white border border-brand-200 px-5 py-2.5 rounded-xl hover:bg-brand-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            {t.prevPage}
          </button>
          <div className="text-center">
            <p className="text-sm font-bold text-gray-700">{page + 1} / {totalPages}</p>
            <p className="text-xs text-gray-400">{t.answered}: {answeredCount}/{TOTAL_QUESTIONS}</p>
          </div>
          <button onClick={() => { setPage(p => Math.min(totalPages - 1, p + 1)); window.scrollTo(0, 0); }}
            disabled={page >= totalPages - 1}
            className="flex items-center gap-2 text-sm font-semibold text-white bg-brand-600 px-5 py-2.5 rounded-xl hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            {t.nextPage}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Sharing Tab ──────────────────────────────────────────────────────────────
function SharingTab({ user, t }: { user: AppUser; t: typeof i18n.en }) {
  const effectiveUid = getAuthUid() || user.uid;
  const [shares, setShares] = useState<ProfileShare[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sharing' | 'success' | 'already' | 'error'>('idle');

  useEffect(() => {
    getProfileShares(effectiveUid).then(s => { setShares(s); setLoading(false); }).catch(() => setLoading(false));
  }, [effectiveUid]);

  async function handleShare() {
    if (!email.trim() || !email.includes('@')) return;
    setStatus('sharing');
    const result = await shareProfileWithEmail(effectiveUid, email.trim());
    if (result === 'ok') {
      setShares(prev => [...prev, { id: Date.now().toString(), ownerUid: effectiveUid, sharedWithEmail: email.trim().toLowerCase(), sharedAt: new Date().toISOString() }]);
      setEmail('');
      setStatus('success');
      setTimeout(() => setStatus('idle'), 3000);
    } else if (result === 'already') {
      setStatus('already');
      setTimeout(() => setStatus('idle'), 3000);
    } else {
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3000);
    }
  }

  async function handleRevoke(share: ProfileShare) {
    await removeProfileShare(effectiveUid, share.sharedWithEmail);
    setShares(prev => prev.filter(s => s.id !== share.id));
  }

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h2 className="text-lg font-bold text-gray-900">{t.sharingTitle}</h2>
        <p className="text-sm text-gray-500 mt-1 leading-relaxed">{t.sharingDesc}</p>
      </div>

      {/* Add new share */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <label className="block text-sm font-semibold text-gray-700 mb-2">{t.shareEmailLabel}</label>
        <div className="flex gap-2">
          <input type="email" value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleShare()}
            placeholder={t.shareEmailPlaceholder}
            className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
          <button onClick={handleShare} disabled={status === 'sharing' || !email.trim()}
            className="bg-brand-600 text-white font-bold px-5 py-2.5 rounded-xl hover:bg-brand-700 disabled:opacity-60 text-sm whitespace-nowrap transition-colors">
            {status === 'sharing' ? '…' : t.shareBtn}
          </button>
        </div>
        {status === 'success' && <p className="text-green-600 text-sm mt-2 font-medium">{t.shareSuccess}</p>}
        {status === 'already' && <p className="text-amber-600 text-sm mt-2">{t.alreadyShared}</p>}
        {status === 'error' && <p className="text-red-600 text-sm mt-2">{t.shareError}</p>}
      </div>

      {/* Shared with list */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <h3 className="text-sm font-bold text-gray-700 mb-4">{t.sharedWith}</h3>
        {loading ? (
          <div className="w-6 h-6 border-2 border-brand-400/30 border-t-brand-400 rounded-full animate-spin mx-auto" />
        ) : shares.length === 0 ? (
          <div className="text-center py-6">
            <div className="text-4xl mb-2">🔒</div>
            <p className="text-gray-400 text-sm">{t.noShares}</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {shares.map(s => (
              <li key={s.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">{s.sharedWithEmail}</p>
                  <p className="text-xs text-gray-400">{formatDate(s.sharedAt, 'en')}</p>
                </div>
                <button onClick={() => handleRevoke(s)}
                  className="text-xs text-red-500 hover:text-red-700 font-semibold border border-red-200 hover:border-red-400 px-3 py-1 rounded-lg transition-colors">
                  {t.revokeAccess}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ─── Delete Profile Modal ─────────────────────────────────────────────────────
function DeleteProfileModal({ user, onClose, onDeleted, t }: { user: AppUser; onClose: () => void; onDeleted: () => void; t: typeof i18n.en }) {
  const [step, setStep] = useState<'confirm' | 'code'>('confirm');
  const [code, setCode] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const effectiveUid = getAuthUid() || user.uid;

  async function handleRequestCode() {
    setLoading(true); setError('');
    try {
      const c = await requestProfileDeletion(effectiveUid, user.email);
      setGeneratedCode(c); setStep('code');
    } catch (e: any) { setError(e.message || 'Error'); }
    finally { setLoading(false); }
  }

  async function handleConfirmDelete() {
    setLoading(true); setError('');
    try {
      const ok = await confirmProfileDeletion(effectiveUid, code.trim());
      if (!ok) { setError('Invalid or expired code. Try again.'); setLoading(false); return; }
      onDeleted();
    } catch (e: any) { setError(e.message || 'Error'); setLoading(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8">
        {step === 'confirm' && (
          <>
            <div className="text-5xl mb-4 text-center">⚠️</div>
            <h2 className="text-xl font-bold text-gray-900 text-center mb-2">{t.deleteTitle}</h2>
            <p className="text-gray-600 text-sm text-center mb-6">{t.deleteWarn}</p>
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
              <p className="text-red-700 text-sm font-medium mb-2">{t.deleteWillDelete}</p>
              <ul className="text-red-600 text-sm space-y-1">{t.deleteList.map((item, i) => <li key={i}>• {item}</li>)}</ul>
            </div>
            {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
            <div className="flex gap-3">
              <button onClick={handleRequestCode} disabled={loading}
                className="flex-1 bg-red-600 text-white font-bold py-3 rounded-xl hover:bg-red-700 disabled:opacity-60 text-sm">
                {loading ? '…' : t.deleteContinue}
              </button>
              <button onClick={onClose}
                className="flex-1 bg-white border border-gray-300 text-gray-700 font-medium py-3 rounded-xl hover:bg-gray-50 text-sm">{t.cancel}</button>
            </div>
          </>
        )}
        {step === 'code' && (
          <>
            <div className="text-5xl mb-4 text-center">📧</div>
            <h2 className="text-xl font-bold text-gray-900 text-center mb-2">{t.deleteCodeTitle}</h2>
            <p className="text-gray-600 text-sm text-center mb-4">{t.deleteCodeInfo} <strong>{user.email}</strong></p>
            {generatedCode && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-center">
                <p className="text-xs text-amber-700 mb-1">{t.deleteCodeNoEmail}</p>
                <p className="text-3xl font-bold tracking-widest text-amber-800">{generatedCode}</p>
              </div>
            )}
            <input type="text" placeholder={t.deleteCodePlaceholder} maxLength={6}
              value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-2xl font-mono text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-red-400 mb-4" />
            {error && <p className="text-red-500 text-sm mb-4 text-center">{error}</p>}
            <div className="flex gap-3">
              <button onClick={handleConfirmDelete} disabled={loading || code.length !== 6}
                className="flex-1 bg-red-600 text-white font-bold py-3 rounded-xl hover:bg-red-700 disabled:opacity-60 text-sm">
                {loading ? t.deleting : t.deleteConfirmBtn}
              </button>
              <button onClick={onClose}
                className="flex-1 bg-white border border-gray-300 text-gray-700 font-medium py-3 rounded-xl hover:bg-gray-50 text-sm">{t.cancel}</button>
            </div>
            <p className="text-xs text-gray-400 text-center mt-4">{t.codeExpiry}</p>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
type Tab = 'multimedia' | 'questions' | 'sharing' | 'avatar' | 'avatarSetup';

export default function AppDashboard({ user }: { user: AppUser }) {
  const { locale } = useLang();
  const t = i18n[locale as 'en' | 'bg'] || i18n.en;
  const [activeTab, setActiveTab] = useState<Tab>('multimedia');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const NAV: Array<{ key: Tab; label: string; icon: string }> = [
    { key: 'multimedia', label: t.multimedia, icon: '📁' },
    { key: 'questions',  label: t.questions,  icon: '📝' },
    { key: 'sharing',    label: t.sharing,    icon: '🔗' },
    { key: 'avatarSetup', label: (t as any).avatarSetup || '🎬 Avatar Setup', icon: '🎬' },
    { key: 'avatar',      label: (t as any).avatar    || '🤖 AI Avatar',    icon: '🤖' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* ── Top Bar ── */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile hamburger */}
            <button onClick={() => setSidebarOpen(o => !o)} className="lg:hidden p-2 rounded-lg hover:bg-gray-100">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="w-9 h-9 rounded-full bg-brand-600 text-white flex items-center justify-center font-bold text-base flex-shrink-0">
              {user.email[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-gray-900 leading-tight">{t.myLegacy}</h1>
              <p className="text-xs text-gray-400 truncate max-w-[180px]">{user.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowDeleteModal(true)}
              className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-red-500 hover:text-red-700 border border-red-200 hover:border-red-400 px-3 py-1.5 rounded-lg transition-colors">
              {t.deleteProfile}
            </button>
            <button onClick={async () => { await signOutUser(); window.location.href = '/login/'; }}
              className="text-sm text-gray-500 hover:text-gray-800 font-medium border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">
              {t.signOut}
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 gap-6">

        {/* ── Sidebar ── */}
        {/* Mobile overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        <aside className={`
          fixed lg:static inset-y-0 left-0 z-50 lg:z-auto
          w-64 bg-white border-r border-gray-200 lg:border lg:rounded-2xl
          flex flex-col gap-2 p-4 shadow-xl lg:shadow-sm
          transform transition-transform duration-200
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          lg:h-fit lg:sticky lg:top-24
        `}>
          {/* Close mobile */}
          <div className="flex items-center justify-between mb-2 lg:hidden">
            <span className="text-sm font-bold text-gray-700">{t.myLegacy}</span>
            <button onClick={() => setSidebarOpen(false)} className="p-1 rounded-lg hover:bg-gray-100">
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider px-2 mb-1 hidden lg:block">Navigation</p>

          {NAV.map(item => (
            <button key={item.key}
              onClick={() => { setActiveTab(item.key); setSidebarOpen(false); }}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all text-left w-full
                ${activeTab === item.key
                  ? 'bg-brand-600 text-white shadow-md shadow-brand-200'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}>
              <span className="text-base">{item.icon}</span>
              <span>{item.label}</span>
              {activeTab === item.key && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white/60" />
              )}
            </button>
          ))}

          <div className="mt-auto pt-4 border-t border-gray-100 space-y-1">
            {/* Upgrade to Premium CTA */}
            <a href="/pricing"
              className="flex items-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 hover:border-amber-300 transition-colors mb-2">
              <span className="text-base">⭐</span>
              <div className="min-w-0">
                <div className="text-xs font-bold text-amber-800 leading-tight">
                  {locale === 'bg' ? 'Надстрой до Premium' : 'Upgrade to Premium'}
                </div>
                <div className="text-[10px] text-amber-600 leading-tight">
                  {locale === 'bg' ? 'Неограничени спомени' : 'Unlimited memories'}
                </div>
              </div>
              <span className="ml-auto text-amber-500 text-xs">→</span>
            </a>
            <button onClick={() => { setShowDeleteModal(true); setSidebarOpen(false); }}
              className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 w-full text-left transition-colors">
              🗑 {t.deleteProfile}
            </button>
          </div>
        </aside>

        {/* ── Main Content ── */}
        <main className="flex-1 min-w-0">
          {activeTab === 'multimedia' && <MultimediaTab user={user} t={t} locale={locale} />}
          {activeTab === 'questions'  && <QuestionsTab  user={user} t={t} locale={locale} />}
          {activeTab === 'sharing'    && <SharingTab    user={user} t={t} />}
          {activeTab === 'avatarSetup' && (
            <AvatarSetup user={user} ownerUid={getAuthUid() || user.uid} />
          )}
          {/* AvatarChat is always mounted but hidden when not active — preserves conversation state */}
          <div style={{ display: activeTab === 'avatar' ? 'block' : 'none' }}>
            <AvatarChat
              user={user}
              ownerUid={getAuthUid() || user.uid}
              ownerName={user.email.split('@')[0]}
            />
          </div>
        </main>
      </div>

      {showDeleteModal && (
        <DeleteProfileModal
          user={user}
          onClose={() => setShowDeleteModal(false)}
          onDeleted={() => { window.location.href = '/login/'; }}
          t={t}
        />
      )}
    </div>
  );
}
