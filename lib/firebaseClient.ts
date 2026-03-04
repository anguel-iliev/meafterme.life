// lib/firebaseClient.ts
// Firebase CLIENT SDK — runs in the browser, no Node.js needed.

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { getStorage, FirebaseStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId:     process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

export function isFirebaseClientConfigured(): boolean {
  return !!(firebaseConfig.apiKey && firebaseConfig.projectId);
}

let app: FirebaseApp;
let _db: Firestore;
let _auth: Auth;
let _storage: FirebaseStorage;

export function getFirebaseApp(): FirebaseApp {
  if (!app) {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  }
  return app;
}

export function getClientDb(): Firestore {
  if (!_db) _db = getFirestore(getFirebaseApp());
  return _db;
}

export function getClientAuth(): Auth {
  if (!_auth) _auth = getAuth(getFirebaseApp());
  return _auth;
}

export function getClientStorage(): FirebaseStorage {
  if (!_storage) {
    const bucket = firebaseConfig.storageBucket;
    // Pass bucket URL explicitly – supports both legacy (.appspot.com) and new (.firebasestorage.app) formats
    const bucketUrl = bucket
      ? (bucket.startsWith('gs://') ? bucket : `gs://${bucket}`)
      : undefined;
    _storage = bucketUrl
      ? getStorage(getFirebaseApp(), bucketUrl)
      : getStorage(getFirebaseApp());
  }
  return _storage;
}
