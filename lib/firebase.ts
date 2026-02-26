// lib/firebase.ts
// Firebase Admin SDK initialization – safe to import from any server component or API route.
// Uses FIREBASE_PRIVATE_KEY_B64 to avoid multiline env var issues in cPanel.

import admin from 'firebase-admin';

function getPrivateKey(): string {
  const b64 = process.env.FIREBASE_PRIVATE_KEY_B64;
  if (!b64) {
    throw new Error('Missing FIREBASE_PRIVATE_KEY_B64 environment variable');
  }
  return Buffer.from(b64, 'base64').toString('utf8');
}

function initFirebase() {
  if (admin.apps.length > 0) {
    return admin.app();
  }
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  if (!projectId || !clientEmail) {
    throw new Error('Missing FIREBASE_PROJECT_ID or FIREBASE_CLIENT_EMAIL');
  }
  return admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey: getPrivateKey(),
    }),
  });
}

// Lazily initialised – safe in Next.js module graph
let _db: admin.firestore.Firestore | null = null;

export function getDb(): admin.firestore.Firestore {
  if (!_db) {
    initFirebase();
    _db = admin.firestore();
  }
  return _db;
}

export default admin;
