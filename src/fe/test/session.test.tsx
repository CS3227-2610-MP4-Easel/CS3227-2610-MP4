import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let fbCb: ((u: { uid: string; email: string | null } | null) => void) | null = null;
const unsub = vi.fn();
const signOutUser = vi.fn();
vi.mock('../lib/auth/firebase', () => ({
  firebaseConfigured: () => true,
  currentUser: vi.fn(),
  onUserChanged: (cb: typeof fbCb) => {
    fbCb = cb;
    return unsub;
  },
  signIn: vi.fn(),
  signUp: vi.fn(),
  signOutUser: (...a: unknown[]) => signOutUser(...a),
  idToken: async () => 't',
}));
vi.mock('../lib/auth/navigate', () => ({ hardNavigate: vi.fn() }));

import { initialsOf, SessionProvider, useSession, type Session } from '../lib/auth/session';

const fetchMock = vi.fn();
let sess: Session | null = null;

function Probe() {
  sess = useSession();
  return <p>{sess ? `${sess.status}|${sess.user?.role ?? '-'}` : 'none'}</p>;
}

const fb = (uid: string) => ({ uid, email: `${uid}@x.io` });
const user = (role: string, id = 'u1') => ({ id, email: 'a@x.io', displayName: 'A', role });
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
const err = (status: number, code: string, requestId?: string) => json(status, { error: { code, message: 'm', requestId } });
const text = () => screen.getByText(/\|/).textContent;

function mount() {
  render(
    <SessionProvider>
      <Probe />
    </SessionProvider>,
  );
}

beforeEach(() => {
  fbCb = null;
  sess = null;
  fetchMock.mockReset();
  signOutUser.mockReset();
  signOutUser.mockResolvedValue(undefined);
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('session', () => {
  it('E54 a 401 from me_4 starts sign-out and changes nothing; onUserChanged(null) then signs out', async () => {
    fetchMock.mockResolvedValue(err(401, 'UNAUTHENTICATED'));
    mount();
    await act(async () => fbCb!(fb('a')));
    expect(signOutUser).toHaveBeenCalledTimes(1);
    expect(sess!.status).toBe('loading');
    await act(async () => fbCb!(null));
    expect(sess!.status).toBe('signed-out');
    expect(sess!.error).toBeNull();
  });

  it('E70 a reply for uid A that arrives after uid B is discarded', async () => {
    let resolveA!: (r: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise<Response>((r) => (resolveA = r)));
    fetchMock.mockResolvedValueOnce(json(200, user('DEVELOPER', 'b')));
    mount();
    await act(async () => fbCb!(fb('a')));
    await act(async () => fbCb!(fb('b')));
    expect(text()).toBe('ready|DEVELOPER');
    await act(async () => resolveA(json(200, user('PM', 'a'))));
    expect(text()).toBe('ready|DEVELOPER');
  });

  it('E81 setUser while a 403 me_4 is in flight discards the reply', async () => {
    let resolve!: (r: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise<Response>((r) => (resolve = r)));
    mount();
    await act(async () => fbCb!(fb('a')));
    await act(async () => sess!.setUser(user('PM') as never));
    await act(async () => resolve(err(403, 'USER_NOT_REGISTERED')));
    expect(text()).toBe('ready|PM');
  });

  it('E81 a 403 USER_NOT_REGISTERED alone gives unregistered', async () => {
    fetchMock.mockResolvedValue(err(403, 'USER_NOT_REGISTERED'));
    mount();
    await act(async () => fbCb!(fb('a')));
    expect(sess!.status).toBe('unregistered');
  });

  it('E100 with a hold active, null -> user makes no me_4 call and keeps the status', async () => {
    mount();
    await act(async () => fbCb!(null));
    let release!: () => void;
    act(() => {
      release = sess!.holdForRegistration();
    });
    await act(async () => fbCb!(fb('a')));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(sess!.status).toBe('signed-out');
    expect(sess!.firebaseEmail).toBe('a@x.io');
    release();
  });

  it('E100 a user-to-user change under a hold calls me_4; after release null -> user calls it; release is idempotent', async () => {
    fetchMock.mockImplementation(async () => json(200, user('PM')));
    mount();
    await act(async () => fbCb!(null));
    let release!: () => void;
    act(() => {
      release = sess!.holdForRegistration();
    });
    await act(async () => fbCb!(fb('a')));
    expect(fetchMock).not.toHaveBeenCalled();
    await act(async () => fbCb!(fb('b')));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    release();
    release();
    await act(async () => fbCb!(null));
    await act(async () => fbCb!(fb('c')));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const other = sess!.holdForRegistration();
    release();
    await act(async () => fbCb!(null));
    await act(async () => fbCb!(fb('d')));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    other();
  });

  it('E99 useSession outside a provider returns null', () => {
    render(<Probe />);
    expect(screen.getByText('none')).toBeTruthy();
  });

  it('E68 a 500 gives error with the request id, retry then succeeds', async () => {
    fetchMock.mockResolvedValueOnce(err(500, 'INTERNAL', 'r9'));
    fetchMock.mockResolvedValueOnce(json(200, user('PM')));
    mount();
    await act(async () => fbCb!(fb('a')));
    expect(sess!.status).toBe('error');
    expect(sess!.error!.requestId).toBe('r9');
    await act(async () => sess!.retry());
    expect(sess!.status).toBe('ready');
  });

  it('E105 initialsOf takes code points of the first two words', () => {
    expect(initialsOf('😀 Zed')).toBe('😀Z');
    expect(initialsOf('  Cy  de  Ro ')).toBe('CD');
    expect(initialsOf('bo')).toBe('B');
    expect(initialsOf('   ')).toBe('?');
  });
});
