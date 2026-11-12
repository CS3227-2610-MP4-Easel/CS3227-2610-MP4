import { act, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let fbCb: ((u: { uid: string; email: string | null } | null) => void) | null = null;
let configured = true;
const replace = vi.fn();
const router = { replace };
const signOutUser = vi.fn(async () => {});
let pathname = '/projects';

vi.mock('../lib/auth/firebase', () => ({
  firebaseConfigured: () => configured,
  currentUser: vi.fn(),
  onUserChanged: (cb: typeof fbCb) => {
    fbCb = cb;
    return vi.fn();
  },
  signIn: vi.fn(),
  signUp: vi.fn(),
  signOutUser: () => signOutUser(),
  idToken: async () => 't',
}));
vi.mock('../lib/auth/navigate', () => ({ hardNavigate: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => pathname,
  useSearchParams: () => new URLSearchParams(),
}));

import AuthGate from '../components/auth-gate';
import RoleBar from '../components/role-bar';
import Screen from '../components/screen';
import { currentUser } from '../lib/auth/firebase';
import { AuthRoot } from '../lib/auth/mode-context';
import { useSession } from '../lib/auth/session';
import { HOME, resolve } from '../lib/screens';
import { A } from '../lib/nav';
import { ProjectRouteContext, projectRoute } from '../lib/api/project-mode';

const fetchMock = vi.fn();
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
const me = (role: string, displayName = 'Ana Lee') => json(200, { id: 'u1', email: 'a@x.io', displayName, role });
const err = (status: number, code: string, requestId?: string) => json(status, { error: { code, message: 'm', requestId } });
const fb = { uid: 'a', email: 'a@x.io' };

function mount(path: string, view?: string) {
  pathname = path;
  return render(
    <AuthRoot mode="firebase">
      <AuthGate pathname={path} view={view} />
    </AuthRoot>,
  );
}

beforeEach(() => {
  fbCb = null;
  configured = true;
  replace.mockReset();
  signOutUser.mockReset();
  signOutUser.mockResolvedValue(undefined);
  vi.mocked(currentUser).mockReset();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.cookie = 'role=; max-age=0';
});

describe('gate', () => {
  it('E67 loading shows only Loading…, then signed-out replaces to /sign-in with Loading… still shown', async () => {
    mount('/projects');
    expect(screen.getByText('Loading…')).toBeTruthy();
    expect(document.querySelector('header.top')).toBeNull();
    expect(replace).not.toHaveBeenCalled();
    await act(async () => fbCb!(null));
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith('/sign-in');
    expect(screen.getByText('Loading…')).toBeTruthy();
    expect(document.querySelector('header.top')).toBeNull();
  });

  it('authenticated Dev Lead visiting the root lands on the Dev Lead home', async () => {
    fetchMock.mockResolvedValue(me('DEV_LEAD'));
    mount('/');
    await act(async () => fbCb!(fb));
    expect(replace).toHaveBeenCalledWith('/lead/overview');
  });

  it('E54 a 401 from me_4 on /projects, then onUserChanged(null), replaces to /sign-in with no error view', async () => {
    vi.mocked(currentUser).mockReturnValue(fb as never);
    fetchMock.mockImplementation(async () => err(401, 'UNAUTHENTICATED'));
    mount('/projects');
    await act(async () => fbCb!(fb));
    expect(screen.queryByText('Something went wrong.')).toBeNull();
    expect(replace).not.toHaveBeenCalled();
    await act(async () => fbCb!(null));
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith('/sign-in');
    expect(screen.queryByText('Something went wrong.')).toBeNull();
  });

  it('E3 an authenticated 401 signs out and replaces the protected page', async () => {
    vi.mocked(currentUser).mockReturnValue(fb as never);
    fetchMock.mockImplementation(async () => err(401, 'UNAUTHENTICATED'));
    signOutUser.mockImplementation(async () => { fbCb?.(null); });
    mount('/projects');
    await act(async () => fbCb!(fb));
    expect(signOutUser).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith('/sign-in');
    expect(screen.getByText('Loading…')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Projects' })).toBeNull();
  });

  it('E81 setUser while a 403 me_4 is in flight leaves ready and never replaces to /register', async () => {
    let resolveFetch!: (r: Response) => void;
    fetchMock.mockImplementation(() => new Promise<Response>((r) => (resolveFetch = r)));
    let s!: ReturnType<typeof useSession>;
    function Grab() {
      s = useSession();
      return null;
    }
    pathname = '/projects';
    render(
      <AuthRoot mode="firebase">
        <Grab />
        <AuthGate pathname="/projects" />
      </AuthRoot>,
    );
    await act(async () => fbCb!(fb));
    await act(async () => s!.setUser({ id: 'u1', email: 'a@x.io', displayName: 'Ana', role: 'PM' }));
    await act(async () => resolveFetch(err(403, 'USER_NOT_REGISTERED')));
    expect(s!.status).toBe('ready');
    expect(replace).not.toHaveBeenCalledWith('/register');
  });

  it('E100 /register keeps rendering Register during a hold when a user appears', async () => {
    let hold!: () => () => void;
    function Grab() {
      hold = useSession()!.holdForRegistration;
      return null;
    }
    pathname = '/register';
    render(
      <AuthRoot mode="firebase">
        <Grab />
        <AuthGate pathname="/register" />
      </AuthRoot>,
    );
    await act(async () => fbCb!(null));
    let release!: () => void;
    act(() => {
      release = hold();
    });
    await act(async () => fbCb!(fb));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText('Pick your role')).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
    release();
  });

  it('E66 ready as DEV_LEAD on /lead/overview renders the lead overview whatever the role cookie says', async () => {
    document.cookie = 'role=pm';
    fetchMock.mockResolvedValue(me('DEV_LEAD'));
    mount('/lead/overview');
    await act(async () => fbCb!(fb));
    expect(screen.queryByText('Loading…')).toBeNull();
    expect(screen.getByText('Dev Lead')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'Overview' })).toBeTruthy();
    expect(screen.queryByText('Page not found')).toBeNull();
    expect(screen.queryByText('You cannot open this page')).toBeNull();
    expect(replace).not.toHaveBeenCalled();
  });

  it('E68 a 500 shows the error view with the request id; Retry then renders the screen', async () => {
    fetchMock.mockResolvedValueOnce(err(500, 'INTERNAL', 'r9'));
    fetchMock.mockResolvedValueOnce(me('PM'));
    mount('/projects');
    await act(async () => fbCb!(fb));
    expect(screen.getByText('Something went wrong.')).toBeTruthy();
    expect(screen.getByText('Request ID: r9')).toBeTruthy();
    await act(async () => screen.getByRole('button', { name: 'Retry' }).click());
    expect(screen.queryByText('Something went wrong.')).toBeNull();
    expect(screen.getByText('Project Manager')).toBeTruthy();
  });

  it('E69 signing out elsewhere replaces to /sign-in on a protected page; on /sign-in the form stays', async () => {
    fetchMock.mockResolvedValue(me('PM'));
    const a = mount('/projects');
    await act(async () => fbCb!(fb));
    await act(async () => fbCb!(null));
    expect(replace).toHaveBeenCalledWith('/sign-in');
    a.unmount();
    replace.mockReset();
    mount('/sign-in');
    await act(async () => fbCb!(null));
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });

  it('E94 unregistered on /projects replaces to /register', async () => {
    fetchMock.mockResolvedValue(err(403, 'USER_NOT_REGISTERED'));
    mount('/projects');
    await act(async () => fbCb!(fb));
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith('/register');
  });

  it('E94 unregistered on /sign-in replaces to /register; on /register shows Register', async () => {
    fetchMock.mockImplementation(async () => err(403, 'USER_NOT_REGISTERED'));
    const a = mount('/sign-in');
    await act(async () => fbCb!(fb));
    expect(replace).toHaveBeenCalledWith('/register');
    a.unmount();
    replace.mockReset();
    mount('/register');
    await act(async () => fbCb!(fb));
    expect(screen.getByText('Finish setting up')).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });

  it('E95 ready on /sign-in and on /register replaces to /projects once each', async () => {
    fetchMock.mockImplementation(async () => me('PM'));
    for (const p of ['/sign-in', '/register']) {
      replace.mockReset();
      const v = mount(p);
      await act(async () => fbCb!(fb));
      expect(replace).toHaveBeenCalledTimes(1);
      expect(replace).toHaveBeenCalledWith('/projects');
      v.unmount();
    }
  });

  it('E96 error on /sign-in and /register shows the error view with Retry', async () => {
    fetchMock.mockImplementation(async () => err(500, 'INTERNAL'));
    for (const p of ['/sign-in', '/register']) {
      const v = mount(p);
      await act(async () => fbCb!(fb));
      expect(screen.getByText('Something went wrong.')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
      expect(screen.queryByText(/Request ID/)).toBeNull();
      v.unmount();
    }
  });

  it('E97 /styleguide and /states render with no replace while signed-out and unregistered', async () => {
    const heading: Record<string, string> = { '/styleguide': 'Design system', '/states': 'Global states and errors' };
    for (const p of ['/styleguide', '/states']) {
      const v = mount(p);
      await act(async () => fbCb!(null));
      expect(screen.getByRole('heading', { level: 1, name: heading[p] })).toBeTruthy();
      v.unmount();
      fetchMock.mockImplementation(async () => err(403, 'USER_NOT_REGISTERED'));
      const w = mount(p);
      await act(async () => fbCb!(fb));
      expect(screen.getByRole('heading', { level: 1, name: heading[p] })).toBeTruthy();
      w.unmount();
    }
    expect(replace).not.toHaveBeenCalled();
  });

  it('E97 the open pages use role pm even when the user is DEV_LEAD', async () => {
    fetchMock.mockImplementation(async () => me('DEV_LEAD'));
    mount('/styleguide');
    await act(async () => fbCb!(fb));
    expect(screen.getByRole('heading', { level: 1, name: 'Design system' })).toBeTruthy();
    expect(screen.queryByText('You cannot open this page')).toBeNull();
    expect(replace).not.toHaveBeenCalled();
  });

  it('E98 renderToString of the firebase gate has Loading… and no screen markup', () => {
    pathname = '/projects';
    const html = renderToString(
      <AuthRoot mode="firebase">
        <AuthGate pathname="/projects" />
      </AuthRoot>,
    );
    expect(html).toContain('Loading…');
    expect(html).not.toContain('class="top"');
  });

  it('E78 prototype mode renders the canvas sign-in with its prototype buttons and the role bar', () => {
    pathname = '/projects';
    render(
      <AuthRoot mode="prototype">
        <Screen found={resolve('/sign-in', undefined, 'pm')} role="pm" home={HOME.pm} />
        <RoleBar />
      </AuthRoot>,
    );
    expect(screen.getByText('Prototype: sign in as')).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Prototype role' })).toBeTruthy();
  });

  it('N1 a rendered project link replaces default p1 with the active UUID', () => {
    render(
      <ProjectRouteContext.Provider value={projectRoute('/projects/550e8400-e29b-41d4-a716-446655440000/board')}>
        <A href="/projects/p1/board">Board</A>
      </ProjectRouteContext.Provider>,
    );
    expect(screen.getByRole('link', { name: 'Board' }).getAttribute('href')).toBe('/projects/550e8400-e29b-41d4-a716-446655440000/board');
  });

  it('E79 unconfigured, and firebase with firebaseConfigured() false, show only the one line', () => {
    for (const [mode, cfg] of [['unconfigured', true], ['firebase', false]] as const) {
      configured = cfg;
      const v = render(
        <AuthRoot mode={mode}>
          <AuthGate pathname="/projects" />
          <RoleBar />
        </AuthRoot>,
      );
      expect(screen.getByText('Sign-in is not configured for this deployment.')).toBeTruthy();
      expect(v.container.querySelector('header.top')).toBeNull();
      expect(screen.queryByRole('group', { name: 'Prototype role' })).toBeNull();
      v.unmount();
    }
  });
});
