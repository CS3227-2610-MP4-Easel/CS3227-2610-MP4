// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../app/api/as/route';
import { FIREBASE_KEYS } from '../lib/auth/mode';

const call = (qs: string) => GET(new NextRequest(`http://localhost:3100/api/as?${qs}`));

function prototypeEnv() {
  vi.stubEnv('APP_TIER', 'preview');
  vi.stubEnv('VERCEL_ENV', '');
  for (const k of FIREBASE_KEYS) vi.stubEnv(k, '');
}

afterEach(() => vi.unstubAllEnvs());

describe('/api/as', () => {
  it('E59 404 with no cookie in firebase mode', async () => {
    vi.stubEnv('APP_TIER', 'prod');
    for (const k of FIREBASE_KEYS) vi.stubEnv(k, 'x');
    const res = await call('role=pm&to=/projects');
    expect(res.status).toBe(404);
    expect(res.headers.get('set-cookie')).toBeNull();
  });

  it('E59 404 with no cookie in unconfigured mode', async () => {
    vi.stubEnv('APP_TIER', 'dev');
    for (const k of FIREBASE_KEYS) vi.stubEnv(k, '');
    const res = await call('role=pm&to=/projects');
    expect(res.status).toBe(404);
    expect(res.headers.get('set-cookie')).toBeNull();
  });

  it('E86 prototype sets the role cookie and redirects on-site', async () => {
    prototypeEnv();
    const res = await call('role=lead&to=/lead/overview');
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get('location')!).pathname).toBe('/lead/overview');
    expect(res.headers.get('set-cookie')).toContain('role=lead');
  });

  it.each(['/\\evil.com', '/%5Cevil.com', '/%5cevil.com', '//evil.com', 'https://evil.com'])(
    'E87 %s redirects to same-origin /projects',
    async (to) => {
      prototypeEnv();
      const res = await call(`role=pm&to=${encodeURIComponent(to)}`);
      const u = new URL(res.headers.get('location')!);
      expect(u.origin).toBe('http://localhost:3100');
      expect(u.pathname).toBe('/projects');
    },
  );
});
