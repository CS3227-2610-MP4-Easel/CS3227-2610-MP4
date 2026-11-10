// Calls to the real API. Until the sign-in screen lands (C46) every call carries the fixed token `dev-pm`,
// which the API accepts on the `local` tier only (api/src/deps.ts); on any other tier it answers 401.
import { currentProject } from '../screens';

export const DEV_PM_TOKEN = 'dev-pm';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The project of the open page (set from the URL by Screen). Live calls need a real project id.
export function openProjectId(): string {
  const id = currentProject();
  if (!UUID.test(id)) throw new LiveError('NO_PROJECT', 'Open a project from the Projects page first.', 400);
  return id;
}

export class LiveError extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message);
  }
}

export async function call<T>(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: { authorization: `Bearer ${DEV_PM_TOKEN}`, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new LiveError(json?.error?.code ?? 'INTERNAL_ERROR', json?.error?.message ?? 'Something went wrong.', res.status);
  return json as T;
}
