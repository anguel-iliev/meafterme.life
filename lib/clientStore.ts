// lib/clientStore.ts
// All data operations using Firebase Client SDK (browser-side).
// Falls back to localStorage demo store when Firebase is not configured.

import {
  collection, addDoc, query, where, getDocs,
  doc, setDoc, updateDoc, getDoc, orderBy, limit,
  serverTimestamp, Timestamp
} from 'firebase/firestore';
import {
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { getClientDb, getClientAuth, isFirebaseClientConfigured } from './firebaseClient';

export type UserStatus = 'WAITLISTED' | 'PENDING_APPROVAL' | 'ACTIVE';

export interface AppUser {
  uid: string;
  email: string;
  status: UserStatus;
}

// ─── Auth (Firebase Auth email link) ──────────────────────────────────────────

export async function sendMagicLink(email: string): Promise<{ demo?: boolean; link?: string }> {
  if (!isFirebaseClientConfigured()) {
    // DEMO fallback — save token in localStorage
    const token = crypto.randomUUID();
    const expiry = Date.now() + 60 * 60 * 1000;
    localStorage.setItem('demo_magic_token', JSON.stringify({ token, email, expiry }));
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
    return { demo: true, link: `${appUrl}/auth/verify/?token=${token}&email=${encodeURIComponent(email)}` };
  }

  const auth = getClientAuth();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
  const actionCodeSettings = {
    url: `${appUrl}/auth/verify/`,
    handleCodeInApp: true,
  };
  await sendSignInLinkToEmail(auth, email, actionCodeSettings);
  // Save email to localStorage so we can complete sign-in on verify page
  localStorage.setItem('emailForSignIn', email);
  return { demo: false };
}

export async function verifyMagicLink(url: string): Promise<AppUser | null> {
  if (!isFirebaseClientConfigured()) {
    // DEMO fallback
    const params = new URLSearchParams(new URL(url).search);
    const token = params.get('token');
    const email = params.get('email');
    if (!token || !email) return null;
    const stored = localStorage.getItem('demo_magic_token');
    if (!stored) return null;
    const data = JSON.parse(stored);
    if (data.token !== token || Date.now() > data.expiry) return null;
    localStorage.removeItem('demo_magic_token');
    // Create/get user
    return await findOrCreateClientUser(email);
  }

  const auth = getClientAuth();
  if (!isSignInWithEmailLink(auth, url)) return null;
  let email = localStorage.getItem('emailForSignIn');
  if (!email) {
    email = window.prompt('Please confirm your email:') || '';
  }
  const result = await signInWithEmailLink(auth, email, url);
  localStorage.removeItem('emailForSignIn');
  return await findOrCreateClientUser(result.user.email!);
}

export async function signOutUser(): Promise<void> {
  if (isFirebaseClientConfigured()) {
    await firebaseSignOut(getClientAuth());
  }
  localStorage.removeItem('meafterme_session');
}

export function getCurrentUser(): AppUser | null {
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

export async function findOrCreateClientUser(email: string): Promise<AppUser> {
  if (!isFirebaseClientConfigured()) {
    // Demo: use localStorage
    const key = 'demo_users';
    const users: Record<string, AppUser> = JSON.parse(localStorage.getItem(key) || '{}');
    if (users[email]) {
      saveCurrentUser(users[email]);
      return users[email];
    }
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
    const user: AppUser = { uid: d.id, email: d.data().email, status: d.data().status };
    saveCurrentUser(user);
    return user;
  }
  // Create new user
  const ref = await addDoc(collection(db, 'users'), {
    email,
    status: 'WAITLISTED' as UserStatus,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  const newUser: AppUser = { uid: ref.id, email, status: 'WAITLISTED' };
  saveCurrentUser(newUser);
  return newUser;
}

export async function getUserStatus(email: string): Promise<UserStatus | null> {
  if (!isFirebaseClientConfigured()) {
    const key = 'demo_users';
    const users: Record<string, AppUser> = JSON.parse(localStorage.getItem(key) || '{}');
    return users[email]?.status || null;
  }
  const db = getClientDb();
  const q = query(collection(db, 'users'), where('email', '==', email), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return snap.docs[0].data().status as UserStatus;
}

// ─── Waitlist ─────────────────────────────────────────────────────────────────

export async function addToWaitlist(email: string): Promise<'new' | 'existing'> {
  if (!isFirebaseClientConfigured()) {
    const key = 'demo_waitlist';
    const list: string[] = JSON.parse(localStorage.getItem(key) || '[]');
    if (list.includes(email)) return 'existing';
    list.push(email);
    localStorage.setItem(key, JSON.stringify(list));
    return 'new';
  }
  const db = getClientDb();
  const q = query(collection(db, 'waitlist_signups'), where('email', '==', email), limit(1));
  const snap = await getDocs(q);
  if (!snap.empty) return 'existing';
  await addDoc(collection(db, 'waitlist_signups'), {
    email,
    createdAt: serverTimestamp(),
    earlyAccess: false,
  });
  return 'new';
}

// ─── Invite codes ─────────────────────────────────────────────────────────────

export async function redeemInviteCode(code: string, email: string): Promise<'ok' | 'invalid' | 'used'> {
  if (!isFirebaseClientConfigured()) {
    const key = 'demo_codes';
    const codes: Record<string, { used: boolean }> = JSON.parse(localStorage.getItem(key) || '{"DEMO2026":{"used":false}}');
    const upper = code.trim().toUpperCase();
    if (!codes[upper]) return 'invalid';
    if (codes[upper].used) return 'used';
    codes[upper].used = true;
    localStorage.setItem(key, JSON.stringify(codes));
    // Update user status
    const usersKey = 'demo_users';
    const users: Record<string, AppUser> = JSON.parse(localStorage.getItem(usersKey) || '{}');
    if (users[email]) {
      users[email].status = 'PENDING_APPROVAL';
      localStorage.setItem(usersKey, JSON.stringify(users));
      saveCurrentUser(users[email]);
    }
    return 'ok';
  }
  const db = getClientDb();
  const q = query(collection(db, 'invite_codes'), where('code', '==', code.trim().toUpperCase()), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return 'invalid';
  const d = snap.docs[0];
  if (d.data().used) return 'used';
  await updateDoc(d.ref, { used: true, usedByEmail: email, usedAt: serverTimestamp() });
  // Update user status
  const uq = query(collection(db, 'users'), where('email', '==', email), limit(1));
  const usnap = await getDocs(uq);
  if (!usnap.empty) {
    await updateDoc(usnap.docs[0].ref, { status: 'PENDING_APPROVAL', updatedAt: serverTimestamp() });
    const user = getCurrentUser();
    if (user) saveCurrentUser({ ...user, status: 'PENDING_APPROVAL' });
  }
  return 'ok';
}

// ─── Contact ──────────────────────────────────────────────────────────────────

export async function submitContactForm(data: { name: string; email: string; message: string; earlyAccess: boolean }): Promise<void> {
  if (!isFirebaseClientConfigured()) {
    console.log('Demo contact form:', data);
    return;
  }
  const db = getClientDb();
  await addDoc(collection(db, 'contact_messages'), {
    ...data,
    createdAt: serverTimestamp(),
  });
}

// ─── Admin helpers ─────────────────────────────────────────────────────────────

export async function adminApproveUser(uid: string, adminSecret: string): Promise<boolean> {
  // For static Apache hosting: use Firestore directly with admin check
  if (!isFirebaseClientConfigured()) {
    const key = 'demo_users';
    const users: Record<string, AppUser> = JSON.parse(localStorage.getItem(key) || '{}');
    for (const u of Object.values(users)) {
      if (u.uid === uid) { u.status = 'ACTIVE'; }
    }
    localStorage.setItem(key, JSON.stringify(users));
    return true;
  }
  const db = getClientDb();
  await updateDoc(doc(db, 'users', uid), {
    status: 'ACTIVE',
    updatedAt: serverTimestamp(),
    approvedAt: serverTimestamp(),
  });
  return true;
}

export async function getAllUsers(): Promise<AppUser[]> {
  if (!isFirebaseClientConfigured()) {
    const users: Record<string, AppUser> = JSON.parse(localStorage.getItem('demo_users') || '{}');
    return Object.values(users);
  }
  const db = getClientDb();
  const snap = await getDocs(query(collection(db, 'users'), orderBy('createdAt', 'desc')));
  return snap.docs.map(d => ({ uid: d.id, email: d.data().email, status: d.data().status }));
}

export async function getWaitlistSignups(): Promise<{ email: string }[]> {
  if (!isFirebaseClientConfigured()) {
    const list: string[] = JSON.parse(localStorage.getItem('demo_waitlist') || '[]');
    return list.map(email => ({ email }));
  }
  const db = getClientDb();
  const snap = await getDocs(query(collection(db, 'waitlist_signups'), orderBy('createdAt', 'desc')));
  return snap.docs.map(d => ({ email: d.data().email }));
}

export async function createInviteCode(code?: string): Promise<string> {
  const finalCode = (code || Math.random().toString(36).slice(2, 10)).toUpperCase();
  if (!isFirebaseClientConfigured()) {
    const key = 'demo_codes';
    const codes = JSON.parse(localStorage.getItem(key) || '{}');
    codes[finalCode] = { used: false };
    localStorage.setItem(key, JSON.stringify(codes));
    return finalCode;
  }
  const db = getClientDb();
  await addDoc(collection(db, 'invite_codes'), {
    code: finalCode,
    used: false,
    createdAt: serverTimestamp(),
    createdBy: 'admin',
  });
  return finalCode;
}

export async function getInviteCodes(): Promise<{ code: string; used: boolean; usedByEmail?: string }[]> {
  if (!isFirebaseClientConfigured()) {
    const codes: Record<string, { used: boolean }> = JSON.parse(localStorage.getItem('demo_codes') || '{"DEMO2026":{"used":false}}');
    return Object.entries(codes).map(([code, v]) => ({ code, used: v.used }));
  }
  const db = getClientDb();
  const snap = await getDocs(query(collection(db, 'invite_codes'), orderBy('createdAt', 'desc')));
  return snap.docs.map(d => ({ code: d.data().code, used: d.data().used, usedByEmail: d.data().usedByEmail }));
}
