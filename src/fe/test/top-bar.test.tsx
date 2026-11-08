import { act, render, screen } from '@testing-library/react';
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
import { AuthRoot } from '../lib/auth/mode-context';

const fetchMock = vi.fn();

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
