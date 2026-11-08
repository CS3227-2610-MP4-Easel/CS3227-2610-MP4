import { beforeEach, describe, expect, it, vi } from 'vitest';

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

  it('F2 importing the module does not throw or start the SDK', async () => {
    await expect(load()).resolves.toBeDefined();
  });
});
