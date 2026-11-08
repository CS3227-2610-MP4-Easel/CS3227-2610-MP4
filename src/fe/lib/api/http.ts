'use client';
import { idToken, signOutUser } from '../auth/firebase';
import { ApiError } from './errors';

const PATH_OK = /^\/api\/[A-Za-z0-9._~\-/?=&%]*$/;

function samePath(path: string): boolean {
  if (!PATH_OK.test(path)) return false;
  const before = path.split('?')[0];
  const rest = before.slice('/api/'.length);
  if (/%2f|%5c/i.test(before) || rest.includes('//')) return false;
  // URL parsing resolves these segments (also percent-encoded) and would leave /api/.
  return !rest.split('/').some((s) => DOTS.includes(s.toLowerCase()));
}

const DOTS = ['.', '..', '%2e', '.%2e', '%2e.', '%2e%2e'];
const cut = (v: string, n: number) => v.slice(0, n);

function boundDetails(d: unknown): { field: string; message: string }[] {
  if (!Array.isArray(d)) return [];
  const out: { field: string; message: string }[] = [];
  for (const x of d) {
    if (out.length >= 50) break;
    if (x && typeof x === 'object' && typeof (x as { field?: unknown }).field === 'string' && typeof (x as { message?: unknown }).message === 'string') {
      out.push({ field: cut((x as { field: string }).field, 200), message: cut((x as { message: string }).message, 500) });
    }
  }
  return out;
}

function retryAfter(h: string | null): number | null {
  if (h === null || !/^\d+$/.test(h)) return null;
  const n = Number(h);
  return n >= 1 && n <= 3600 ? n : null;
}

const GENERIC = 'Something went wrong.';

export async function apiFetch<T>(
  path: string,
  init: { method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'; body?: unknown; auth?: boolean } = {},
): Promise<T> {
  if (!samePath(path)) throw new Error('apiFetch: path must be a same-origin /api/ path');
  const useAuth = init.auth ?? true;
  const headers: Record<string, string> = {};
  if (useAuth) {
    const t = await idToken();
    if (t === null) throw new ApiError('UNAUTHENTICATED', 'Authentication is required.', { status: 401 });
    headers.Authorization = `Bearer ${t}`;
  }
  let body: string | undefined;
  if (init.body !== undefined) {
    body = JSON.stringify(init.body);
    headers['Content-Type'] = 'application/json';
  }
  let res: Response;
  try {
    res = await fetch(path, { method: init.method ?? 'GET', headers, body, redirect: 'error', credentials: 'same-origin' });
  } catch {
    throw new ApiError('NETWORK', GENERIC, { status: 0 });
  }
  const status = res.status;
  const text = status === 204 ? '' : await res.text().catch(() => '');
  if (status >= 200 && status < 300) {
    if (text === '') return undefined as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new ApiError('INTERNAL', GENERIC, { status });
    }
  }
  const ra = retryAfter(res.headers.get('Retry-After'));
  if (status === 401 && useAuth) signOutUser().catch(() => {});
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = null;
  }
  const e = (parsed as { error?: { code?: unknown; message?: unknown; details?: unknown; requestId?: unknown } } | null)?.error;
  if (e && typeof e.code === 'string' && typeof e.message === 'string') {
    throw new ApiError(cut(e.code, 100), cut(e.message, 500), {
      status,
      details: boundDetails(e.details),
      requestId: typeof e.requestId === 'string' ? cut(e.requestId, 100) : null,
      retryAfterSeconds: ra,
    });
  }
  throw new ApiError('INTERNAL', GENERIC, { status, retryAfterSeconds: ra });
}
