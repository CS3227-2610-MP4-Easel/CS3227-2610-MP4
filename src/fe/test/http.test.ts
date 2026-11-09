import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const idToken = vi.fn();
const signOutUser = vi.fn();
vi.mock('../lib/auth/firebase', () => ({
  firebaseConfigured: () => true,
  currentUser: vi.fn(),
  onUserChanged: vi.fn(() => vi.fn()),
  signIn: vi.fn(),
  signUp: vi.fn(),
  signOutUser: (...a: unknown[]) => signOutUser(...a),
  idToken: (...a: unknown[]) => idToken(...a),
}));

import { apiFetch } from '../lib/api/http';
import { ApiError, checkCode_2, me_4, register_3 } from '../lib/api';

const fetchMock = vi.fn();

function reply(status: number, body: string, headers: Record<string, string> = {}) {
  fetchMock.mockResolvedValue(new Response(status === 204 ? null : body, { status, headers }));
}

async function fail(p: Promise<unknown>): Promise<ApiError> {
  try {
    await p;
  } catch (e) {
    return e as ApiError;
  }
  throw new Error('expected rejection');
}

beforeEach(() => {
  fetchMock.mockReset();
  idToken.mockReset();
  signOutUser.mockReset();
  signOutUser.mockResolvedValue(undefined);
  idToken.mockResolvedValue('tok123');
  vi.stubGlobal('fetch', fetchMock);
  reply(200, '{"ok":true}');
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('apiFetch', () => {
  it('E60 rejects non same-origin or traversal paths before idToken and fetch', async () => {
    const bad = [
      'https://evil.example/api/me',
      '//evil/api',
      '/other',
      '/api',
      '/apix',
      '/\\evil',
      '/api/../x',
      '/api/a b',
      '/api/a\nb',
      '/api/./x',
      '/api/a//b',
      '/api/a/../b',
      '/api/%2e%2e/x',
      '/api/%2E%2e/x',
      '/api/..',
      '/api/a/..',
      '/api/.',
      '/api/..?x',
      '/api/a%2fb',
      '/api/a%5Cb',
      '/api/.%2e/x',
      '/api/%2e./x',
    ];
    for (const p of bad) {
      await expect(apiFetch(p)).rejects.toThrow('apiFetch: path must be a same-origin /api/ path');
    }
    await expect(apiFetch('/api/%2e%2e/x', { auth: false })).rejects.toThrow('apiFetch: path must be');
    expect(idToken).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('E60 ordinary paths with a query pass', async () => {
    await apiFetch('/api/a/b.c?x=1&y=%20');
    expect(fetchMock.mock.calls[0][0]).toBe('/api/a/b.c?x=1&y=%20');
  });

  it('E61 attaches the bearer token, redirect error, and keeps the token out of the URL', async () => {
    await apiFetch('/api/me');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/me');
    expect(url).not.toContain('tok123');
    expect(init.headers.Authorization).toBe('Bearer tok123');
    expect(init.redirect).toBe('error');
    expect(init.credentials).toBe('same-origin');
    expect(init.method).toBe('GET');
    expect(init.body).toBeUndefined();
    expect(init.headers['Content-Type']).toBeUndefined();
    expect(Object.entries(init.headers).filter(([k, v]) => k !== 'Authorization' && String(v).includes('tok123'))).toEqual([]);
  });

  it('E61 the token is not in the body', async () => {
    await apiFetch('/api/x', { method: 'POST', body: { a: 1 } });
    expect(fetchMock.mock.calls[0][1].body).not.toContain('tok123');
  });

  it('E88 auth false sends no Authorization and a JSON body', async () => {
    await apiFetch('/api/x', { method: 'POST', body: { a: 1 }, auth: false });
    const init = fetchMock.mock.calls[0][1];
    expect(init.headers.Authorization).toBeUndefined();
    expect(idToken).not.toHaveBeenCalled();
    expect(init.body).toBe('{"a":1}');
    expect(init.headers['Content-Type']).toBe('application/json');
  });

  it('E62 maps an error body to ApiError with details and requestId', async () => {
    const details = [
      { field: 'a', message: 'bad a' },
      { field: 'b', message: 'bad b' },
    ];
    reply(422, JSON.stringify({ error: { code: 'VALIDATION_FAILED', message: 'Invalid', details, requestId: 'r1' } }));
    const e = await fail(apiFetch('/api/x'));
    expect(e).toBeInstanceOf(ApiError);
    expect(e.code).toBe('VALIDATION_FAILED');
    expect(e.status).toBe(422);
    expect(e.details).toEqual(details);
    expect(e.requestId).toBe('r1');
  });

  it('E63 parses Retry-After only for integers 1 to 3600', async () => {
    const cases: [string | null, number | null][] = [
      ['42', 42],
      ['1', 1],
      ['3600', 3600],
      ['-1', null],
      ['0', null],
      ['3601', null],
      ['3.5', null],
      ['abc', null],
      ['', null],
      [null, null],
    ];
    for (const [h, want] of cases) {
      reply(429, '{"error":{"code":"RATE_LIMITED","message":"slow"}}', h === null ? {} : { 'Retry-After': h });
      const e = await fail(apiFetch('/api/x'));
      expect(e.retryAfterSeconds).toBe(want);
    }
  });

  it('E63 a Retry-After with surrounding space is rejected', async () => {
    // Headers trims values, so hand fetch a response-like object that keeps the space.
    fetchMock.mockResolvedValue({ status: 429, text: async () => '', headers: { get: () => ' 42' } });
    expect((await fail(apiFetch('/api/x'))).retryAfterSeconds).toBeNull();
  });

  it('E64 a 502 HTML body becomes INTERNAL and a rejected fetch becomes NETWORK', async () => {
    reply(502, '<html>bad gateway</html>');
    const a = await fail(apiFetch('/api/x'));
    expect([a.code, a.status]).toEqual(['INTERNAL', 502]);
    fetchMock.mockRejectedValue(new TypeError('offline'));
    const b = await fail(apiFetch('/api/x'));
    expect([b.code, b.status]).toEqual(['NETWORK', 0]);
  });

  it('E89 handles 204, an empty 200 and an unparseable 200', async () => {
    reply(204, '');
    expect(await apiFetch('/api/x')).toBeUndefined();
    reply(200, '');
    expect(await apiFetch('/api/x')).toBeUndefined();
    reply(200, 'not json');
    const e = await fail(apiFetch('/api/x'));
    expect([e.code, e.status]).toEqual(['INTERNAL', 200]);
  });

  it('E65 a missing token gives UNAUTHENTICATED with no request and no sign-out', async () => {
    idToken.mockResolvedValue(null);
    const e = await fail(apiFetch('/api/me'));
    expect([e.code, e.status]).toEqual(['UNAUTHENTICATED', 401]);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(signOutUser).not.toHaveBeenCalled();
  });

  it('E90 an authenticated 401 starts sign-out once and still rejects', async () => {
    reply(401, '{"error":{"code":"UNAUTHENTICATED","message":"no"}}');
    const e = await fail(apiFetch('/api/me'));
    expect(e).toBeInstanceOf(ApiError);
    expect(e.status).toBe(401);
    expect(signOutUser).toHaveBeenCalledTimes(1);
  });

  // Removing the .catch in apiFetch makes vitest fail this file on the unhandled rejection.
  it('E90 a rejected sign-out does not change the thrown error', async () => {
    signOutUser.mockRejectedValue(new Error('x'));
    reply(401, '');
    const e = await fail(apiFetch('/api/me'));
    expect(e.status).toBe(401);
  });

  it('E91 a 401 with auth false rejects without sign-out', async () => {
    reply(401, '{"error":{"code":"UNAUTHENTICATED","message":"no"}}');
    const e = await fail(apiFetch('/api/x', { auth: false }));
    expect(e.status).toBe(401);
    expect(signOutUser).not.toHaveBeenCalled();
  });

  it('E92 no console method receives the token, code or password', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug', 'trace', 'dir', 'table'] as const).map((m) => vi.spyOn(console, m));
    await apiFetch('/api/x', { method: 'POST', body: { code: 'SECRETCODE', password: 'pw-secret' } });
    reply(500, '{"error":{"code":"X","message":"m"}}');
    await fail(apiFetch('/api/x', { method: 'POST', body: { code: 'SECRETCODE' } }));
    reply(401, '{"error":{"code":"U","message":"m"}}');
    await fail(apiFetch('/api/x', { method: 'POST', body: { code: 'SECRETCODE' } }));
    expect(signOutUser).toHaveBeenCalledTimes(1);
    const seen = JSON.stringify(spies.flatMap((s) => s.mock.calls));
    for (const s of ['tok123', 'SECRETCODE', 'pw-secret']) expect(seen).not.toContain(s);
  });
});

describe('error body mapping', () => {
  it('E62 a JSON body without error maps to INTERNAL', async () => {
    reply(400, '{"x":1}');
    expect((await fail(apiFetch('/api/x'))).code).toBe('INTERNAL');
  });

  it('E62 a non-string code maps to INTERNAL', async () => {
    reply(400, '{"error":{"code":5,"message":"m"}}');
    expect((await fail(apiFetch('/api/x'))).code).toBe('INTERNAL');
  });

  it('E62 missing details and requestId give [] and null', async () => {
    reply(400, '{"error":{"code":"C","message":"m"}}');
    const e = await fail(apiFetch('/api/x'));
    expect([e.details, e.requestId]).toEqual([[], null]);
  });

  it('E63 a non-2xx INTERNAL still carries retryAfterSeconds', async () => {
    reply(503, 'down', { 'Retry-After': '7' });
    const e = await fail(apiFetch('/api/x'));
    expect([e.code, e.retryAfterSeconds]).toEqual(['INTERNAL', 7]);
  });

  it('E62 server fields are truncated and details bounded', async () => {
    const details = [
      ...Array.from({ length: 60 }, () => ({ field: 'f'.repeat(300), message: 'm'.repeat(600) })),
    ];
    details.unshift(null as never, { x: 1 } as never);
    reply(400, JSON.stringify({ error: { code: 'c'.repeat(200), message: 'm'.repeat(900), requestId: 'r'.repeat(200), details } }));
    const e = await fail(apiFetch('/api/x'));
    expect(e.code).toHaveLength(100);
    expect(e.message).toHaveLength(500);
    expect(e.requestId).toHaveLength(100);
    expect(e.details).toHaveLength(50);
    expect(e.details[0].field).toHaveLength(200);
    expect(e.details[0].message).toHaveLength(500);
  });
});

describe('ApiError', () => {
  it('E93 the two-argument form keeps defaults', () => {
    const e = new ApiError('X', 'm');
    expect([e.code, e.message, e.status, e.details, e.requestId, e.retryAfterSeconds]).toEqual(['X', 'm', 0, [], null, null]);
  });
});

describe('endpoints', () => {
  it('F2 checkCode_2 posts the trimmed code without auth', async () => {
    reply(204, '');
    await checkCode_2('PM', '  abc ');
    const [url, init] = fetchMock.mock.calls[0];
    expect([url, init.method, init.body]).toEqual(['/api/auth/check-code', 'POST', '{"role":"PM","code":"abc"}']);
    expect(init.headers.Authorization).toBeUndefined();
  });

  it('F2 register_3 posts trimmed code and name with auth', async () => {
    reply(200, '{"id":"1","email":"a@b.c","displayName":"Ann","role":"PM"}');
    const u = await register_3('PM', ' c1 ', ' Ann ');
    const [url, init] = fetchMock.mock.calls[0];
    expect([url, init.method, init.body]).toEqual(['/api/auth/register', 'POST', '{"role":"PM","code":"c1","displayName":"Ann"}']);
    expect(init.headers.Authorization).toBe('Bearer tok123');
    expect(u.displayName).toBe('Ann');
  });

  it('F2 me_4 gets /api/me', async () => {
    reply(200, '{"id":"1","email":"a@b.c","displayName":"Ann","role":"DEVELOPER"}');
    const u = await me_4();
    const [url, init] = fetchMock.mock.calls[0];
    expect([url, init.method]).toEqual(['/api/me', 'GET']);
    expect(u.role).toBe('DEVELOPER');
  });
});
