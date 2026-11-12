import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

const P = '0f8fad5b-d9cb-469f-a165-70867728950e';
let pathname = `/projects/${P}/standups`;
vi.mock('../lib/auth/firebase', () => ({ idToken: async () => 't', signOutUser: vi.fn(async () => {}) }));
vi.mock('next/navigation', () => ({ usePathname: () => pathname }));

import { LiveTeamStandups } from '../components/live/team-standups-live';
import Standups from '../components/canvas/Standups';
import { nextStandupDate, todaySgt, type LiveMember, type LiveStandup } from '../lib/api/dev';
import { LiveTestProvider } from './live-provider';

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
const member = (userId: string, displayName: string, role: LiveMember['role'] = 'DEVELOPER'): LiveMember => ({ userId, displayName, role });
const standup = (developerId: string, over: Partial<LiveStandup> = {}): LiveStandup => ({
  id: `s-${developerId}`, developerId, date: todaySgt(new Date()), content: { yesterday: [`${developerId} yesterday`], today: [], blockers: [] },
  degraded: false, flagged: false, cached: false, outcome: null, version: 1, ...over,
});

function stub(members: LiveMember[] | Response, byDate: (date: string) => LiveStandup[] = () => []) {
  const dates: string[] = [];
  const fetchMock = vi.fn(async (url: string) => {
    if (url.endsWith('/members')) return members instanceof Response ? members : ok(members);
    const date = new URL(url, 'http://x').searchParams.get('date')!;
    dates.push(date);
    return ok({ items: byDate(date), page: 0, size: 100, total: 0 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return { fetchMock, dates };
}
const view = () => render(<LiveTestProvider><LiveTeamStandups /></LiveTestProvider>);
const cardNames = () => screen.getAllByRole('article').map((a) => a.querySelector('b')?.textContent);

afterEach(() => { pathname = `/projects/${P}/standups`; });

describe('S18 live (F5)', () => {
  it('E12 one card per developer in name order; those without a standup read not generated', async () => {
    const s = stub([member('u-wo', 'Wei Ling Ong'), member('u-ml', 'Marcus Lim'), member('u-pn', 'Priya Nair')], () => [standup('u-pn')]);
    view();
    expect(await screen.findByText('u-pn yesterday')).toBeTruthy();
    expect(cardNames()).toEqual(['Marcus Lim', 'Priya Nair', 'Wei Ling Ong']);
    expect(screen.getAllByText('not generated')).toHaveLength(2);
    expect(s.dates).toEqual([todaySgt(new Date())]);
  });

  it('E13 PM and Dev Lead members get no card; a standup with no matching member is not shown', async () => {
    stub([member('u-pm', 'Aisha Rahman', 'PM'), member('u-dl', 'Daniel Tan', 'DEV_LEAD'), member('u-pn', 'Priya Nair')], () => [standup('u-pn'), standup('u-gone')]);
    view();
    await screen.findByText('u-pn yesterday');
    expect(cardNames()).toEqual(['Priya Nair']);
    expect(screen.queryByText('u-gone yesterday')).toBeNull();
  });

  it('badges: Edited, degraded and flagged; none for ACCEPTED', async () => {
    stub([member('a', 'Ann'), member('b', 'Ben')], () => [standup('a', { outcome: 'EDITED', degraded: true, flagged: true }), standup('b', { outcome: 'ACCEPTED' })]);
    view();
    await screen.findByText('a yesterday');
    const [ann, ben] = screen.getAllByRole('article');
    expect(within(ann).getByText('Edited')).toBeTruthy();
    expect(within(ann).getByText('Built from task activity only')).toBeTruthy();
    expect(within(ann).getByText('Flagged for review')).toBeTruthy();
    expect(within(ben).queryByText('Edited')).toBeNull();
    expect(within(ben).queryByText(/Accepted/i)).toBeNull();
  });

  it('day options: next standup and an earlier day fetch their own dates', async () => {
    const s = stub([member('a', 'Ann')]);
    view();
    await screen.findByText('not generated');
    await userEvent.click(screen.getByRole('tab', { name: /^For the next standup/ }));
    await userEvent.click(screen.getByRole('tab', { name: 'Earlier' }));
    const today = todaySgt(new Date());
    const back = (n: number) => new Date(Date.parse(`${today}T00:00:00Z`) - n * 86400_000).toISOString().slice(0, 10);
    const earlier = screen.getByLabelText('Earlier day') as HTMLSelectElement;
    expect(Array.from(earlier.options).map((o) => o.value)).toEqual([1, 2, 3, 4, 5, 6, 7].map(back));
    await userEvent.selectOptions(earlier, back(3));
    await screen.findByText('not generated');
    expect(s.dates).toEqual([today, nextStandupDate(new Date()), back(1), back(3)]);
  });

  it('the developer filter shows one card without a new request', async () => {
    const s = stub([member('a', 'Ann'), member('b', 'Ben')]);
    view();
    await screen.findAllByText('not generated');
    await userEvent.selectOptions(screen.getByLabelText('Developer'), 'b');
    expect(cardNames()).toEqual(['Ben']);
    expect(s.dates).toHaveLength(1);
  });

  it('no developers shows the add-them line', async () => {
    stub([member('u-pm', 'Aisha Rahman', 'PM')]);
    view();
    expect(await screen.findByText('No developers have been added. Add them in Members.')).toBeTruthy();
  });

  it('a 404 from members shows the not-found text', async () => {
    stub(new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'm' } }), { status: 404 }));
    view();
    expect(await screen.findByText('This project was not found or you are not a member.')).toBeTruthy();
  });

  it('E14 standup lines and names render as literal text', async () => {
    const evil = '<img src=x onerror=alert(1)>';
    stub([member('a', evil)], () => [standup('a', { content: { yesterday: [evil, evil], today: [], blockers: [evil] } })]);
    const { container } = view();
    // The name on the card and in the developer filter, plus three standup lines.
    expect(await screen.findAllByText(evil)).toHaveLength(5);
    expect(container.querySelector('img')).toBeNull();
  });

  it('E1 a non-UUID project shows the not-found text and sends nothing', () => {
    pathname = '/projects/1/standups';
    const s = stub([]);
    view();
    expect(screen.getByText('This project was not found or you are not a member.')).toBeTruthy();
    expect(s.fetchMock).not.toHaveBeenCalled();
  });
});

describe('S18 canvas switch (F6)', () => {
  it('E15 prototype mode keeps the mock cards and sends no request', () => {
    const s = stub([]);
    render(<Standups />);
    expect(screen.getAllByText(/For today/).length).toBeGreaterThan(0);
    expect(s.fetchMock).not.toHaveBeenCalled();
  });

  it('firebase mode renders the live cards', async () => {
    stub([member('a', 'Ann')]);
    render(<LiveTestProvider><Standups /></LiveTestProvider>);
    expect(await screen.findByText('not generated')).toBeTruthy();
  });
});
