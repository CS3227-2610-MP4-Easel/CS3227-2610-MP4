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
    const cases: [string, string, string, string, string][] = [
      ['DEVELOPER', 'Ana Lee', 'AL', 'Developer', 'r-dev'],
      ['DEV_LEAD', 'bo', 'B', 'Dev Lead', 'r-lead'],
      ['PM', '  Cy  de  Ro ', 'CD', 'Project Manager', 'r-pm'],
    ];
    for (const [role, name, initials, label, cls] of cases) {
      const v = await mountAs(role, name, 'who@x.io');
      expect(v.container.querySelector('.av')!.textContent).toBe(initials);
      expect(v.container.querySelector('.role')!.textContent).toBe(label);
      expect(v.container.querySelector('.role')!.className).toContain(cls);
      expect(v.container.querySelector('.b[style]')!.textContent).toBe(name);
      expect(screen.getByText('who@x.io')).toBeTruthy();
      expect(screen.queryByRole('group', { name: 'Prototype role' })).toBeNull();
      v.unmount();
    }
  });

  it('E51 Sign out calls signOutUser once, then hardNavigate to /sign-in', async () => {
    await mountAs('PM', 'Cy');
    await act(async () => screen.getByRole('button', { name: 'Sign out' }).click());
    expect(signOutUser).toHaveBeenCalledTimes(1);
    expect(hardNavigate).toHaveBeenCalledTimes(1);
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

  it('E99 without a provider Top renders the prototype content and link', () => {
    render(<Top />);
    expect(screen.getByText('Aisha Rahman')).toBeTruthy();
    expect(screen.getByText('Sign out').getAttribute('href')).toBe('/api/as?role=out&to=/sign-in');
  });
});
