// lib/auth.ts
// Server-side auth helpers.
// Automatically falls back to in-memory demo store when Firebase is not configured.

import { v4 as uuidv4 } from 'uuid';
import {
  isFirebaseConfigured,
  demoFindOrCreateUser,
  demoGetUserByEmail,
  demoGetUserById,
  demoSetUserStatus,
  demoCreateMagicLinkToken,
  demoVerifyMagicLinkToken,
  demoAddWaitlistSignup,
  demoListWaitlistSignups,
  demoRedeemInviteCode,
  demoCreateInviteCode,
  demoListInviteCodes,
  demoListPendingUsers,
  demoListAllUsers,
  demoAdminApproveUser,
} from './demoStore';

const MAGIC_LINK_TTL_MS = 30 * 60 * 1000;

export type UserStatus = 'WAITLISTED' | 'PENDING_APPROVAL' | 'ACTIVE';

export interface FirestoreUser {
  email: string;
  status: UserStatus;
  createdAt: any;
  updatedAt: any;
}

// ─── Lazy Firebase import ─────────────────────────────────────────────────────

async function getFirebaseDb() {
  const { getDb } = await import('./firebase');
  return getDb();
}

// ─── Users ───────────────────────────────────────────────────────────────────

export async function findOrCreateUser(email: string): Promise<{ uid: string; status: UserStatus; isNew: boolean }> {
  if (!isFirebaseConfigured()) return demoFindOrCreateUser(email);

  const db = await getFirebaseDb();
  const snap = await db.collection('users').where('email', '==', email).limit(1).get();
  if (!snap.empty) {
    const doc = snap.docs[0];
    return { uid: doc.id, status: (doc.data() as FirestoreUser).status, isNew: false };
  }
  const now = new Date();
  const ref = await db.collection('users').add({
    email,
    status: 'WAITLISTED' as UserStatus,
    createdAt: now,
    updatedAt: now,
  });
  return { uid: ref.id, status: 'WAITLISTED', isNew: true };
}

export async function getUserByEmail(email: string) {
  if (!isFirebaseConfigured()) {
    const u = demoGetUserByEmail(email);
    return u ? { uid: u.uid, email: u.email, status: u.status, createdAt: u.createdAt, updatedAt: u.updatedAt } : null;
  }
  const db = await getFirebaseDb();
  const snap = await db.collection('users').where('email', '==', email).limit(1).get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { uid: doc.id, ...(doc.data() as FirestoreUser) };
}

export async function getUserById(uid: string) {
  if (!isFirebaseConfigured()) {
    const u = demoGetUserById(uid);
    return u ? { uid: u.uid, email: u.email, status: u.status, createdAt: u.createdAt, updatedAt: u.updatedAt } : null;
  }
  const db = await getFirebaseDb();
  const doc = await db.collection('users').doc(uid).get();
  if (!doc.exists) return null;
  return { uid: doc.id, ...(doc.data() as FirestoreUser) };
}

export async function setUserStatus(uid: string, status: UserStatus) {
  if (!isFirebaseConfigured()) { demoSetUserStatus(uid, status); return; }
  const db = await getFirebaseDb();
  await db.collection('users').doc(uid).update({ status, updatedAt: new Date() });
}

// ─── Magic links ─────────────────────────────────────────────────────────────

export async function createMagicLinkToken(email: string): Promise<string> {
  if (!isFirebaseConfigured()) return demoCreateMagicLinkToken(email);

  const db = await getFirebaseDb();
  const token = uuidv4();
  const now = new Date();
  await db.collection('magic_links').doc(token).set({
    email,
    used: false,
    createdAt: now,
    expiresAt: new Date(now.getTime() + MAGIC_LINK_TTL_MS),
  });
  return token;
}

export async function verifyMagicLinkToken(token: string): Promise<string | null> {
  if (!isFirebaseConfigured()) return demoVerifyMagicLinkToken(token);

  const db = await getFirebaseDb();
  const ref = db.collection('magic_links').doc(token);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const data = snap.data()!;
  if (data.used) return null;
  const expiresAt: Date = data.expiresAt.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt);
  if (new Date() > expiresAt) return null;
  await ref.update({ used: true, usedAt: new Date() });
  return data.email as string;
}

// ─── Waitlist ─────────────────────────────────────────────────────────────────

export async function addWaitlistSignup(email: string): Promise<'new' | 'existing'> {
  if (!isFirebaseConfigured()) return demoAddWaitlistSignup(email);

  const db = await getFirebaseDb();
  const snap = await db.collection('waitlist_signups').where('email', '==', email).limit(1).get();
  if (!snap.empty) return 'existing';
  await db.collection('waitlist_signups').add({ email, createdAt: new Date(), earlyAccess: false });
  return 'new';
}

// ─── Invite codes ─────────────────────────────────────────────────────────────

export interface InviteCode {
  code: string;
  used: boolean;
  usedByEmail?: string;
  usedAt?: Date;
  createdAt: Date;
  createdBy?: string;
}

export async function redeemInviteCode(code: string, email: string): Promise<'ok' | 'invalid' | 'used'> {
  if (!isFirebaseConfigured()) return demoRedeemInviteCode(code, email);

  const db = await getFirebaseDb();
  const snap = await db.collection('invite_codes').where('code', '==', code.trim().toUpperCase()).limit(1).get();
  if (snap.empty) return 'invalid';
  const doc = snap.docs[0];
  const data = doc.data() as InviteCode;
  if (data.used) return 'used';
  await doc.ref.update({ used: true, usedByEmail: email, usedAt: new Date() });
  const user = await getUserByEmail(email);
  if (user) {
    await setUserStatus(user.uid, 'PENDING_APPROVAL');
    await db.collection('admin_audit').add({ action: 'invite_code_redeemed', email, code, timestamp: new Date() });
  }
  return 'ok';
}

export async function createInviteCode(code?: string, createdBy?: string): Promise<string> {
  if (!isFirebaseConfigured()) return demoCreateInviteCode(code);

  const db = await getFirebaseDb();
  const finalCode = (code || uuidv4().slice(0, 8)).toUpperCase();
  await db.collection('invite_codes').add({ code: finalCode, used: false, createdAt: new Date(), createdBy: createdBy || 'admin' });
  return finalCode;
}

export async function listInviteCodes() {
  if (!isFirebaseConfigured()) return demoListInviteCodes();

  const db = await getFirebaseDb();
  const snap = await db.collection('invite_codes').orderBy('createdAt', 'desc').get();
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as InviteCode) }));
}

// ─── Admin ────────────────────────────────────────────────────────────────────

export async function listPendingUsers() {
  if (!isFirebaseConfigured()) return demoListPendingUsers();

  const db = await getFirebaseDb();
  const snap = await db.collection('users').where('status', '==', 'PENDING_APPROVAL').get();
  return snap.docs.map(d => ({ uid: d.id, ...(d.data() as FirestoreUser) }));
}

export async function listAllUsers() {
  if (!isFirebaseConfigured()) return demoListAllUsers();

  const db = await getFirebaseDb();
  const snap = await db.collection('users').orderBy('createdAt', 'desc').get();
  return snap.docs.map(d => ({ uid: d.id, ...(d.data() as FirestoreUser) }));
}

export async function adminApproveUser(uid: string) {
  if (!isFirebaseConfigured()) { demoAdminApproveUser(uid); return; }

  const db = await getFirebaseDb();
  await setUserStatus(uid, 'ACTIVE');
  await db.collection('admin_audit').add({ action: 'user_approved', uid, timestamp: new Date() });
}

export async function listWaitlistSignups() {
  if (!isFirebaseConfigured()) return demoListWaitlistSignups();

  const db = await getFirebaseDb();
  const snap = await db.collection('waitlist_signups').orderBy('createdAt', 'desc').get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
