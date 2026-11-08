import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let fbCb: ((u: { uid: string; email: string | null } | null) => void) | null = null;
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
  signOutUser: vi.fn(async () => {}),
  idToken: async () => 't',
}));
vi.mock('../lib/auth/navigate', () => ({ hardNavigate: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => '/sign-in',
  useSearchParams: () => new URLSearchParams(),
}));

import AuthGate from '../components/auth-gate';
import { AuthRoot } from '../lib/auth/mode-context';
import { signIn } from '../lib/auth/firebase';

const fetchMock = vi.fn();
const me = () =>
  new Response(JSON.stringify({ id: 'u1', email: 'a@x.io', displayName: 'Ana', role: 'PM' }), { status: 200 });

function mount() {
  return render(
    <AuthRoot mode="firebase">
      <AuthGate pathname="/sign-in" />
    </AuthRoot>,
  );
}

beforeEach(() => {
  fbCb = null;
  replace.mockReset();
  fetchMock.mockReset();
  vi.mocked(signIn).mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('sign-in screen', () => {
  it('E51 signs in with the typed credentials and the gate, not the form, replaces to /projects', async () => {
    fetchMock.mockImplementation(async () => me());
    vi.mocked(signIn).mockResolvedValue(undefined as never);
    mount();
    await act(async () => fbCb!(null));
    const u = userEvent.setup();
    await u.type(screen.getByLabelText('Email'), 'a@x.io');
    await u.type(screen.getByLabelText('Password'), 'secret12');
    await u.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(signIn).toHaveBeenCalledWith('a@x.io', 'secret12');
    expect(replace).not.toHaveBeenCalled();
    await act(async () => fbCb!({ uid: 'a', email: 'a@x.io' }));
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith('/projects');
  });

  it('E71 shows the Firebase message unchanged and does not replace', async () => {
    vi.mocked(signIn).mockRejectedValue(new Error('Firebase: Error (auth/invalid-credential).'));
    mount();
    await act(async () => fbCb!(null));
    const u = userEvent.setup();
    await u.type(screen.getByLabelText('Email'), 'a@x.io');
    await u.type(screen.getByLabelText('Password'), 'bad');
    await u.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByText('Firebase: Error (auth/invalid-credential).')).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });

  it('E72 a double click calls signIn once', async () => {
    vi.mocked(signIn).mockImplementation(() => new Promise(() => {}));
    mount();
    await act(async () => fbCb!(null));
    const u = userEvent.setup();
    await u.type(screen.getByLabelText('Email'), 'a@x.io');
    await u.type(screen.getByLabelText('Password'), 'pw');
    await u.dblClick(screen.getByRole('button', { name: 'Sign in' }));
    expect(signIn).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Please wait…' }).getAttribute('aria-busy')).toBe('true');
  });

  it('E51 submit is disabled while the session is loading', () => {
    mount();
    expect((screen.getByRole('button', { name: 'Sign in' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('E51 Show/Hide flips the password input type', async () => {
    mount();
    await act(async () => fbCb!(null));
    const u = userEvent.setup();
    const pw = screen.getByLabelText('Password') as HTMLInputElement;
    expect(pw.type).toBe('password');
    await u.click(screen.getByRole('button', { name: 'Show' }));
    expect(pw.type).toBe('text');
    await u.click(screen.getByRole('button', { name: 'Hide' }));
    expect(pw.type).toBe('password');
  });
});
