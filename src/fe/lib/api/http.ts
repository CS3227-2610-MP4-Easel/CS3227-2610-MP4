'use client';
import { idToken, signOutUser } from '../auth/firebase';
import { ApiError, type ApiErrorDetail } from './errors';

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

function boundDetails(d: unknown): ApiErrorDetail[] {
  const candidates = Array.isArray(d) ? d : d && typeof d === 'object' ? [d] : [];
  const out: ApiErrorDetail[] = [];
  for (const x of candidates) {
    if (out.length >= 50) break;
    if (x && typeof x === 'object' && typeof (x as { field?: unknown }).field === 'string' && typeof (x as { message?: unknown }).message === 'string') {
      out.push({ field: cut((x as { field: string }).field, 200), message: cut((x as { message: string }).message, 500) });
      continue;
    }
    if (x && typeof x === 'object' && Array.isArray((x as { suggestionIds?: unknown }).suggestionIds)) {
      const suggestionIds = (x as { suggestionIds: unknown[] }).suggestionIds
        .filter((id): id is string => typeof id === 'string')
        .slice(0, 100)
        .map((id) => cut(id, 100));
      out.push({ field: 'suggestionIds', message: 'The selected suggestions are not valid.', suggestionIds });
    }
  }
  return out;
}

function retryAfter(h: string | null): number | null {
  if (h === null || !/^\d+$/.test(h)) return null;
  const n = Number(h);
  return n >= 1 && n <= 3600 ? n : null;
}

const GENERIC = 'Something went wrong. Try again.';
const SAFE_CODES = new Set([
  'FORBIDDEN_ROLE', 'FORBIDDEN', 'NOT_FOUND', 'CONFLICT_VERSION', 'CONFLICT_STATE',
  'VALIDATION_FAILED', 'RATE_LIMITED', 'NETWORK', 'INTERNAL', 'INTERNAL_ERROR',
  // Auth flows use these bounded codes to select their fixed UI state.
  'UNAUTHENTICATED', 'USER_NOT_REGISTERED', 'REGISTRATION_CODE_INVALID', 'ALREADY_REGISTERED',
]);

function errorCode(status: number, code: unknown): string {
  if (typeof code === 'string' && SAFE_CODES.has(code)) return code;
  if (status === 401) return 'UNAUTHENTICATED';
  if (status === 403) return 'FORBIDDEN';
  if (status === 404) return 'NOT_FOUND';
  if (status === 409) return 'CONFLICT_STATE';
  if (status === 422) return 'VALIDATION_FAILED';
  if (status === 429) return 'RATE_LIMITED';
  return status >= 500 ? 'INTERNAL' : 'INTERNAL_ERROR';
}

function errorMessage(status: number, code: string): string {
  if (status >= 500 || code === 'NETWORK' || code === 'INTERNAL' || code === 'INTERNAL_ERROR') return GENERIC;
  if (status === 401) return 'Authentication is required.';
  if (status === 403) return 'You do not have permission to view this.';
  if (status === 404) return 'This project or task was not found.';
  if (status === 409) return 'This changed elsewhere. Reload before trying again.';
  if (status === 422) return 'Check the highlighted fields.';
  if (status === 429) return 'Please wait before trying again.';
  if (code === 'UNAUTHENTICATED') return 'Authentication is required.';
  if (code === 'FORBIDDEN' || code === 'FORBIDDEN_ROLE') return 'You do not have permission to view this.';
  if (code === 'NOT_FOUND') return 'This project or task was not found.';
  if (code === 'CONFLICT_VERSION' || code === 'CONFLICT_STATE' || code === 'ALREADY_REGISTERED') return 'This changed elsewhere. Reload before trying again.';
  if (code === 'VALIDATION_FAILED') return 'Check the highlighted fields.';
  if (code === 'RATE_LIMITED') return 'Please wait before trying again.';
  return GENERIC;
}

export async function apiFetch<T>(
  path: string,
  init: { method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'; body?: unknown; auth?: boolean } = {},
): Promise<T> {
  if (!samePath(path)) throw new Error('apiFetch: path must be a same-origin /api/ path');
  const useAuth = init.auth ?? true;
  const headers: Record<string, string> = {};
  if (useAuth) {
    let t: string | null;
    try {
      t = await idToken();
    } catch {
      throw new ApiError('NETWORK', GENERIC, { status: 0 });
    }
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
  if (e && typeof e.code === 'string') {
    const code = errorCode(status, e.code);
    throw new ApiError(code, errorMessage(status, code), {
      status,
      details: boundDetails(e.details),
      requestId: typeof e.requestId === 'string' ? cut(e.requestId, 100) : null,
      retryAfterSeconds: ra,
    });
  }
  const code = errorCode(status, null);
  throw new ApiError(code, errorMessage(status, code), { status, retryAfterSeconds: ra });
}
