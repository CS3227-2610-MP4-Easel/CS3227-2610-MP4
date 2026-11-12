import { afterEach, describe, expect, it, vi } from 'vitest';
import { ActivityItemInputSchema } from '@agile/contracts';

vi.mock('../lib/auth/firebase', () => ({ idToken: async () => 't', signOutUser: vi.fn(async () => {}) }));
vi.mock('next/navigation', () => ({ usePathname: () => '/' }));

import { exampleActivityFile_49 } from '../lib/api';
import { members_9, myStandup_52, nextStandupDate, projectIdFrom, standup_51, summaries_50, teamStandups_55, todaySgt, upload_49 } from '../lib/api/dev';

const P = '0f8fad5b-d9cb-469f-a165-70867728950e';
const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
const err = (status: number, code: string) => new Response(JSON.stringify({ error: { code, message: 'm' } }), { status });

function stubFetch(...responses: Response[]) {
  const fetchMock = vi.fn(async () => responses.shift() ?? ok({}));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}
const call = (m: ReturnType<typeof vi.fn>, i = 0) => {
  const [path, init] = m.mock.calls[i] as [string, RequestInit];
  return { path, method: init.method, body: init.body === undefined ? undefined : JSON.parse(init.body as string), auth: (init.headers as Record<string, string>).Authorization };
};

afterEach(() => vi.unstubAllGlobals());

describe('projectIdFrom', () => {
  it('E1 a non-UUID project segment gives null', () => {
    expect(projectIdFrom('/projects/1/standup')).toBeNull();
    expect(projectIdFrom('/projects')).toBeNull();
    expect(projectIdFrom(null)).toBeNull();
  });
  it('returns the UUID segment lowercased', () => {
    expect(projectIdFrom(`/projects/${P.toUpperCase()}/standups`)).toBe(P);
  });
});

describe('standup dates (Asia/Singapore)', () => {
  it('E8 Friday to Sunday give the coming Monday; Thursday the next day', () => {
    for (const [now, today, next] of [
      ['2026-11-13T10:00:00Z', '2026-11-13', '2026-11-16'], // Fri 18:00 SGT
      ['2026-11-14T10:00:00Z', '2026-11-14', '2026-11-16'], // Sat
      ['2026-11-15T10:00:00Z', '2026-11-15', '2026-11-16'], // Sun
      ['2026-11-12T15:59:00Z', '2026-11-12', '2026-11-13'], // Thu 23:59 SGT
      ['2026-11-12T16:00:00Z', '2026-11-13', '2026-11-16'], // Fri 00:00 SGT
    ]) {
      expect([todaySgt(new Date(now)), nextStandupDate(new Date(now))], now).toEqual([today, next]);
    }
  });
});

describe('live calls', () => {
  it('each sends its path, method and body with the bearer token', async () => {
    const f = stubFetch(ok([]), ok({ received: 0 }), ok({ summaries: [], failed: [] }), ok({ id: 's' }), ok({ id: 's' }), ok({ items: [{ id: 's' }] }));
    await members_9(P);
    await upload_49(P, [{ a: 1 }]);
    await summaries_50(P, ['i1']);
    await standup_51(P, '2026-11-16');
    await myStandup_52(P, '2026-11-16');
    expect(await teamStandups_55(P, '2026-11-13')).toEqual([{ id: 's' }]);
    expect([0, 1, 2, 3, 4, 5].map((i) => call(f, i))).toEqual([
      { path: `/api/projects/${P}/members`, method: 'GET', body: undefined, auth: 'Bearer t' },
      { path: `/api/dev/projects/${P}/uploads`, method: 'POST', body: { items: [{ a: 1 }] }, auth: 'Bearer t' },
      { path: `/api/dev/projects/${P}/summaries`, method: 'POST', body: { itemIds: ['i1'] }, auth: 'Bearer t' },
      { path: `/api/dev/projects/${P}/standups`, method: 'POST', body: { date: '2026-11-16' }, auth: 'Bearer t' },
      { path: `/api/dev/projects/${P}/standups/mine?date=2026-11-16`, method: 'GET', body: undefined, auth: 'Bearer t' },
      { path: `/api/lead/projects/${P}/standups?date=2026-11-13&page=0&size=100`, method: 'GET', body: undefined, auth: 'Bearer t' },
    ]);
  });

  it('E2 endpoint 52 resolves null on 404 and rethrows other errors', async () => {
    stubFetch(err(404, 'NOT_FOUND'), err(409, 'CONFLICT_STATE'));
    expect(await myStandup_52(P, '2026-11-16')).toBeNull();
    await expect(myStandup_52(P, '2026-11-16')).rejects.toMatchObject({ code: 'CONFLICT_STATE', status: 409 });
  });
});

describe('example activity file', () => {
  it('E16 every item passes ActivityItemInputSchema', () => {
    const { items } = JSON.parse(exampleActivityFile_49()) as { items: unknown[] };
    expect(items.length).toBe(3);
    for (const item of items) expect(ActivityItemInputSchema.safeParse(item).success, JSON.stringify(item)).toBe(true);
    expect(new Set(items.map((i) => (i as { externalId: string }).externalId)).size).toBe(3);
  });
});
