// lib/clientStore.ts
// All data operations using Firebase Client SDK (browser-side).

import {
  collection, addDoc, query, where, getDocs,
  doc, updateDoc, getDoc, setDoc, deleteDoc, orderBy, limit,
  serverTimestamp, deleteField
} from 'firebase/firestore';

/** Remove undefined (and optionally null) fields so Firestore never sees 'undefined' */
function stripUndefined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  ) as Partial<T>;
}
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import {
  ref, uploadBytesResumable, getDownloadURL, deleteObject
} from 'firebase/storage';
import { getClientDb, getClientAuth, getClientStorage, isFirebaseClientConfigured } from './firebaseClient';

// ─── Wait for Firebase Auth to restore session ────────────────────────────────
// In a static export, Firebase Auth is async – currentUser is null on first render.
// Call this before any Firestore query that relies on auth.currentUser.
export function waitForAuthReady(): Promise<User | null> {
  if (!isFirebaseClientConfigured()) return Promise.resolve(null);
  return new Promise((resolve) => {
    const auth = getClientAuth();
    // If already resolved (non-null or explicitly null after init), return immediately
    if (auth.currentUser !== undefined) {
      resolve(auth.currentUser);
      return;
    }
    const unsub = onAuthStateChanged(auth, (user) => {
      unsub();
      resolve(user);
    });
    // Timeout fallback: 5 seconds
    setTimeout(() => { unsub(); resolve(auth.currentUser); }, 5000);
  });
}

export type UserStatus = 'ACTIVE' | 'PENDING_APPROVAL' | 'WAITLISTED';

export interface AppUser {
  uid: string;
  email: string;
  status: UserStatus;
  emailVerified?: boolean;
}

export interface MemoryItem {
  id: string;
  uid: string;           // owner Firebase UID
  name: string;          // original filename or user-given name
  description?: string;
  type: 'photo' | 'video' | 'audio' | 'document' | 'other';
  url: string;           // download URL
  storagePath: string;   // Firebase Storage path for deletion
  size: number;          // bytes
  mimeType: string;
  createdAt: string;     // ISO string
  // Avatar reference: marks this file as a reference for the AI avatar
  usage?: 'avatar_reference' | null;
}

// ─── Email / Password Registration ────────────────────────────────────────────

export async function registerWithEmailPassword(email: string, password: string): Promise<void> {
  if (!isFirebaseClientConfigured()) {
    const key = 'demo_users';
    const users: Record<string, AppUser> = JSON.parse(localStorage.getItem(key) || '{}');
    if (users[email]) throw new Error('auth/email-already-in-use');
    const newUser: AppUser = { uid: 'demo-' + Date.now(), email, status: 'ACTIVE', emailVerified: true };
    users[email] = newUser;
    localStorage.setItem(key, JSON.stringify(users));
    saveCurrentUser(newUser);
    return;
  }

  const auth = getClientAuth();
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  await sendEmailVerification(credential.user, {
    url: `${process.env.NEXT_PUBLIC_APP_URL || window.location.origin}/login/`,
    handleCodeInApp: false,
  });
  const db = getClientDb();
  await addDoc(collection(db, 'users'), {
    uid: credential.user.uid,
    email,
    status: 'ACTIVE' as UserStatus,
    emailVerified: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await firebaseSignOut(auth);
}

export async function loginWithEmailPassword(email: string, password: string): Promise<User & { appUser?: AppUser }> {
  if (!isFirebaseClientConfigured()) {
    const key = 'demo_users';
    const users: Record<string, AppUser> = JSON.parse(localStorage.getItem(key) || '{}');
    const user = users[email];
    if (!user) throw new Error('auth/user-not-found');
    saveCurrentUser(user);
    return { emailVerified: true, appUser: user } as any;
  }

  const auth = getClientAuth();
  const credential = await signInWithEmailAndPassword(auth, email, password);
  const fbUser = credential.user;

  if (!fbUser.emailVerified) {
    return fbUser;
  }

  const appUser = await findOrCreateClientUserByUid(fbUser.uid, fbUser.email!);
  saveCurrentUser(appUser);
  return Object.assign(fbUser, { appUser });
}

export async function signOutUser(): Promise<void> {
  if (isFirebaseClientConfigured()) {
    try { await firebaseSignOut(getClientAuth()); } catch {}
  }
  clearCurrentUser();
}

export function getCurrentUser(): AppUser | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem('meafterme_session');
  if (!stored) return null;
  try { return JSON.parse(stored) as AppUser; }
  catch { return null; }
}

export function saveCurrentUser(user: AppUser): void {
  localStorage.setItem('meafterme_session', JSON.stringify(user));
}

export function clearCurrentUser(): void {
  localStorage.removeItem('meafterme_session');
}

// ─── Users (Firestore) ────────────────────────────────────────────────────────

export async function findOrCreateClientUserByUid(uid: string, email: string): Promise<AppUser> {
  const db = getClientDb();
  const q = query(collection(db, 'users'), where('uid', '==', uid), limit(1));
  const snap = await getDocs(q);
  if (!snap.empty) {
    const d = snap.docs[0];
    return { uid: d.data().uid || d.id, email: d.data().email, status: d.data().status as UserStatus };
  }
  const eq = query(collection(db, 'users'), where('email', '==', email), limit(1));
  const esnap = await getDocs(eq);
  if (!esnap.empty) {
    const d = esnap.docs[0];
    if (!d.data().uid) await updateDoc(d.ref, { uid, updatedAt: serverTimestamp() });
    return { uid: d.data().uid || uid, email: d.data().email, status: d.data().status as UserStatus };
  }
  await addDoc(collection(db, 'users'), {
    uid, email, status: 'ACTIVE' as UserStatus,
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  return { uid, email, status: 'ACTIVE' };
}

export async function findOrCreateClientUser(email: string): Promise<AppUser> {
  if (!isFirebaseClientConfigured()) {
    const key = 'demo_users';
    const users: Record<string, AppUser> = JSON.parse(localStorage.getItem(key) || '{}');
    if (users[email]) { saveCurrentUser(users[email]); return users[email]; }
    const newUser: AppUser = { uid: 'demo-' + Date.now(), email, status: 'ACTIVE' };
    users[email] = newUser;
    localStorage.setItem(key, JSON.stringify(users));
    saveCurrentUser(newUser);
    return newUser;
  }
  const db = getClientDb();
  const q = query(collection(db, 'users'), where('email', '==', email), limit(1));
  const snap = await getDocs(q);
  if (!snap.empty) {
    const d = snap.docs[0];
    const user: AppUser = { uid: d.data().uid || d.id, email: d.data().email, status: d.data().status };
    saveCurrentUser(user);
    return user;
  }
  const newRef = await addDoc(collection(db, 'users'), {
    email, status: 'ACTIVE' as UserStatus,
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  const newUser: AppUser = { uid: newRef.id, email, status: 'ACTIVE' };
  saveCurrentUser(newUser);
  return newUser;
}

// ─── Memory Items (Firestore + Firebase Storage) ──────────────────────────────

function getFileType(mimeType: string): MemoryItem['type'] {
  if (mimeType.startsWith('image/')) return 'photo';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType === 'application/pdf' || mimeType.includes('word') || mimeType.includes('text')) return 'document';
  return 'other';
}

/**
 * Upload a file to Firebase Storage and save metadata in Firestore.
 * Falls back to localStorage/objectURL demo mode if Storage fails.
 * Returns the created MemoryItem.
 */
export async function uploadMemoryItem(
  uid: string,
  file: File,
  description: string,
  onProgress?: (pct: number) => void
): Promise<MemoryItem> {

  // ── DEMO MODE (no Firebase config) ──────────────────────────────────────────
  if (!isFirebaseClientConfigured()) {
    onProgress?.(30);
    await new Promise(r => setTimeout(r, 300));
    onProgress?.(80);
    await new Promise(r => setTimeout(r, 200));
    onProgress?.(100);

    const url = URL.createObjectURL(file);
    const item: MemoryItem = {
      id: 'demo-' + Date.now(),
      uid,
      name: file.name,
      description,
      type: getFileType(file.type),
      url,
      storagePath: '',
      size: file.size,
      mimeType: file.type,
      createdAt: new Date().toISOString(),
    };
    const key = `demo_memories_${uid}`;
    const list: MemoryItem[] = JSON.parse(localStorage.getItem(key) || '[]');
    list.unshift(item);
    localStorage.setItem(key, JSON.stringify(list));
    return item;
  }

  // ── FIREBASE MODE ────────────────────────────────────────────────────────────
  // Wait for Firebase Auth to restore session
  const firebaseUser = await waitForAuthReady();
  const realUid = firebaseUser?.uid ?? uid;

  if (!firebaseUser) {
    throw new Error('You must be signed in to upload files. Please log in again.');
  }

  // Validate token is fresh (re-fetch if needed)
  try {
    await firebaseUser.getIdToken(false);
  } catch (tokenErr) {
    throw new Error('Session expired. Please sign out and sign in again.');
  }

  let storage: ReturnType<typeof getClientStorage>;
  try {
    storage = getClientStorage();
  } catch (storageInitErr: any) {
    console.error('[Upload] getClientStorage error:', storageInitErr);
    throw new Error('Firebase Storage not available. Check your Firebase configuration.');
  }

  const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
  const storagePath = `memories/${realUid}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const storageRef = ref(storage, storagePath);

  console.log('[Upload] Starting upload:', { storagePath, size: file.size, type: file.type, uid: realUid });
  onProgress?.(1);

  // Upload with progress tracking and 90-second timeout
  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const done = (err?: Error) => {
      if (settled) return;
      settled = true;
      err ? reject(err) : resolve();
    };

    // Safety timeout — if nothing happens in 90s, reject
    const timeout = setTimeout(() => {
      console.error('[Upload] TIMEOUT after 90s — storage bucket may be wrong or rules deny access');
      done(new Error(
        'Upload timed out after 90 seconds.\n' +
        'Possible causes:\n' +
        '1. Firebase Storage rules do not allow write access\n' +
        '2. Storage bucket name is incorrect\n' +
        '3. Network / CORS issue\n\n' +
        'Check Firebase Console → Storage → Rules and make sure the bucket is enabled.'
      ));
    }, 90_000);

    let task: ReturnType<typeof uploadBytesResumable>;
    try {
      task = uploadBytesResumable(storageRef, file, {
        contentType: file.type || 'application/octet-stream',
      });
    } catch (initErr: any) {
      clearTimeout(timeout);
      console.error('[Upload] uploadBytesResumable init error:', initErr);
      done(new Error('Could not start upload: ' + (initErr?.message || String(initErr))));
      return;
    }

    task.on(
      'state_changed',
      snapshot => {
        const pct = snapshot.totalBytes > 0
          ? Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)
          : 1;
        console.log(`[Upload] Progress: ${pct}% (${snapshot.bytesTransferred}/${snapshot.totalBytes}) state=${snapshot.state}`);
        onProgress?.(Math.max(pct, 1));
      },
      error => {
        clearTimeout(timeout);
        console.error('[Upload] Firebase Storage error:', error.code, error.message);
        // Map Firebase Storage error codes to human-readable messages
        let msg = error.message || 'Upload failed';
        const code: string = (error as any).code ?? '';
        if (code === 'storage/unauthorized')
          msg = 'Permission denied (storage/unauthorized). Check Firebase Storage Rules:\nAllow write for authenticated users at memories/{userId}/**';
        else if (code === 'storage/canceled')
          msg = 'Upload was cancelled.';
        else if (code === 'storage/unknown' || code === 'storage/retry-limit-exceeded')
          msg = 'Network error during upload (storage/unknown). This may be a CORS issue. Check Firebase Storage CORS settings.';
        else if (code === 'storage/quota-exceeded')
          msg = 'Firebase Storage quota exceeded. Upgrade your plan.';
        else if (code === 'storage/bucket-not-found')
          msg = 'Firebase Storage bucket not found. Check NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET in your config.';
        else if (code === 'storage/no-default-bucket')
          msg = 'No default Firebase Storage bucket configured. Enable Storage in Firebase Console.';
        done(new Error(msg));
      },
      () => {
        clearTimeout(timeout);
        console.log('[Upload] Upload complete!');
        done();
      }
    );
  });

  const url = await getDownloadURL(storageRef);

  const db = getClientDb();
  const docRef = await addDoc(collection(db, 'memories'), {
    uid: realUid,
    name: file.name,
    description: description || '',
    type: getFileType(file.type),
    url,
    storagePath,
    size: file.size,
    mimeType: file.type,
    createdAt: serverTimestamp(),
  });

  return {
    id: docRef.id,
    uid: realUid,
    name: file.name,
    description: description || '',
    type: getFileType(file.type),
    url,
    storagePath,
    size: file.size,
    mimeType: file.type,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Get all memory items for a user.
 */
export async function getMemoryItems(uid: string): Promise<MemoryItem[]> {
  if (!isFirebaseClientConfigured()) {
    const key = `demo_memories_${uid}`;
    return JSON.parse(localStorage.getItem(key) || '[]');
  }
  // Wait for Firebase Auth to restore session
  const firebaseUser = await waitForAuthReady();
  const realUid = firebaseUser?.uid || uid;
  const db = getClientDb();
  // Use simple where-only query (no orderBy) to avoid composite index requirement.
  // Sort client-side instead.
  const q = query(
    collection(db, 'memories'),
    where('uid', '==', realUid)
  );
  const snap = await getDocs(q);
  const items = snap.docs.map(d => ({
    id: d.id,
    uid: d.data().uid,
    name: d.data().name,
    description: d.data().description || '',
    type: d.data().type,
    url: d.data().url,
    storagePath: d.data().storagePath,
    size: d.data().size || 0,
    mimeType: d.data().mimeType || '',
    createdAt: d.data().createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
    usage: d.data().usage || null,
  }));
  // Sort client-side (newest first) to avoid requiring a composite Firestore index
  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Delete a single memory item (Storage + Firestore).
 */
export async function deleteMemoryItem(item: MemoryItem): Promise<void> {
  if (!isFirebaseClientConfigured()) {
    const key = `demo_memories_${item.uid}`;
    const list: MemoryItem[] = JSON.parse(localStorage.getItem(key) || '[]');
    localStorage.setItem(key, JSON.stringify(list.filter(i => i.id !== item.id)));
    return;
  }
  const storage = getClientStorage();
  if (item.storagePath) {
    try { await deleteObject(ref(storage, item.storagePath)); } catch {}
  }
  const db = getClientDb();
  await deleteDoc(doc(db, 'memories', item.id));
}

/**
 * Delete ALL memory items for a user (called when deleting the profile).
 */
export async function deleteAllMemoryItems(uid: string): Promise<void> {
  const items = await getMemoryItems(uid);
  await Promise.all(items.map(item => deleteMemoryItem(item)));
}

/**
 * Set or clear avatar_reference usage on a memory item.
 * Stores { usage: "avatar_reference" } or deletes the field when clearing.
 */
export async function setMemoryUsage(
  item: MemoryItem,
  usage: 'avatar_reference' | null
): Promise<void> {
  if (!isFirebaseClientConfigured()) {
    // Demo mode — update localStorage
    const key = `demo_memories_${item.uid}`;
    const list: MemoryItem[] = JSON.parse(localStorage.getItem(key) || '[]');
    const updated = list.map(m => m.id === item.id ? { ...m, usage } : m);
    localStorage.setItem(key, JSON.stringify(updated));
    return;
  }
  const db = getClientDb();
  // Firestore does not accept null — use deleteField() to remove the field
  await updateDoc(doc(db, 'memories', item.id), {
    usage: usage === null ? deleteField() : usage,
  });
}

/**
 * Send a 6-digit confirmation code to the user's email via Firebase extension
 * (workaround: store code in Firestore with TTL, email via nodemailer is server-side only).
 * For static hosting, we generate a code and store it in Firestore, then show it on screen
 * (in production, trigger a Firebase extension or Cloud Function).
 * 
 * For this static export: we store the code in Firestore and return it.
 * The UI will send the user the code by showing a 2nd step confirmation.
 */
export async function requestProfileDeletion(uid: string, email: string): Promise<string> {
  const code = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  if (!isFirebaseClientConfigured()) {
    localStorage.setItem('demo_delete_code', JSON.stringify({ uid, code, expiresAt: expiresAt.toISOString() }));
    return code;
  }

  const db = getClientDb();
  // Store code in Firestore
  const q = query(collection(db, 'delete_codes'), where('uid', '==', uid), limit(1));
  const snap = await getDocs(q);
  if (!snap.empty) {
    await updateDoc(snap.docs[0].ref, { code, expiresAt, email });
  } else {
    await addDoc(collection(db, 'delete_codes'), { uid, email, code, expiresAt });
  }

  // Trigger Firebase email extension (Trigger Email from Firestore)
  // This writes to "mail" collection which Firebase Extension picks up
  try {
    await addDoc(collection(db, 'mail'), {
      to: email,
      message: {
        subject: 'MEafterMe — Profile Deletion Confirmation Code',
        html: `<h2>Profile Deletion Request</h2>
<p>You requested to delete your MEafterMe profile and all associated memories.</p>
<p><strong>Your confirmation code: <span style="font-size:2em;letter-spacing:4px;color:#dc2626;">${code}</span></strong></p>
<p>This code expires in 10 minutes.</p>
<p>If you did not request this, ignore this email.</p>`,
        text: `Your MEafterMe profile deletion code: ${code}\nExpires in 10 minutes.`,
      },
    });
  } catch (e) {
    // Email extension might not be installed — code is still stored in Firestore
    console.warn('Could not send email (extension may not be configured):', e);
  }

  return code; // Return for display if email fails
}

/**
 * Verify the deletion code and delete the profile.
 */
export async function confirmProfileDeletion(uid: string, inputCode: string): Promise<boolean> {
  if (!isFirebaseClientConfigured()) {
    const stored = localStorage.getItem('demo_delete_code');
    if (!stored) return false;
    const data = JSON.parse(stored);
    if (data.uid !== uid || data.code !== inputCode) return false;
    if (new Date() > new Date(data.expiresAt)) return false;
    localStorage.removeItem('demo_delete_code');
    await deleteAllMemoryItems(uid);
    // Delete user record
    const usersKey = 'demo_users';
    const users: Record<string, AppUser> = JSON.parse(localStorage.getItem(usersKey) || '{}');
    for (const [email, u] of Object.entries(users)) {
      if (u.uid === uid) { delete users[email]; }
    }
    localStorage.setItem(usersKey, JSON.stringify(users));
    clearCurrentUser();
    return true;
  }

  const db = getClientDb();
  const q = query(collection(db, 'delete_codes'), where('uid', '==', uid), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return false;

  const data = snap.docs[0].data();
  if (data.code !== inputCode) return false;
  const expiresAt = data.expiresAt?.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt);
  if (new Date() > expiresAt) return false;

  // Delete the code record
  await deleteDoc(snap.docs[0].ref);

  // Delete all memories
  await deleteAllMemoryItems(uid);

  // Delete Firestore user doc
  const userQ = query(collection(db, 'users'), where('uid', '==', uid), limit(1));
  const userSnap = await getDocs(userQ);
  if (!userSnap.empty) await deleteDoc(userSnap.docs[0].ref);

  // Sign out
  try {
    const auth = getClientAuth();
    // Delete Firebase Auth user
    const currentUser = auth.currentUser;
    if (currentUser) await currentUser.delete();
  } catch {}

  clearCurrentUser();
  return true;
}

// ─── Life Questions — Answers ─────────────────────────────────────────────────

export interface QuestionAnswer {
  questionId: number;
  answer: string;
  updatedAt: string;
  docId?: string;  // Firestore document ID — cached to avoid composite index queries
}

// In-memory cache of docIds: uid -> questionId -> docId
const _answerDocCache: Record<string, Record<number, string>> = {};

/** Save or update a single answer */
export async function saveAnswer(uid: string, questionId: number, answer: string): Promise<void> {
  if (!isFirebaseClientConfigured()) {
    const key = `demo_answers_${uid}`;
    const all: Record<number, QuestionAnswer> = JSON.parse(localStorage.getItem(key) || '{}');
    all[questionId] = { questionId, answer, updatedAt: new Date().toISOString() };
    localStorage.setItem(key, JSON.stringify(all));
    return;
  }
  // Wait for Firebase Auth to restore session (crucial in static export)
  const firebaseUser = await waitForAuthReady();
  const realUid = firebaseUser?.uid ?? uid;

  console.log('[saveAnswer] firebaseUser:', firebaseUser?.uid, '| realUid:', realUid, '| questionId:', questionId);

  if (!firebaseUser) {
    throw new Error('Not authenticated. Please sign out and sign in again.');
  }

  const db = getClientDb();

  // Always use deterministic doc ID: {uid}_q{questionId}
  // This avoids composite index AND makes the doc ID predictable for security rules
  const docId = `${realUid}_q${questionId}`;
  const docRef = doc(db, 'answers', docId);

  // Use setDoc with merge:true — works for both create and update
  // Security rule: request.resource.data.uid == request.auth.uid → always allowed
  console.log('[saveAnswer] Writing to Firestore docId:', docId, 'uid:', realUid);
  try {
    await setDoc(docRef, {
      uid: realUid,
      questionId,
      answer,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    }, { merge: true });
    console.log('[saveAnswer] ✅ Success docId:', docId);
  } catch (e: any) {
    console.error('[saveAnswer] ❌ Firestore error:', e?.code, e?.message);
    throw e;
  }

  // Cache the docId
  if (!_answerDocCache[realUid]) _answerDocCache[realUid] = {};
  _answerDocCache[realUid][questionId] = docId;
}

/** Get all answers for a user */
export async function getAnswers(uid: string): Promise<Record<number, QuestionAnswer>> {
  if (!isFirebaseClientConfigured()) {
    const key = `demo_answers_${uid}`;
    return JSON.parse(localStorage.getItem(key) || '{}');
  }
  // Wait for Firebase Auth to restore session (crucial in static export)
  const firebaseUser = await waitForAuthReady();
  const realUid = firebaseUser?.uid ?? uid;
  console.log('[getAnswers] realUid:', realUid, '| passed uid:', uid, '| firebaseUser:', firebaseUser?.uid);
  const db = getClientDb();
  // Simple single-field query — no composite index required
  const q = query(collection(db, 'answers'), where('uid', '==', realUid));
  const snap = await getDocs(q);
  console.log('[getAnswers] found', snap.size, 'answers for uid:', realUid);
  const result: Record<number, QuestionAnswer> = {};
  if (!_answerDocCache[realUid]) _answerDocCache[realUid] = {};
  snap.docs.forEach(d => {
    const data = d.data();
    const qId = Number(data.questionId);
    result[qId] = {
      questionId: qId,
      answer: data.answer ?? '',
      updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      docId: d.id,
    };
    // Populate doc cache
    _answerDocCache[realUid][qId] = d.id;
  });
  return result;
}

/** Get answers for a shared profile (by sharedUid — only if the viewer has access) */
export async function getSharedAnswers(ownerUid: string, viewerEmail: string): Promise<Record<number, QuestionAnswer> | null> {
  if (!isFirebaseClientConfigured()) {
    // demo — always allow
    const key = `demo_answers_${ownerUid}`;
    return JSON.parse(localStorage.getItem(key) || '{}');
  }
  const db = getClientDb();
  // Check if viewerEmail is in the owner's shared_with list
  const shareQ = query(
    collection(db, 'profile_shares'),
    where('ownerUid', '==', ownerUid),
    where('sharedWithEmail', '==', viewerEmail.toLowerCase()),
    limit(1)
  );
  const shareSnap = await getDocs(shareQ);
  if (shareSnap.empty) return null; // no access

  // Fetch answers
  const q = query(collection(db, 'answers'), where('uid', '==', ownerUid));
  const snap = await getDocs(q);
  const result: Record<number, QuestionAnswer> = {};
  snap.docs.forEach(d => {
    const data = d.data();
    result[data.questionId] = {
      questionId: data.questionId,
      answer: data.answer,
      updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
    };
  });
  return result;
}

// ─── Profile Sharing ──────────────────────────────────────────────────────────

export interface ProfileShare {
  id: string;
  ownerUid: string;
  sharedWithEmail: string;
  sharedAt: string;
}

/** Share your profile (answers + memories) with another user by email */
export async function shareProfileWithEmail(ownerUid: string, targetEmail: string): Promise<'ok' | 'already' | 'error'> {
  const email = targetEmail.toLowerCase().trim();
  if (!isFirebaseClientConfigured()) {
    const key = `demo_shares_${ownerUid}`;
    const list: string[] = JSON.parse(localStorage.getItem(key) || '[]');
    if (list.includes(email)) return 'already';
    list.push(email);
    localStorage.setItem(key, JSON.stringify(list));
    return 'ok';
  }
  try {
    const auth = getClientAuth();
    const realUid = auth.currentUser?.uid ?? ownerUid;
    const db = getClientDb();
    const q = query(
      collection(db, 'profile_shares'),
      where('ownerUid', '==', realUid),
      where('sharedWithEmail', '==', email),
      limit(1)
    );
    const snap = await getDocs(q);
    if (!snap.empty) return 'already';
    await addDoc(collection(db, 'profile_shares'), {
      ownerUid: realUid,
      sharedWithEmail: email,
      sharedAt: serverTimestamp(),
    });
    return 'ok';
  } catch { return 'error'; }
}

/** Remove sharing access for an email */
export async function removeProfileShare(ownerUid: string, targetEmail: string): Promise<void> {
  const email = targetEmail.toLowerCase().trim();
  if (!isFirebaseClientConfigured()) {
    const key = `demo_shares_${ownerUid}`;
    const list: string[] = JSON.parse(localStorage.getItem(key) || '[]');
    localStorage.setItem(key, JSON.stringify(list.filter(e => e !== email)));
    return;
  }
  const auth = getClientAuth();
  const realUid = auth.currentUser?.uid ?? ownerUid;
  const db = getClientDb();
  const q = query(
    collection(db, 'profile_shares'),
    where('ownerUid', '==', realUid),
    where('sharedWithEmail', '==', email),
    limit(1)
  );
  const snap = await getDocs(q);
  if (!snap.empty) await deleteDoc(snap.docs[0].ref);
}

/** Get all emails this profile is shared with */
export async function getProfileShares(ownerUid: string): Promise<ProfileShare[]> {
  if (!isFirebaseClientConfigured()) {
    const key = `demo_shares_${ownerUid}`;
    const list: string[] = JSON.parse(localStorage.getItem(key) || '[]');
    return list.map((email, i) => ({ id: `demo-${i}`, ownerUid, sharedWithEmail: email, sharedAt: new Date().toISOString() }));
  }
  const auth = getClientAuth();
  const realUid = auth.currentUser?.uid ?? ownerUid;
  const db = getClientDb();
  const q = query(collection(db, 'profile_shares'), where('ownerUid', '==', realUid));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({
    id: d.id,
    ownerUid: d.data().ownerUid,
    sharedWithEmail: d.data().sharedWithEmail,
    sharedAt: d.data().sharedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
  }));
}

/** Check if current user has access to another user's profile */
export async function checkSharedAccess(ownerUid: string, viewerEmail: string): Promise<boolean> {
  if (!isFirebaseClientConfigured()) return true;
  const db = getClientDb();
  const q = query(
    collection(db, 'profile_shares'),
    where('ownerUid', '==', ownerUid),
    where('sharedWithEmail', '==', viewerEmail.toLowerCase()),
    limit(1)
  );
  const snap = await getDocs(q);
  return !snap.empty;
}

// ─── Contact ──────────────────────────────────────────────────────────────────

export async function submitContactForm(data: { name: string; email: string; message: string; earlyAccess: boolean }): Promise<void> {
  if (!isFirebaseClientConfigured()) { console.log('Demo contact form:', data); return; }
  const db = getClientDb();
  await addDoc(collection(db, 'contact_messages'), { ...data, createdAt: serverTimestamp() });
}

// ─── Admin helpers ─────────────────────────────────────────────────────────────

export async function adminApproveUser(uid: string, adminSecret: string): Promise<boolean> {
  if (!isFirebaseClientConfigured()) { return true; }
  const db = getClientDb();
  const q = query(collection(db, 'users'), where('uid', '==', uid), limit(1));
  const snap = await getDocs(q);
  if (!snap.empty) {
    await updateDoc(snap.docs[0].ref, { status: 'ACTIVE', updatedAt: serverTimestamp(), approvedAt: serverTimestamp() });
  }
  return true;
}

export async function getAllUsers(): Promise<AppUser[]> {
  if (!isFirebaseClientConfigured()) {
    const users: Record<string, AppUser> = JSON.parse(localStorage.getItem('demo_users') || '{}');
    return Object.values(users);
  }
  const db = getClientDb();
  const snap = await getDocs(query(collection(db, 'users'), orderBy('createdAt', 'desc')));
  return snap.docs.map(d => ({ uid: d.data().uid || d.id, email: d.data().email, status: d.data().status }));
}

export async function getWaitlistSignups(): Promise<{ email: string }[]> { return []; }
export async function createInviteCode(code?: string): Promise<string> {
  const finalCode = (code || Math.random().toString(36).slice(2, 10)).toUpperCase();
  return finalCode;
}
export async function getInviteCodes(): Promise<{ code: string; used: boolean; usedByEmail?: string }[]> { return []; }

// ─── Avatar Config ────────────────────────────────────────────────────────────

export interface AvatarConfig {
  uid: string;
  // Reference photo for D-ID (face image)
  photoMemoryId?: string;
  photoUrl?: string;
  photoName?: string;
  // Reference audio for ElevenLabs voice clone
  audioMemoryId?: string;
  audioUrl?: string;
  audioName?: string;
  audioStoragePath?: string;
  // ElevenLabs voice clone result
  voiceId?: string;
  voiceStatus?: 'pending' | 'ready' | 'error';
  // Status
  setupComplete?: boolean;
  updatedAt?: string;
}

/** Save avatar config for a user */
export async function saveAvatarConfig(uid: string, config: Partial<AvatarConfig>): Promise<void> {
  const key = `avatar_config_${uid}`;
  if (!isFirebaseClientConfigured()) {
    const existing = JSON.parse(localStorage.getItem(key) || '{}');
    // Strip undefined for localStorage too
    const cleaned = stripUndefined(config);
    localStorage.setItem(key, JSON.stringify({ ...existing, ...cleaned, uid, updatedAt: new Date().toISOString() }));
    return;
  }
  const firebaseUser = await waitForAuthReady();
  const realUid = firebaseUser?.uid ?? uid;
  const db = getClientDb();
  // CRITICAL: Firestore rejects 'undefined' values — strip them before writing
  const cleaned = stripUndefined(config);
  await setDoc(doc(db, 'avatar_configs', realUid), {
    ...cleaned,
    uid: realUid,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

/** Get avatar config for a user */
export async function getAvatarConfig(uid: string): Promise<AvatarConfig | null> {
  const key = `avatar_config_${uid}`;
  if (!isFirebaseClientConfigured()) {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : null;
  }
  const firebaseUser = await waitForAuthReady();
  const realUid = firebaseUser?.uid ?? uid;
  const db = getClientDb();
  const snap = await getDoc(doc(db, 'avatar_configs', realUid));
  if (!snap.exists()) return null;
  const d = snap.data();
  return {
    uid: d.uid,
    photoMemoryId: d.photoMemoryId,
    photoUrl: d.photoUrl,
    photoName: d.photoName,
    audioMemoryId: d.audioMemoryId,
    audioUrl: d.audioUrl,
    audioName: d.audioName,
    audioStoragePath: d.audioStoragePath,
    voiceId: d.voiceId,
    voiceStatus: d.voiceStatus,
    setupComplete: d.setupComplete,
    updatedAt: d.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
  };
}

// Legacy stubs
export async function sendMagicLink(email: string): Promise<{ demo?: boolean; link?: string }> { return {}; }
export async function verifyMagicLink(url: string): Promise<AppUser | null> { return null; }
export async function addToWaitlist(email: string): Promise<'new' | 'existing'> { return 'new'; }
export async function redeemInviteCode(code: string, email: string): Promise<'ok' | 'invalid' | 'used'> { return 'invalid'; }
export async function getUserStatus(email: string): Promise<UserStatus | null> { return null; }
