// Calls to the real API. Until the sign-in screen lands (C46) every call carries the fixed token `dev-pm`,
// which the API accepts on the `local` tier only (api/src/deps.ts); on any other tier it answers 401.
export const DEV_PM_TOKEN = 'dev-pm';

// The seeded demo project (src/be/db/prisma/seed.ts). The prototype screens carry no project id yet.
export const LIVE_PROJECT_ID = '00000000-0000-4000-8000-000000000010';

export class LiveError extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message);
  }
}

export async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: { authorization: `Bearer ${DEV_PM_TOKEN}`, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new LiveError(json?.error?.code ?? 'INTERNAL_ERROR', json?.error?.message ?? 'Something went wrong.', res.status);
  return json as T;
}
