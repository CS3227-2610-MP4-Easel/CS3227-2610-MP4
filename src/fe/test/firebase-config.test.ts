import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sdk = vi.hoisted(() => ({ initializeApp: vi.fn(), getApps: vi.fn(() => []), getApp: vi.fn(), getAuth: vi.fn() }));
vi.mock('@firebase/app', () => ({ initializeApp: sdk.initializeApp, getApps: sdk.getApps, getApp: sdk.getApp }));
vi.mock('@firebase/auth', () => ({
  getAuth: sdk.getAuth,
  onAuthStateChanged: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
}));

const NAMES = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID',
];

async function load() {
  vi.resetModules();
  return import('../lib/auth/firebase');
}

beforeEach(() => {
  for (const n of NAMES) vi.stubEnv(n, 'v');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('firebaseConfigured', () => {
  it('F2 is true when all four values are set', async () => {
    expect((await load()).firebaseConfigured()).toBe(true);
  });

  it('F2 is false when any one is empty or blank', async () => {
    for (const n of NAMES) {
      for (const v of ['', '  ']) {
        vi.stubEnv(n, v);
        expect((await load()).firebaseConfigured()).toBe(false);
        vi.stubEnv(n, 'v');
      }
    }
  });

  it('F2 importing the module does not throw or call the SDK', async () => {
    await load();
    expect(sdk.initializeApp).not.toHaveBeenCalled();
    expect(sdk.getApps).not.toHaveBeenCalled();
    expect(sdk.getAuth).not.toHaveBeenCalled();
  });

  it('F2 idToken and currentUser return null without touching the SDK when unconfigured', async () => {
    vi.stubEnv(NAMES[0], '');
    const m = await load();
    expect(m.currentUser()).toBeNull();
    expect(await m.idToken()).toBeNull();
    expect(sdk.getAuth).not.toHaveBeenCalled();
  });
});
