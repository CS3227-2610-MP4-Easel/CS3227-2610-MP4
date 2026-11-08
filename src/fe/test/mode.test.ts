import { describe, it, expect } from 'vitest';
import { authMode, FIREBASE_KEYS } from '../lib/auth/mode';

const all = Object.fromEntries(FIREBASE_KEYS.map((k) => [k, 'x']));

describe('authMode', () => {
  it('E56 firebase when all four values are set, any tier', () => {
    expect(authMode({ APP_TIER: 'prod', ...all })).toBe('firebase');
    expect(authMode({ APP_TIER: 'other', ...all })).toBe('firebase');
  });

  it('E57 prototype on preview with none set', () => {
    expect(authMode({ APP_TIER: 'preview' })).toBe('prototype');
    expect(authMode({ APP_TIER: 'preview', VERCEL_ENV: 'preview' })).toBe('prototype');
  });

  it('E58 unconfigured for every other combination', () => {
    expect(authMode({ APP_TIER: 'dev' })).toBe('unconfigured');
    expect(authMode({})).toBe('unconfigured');
    for (let n = 1; n <= 3; n++) {
      const some = Object.fromEntries(FIREBASE_KEYS.slice(0, n).map((k) => [k, 'x']));
      expect(authMode({ APP_TIER: 'prod', ...some })).toBe('unconfigured');
    }
    for (const missing of FIREBASE_KEYS) {
      const rest = Object.fromEntries(FIREBASE_KEYS.filter((k) => k !== missing).map((k) => [k, 'x']));
      expect(authMode({ APP_TIER: 'preview', ...rest })).toBe('unconfigured');
    }
  });

  it('E84 whitespace values count as absent', () => {
    const blanks = Object.fromEntries(FIREBASE_KEYS.map((k) => [k, '  ']));
    expect(authMode({ APP_TIER: 'preview', ...blanks })).toBe('prototype');
    expect(authMode({ APP_TIER: 'prod', ...blanks })).toBe('unconfigured');
  });

  it('E85 tier is case-sensitive and production VERCEL_ENV blocks prototype', () => {
    expect(authMode({ APP_TIER: 'PREVIEW' })).toBe('unconfigured');
    expect(authMode({ APP_TIER: 'preview', VERCEL_ENV: 'production' })).toBe('unconfigured');
  });
});
