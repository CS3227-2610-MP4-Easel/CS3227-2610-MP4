import { act, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let fbCb: ((u: { uid: string; email: string | null } | null) => void) | null = null;
let configured = true;
const replace = vi.fn();
const router = { replace };
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
  signOutUser: vi.fn(async () => {}),
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
import { AuthRoot } from '../lib/auth/mode-context';
import { HOME, resolve } from '../lib/screens';

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
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('gate', () => {
  it('E67 loading shows only Loading…, then signed-out replaces to /sign-in with Loading… still shown', async () => {
    mount('/projects');
    expect(screen.getByText('Loading…')).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
    await act(async () => fbCb!(null));
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith('/sign-in');
    expect(screen.getByText('Loading…')).toBeTruthy();
  });

  it('E66 ready as DEV_LEAD on /lead/overview renders the lead overview whatever the role cookie says', async () => {
    document.cookie = 'role=pm';
    fetchMock.mockResolvedValue(me('DEV_LEAD'));
    mount('/lead/overview');
    await act(async () => fbCb!(fb));
    expect(screen.queryByText('Loading…')).toBeNull();
    expect(screen.getByText('Dev Lead')).toBeTruthy();
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
    expect(screen.getByText('Sign in')).toBeTruthy();
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
    expect(screen.getByText('Create your account')).toBeTruthy();
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
    for (const p of ['/styleguide', '/states']) {
      const v = mount(p);
      await act(async () => fbCb!(null));
      expect(screen.queryByText('Loading…')).toBeNull();
      v.unmount();
      fetchMock.mockResolvedValue(err(403, 'USER_NOT_REGISTERED'));
      const w = mount(p);
      await act(async () => fbCb!(fb));
      expect(screen.queryByText('Loading…')).toBeNull();
      w.unmount();
    }
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
