import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let fbCb: ((u: { uid: string; email: string | null } | null) => void) | null = null;
const signOutUser = vi.fn();
const hardNavigate = vi.fn();
const replace = vi.fn();
const router = { replace };

vi.mock('../lib/auth/firebase', () => ({
  firebaseConfigured: () => true,
  currentUser: vi.fn(),
  onUserChanged: (cb: typeof fbCb) => {
    fbCb = cb;
    return vi.fn();
  },
  signIn: vi.fn(),
  signUp: vi.fn(),
  signOutUser: (...a: unknown[]) => signOutUser(...a),
  idToken: async () => 't',
}));
vi.mock('../lib/auth/navigate', () => ({ hardNavigate: (...a: unknown[]) => hardNavigate(...a) }));
vi.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => '/projects',
  useSearchParams: () => new URLSearchParams(),
}));

import RoleBar from '../components/role-bar';
import Top from '../components/canvas/Top';
import Projects from '../components/canvas/Projects';
import { AuthRoot } from '../lib/auth/mode-context';
import { ProjectRouteContext, projectRoute } from '../lib/api/project-mode';
import { RoleCtx } from '../lib/nav';

const fetchMock = vi.fn();
const A = '550e8400-e29b-41d4-a716-446655440000';

async function mountAs(role: string, displayName: string, email = 'p@x.io') {
  fetchMock.mockImplementation(async () => new Response(JSON.stringify({ id: 'u1', email, displayName, role }), { status: 200 }));
  const v = render(
    <AuthRoot mode="firebase">
      <Top />
      <RoleBar />
    </AuthRoot>,
  );
  await act(async () => fbCb!({ uid: 'a', email }));
  return v;
}

beforeEach(() => {
  fbCb = null;
  fetchMock.mockReset();
  signOutUser.mockReset();
  signOutUser.mockResolvedValue(undefined);
  hardNavigate.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('top bar', () => {
  it('F1 E1 renders live UUID project rows and preserves each project id in links', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      items: [{
        id: '550e8400-e29b-41d4-a716-446655440000', name: 'Live Campus', brief: 'Live brief', status: 'ACTIVE',
        createdBy: 'u1', createdAt: '2026-11-12T00:00:00Z', updatedAt: '2026-11-12T00:00:00Z', version: 1,
        progress: { pointsTotal: 10, pointsDone: 4, percent: 40, unestimatedTasks: 0 },
      }], page: 0, size: 20, total: 1,
    }), { status: 200 }));
    render(
      <ProjectRouteContext.Provider value={projectRoute('/projects/550e8400-e29b-41d4-a716-446655440000')}>
        <RoleCtx.Provider value="pm"><Projects /></RoleCtx.Provider>
      </ProjectRouteContext.Provider>,
    );
    expect(await screen.findByRole('heading', { name: 'Live Campus' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Live Campus/ }).getAttribute('href')).toBe('/projects/550e8400-e29b-41d4-a716-446655440000');
    expect(screen.queryByRole('heading', { name: 'Campus Eats Mobile App' })).toBeNull();
  });

  it('F7 keeps prototype project rows on a non-UUID route', () => {
    render(<Projects />);
    expect(screen.getByRole('heading', { name: 'Campus Eats Mobile App' })).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('closes the project switcher when clicking outside it', async () => {
    await mountAs('DEV_LEAD', 'Dev Lead');
    fireEvent.click(screen.getByRole('button', { name: 'Switch project' }));
    expect(screen.getByRole('menu')).toBeTruthy();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('preserves each live project link while already inside a project', async () => {
    const B = '660e8400-e29b-41d4-a716-446655440001';
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'u1', email: 'p@x.io', displayName: 'PM', role: 'PM' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [
        { id: A, name: 'Current project', brief: null, status: 'ACTIVE', createdBy: 'u1', createdAt: '', updatedAt: '', version: 1, progress: { pointsTotal: 0, pointsDone: 0, percent: 0, unestimatedTasks: 0 } },
        { id: B, name: 'Other project', brief: null, status: 'ACTIVE', createdBy: 'u1', createdAt: '', updatedAt: '', version: 1, progress: { pointsTotal: 0, pointsDone: 0, percent: 0, unestimatedTasks: 0 } },
      ], page: 0, size: 100, total: 2 }), { status: 200 }));
    render(<AuthRoot mode="firebase"><ProjectRouteContext.Provider value={projectRoute(`/projects/${A}`)}><Top /></ProjectRouteContext.Provider></AuthRoot>);
    await act(async () => fbCb!({ uid: 'a', email: 'p@x.io' }));
    fireEvent.click(screen.getByRole('button', { name: 'Switch project' }));
    expect(screen.getByRole('menuitem', { name: /Current project/ }).getAttribute('href')).toBe(`/projects/${A}`);
    expect(screen.getByRole('menuitem', { name: /Other project/ }).getAttribute('href')).toBe(`/projects/${B}`);
  });

  it('E1 keeps the live list in loading state before the first response and then shows its empty state', async () => {
    let resolve!: (response: Response) => void;
    fetchMock.mockReturnValue(new Promise<Response>((r) => { resolve = r; }));
    render(<ProjectRouteContext.Provider value={projectRoute(`/projects/${A}`)}><RoleCtx.Provider value="pm"><Projects /></RoleCtx.Provider></ProjectRouteContext.Provider>);
    expect(screen.queryByText('No projects yet.')).toBeNull();
    expect(document.querySelector('.sk')).toBeTruthy();
    await act(async () => resolve(new Response(JSON.stringify({ items: [], page: 0, size: 20, total: 0 }), { status: 200 })));
    expect(screen.getByText('No projects yet.')).toBeTruthy();
  });

  it('E7 retries a live list API error without rendering server text', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 'INTERNAL', message: 'secret server detail' } }), { status: 500 }));
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ items: [{ id: A, name: 'Recovered', brief: null, status: 'ACTIVE', createdBy: 'u1', createdAt: '', updatedAt: '', version: 1, progress: { pointsTotal: 0, pointsDone: 0, percent: 0, unestimatedTasks: 0 } }], page: 0, size: 20, total: 1 }), { status: 200 }));
    render(<ProjectRouteContext.Provider value={projectRoute(`/projects/${A}`)}><RoleCtx.Provider value="pm"><Projects /></RoleCtx.Provider></ProjectRouteContext.Provider>);
    expect(await screen.findByText('Something went wrong. Try again.')).toBeTruthy();
    expect(screen.queryByText('secret server detail')).toBeNull();
    await act(async () => screen.getByRole('button', { name: 'Try again' }).click());
    expect(await screen.findByRole('heading', { name: 'Recovered' })).toBeTruthy();
  });

  it('E3 lets a live list 401 follow the apiFetch sign-out boundary', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 401 }));
    render(<ProjectRouteContext.Provider value={projectRoute(`/projects/${A}`)}><RoleCtx.Provider value="pm"><Projects /></RoleCtx.Provider></ProjectRouteContext.Provider>);
    await act(async () => {});
    expect(signOutUser).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Something went wrong. Try again.')).toBeNull();
  });

  it('E77 shows the user, initials, role label and no role bar', async () => {
    const cases: [string, string, string, string, string, string][] = [
      ['DEVELOPER', 'Ana Lee', 'AL', 'Developer', 'r-dev', 'a3'],
      ['DEV_LEAD', 'bo', 'B', 'Dev Lead', 'r-lead', 'a2'],
      ['PM', '  Cy  de  Ro ', 'CD', 'Project Manager', 'r-pm', 'a1'],
    ];
    for (const [role, name, initials, label, cls, av] of cases) {
      const v = await mountAs(role, name, 'who@x.io');
      expect(v.container.querySelector('.av')!.textContent).toBe(initials);
      expect(v.container.querySelector('.av')!.className).toContain(av);
      expect(v.container.querySelector('.role')!.textContent).toBe(label);
      expect(v.container.querySelector('.role')!.className).toContain(cls);
      expect(v.container.querySelector('.b[style]')!.textContent).toBe(name);
      expect(screen.getByText('who@x.io')).toBeTruthy();
      expect(screen.queryByRole('group', { name: 'Prototype role' })).toBeNull();
      v.unmount();
    }
  });

  it('E51 Sign out calls signOutUser once and hardNavigate to /sign-in only after it settles', async () => {
    await mountAs('PM', 'Cy');
    let done!: () => void;
    signOutUser.mockImplementation(() => new Promise<void>((r) => (done = r)));
    await act(async () => screen.getByRole('button', { name: 'Sign out' }).click());
    expect(signOutUser).toHaveBeenCalledTimes(1);
    expect(hardNavigate).not.toHaveBeenCalled();
    await act(async () => done());
    expect(hardNavigate).toHaveBeenCalledTimes(1);
    expect(hardNavigate).toHaveBeenCalledWith('/sign-in');
    expect(signOutUser.mock.invocationCallOrder[0]).toBeLessThan(hardNavigate.mock.invocationCallOrder[0]);
  });

  it('E51 still navigates to /sign-in when signOutUser rejects', async () => {
    await mountAs('PM', 'Cy');
    signOutUser.mockRejectedValue(new Error('x'));
    await act(async () => {
      screen.getByRole('button', { name: 'Sign out' }).click();
    });
    expect(hardNavigate).toHaveBeenCalledWith('/sign-in');
  });

  it('E105 an emoji first name gives the whole emoji as the first initial', async () => {
    const v = await mountAs('PM', '😀 Zed');
    expect(v.container.querySelector('.av')!.textContent).toBe('😀Z');
  });

  it('E39 markup in a display name is literal text', async () => {
    const name = '<script>alert(1)</script>';
    const v = await mountAs('PM', name);
    expect(screen.getByText(name)).toBeTruthy();
    expect(v.container.querySelector('script')).toBeNull();
  });

  it('E51 a session without a user still renders the Firebase Sign out button', async () => {
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ error: { code: 'USER_NOT_REGISTERED', message: 'm' } }), { status: 403 }));
    const v = render(
      <AuthRoot mode="firebase">
        <Top />
      </AuthRoot>,
    );
    await act(async () => fbCb!({ uid: 'a', email: 'a@x.io' }));
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeTruthy();
    expect(v.container.querySelector('a[href^="/api/as"]')).toBeNull();
  });

  it('E99 without a provider Top renders the prototype content and link', () => {
    render(<Top />);
    expect(screen.getByText('Aisha Rahman')).toBeTruthy();
    expect(screen.getByText('Sign out').getAttribute('href')).toBe('/api/as?role=out&to=/sign-in');
  });
});
