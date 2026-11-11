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
    const u = new URL(res.headers.get('location')!);
    expect(u.origin).toBe('http://localhost:3100');
    expect(u.pathname).toBe('/lead/overview');
    const cookie = res.headers.get('set-cookie')!;
    expect(cookie).toContain('role=lead');
    expect(cookie).toMatch(/httponly/i);
    expect(cookie).toMatch(/samesite=lax/i);
  });

  it('E86 same-site target keeps its query and hash', async () => {
    prototypeEnv();
    const res = await call(`role=pm&to=${encodeURIComponent('/lead/overview?a=1#h')}`);
    const u = new URL(res.headers.get('location')!);
    expect(u.pathname).toBe('/lead/overview');
    expect(u.search).toBe('?a=1');
    expect(u.hash).toBe('#h');
  });

  it('E86 role=out deletes the cookie', async () => {
    prototypeEnv();
    const res = await call('role=out');
    expect(res.headers.get('set-cookie')).toMatch(/role=;/);
  });

  it('E86 unknown role sets no cookie', async () => {
    prototypeEnv();
    const res = await call('role=admin');
    expect(res.headers.get('set-cookie')).toBeNull();
  });

  it('E59 404 with no cookie for role=out outside prototype', async () => {
    vi.stubEnv('APP_TIER', 'dev');
    for (const k of FIREBASE_KEYS) vi.stubEnv(k, '');
    const res = await call('role=out');
    expect(res.status).toBe(404);
    expect(res.headers.get('set-cookie')).toBeNull();
  });

  it('E87 a malformed target redirects to /projects and still sets the cookie', async () => {
    prototypeEnv();
    const res = await call(`role=pm&to=${encodeURIComponent('http://[')}`);
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get('location')!).pathname).toBe('/projects');
    expect(res.headers.get('set-cookie')).toContain('role=pm');
  });

  it.each([
    '/\\evil.com',
    '/%5Cevil.com',
    '/%5cevil.com',
    '//evil.com',
    'https://evil.com',
    '/.//evil.com',
    '/a/..//evil.com',
    '/..//evil.com',
  ])('E87 %s redirects to same-origin /projects', async (to) => {
    prototypeEnv();
    const res = await call(`role=pm&to=${encodeURIComponent(to)}`);
    expect(res.status).toBe(307);
    const u = new URL(res.headers.get('location')!);
    expect(u.origin).toBe('http://localhost:3100');
    expect(u.pathname).toBe('/projects');
    expect(u.search + u.hash).toBe('');
  });
});
