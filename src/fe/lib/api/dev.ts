'use client';
// Live calls for S20 and S18 (endpoints 9, 49-52, 55), used only in `firebase` auth mode.
// Each takes the project id from the URL (useProjectId); errors are ApiError from apiFetch.
import { usePathname } from 'next/navigation';
import { ApiError } from './errors';
import { apiFetch } from './http';

export type LiveStandup = {
  id: string;
  developerId: string;
  date: string;
  content: { yesterday: string[]; today: string[]; blockers: string[] };
  degraded: boolean;
  flagged: boolean;
  cached: boolean;
  outcome: 'EDITED' | 'ACCEPTED' | null;
  version: number;
};
export type LiveMember = { userId: string; displayName: string; role: 'PM' | 'DEV_LEAD' | 'DEVELOPER' };
export type UploadResult = { received: number; created: number; updated: number; unchanged: number; rejected: { index: number; reason: string }[]; needsSummary: string[] };
export type SummariesResult = { summaries: { itemId: string; oneLiner: string; cached: boolean }[]; failed: string[] };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The project id from `/projects/{id}/...`, lowercased, or null when that segment is not a UUID. */
export function projectIdFrom(pathname: string | null): string | null {
  const id = /^\/projects\/([^/]+)/.exec(pathname ?? '')?.[1] ?? '';
  return UUID.test(id) ? id.toLowerCase() : null;
}
export const useProjectId = (): string | null => projectIdFrom(usePathname());

const SGT = 8 * 3600_000;
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
/** Today's date in Asia/Singapore (no daylight saving, so a fixed +08:00). */
export const todaySgt = (now: Date): string => iso(now.getTime() + SGT);
/** The next standup: Monday to Thursday give the next day, Friday to Sunday the coming Monday. */
export function nextStandupDate(now: Date): string {
  const day = new Date(now.getTime() + SGT).getUTCDay();
  const ahead = day === 5 ? 3 : day === 6 ? 2 : 1;
  return iso(now.getTime() + SGT + ahead * 86400_000);
}

const p = (projectId: string) => encodeURIComponent(projectId);

export const members_9 = (projectId: string) => apiFetch<LiveMember[]>(`/api/projects/${p(projectId)}/members`);
export const upload_49 = (projectId: string, items: unknown[]) =>
  apiFetch<UploadResult>(`/api/dev/projects/${p(projectId)}/uploads`, { method: 'POST', body: { items } });
export const summaries_50 = (projectId: string, itemIds: string[]) =>
  apiFetch<SummariesResult>(`/api/dev/projects/${p(projectId)}/summaries`, { method: 'POST', body: { itemIds } });
export const standup_51 = (projectId: string, date: string) =>
  apiFetch<LiveStandup>(`/api/dev/projects/${p(projectId)}/standups`, { method: 'POST', body: { date } });

/** Endpoint 52; null when there is no standup for that date yet (404). A non-member also gets 404 here,
 * so S20 shows "No standup yet" until a write (49-51) returns its own 404 (spec E2). */
export async function myStandup_52(projectId: string, date: string): Promise<LiveStandup | null> {
  try {
    return await apiFetch<LiveStandup>(`/api/dev/projects/${p(projectId)}/standups/mine?date=${date}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

export async function teamStandups_55(projectId: string, date: string): Promise<LiveStandup[]> {
  const page = await apiFetch<{ items: LiveStandup[] }>(`/api/lead/projects/${p(projectId)}/standups?date=${date}&page=0&size=100`);
  return page.items;
}
