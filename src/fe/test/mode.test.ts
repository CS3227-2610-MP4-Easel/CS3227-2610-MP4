import { describe, it, expect } from 'vitest';
import { authMode, FIREBASE_KEYS } from '../lib/auth/mode';
import { isProjectUuid, projectRoute } from '../lib/api/project-mode';
import { routeFor } from '../lib/nav';
import { resolve, routeOf } from '../lib/screens';

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

  it('E84 trimmed tier, blank VERCEL_ENV, production variants, partial whitespace', () => {
    expect(authMode({ APP_TIER: ' preview ' })).toBe('prototype');
    expect(authMode({ APP_TIER: 'preview', VERCEL_ENV: '  ' })).toBe('prototype');
    expect(authMode({ APP_TIER: 'preview', VERCEL_ENV: ' production ' })).toBe('unconfigured');
    expect(authMode({ APP_TIER: 'preview', VERCEL_ENV: 'Production' })).toBe('unconfigured');
    const three = Object.fromEntries(FIREBASE_KEYS.slice(0, 3).map((k) => [k, 'x']));
    expect(authMode({ APP_TIER: 'prod', ...three, [FIREBASE_KEYS[3]]: '  ' })).toBe('unconfigured');
  });

  it('E85 tier is case-sensitive and production VERCEL_ENV blocks prototype', () => {
    expect(authMode({ APP_TIER: 'PREVIEW' })).toBe('unconfigured');
    expect(authMode({ APP_TIER: 'preview', VERCEL_ENV: 'production' })).toBe('unconfigured');
  });
});

describe('project route mode', () => {
  it('F7 accepts only RFC4122 version 1-5 UUID project ids', () => {
    expect(isProjectUuid('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    expect(isProjectUuid('550E8400-E29B-41D4-A716-446655440000')).toBe(true);
    expect(isProjectUuid('550e8400-e29b-61d4-a716-446655440000')).toBe(false);
    expect(isProjectUuid('550e8400-e29b-41d4-c716-446655440000')).toBe(false);
    expect(isProjectUuid('p1')).toBe(false);
  });

  it('F8 selects live mode only for the UUID project segment', () => {
    expect(projectRoute('/projects/550e8400-e29b-41d4-a716-446655440000/health')).toMatchObject({
      mode: 'live',
      projectId: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(projectRoute('/projects/p1/health')).toMatchObject({ mode: 'prototype', projectId: null });
  });

  it('N1 preserves the route project id when translating canvas links', () => {
    expect(routeOf('Health.dc.html', '550e8400-e29b-41d4-a716-446655440000')).toBe('/projects/550e8400-e29b-41d4-a716-446655440000/health');
    expect(routeFor('Board.dc.html', '550e8400-e29b-41d4-a716-446655440000')).toBe('/projects/550e8400-e29b-41d4-a716-446655440000/board');
  });

  it('E14 rejects role-excluded state and mutation-dialog URLs', () => {
    expect(resolve('/projects/p1/settings', undefined, 'dev')).toEqual({ forbidden: true });
    expect(resolve('/projects/p1/backlog', 'add-task', 'dev')).toEqual({ forbidden: true });
    expect(resolve('/projects/p1/sprints', 'new', 'pm')).toEqual({ forbidden: true });
  });
});
