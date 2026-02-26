// lib/auth.ts
// Server-side auth helpers: create/verify magic-link tokens, check user status.

import { getDb } from './firebase';
import { v4 as uuidv4 } from 'uuid';

const MAGIC_LINK_TTL_MS = 30 * 60 * 1000; // 30 minutes

// ─── Users ───────────────────────────────────────────────────────────────────

export type UserStatus = 'WAITLISTED' | 'PENDING_APPROVAL' | 'ACTIVE';

export interface FirestoreUser {
  email: string;
  status: UserStatus;
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
}

export async function findOrCreateUser(email: string): Promise<{ uid: string; status: UserStatus; isNew: boolean }> {
  const db = getDb();
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
  const db = getDb();
  const snap = await db.collection('users').where('email', '==', email).limit(1).get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { uid: doc.id, ...(doc.data() as FirestoreUser) };
}

export async function getUserById(uid: string) {
  const db = getDb();
  const doc = await db.collection('users').doc(uid).get();
  if (!doc.exists) return null;
  return { uid: doc.id, ...(doc.data() as FirestoreUser) };
}

export async function setUserStatus(uid: string, status: UserStatus) {
  const db = getDb();
  await db.collection('users').doc(uid).update({ status, updatedAt: new Date() });
}

// ─── Magic links ─────────────────────────────────────────────────────────────

export async function createMagicLinkToken(email: string): Promise<string> {
  const db = getDb();
  const token = uuidv4();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + MAGIC_LINK_TTL_MS);
  await db.collection('magic_links').doc(token).set({
    email,
    used: false,
    createdAt: now,
    expiresAt,
  });
  return token;
}

export async function verifyMagicLinkToken(token: string): Promise<string | null> {
  const db = getDb();
  const ref = db.collection('magic_links').doc(token);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const data = snap.data()!;
  if (data.used) return null;
  const expiresAt: Date = data.expiresAt.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt);
  if (new Date() > expiresAt) return null;
  // Mark as used
  await ref.update({ used: true, usedAt: new Date() });
  return data.email as string;
}

// ─── Waitlist signups ─────────────────────────────────────────────────────────

export async function addWaitlistSignup(email: string): Promise<'new' | 'existing'> {
  const db = getDb();
  const snap = await db.collection('waitlist_signups').where('email', '==', email).limit(1).get();
  if (!snap.empty) return 'existing';
  await db.collection('waitlist_signups').add({
    email,
    createdAt: new Date(),
    earlyAccess: false,
  });
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
  const db = getDb();
  const snap = await db.collection('invite_codes').where('code', '==', code.trim().toUpperCase()).limit(1).get();
  if (snap.empty) return 'invalid';
  const doc = snap.docs[0];
  const data = doc.data() as InviteCode;
  if (data.used) return 'used';
  // Mark used
  await doc.ref.update({ used: true, usedByEmail: email, usedAt: new Date() });
  // Update user to PENDING_APPROVAL
  const user = await getUserByEmail(email);
  if (user) {
    await setUserStatus(user.uid, 'PENDING_APPROVAL');
    // Admin audit log
    await db.collection('admin_audit').add({
      action: 'invite_code_redeemed',
      email,
      code,
      timestamp: new Date(),
    });
  }
  return 'ok';
}

export async function createInviteCode(code?: string, createdBy?: string): Promise<string> {
  const db = getDb();
  const finalCode = (code || uuidv4().slice(0, 8)).toUpperCase();
  await db.collection('invite_codes').add({
    code: finalCode,
    used: false,
    createdAt: new Date(),
    createdBy: createdBy || 'admin',
  });
  return finalCode;
}

export async function listInviteCodes() {
  const db = getDb();
  const snap = await db.collection('invite_codes').orderBy('createdAt', 'desc').get();
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as InviteCode) }));
}

// ─── Admin ────────────────────────────────────────────────────────────────────

export async function listPendingUsers() {
  const db = getDb();
  const snap = await db.collection('users').where('status', '==', 'PENDING_APPROVAL').get();
  return snap.docs.map(d => ({ uid: d.id, ...(d.data() as FirestoreUser) }));
}

export async function listAllUsers() {
  const db = getDb();
  const snap = await db.collection('users').orderBy('createdAt', 'desc').get();
  return snap.docs.map(d => ({ uid: d.id, ...(d.data() as FirestoreUser) }));
}

export async function adminApproveUser(uid: string) {
  const db = getDb();
  await setUserStatus(uid, 'ACTIVE');
  await db.collection('admin_audit').add({
    action: 'user_approved',
    uid,
    timestamp: new Date(),
  });
}

export async function listWaitlistSignups() {
  const db = getDb();
  const snap = await db.collection('waitlist_signups').orderBy('createdAt', 'desc').get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
