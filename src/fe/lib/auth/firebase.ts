'use client';
import { getApp, getApps, initializeApp } from '@firebase/app';
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from '@firebase/auth';

export type FbUser = { uid: string; email: string | null };

// Next.js inlines only literal process.env.NEXT_PUBLIC_* references, so each is spelled out.
function config() {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
}

export function firebaseConfigured(): boolean {
  return Object.values(config()).every((v) => (v ?? '').trim() !== '');
}

function auth() {
  const app = getApps().length ? getApp() : initializeApp(config());
  return getAuth(app);
}

const map = (u: { uid: string; email: string | null } | null): FbUser | null =>
  u ? { uid: u.uid, email: u.email } : null;

export function currentUser(): FbUser | null {
  if (!firebaseConfigured()) return null;
  return map(auth().currentUser);
}

export function onUserChanged(cb: (u: FbUser | null) => void): () => void {
  return onAuthStateChanged(auth(), (u) => cb(map(u)));
}

export async function signIn(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(auth(), email, password);
}

export async function signUp(email: string, password: string): Promise<void> {
  await createUserWithEmailAndPassword(auth(), email, password);
}

export async function signOutUser(): Promise<void> {
  await signOut(auth());
}

export async function idToken(): Promise<string | null> {
  if (!firebaseConfigured()) return null;
  const u = auth().currentUser;
  return u ? u.getIdToken() : null;
}
