import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

const P = '0f8fad5b-d9cb-469f-a165-70867728950e';
let pathname = `/projects/${P}/standup`;
vi.mock('../lib/auth/firebase', () => ({ idToken: async () => 't', signOutUser: vi.fn(async () => {}) }));
vi.mock('next/navigation', () => ({ usePathname: () => pathname }));

import { LiveStandupScreen } from '../components/live/standup-live';
import { LiveTestProvider } from './live-provider';

type Handler = (body: any, url: string) => Response | Promise<Response>;
const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
const err = (status: number, code: string, headers: Record<string, string> = {}) => new Response(JSON.stringify({ error: { code, message: `server says ${code}` } }), { status, headers });
const uploadRes = (over: object = {}) => ({ received: 3, created: 2, updated: 1, unchanged: 0, rejected: [], needsSummary: [], ...over });

function stub(routes: { uploads?: Handler; summaries?: Handler }) {
  const calls: { path: string; body: any }[] = [];
  const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
    const body = init.body ? JSON.parse(init.body as string) : undefined;
    calls.push({ path: url, body });
    const key = url.endsWith('/uploads') ? 'uploads' : url.endsWith('/summaries') ? 'summaries' : null;
    const h = key && routes[key];
    return h ? h(body, url) : new Response('{}', { status: 500 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return { calls, fetchMock, summaryCalls: () => calls.filter((c) => c.path.endsWith('/summaries')).map((c) => c.body.itemIds) };
}

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
    expect(s.fetchMock).not.toHaveBeenCalled();
  });

  it('E4 sends every item in one call and shows the counts and each rejection', async () => {
    const s = stub({ uploads: () => ok(uploadRes({ rejected: [{ index: 2, reason: 'title: Required' }] })) });
    view();
    await choose(fileOf(items(3)));
    expect(await screen.findByText('2 new, 1 changed, 0 unchanged, 1 rejected')).toBeTruthy();
    expect(screen.getByText('Item 3: title: Required')).toBeTruthy();
    expect(s.calls).toEqual([{ path: `/api/dev/projects/${P}/uploads`, body: JSON.parse(items(3)) }]);
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

  it('a 429 RATE_LIMITED stops the run and marks the rest failed', async () => {
    const s = stub({ uploads: () => ok(uploadRes({ needsSummary: ids(15) })), summaries: () => err(429, 'RATE_LIMITED', { 'Retry-After': '30' }) });
    view();
    await choose(fileOf(items(15)));
    expect(await screen.findByText('Too many AI requests. Try again in 30 s.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Retry failed (15)' })).toBeTruthy();
    expect(s.summaryCalls()).toHaveLength(1);
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
