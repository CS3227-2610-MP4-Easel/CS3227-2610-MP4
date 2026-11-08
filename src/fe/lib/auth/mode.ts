export type AuthMode = 'firebase' | 'prototype' | 'unconfigured';

export const FIREBASE_KEYS = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID',
] as const;

const present = (v: string | undefined) => (v ?? '').trim() !== '';

// Fails closed: only an explicit preview tier with no Firebase values and not on Vercel production is prototype.
export function authMode(env: Record<string, string | undefined>): AuthMode {
  const count = FIREBASE_KEYS.filter((k) => present(env[k])).length;
  if (count === FIREBASE_KEYS.length) return 'firebase';
  if (count === 0 && env.APP_TIER === 'preview' && (env.VERCEL_ENV ?? '').trim() !== 'production') {
    return 'prototype';
  }
  return 'unconfigured';
}
