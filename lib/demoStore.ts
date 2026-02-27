// lib/demoStore.ts
// In-memory store used when Firebase credentials are NOT configured.
// Tokens persist to a temp JSON file to survive PM2 restarts in dev/demo mode.

import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { UserStatus } from './auth';

export function isFirebaseConfigured(): boolean {
  return !!(
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY_B64
  );
}

// ─── Persistent file store for tokens (survives restarts) ────────────────────

const STORE_FILE = path.join(os.tmpdir(), 'meafterme_demo_tokens.json');

interface PersistedStore {
  magicLinks: Record<string, { email: string; used: boolean; expiresAt: string }>;
  users: Record<string, { uid: string; email: string; status: UserStatus; createdAt: string; updatedAt: string }>;
  waitlist: Record<string, { id: string; email: string; createdAt: string; earlyAccess: boolean }>;
  inviteCodes: Record<string, { id: string; code: string; used: boolean; usedByEmail?: string; createdAt: string; createdBy: string }>;
}

function loadStore(): PersistedStore {
  try {
    if (fs.existsSync(STORE_FILE)) {
      return JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
    }
  } catch {}
  return {
    magicLinks: {},
    users: {
      'demo-admin-uid': {
        uid: 'demo-admin-uid',
        email: 'admin@afterme.life',
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    },
    waitlist: {},
    inviteCodes: {
      'demo-code-1': { id: 'demo-code-1', code: 'DEMO2026', used: false, createdAt: new Date().toISOString(), createdBy: 'admin' },
    },
  };
}

function saveStore(store: PersistedStore): void {
  try {
    fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), 'utf8');
  } catch (e) {
    console.warn('Demo store save failed:', e);
  }
}

// ─── User helpers ─────────────────────────────────────────────────────────────

export function demoFindOrCreateUser(email: string): { uid: string; status: UserStatus; isNew: boolean } {
  const store = loadStore();
  for (const u of Object.values(store.users)) {
    if (u.email === email) return { uid: u.uid, status: u.status, isNew: false };
  }
  const uid = 'demo-' + uuidv4().slice(0, 8);
  const now = new Date().toISOString();
  // New users → ACTIVE immediately in demo mode (so they can explore the app)
  store.users[uid] = { uid, email, status: 'ACTIVE', createdAt: now, updatedAt: now };
  saveStore(store);
  return { uid, status: 'ACTIVE', isNew: true };
}

export function demoGetUserByEmail(email: string) {
  const store = loadStore();
  return Object.values(store.users).find(u => u.email === email) ?? null;
}

export function demoGetUserById(uid: string) {
  const store = loadStore();
  return store.users[uid] ?? null;
}

export function demoSetUserStatus(uid: string, status: UserStatus): void {
  const store = loadStore();
  if (store.users[uid]) {
    store.users[uid].status = status;
    store.users[uid].updatedAt = new Date().toISOString();
    saveStore(store);
  }
}

// ─── Magic links ──────────────────────────────────────────────────────────────

export function demoCreateMagicLinkToken(email: string): string {
  const store = loadStore();
  const token = uuidv4();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour in demo
  store.magicLinks[token] = { email, used: false, expiresAt };
  saveStore(store);
  return token;
}

export function demoVerifyMagicLinkToken(token: string): string | null {
  const store = loadStore();
  const link = store.magicLinks[token];
  if (!link) return null;
  if (link.used) return null;
  if (new Date() > new Date(link.expiresAt)) return null;
  link.used = true;
  saveStore(store);
  return link.email;
}

// ─── Waitlist ─────────────────────────────────────────────────────────────────

export function demoAddWaitlistSignup(email: string): 'new' | 'existing' {
  const store = loadStore();
  for (const s of Object.values(store.waitlist)) {
    if (s.email === email) return 'existing';
  }
  const id = uuidv4();
  store.waitlist[id] = { id, email, createdAt: new Date().toISOString(), earlyAccess: false };
  saveStore(store);
  return 'new';
}

export function demoListWaitlistSignups() {
  const store = loadStore();
  return Object.values(store.waitlist).sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

// ─── Invite codes ─────────────────────────────────────────────────────────────

export function demoRedeemInviteCode(code: string, email: string): 'ok' | 'invalid' | 'used' {
  const store = loadStore();
  const upper = code.trim().toUpperCase();
  for (const c of Object.values(store.inviteCodes)) {
    if (c.code === upper) {
      if (c.used) return 'used';
      c.used = true;
      c.usedByEmail = email;
      // Set user to PENDING_APPROVAL
      for (const u of Object.values(store.users)) {
        if (u.email === email) { u.status = 'PENDING_APPROVAL'; break; }
      }
      saveStore(store);
      return 'ok';
    }
  }
  return 'invalid';
}

export function demoCreateInviteCode(code?: string): string {
  const store = loadStore();
  const finalCode = (code || uuidv4().slice(0, 8)).toUpperCase();
  const id = uuidv4();
  store.inviteCodes[id] = { id, code: finalCode, used: false, createdAt: new Date().toISOString(), createdBy: 'admin' };
  saveStore(store);
  return finalCode;
}

export function demoListInviteCodes() {
  const store = loadStore();
  return Object.values(store.inviteCodes).sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

// ─── Admin ────────────────────────────────────────────────────────────────────

export function demoListPendingUsers() {
  const store = loadStore();
  return Object.values(store.users).filter(u => u.status === 'PENDING_APPROVAL');
}

export function demoListAllUsers() {
  const store = loadStore();
  return Object.values(store.users).sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function demoAdminApproveUser(uid: string): void {
  demoSetUserStatus(uid, 'ACTIVE');
}

// ─── Contact ──────────────────────────────────────────────────────────────────

const contactMessages: any[] = [];
export function demoAddContactMessage(data: any): void {
  contactMessages.push({ ...data, createdAt: new Date().toISOString(), id: uuidv4() });
}
