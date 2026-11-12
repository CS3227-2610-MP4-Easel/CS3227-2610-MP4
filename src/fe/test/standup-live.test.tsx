import { StrictMode } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

const P = '0f8fad5b-d9cb-469f-a165-70867728950e';
let pathname = `/projects/${P}/standup`;
vi.mock('../lib/auth/firebase', () => ({ idToken: async () => 't', signOutUser: vi.fn(async () => {}) }));
vi.mock('next/navigation', () => ({ usePathname: () => pathname }));

import { LiveStandupScreen } from '../components/live/standup-live';
import Standup from '../components/canvas/Standup';
import { nextStandupDate, todaySgt, type LiveStandup } from '../lib/api/dev';
import { LiveTestProvider } from './live-provider';

type Handler = (body: any, url: string) => Response | Promise<Response>;
const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
const err = (status: number, code: string, headers: Record<string, string> = {}) => new Response(JSON.stringify({ error: { code, message: `server says ${code}` } }), { status, headers });
const uploadRes = (over: object = {}) => ({ received: 3, created: 2, updated: 1, unchanged: 0, rejected: [], needsSummary: [], ...over });

// Routes: uploads (49), summaries (50), generate (51), mine (52; default 404 = no standup yet).
function stub(routes: { uploads?: Handler; summaries?: Handler; generate?: Handler; mine?: Handler }) {
  const calls: { path: string; body: any }[] = [];
  const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
    const body = init.body ? JSON.parse(init.body as string) : undefined;
    calls.push({ path: url, body });
    const key = url.endsWith('/uploads') ? 'uploads' : url.endsWith('/summaries') ? 'summaries' : url.endsWith('/standups') ? 'generate' : url.includes('/standups/mine') ? 'mine' : null;
    const h = key && routes[key];
    if (h) return h(body, url);
    return key === 'mine' ? err(404, 'NOT_FOUND') : new Response('{}', { status: 500 });
  });
  vi.stubGlobal('fetch', fetchMock);
  const of = (suffix: string) => calls.filter((c) => c.path.endsWith(suffix));
  return { calls, fetchMock, uploadCalls: () => of('/uploads'), generateCalls: () => of('/standups').map((c) => c.body), summaryCalls: () => of('/summaries').map((c) => c.body.itemIds) };
}

const standup = (over: Partial<LiveStandup> = {}): LiveStandup => ({
  id: 's1', developerId: 'd1', date: nextStandupDate(new Date()), content: { yesterday: ['Fixed the menu card'], today: ['Wire the detail page'], blockers: [] },
  degraded: false, flagged: false, cached: false, outcome: null, version: 1, ...over,
});

const view = () => render(<LiveTestProvider><LiveStandupScreen /></LiveTestProvider>);
const fileOf = (content: string, name = 'activity.json') => new File([content], name, { type: 'application/json' });
const items = (n: number) => JSON.stringify({ items: Array.from({ length: n }, (_, i) => ({ type: 'COMMIT', externalId: `c${i}` })) });
const choose = async (file: File) => userEvent.upload(screen.getByLabelText('Activity file'), file);
const ids = (n: number) => Array.from({ length: n }, (_, i) => `id-${i}`);

afterEach(() => { pathname = `/projects/${P}/standup`; vi.useRealTimers(); });

describe('S20 live: project id', () => {
  it('E1 a non-UUID project shows the not-found text and sends nothing', () => {
    pathname = '/projects/1/standup';
    const s = stub({});
    view();
    expect(screen.getByText('This project was not found or you are not a member.')).toBeTruthy();
    expect(s.fetchMock).not.toHaveBeenCalled();
  });
});

describe('S20 live: upload (F2)', () => {
  it('E3 an oversize, non-JSON or 101-item file is not sent and names the limit', async () => {
    const s = stub({});
    view();
    await choose(new File([new Uint8Array(1_048_577)], 'big.json'));
    expect(await screen.findByText('That file is larger than 1 MB.')).toBeTruthy();
    await choose(fileOf('{nope'));
    expect(await screen.findByText('That file is not valid JSON.')).toBeTruthy();
    await choose(fileOf(items(101)));
    expect(await screen.findByText('A file can hold at most 100 items.')).toBeTruthy();
    await choose(fileOf('{"things":[]}'));
    expect(await screen.findByText('That file has no items list.')).toBeTruthy();
    expect(s.uploadCalls()).toEqual([]);
  });

  it('E4 sends every item in one call and shows the counts and each rejection', async () => {
    const s = stub({ uploads: () => ok(uploadRes({ rejected: [{ index: 2, reason: 'title: Required' }] })) });
    view();
    await choose(fileOf(items(3)));
    expect(await screen.findByText('2 new, 1 changed, 0 unchanged, 1 rejected')).toBeTruthy();
    expect(screen.getByText('Item 3: title: Required')).toBeTruthy();
    expect(s.uploadCalls()).toEqual([{ path: `/api/dev/projects/${P}/uploads`, body: JSON.parse(items(3)) }]);
  });

  it('E17 a 409 on upload shows the archived banner and turns the file input off', async () => {
    stub({ uploads: () => err(409, 'CONFLICT_STATE') });
    view();
    await choose(fileOf(items(1)));
    expect(await screen.findByText('This project is archived. Upload and generate are off.')).toBeTruthy();
    expect((screen.getByLabelText('Activity file') as HTMLInputElement).disabled).toBe(true);
  });

  it('a 404 on upload replaces the screen with the not-found text', async () => {
    stub({ uploads: () => err(404, 'NOT_FOUND') });
    view();
    await choose(fileOf(items(1)));
    expect(await screen.findByText('This project was not found or you are not a member.')).toBeTruthy();
  });
});

describe('S20 live: summaries (F3)', () => {
  it('E5 23 ids go in sequential batches of 10, 10 and 3', async () => {
    let inFlight = 0, maxInFlight = 0;
    const s = stub({
      uploads: () => ok(uploadRes({ needsSummary: ids(23) })),
      summaries: async (body) => {
        maxInFlight = Math.max(maxInFlight, ++inFlight);
        await new Promise((r) => setTimeout(r, 5));
        inFlight--;
        return ok({ summaries: body.itemIds.map((itemId: string) => ({ itemId, oneLiner: `did ${itemId}`, cached: false })), failed: [] });
      },
    });
    view();
    await choose(fileOf(items(23)));
    expect(await screen.findByText('Summarised 23 of 23')).toBeTruthy();
    expect(s.summaryCalls()).toEqual([ids(23).slice(0, 10), ids(23).slice(10, 20), ids(23).slice(20)]);
    expect(maxInFlight).toBe(1);
  });

  it('E6 a 429 AI_BUSY shows the countdown, then resends the same batch', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let n = 0;
    const s = stub({
      uploads: () => ok(uploadRes({ needsSummary: ids(12) })),
      summaries: (body) => (++n === 2 ? err(429, 'AI_BUSY', { 'Retry-After': '2' }) : ok({ summaries: body.itemIds.map((itemId: string) => ({ itemId, oneLiner: 'x', cached: false })), failed: [] })),
    });
    view();
    await choose(fileOf(items(12)));
    expect(await screen.findByText('AI is busy. Resuming in 2 s.')).toBeTruthy();
    await act(async () => { await vi.advanceTimersByTimeAsync(2100); });
    expect(await screen.findByText('Summarised 12 of 12')).toBeTruthy();
    expect(s.summaryCalls()).toEqual([ids(12).slice(0, 10), ids(12).slice(10), ids(12).slice(10)]);
  });

  it('E7 Retry failed resends exactly the failed ids', async () => {
    let first = true;
    const s = stub({
      uploads: () => ok(uploadRes({ needsSummary: ids(4) })),
      summaries: (body) => {
        const failed = first ? ['id-1', 'id-3'] : [];
        first = false;
        return ok({ summaries: body.itemIds.filter((id: string) => !failed.includes(id)).map((itemId: string) => ({ itemId, oneLiner: 'x', cached: false })), failed });
      },
    });
    view();
    await choose(fileOf(items(4)));
    await userEvent.click(await screen.findByRole('button', { name: 'Retry failed (2)' }));
    await waitFor(() => expect(screen.getByText('Summarised 4 of 4')).toBeTruthy());
    expect(s.summaryCalls()).toEqual([ids(4), ['id-1', 'id-3']]);
    expect(screen.queryByRole('button', { name: /Retry failed/ })).toBeNull();
  });

  it('a 429 RATE_LIMITED stops the run and marks the rest failed; Retry clears the note', async () => {
    let limited = true;
    const s = stub({
      uploads: () => ok(uploadRes({ needsSummary: ids(15) })),
      summaries: (body) => (limited ? err(429, 'RATE_LIMITED', { 'Retry-After': '30' }) : ok({ summaries: body.itemIds.map((itemId: string) => ({ itemId, oneLiner: 'x', cached: false })), failed: [] })),
    });
    view();
    await choose(fileOf(items(15)));
    expect(await screen.findByText('Too many AI requests. Try again in 30 s.')).toBeTruthy();
    expect(s.summaryCalls()).toHaveLength(1);
    limited = false;
    await userEvent.click(screen.getByRole('button', { name: 'Retry failed (15)' }));
    expect(await screen.findByText('Summarised 15 of 15')).toBeTruthy();
    expect(screen.queryByText(/Too many AI requests/)).toBeNull();
  });

  it('unmounting during the AI_BUSY countdown sends no further request', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const s = stub({ uploads: () => ok(uploadRes({ needsSummary: ids(3) })), summaries: () => err(429, 'AI_BUSY', { 'Retry-After': '2' }) });
    const { unmount } = view();
    await choose(fileOf(items(3)));
    await screen.findByText('AI is busy. Resuming in 2 s.');
    unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(s.summaryCalls()).toHaveLength(1);
  });

  it('under StrictMode a second mount does not duplicate later batches or lines', async () => {
    const s = stub({
      uploads: () => ok(uploadRes({ needsSummary: ids(12) })),
      summaries: (body) => ok({ summaries: body.itemIds.map((itemId: string) => ({ itemId, oneLiner: `did ${itemId}`, cached: false })), failed: [] }),
    });
    render(<StrictMode><LiveTestProvider><LiveStandupScreen /></LiveTestProvider></StrictMode>);
    await choose(fileOf(items(12)));
    expect(await screen.findByText('Summarised 12 of 12')).toBeTruthy();
    // The first batch is already in flight when StrictMode remounts; only the live run continues.
    expect(s.summaryCalls()).toEqual([ids(12).slice(0, 10), ids(12).slice(0, 10), ids(12).slice(10)]);
    expect(screen.getAllByText('did id-0')).toHaveLength(1);
  });

  it('E14 untrusted one-liners render as literal text, duplicates included', async () => {
    const evil = '<img src=x onerror=alert(1)>';
    stub({ uploads: () => ok(uploadRes({ needsSummary: ids(2) })), summaries: () => ok({ summaries: ids(2).map((itemId) => ({ itemId, oneLiner: evil, cached: false })), failed: [] }) });
    const { container } = view();
    await choose(fileOf(items(2)));
    await waitFor(() => expect(screen.getAllByText(evil)).toHaveLength(2));
    expect(container.querySelector('img')).toBeNull();
  });
});

describe('S20 live: standup (F4)', () => {
  const next = () => nextStandupDate(new Date());
  const today = () => todaySgt(new Date());

  it('loads the next standup date; none yet offers Generate, which sends that date', async () => {
    const s = stub({ generate: () => ok(standup()) });
    view();
    expect(await screen.findByText(/^No standup for .* yet\.$/)).toBeTruthy();
    expect(s.calls[0].path).toBe(`/api/dev/projects/${P}/standups/mine?date=${next()}`);
    await userEvent.click(screen.getByRole('button', { name: 'Generate standup' }));
    expect(await screen.findByText('Fixed the menu card')).toBeTruthy();
    expect(s.generateCalls()).toEqual([{ date: next() }]);
  });

  it('E9 a cached regenerate shows the nothing-has-changed note', async () => {
    stub({ mine: () => ok(standup()), generate: () => ok(standup({ cached: true })) });
    view();
    await userEvent.click(await screen.findByRole('button', { name: 'Regenerate' }));
    expect(await screen.findByText('Nothing has changed since this was generated. Upload new activity to refresh it.')).toBeTruthy();
  });

  it('E10 a degraded standup shows its badge and its blocker line; empty lists read Nothing to report', async () => {
    stub({ mine: () => ok(standup({ degraded: true, flagged: true, outcome: 'EDITED', content: { yesterday: [], today: [], blockers: ['Task 7 blocked: waiting on the API key'] } })) });
    view();
    expect(await screen.findByText('Task 7 blocked: waiting on the API key')).toBeTruthy();
    expect(screen.getByText('Built from your task activity only')).toBeTruthy();
    expect(screen.getByText('Flagged for review')).toBeTruthy();
    expect(screen.getByText('Edited')).toBeTruthy();
    expect(screen.getAllByText('Nothing to report.')).toHaveLength(2);
  });

  it('E11 live mode has no Edit, Use as is or thumbs controls', async () => {
    stub({ mine: () => ok(standup()) });
    view();
    await screen.findByRole('button', { name: 'Regenerate' });
    for (const name of [/Edit/, /Use as is/, /Thumbs/]) expect(screen.queryByRole('button', { name })).toBeNull();
    expect(screen.getByRole('button', { name: 'Copy' })).toBeTruthy();
  });

  it('E18 a response for the previous date is dropped after a switch', async () => {
    let release!: (r: Response) => void;
    stub({ mine: (_b, url) => (url.endsWith(next()) ? new Promise<Response>((r) => { release = r; }) : ok(standup({ content: { yesterday: ['for today'], today: [], blockers: [] } }))) });
    view();
    await userEvent.click(screen.getByRole('tab', { name: new RegExp(`^For today`) }));
    expect(await screen.findByText('for today')).toBeTruthy();
    await act(async () => { release(ok(standup({ content: { yesterday: ['stale next'], today: [], blockers: [] } }))); });
    expect(screen.queryByText('stale next')).toBeNull();
    expect(screen.getByText('for today')).toBeTruthy();
    expect(today()).not.toBe(next());
  });

  it('a 429 on generate shows the wait, holds Regenerate, then releases it and clears the banner', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    stub({ mine: () => ok(standup()), generate: () => err(429, 'AI_BUSY', { 'Retry-After': '5' }) });
    view();
    await userEvent.click(await screen.findByRole('button', { name: 'Regenerate' }));
    expect(await screen.findByText('AI is busy. Try again in 5 s.')).toBeTruthy();
    const regen = () => screen.getByRole('button', { name: 'Regenerate' }) as HTMLButtonElement;
    expect(regen().disabled).toBe(true);
    await act(async () => { await vi.advanceTimersByTimeAsync(5100); });
    expect(regen().disabled).toBe(false);
    expect(screen.queryByText(/AI is busy/)).toBeNull();
  });

  it('a failed load shows its message and Try again reloads', async () => {
    let first = true;
    stub({ mine: () => (first ? ((first = false), err(500, 'INTERNAL_ERROR')) : ok(standup())) });
    view();
    expect(await screen.findByText('server says INTERNAL_ERROR')).toBeTruthy();
    expect(screen.queryByText('Loading…')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Fixed the menu card')).toBeTruthy();
  });

  it('an accepted standup shows the accepted banner and no Edited badge', async () => {
    stub({ mine: () => ok(standup({ outcome: 'ACCEPTED' })) });
    view();
    expect(await screen.findByText('You accepted this standup as written.')).toBeTruthy();
    expect(screen.queryByText('Edited')).toBeNull();
  });

  it('a 422 and a 503 AI_DISABLED on generate show their messages', async () => {
    let n = 0;
    stub({ mine: () => ok(standup()), generate: () => (++n === 1 ? err(422, 'VALIDATION_FAILED') : err(503, 'AI_DISABLED')) });
    view();
    await userEvent.click(await screen.findByRole('button', { name: 'Regenerate' }));
    expect(await screen.findByText('That date cannot be used for a standup.')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Regenerate' }));
    expect(await screen.findByText('AI features are off for this deployment.')).toBeTruthy();
  });

  it('E17 a 409 on generate shows the archived banner, turns Regenerate and the file input off, keeps Copy', async () => {
    stub({ mine: () => ok(standup()), generate: () => err(409, 'CONFLICT_STATE') });
    view();
    await userEvent.click(await screen.findByRole('button', { name: 'Regenerate' }));
    expect(await screen.findByText('This project is archived. Upload and generate are off.')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Regenerate' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByLabelText('Activity file') as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Copy' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('E14 standup lines render as literal text, keyed without duplicate-key warnings', async () => {
    const evil = '<img src=x onerror=alert(1)>';
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    stub({ mine: () => ok(standup({ content: { yesterday: [evil, evil], today: [], blockers: [evil] } })) });
    const { container } = view();
    await waitFor(() => expect(screen.getAllByText(evil)).toHaveLength(3));
    expect(container.querySelector('img')).toBeNull();
    expect(errors.mock.calls.filter((c) => String(c[0]).includes('same key'))).toEqual([]);
  });
});

describe('S20 prototype mode (F6)', () => {
  it('E15 the canvas page keeps its mock markup and sends no request', () => {
    const s = stub({});
    render(<Standup />);
    expect(screen.getByText('activity-priya.json')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Edit/ })).toBeTruthy();
    expect(s.fetchMock).not.toHaveBeenCalled();
  });

  it('the canvas page renders the live screen in firebase mode', async () => {
    stub({});
    render(<LiveTestProvider><Standup /></LiveTestProvider>);
    expect(await screen.findByText(/^No standup for .* yet\.$/)).toBeTruthy();
    expect(screen.queryByText('activity-priya.json')).toBeNull();
  });
});
