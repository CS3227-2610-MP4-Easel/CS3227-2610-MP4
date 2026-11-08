import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type FbUser = { uid: string; email: string | null };
let fbCb: ((u: FbUser | null) => void) | null = null;
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
  usePathname: () => '/register',
  useSearchParams: () => new URLSearchParams(),
}));

import AuthGate from '../components/auth-gate';
import { AuthRoot } from '../lib/auth/mode-context';
import { signOutUser, signUp } from '../lib/auth/firebase';
import { hardNavigate } from '../lib/auth/navigate';

const CODE = 'sekret-code-9';
const fetchMock = vi.fn();
const err = (status: number, code: string, extra: Record<string, unknown> = {}, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify({ error: { code, message: 'm', ...extra } }), { status, headers });
const ok = (body: unknown = {}) => new Response(JSON.stringify(body), { status: 200 });
const USER = { id: 'u1', email: 'a@x.io', displayName: 'Ana', role: 'PM' };
const notRegistered = () => err(403, 'USER_NOT_REGISTERED');

type Handlers = { check?: () => Response; reg?: () => Response; me?: () => Response };
function route(h: Handlers) {
  fetchMock.mockImplementation(async (url: string) => {
    if (url.includes('check-code')) return (h.check ?? (() => ok()))();
    if (url.includes('/auth/register')) return (h.reg ?? (() => ok(USER)))();
    return (h.me ?? notRegistered)();
  });
}
const calls = (part: string) => fetchMock.mock.calls.filter((c) => String(c[0]).includes(part));
const body = (c: unknown[]) => JSON.parse((c[1] as { body: string }).body);

function mount() {
  const u = userEvent.setup();
  const view = render(
    <AuthRoot mode="firebase">
      <AuthGate pathname="/register" />
    </AuthRoot>,
  );
  return { u, ...view };
}
const signedOut = () => act(async () => fbCb!(null));

async function step1(u: ReturnType<typeof userEvent.setup>, code = CODE) {
  await u.click(screen.getByRole('radio', { name: /Project Manager/ }));
  await u.type(screen.getByLabelText('Registration code'), code);
  await u.click(screen.getByRole('button', { name: 'Next' }));
}
async function step2(u: ReturnType<typeof userEvent.setup>, name = 'Ana') {
  await u.type(screen.getByLabelText('Display name'), name);
  await u.type(screen.getByLabelText('Email'), 'a@x.io');
  await u.type(screen.getByLabelText('Password'), 'pw123456');
  await u.click(screen.getByRole('button', { name: 'Create account' }));
}
const text = () => document.body.textContent ?? '';
function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((res) => { resolve = res; });
  return { promise, resolve };
}

beforeEach(() => {
  fbCb = null;
  replace.mockReset();
  fetchMock.mockReset();
  vi.mocked(signUp).mockReset();
  vi.mocked(signUp).mockResolvedValue(undefined as never);
  vi.mocked(signOutUser).mockClear();
  vi.mocked(hardNavigate).mockClear();
  localStorage.clear();
  sessionStorage.clear();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('register step 1', () => {
  it('E73 sends the trimmed code to checkCode_2', async () => {
    route({});
    const { u } = mount();
    await signedOut();
    await step1(u, '  abc  ');
    expect(body(calls('check-code')[0])).toEqual({ role: 'PM', code: 'abc' });
    expect(screen.getByRole('heading', { name: 'Create your account' })).toBeTruthy();
  });

  it('E74 Next is disabled with no role and checkCode_2 is not called', async () => {
    route({});
    const { u } = mount();
    await signedOut();
    const next = screen.getByRole('button', { name: 'Next' }) as HTMLButtonElement;
    expect(next.disabled).toBe(true);
    await u.click(next);
    expect(calls('check-code')).toHaveLength(0);
    expect((screen.getAllByRole('radio') as HTMLInputElement[]).every((r) => !r.checked)).toBe(true);
  });

  it('E52a 403 at Next shows Code not accepted and stays on step 1', async () => {
    route({ check: () => err(403, 'REGISTRATION_CODE_INVALID') });
    const { u } = mount();
    await signedOut();
    await step1(u);
    expect(screen.getByText('Code not accepted.')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Pick your role' })).toBeTruthy();
  });

  it('E52e NETWORK at Next shows Something went wrong with Retry and no Request ID', async () => {
    fetchMock.mockRejectedValue(new TypeError('x'));
    const { u } = mount();
    await signedOut();
    await step1(u);
    expect(screen.getByText('Something went wrong.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
    expect(text()).not.toContain('Request ID');
  });

  it('E34 429 counts down from Retry-After, disables submit, then clears', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    route({ check: () => err(429, 'RATE_LIMITED', {}, { 'Retry-After': '3' }) });
    const { u } = mount();
    await signedOut();
    await step1(u);
    const next = () => screen.getByRole('button', { name: 'Next' }) as HTMLButtonElement;
    expect(screen.getByText('Too many attempts. Try again in 3 seconds.')).toBeTruthy();
    expect(next().disabled).toBe(true);
    await act(async () => { vi.advanceTimersByTime(1000); });
    expect(screen.getByText('Too many attempts. Try again in 2 seconds.')).toBeTruthy();
    await act(async () => { vi.advanceTimersByTime(1000); });
    expect(screen.getByText('Too many attempts. Try again in 1 second.')).toBeTruthy();
    await act(async () => { vi.advanceTimersByTime(1000); });
    expect(screen.queryByText(/Too many attempts/)).toBeNull();
    expect(next().disabled).toBe(false);
  });
});

describe('register step 2', () => {
  it('E32 runs checkCode_2, signUp, register_3, setUser in order and the gate replaces to /projects', async () => {
    const order: string[] = [];
    route({ check: () => (order.push('check'), ok()), reg: () => (order.push('reg'), ok(USER)) });
    vi.mocked(signUp).mockImplementation(async () => { order.push('signUp'); });
    const { u } = mount();
    await signedOut();
    await step1(u);
    await step2(u);
    expect(order).toEqual(['check', 'signUp', 'reg']);
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith('/projects');
  });

  it('E100 a user change between signUp and register_3 triggers no me_4 and ends ready', async () => {
    const reg = deferred<Response>();
    route({ reg: () => reg.promise as unknown as Response });
    vi.mocked(signUp).mockImplementation(async () => { fbCb!({ uid: 'a', email: 'a@x.io' }); });
    const { u } = mount();
    await signedOut();
    await step1(u);
    await step2(u);
    expect(calls('/auth/register')).toHaveLength(1);
    expect(calls('/api/me')).toHaveLength(0);
    expect(screen.getByRole('heading', { name: 'Create your account' })).toBeTruthy();
    expect(screen.queryByText(/profile is not set up/)).toBeNull();
    await act(async () => reg.resolve(ok(USER)));
    expect(calls('/api/me')).toHaveLength(0);
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith('/projects');
  });

  it('E81 register_3 success discards a me_4 403 that is in flight', async () => {
    let lateMe: (r: Response) => void = () => {};
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('check-code')) return ok();
      if (url.includes('/auth/register')) {
        // a second user change starts a me_4 that is still pending when register_3 succeeds
        fbCb!({ uid: 'a', email: 'a@x.io' });
        return ok(USER);
      }
      return new Promise<Response>((res) => { lateMe = res; });
    });
    vi.mocked(signUp).mockImplementation(async () => { fbCb!({ uid: 'a', email: 'a@x.io' }); });
    const { u } = mount();
    await signedOut();
    await step1(u);
    await step2(u);
    expect(calls('/api/me')).toHaveLength(1);
    await act(async () => lateMe(notRegistered()));
    expect(screen.queryByText(/profile is not set up/)).toBeNull();
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith('/projects');
    expect(replace).not.toHaveBeenCalledWith('/register');
  });

  it('E101 register_3 500 then Retry calls signUp once and register_3 twice', async () => {
    let n = 0;
    route({ reg: () => (++n === 1 ? err(500, 'INTERNAL') : ok(USER)) });
    const { u } = mount();
    await signedOut();
    await step1(u);
    await step2(u);
    expect(screen.getByText('Something went wrong.')).toBeTruthy();
    await u.click(screen.getByRole('button', { name: 'Retry' }));
    expect(signUp).toHaveBeenCalledTimes(1);
    expect(calls('/auth/register')).toHaveLength(2);
    expect(body(calls('/auth/register')[1]).code).toBe(CODE);
  });

  it('E101 the hold is released after a failed register_3 so a later user change reads me_4', async () => {
    route({ reg: () => err(500, 'INTERNAL') });
    const { u } = mount();
    await signedOut();
    await step1(u);
    await step2(u);
    expect(screen.getByText('Something went wrong.')).toBeTruthy();
    expect(calls('/api/me')).toHaveLength(0);
    await act(async () => fbCb!({ uid: 'a', email: 'a@x.io' }));
    expect(calls('/api/me')).toHaveLength(1);
  });

  it('E101 after a 422 on displayName, correcting it and Create account again skips signUp', async () => {
    let n = 0;
    route({ reg: () => (++n === 1 ? err(422, 'VALIDATION_FAILED', { details: [{ field: 'displayName', message: 'dn bad' }] }) : ok(USER)) });
    const { u } = mount();
    await signedOut();
    await step1(u);
    await step2(u);
    expect(screen.getByText('dn bad')).toBeTruthy();
    expect((screen.getByLabelText('Email') as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByLabelText('Password') as HTMLInputElement).disabled).toBe(true);
    await u.type(screen.getByLabelText('Display name'), 'b');
    await u.click(screen.getByRole('button', { name: 'Create account' }));
    expect(signUp).toHaveBeenCalledTimes(1);
    expect(calls('/auth/register')).toHaveLength(2);
    expect(replace).toHaveBeenCalledWith('/projects');
  });

  it('E52c a 422 with displayName and code keeps the display name message for step 2', async () => {
    let n = 0;
    route({
      reg: () => (++n === 1 ? err(422, 'VALIDATION_FAILED', { details: [{ field: 'displayName', message: 'dn bad' }, { field: 'code', message: 'code bad' }] }) : ok(USER)),
    });
    const { u } = mount();
    await signedOut();
    await step1(u);
    await step2(u);
    const card = within(document.querySelector('form') as HTMLElement);
    expect(card.getByText('code bad')).toBeTruthy();
    expect(card.queryByText('dn bad')).toBeNull();
    await u.click(screen.getByRole('button', { name: 'Next' }));
    expect(within(document.querySelector('form') as HTMLElement).getByText('dn bad')).toBeTruthy();
    expect(within(document.querySelector('form') as HTMLElement).queryByText('code bad')).toBeNull();
  });

  it('E52a 403 at Create account shows Code not accepted under the code field', async () => {
    route({ reg: () => err(403, 'REGISTRATION_CODE_INVALID') });
    const { u } = mount();
    await signedOut();
    await step1(u);
    await step2(u);
    expect(screen.getByText('Code not accepted.')).toBeTruthy();
    expect(screen.getByLabelText('Registration code')).toBeTruthy();
  });

  it('E52b 409 at Create account shows the already-registered banner with a sign-in link', async () => {
    route({ reg: () => err(409, 'ALREADY_REGISTERED') });
    const { u } = mount();
    await signedOut();
    await step1(u);
    await step2(u);
    expect(screen.getByText('This account is already registered. Sign in instead.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Sign in instead' }).getAttribute('href')).toBe('/sign-in');
  });

  it('E52c 422 details land under their fields', async () => {
    route({
      reg: () => err(422, 'VALIDATION_FAILED', { details: [{ field: 'displayName', message: 'dn bad' }, { field: 'code', message: 'code bad' }, { field: 'role', message: 'role bad' }] }),
    });
    const { u } = mount();
    await signedOut();
    await step1(u);
    await step2(u);
    expect(screen.getByText('code bad')).toBeTruthy();
    expect(screen.getByText('role bad')).toBeTruthy();
  });

  it('E52c a 422 for displayName alone stays on step 2 under the display name', async () => {
    route({ reg: () => err(422, 'VALIDATION_FAILED', { details: [{ field: 'displayName', message: 'dn bad' }] }) });
    const { u } = mount();
    await signedOut();
    await step1(u);
    await step2(u);
    expect(screen.getByText('dn bad')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Create your account' })).toBeTruthy();
  });

  it('E52d 422 on an unknown field goes to the form banner', async () => {
    route({ reg: () => err(422, 'VALIDATION_FAILED', { details: [{ field: 'other', message: 'other bad' }] }) });
    const { u } = mount();
    await signedOut();
    await step1(u);
    await step2(u);
    expect(within(document.querySelector('.banner') as HTMLElement).getByText('other bad')).toBeTruthy();
  });

  it('E52f 500 with a request id shows it and Retry', async () => {
    route({ reg: () => err(500, 'INTERNAL', { requestId: 'r2' }) });
    const { u } = mount();
    await signedOut();
    await step1(u);
    await step2(u);
    expect(screen.getByText('Something went wrong.')).toBeTruthy();
    expect(screen.getByText('Request ID: r2')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
  });

  it('E52g a Firebase error shows its message unchanged without a sign-in link', async () => {
    route({});
    vi.mocked(signUp).mockRejectedValue(Object.assign(new Error('m1'), { code: 'auth/weak-password' }));
    const { u } = mount();
    await signedOut();
    await step1(u);
    await step2(u);
    expect(screen.getByText('m1')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Sign in instead' })).toBeNull();
    expect(calls('/auth/register')).toHaveLength(0);
  });

  it('E53 email-already-in-use shows the message and a sign-in link', async () => {
    route({});
    vi.mocked(signUp).mockRejectedValue(Object.assign(new Error('taken'), { code: 'auth/email-already-in-use' }));
    const { u } = mount();
    await signedOut();
    await step1(u);
    await step2(u);
    expect(screen.getByText('taken')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Sign in instead' }).getAttribute('href')).toBe('/sign-in');
  });

  it('E75 Back keeps role and code and Next calls checkCode_2 again', async () => {
    route({});
    const { u } = mount();
    await signedOut();
    await step1(u);
    await u.click(screen.getByRole('button', { name: 'Back' }));
    expect((screen.getByRole('radio', { name: /Project Manager/ }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText('Registration code') as HTMLInputElement).value).toBe(CODE);
    await u.click(screen.getByRole('button', { name: 'Next' }));
    expect(calls('check-code')).toHaveLength(2);
  });

  async function fillStep2(u: ReturnType<typeof userEvent.setup>) {
    await u.type(screen.getByLabelText('Display name'), 'Ana');
    await u.type(screen.getByLabelText('Email'), 'a@x.io');
    await u.type(screen.getByLabelText('Password'), 'pw123456');
  }

  it('E80 a double click while signUp is pending calls signUp once, with busy label and aria-busy', async () => {
    route({});
    const su = deferred<void>();
    vi.mocked(signUp).mockImplementation(() => su.promise as never);
    const { u } = mount();
    await signedOut();
    await step1(u);
    await fillStep2(u);
    await u.dblClick(screen.getByRole('button', { name: 'Create account' }));
    expect(signUp).toHaveBeenCalledTimes(1);
    const busy = screen.getByRole('button', { name: 'Please wait…' }) as HTMLButtonElement;
    expect(busy.getAttribute('aria-busy')).toBe('true');
    expect(busy.disabled).toBe(true);
    await act(async () => su.resolve());
    expect(signUp).toHaveBeenCalledTimes(1);
    expect(calls('/auth/register')).toHaveLength(1);
  });

  it('E80 a double click while register_3 is pending calls register_3 once', async () => {
    const reg = deferred<Response>();
    route({ reg: () => reg.promise as unknown as Response });
    const { u } = mount();
    await signedOut();
    await step1(u);
    await fillStep2(u);
    await u.dblClick(screen.getByRole('button', { name: 'Create account' }));
    expect(signUp).toHaveBeenCalledTimes(1);
    expect(calls('/auth/register')).toHaveLength(1);
    await act(async () => reg.resolve(ok(USER)));
    expect(calls('/auth/register')).toHaveLength(1);
  });

  it('E51 Create account is disabled while the session status is loading', async () => {
    route({ me: () => new Promise<Response>(() => {}) as unknown as Response });
    const { u } = mount();
    await signedOut();
    await step1(u);
    await act(async () => fbCb!({ uid: 'a', email: 'a@x.io' }));
    expect((screen.getByRole('button', { name: 'Create account' }) as HTMLButtonElement).disabled).toBe(true);
    expect(signUp).not.toHaveBeenCalled();
  });

  it('E34 a 429 at Create account counts down and continues across Back', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    route({ reg: () => err(429, 'RATE_LIMITED', {}, { 'Retry-After': '3' }) });
    const { u } = mount();
    await signedOut();
    await step1(u);
    await fillStep2(u);
    await u.click(screen.getByRole('button', { name: 'Create account' }));
    expect(screen.getByText('Too many attempts. Try again in 3 seconds.')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Create account' }) as HTMLButtonElement).disabled).toBe(true);
    await u.click(screen.getByRole('button', { name: 'Back' }));
    await act(async () => { vi.advanceTimersByTime(1000); });
    expect(screen.getByText('Too many attempts. Try again in 2 seconds.')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Next' }) as HTMLButtonElement).disabled).toBe(true);
    expect(calls('check-code')).toHaveLength(1);
  });

  it('E39 a script-like display name is sent as typed and adds no script element', async () => {
    route({});
    const { u } = mount();
    await signedOut();
    await step1(u);
    await u.type(screen.getByLabelText('Display name'), '<script>alert(1)</script>');
    await u.type(screen.getByLabelText('Email'), 'a@x.io');
    await u.type(screen.getByLabelText('Password'), 'pw123456');
    await u.click(screen.getByRole('button', { name: 'Create account' }));
    expect(body(calls('/auth/register')[0]).displayName).toBe('<script>alert(1)</script>');
    expect(document.querySelector('script')).toBeNull();
  });
});

describe('finish setup', () => {
  async function toFinish() {
    const m = mount();
    await signedOut();
    await act(async () => fbCb!({ uid: 'a', email: 'a@x.io' }));
    return m;
  }

  it('E33 an unregistered session shows finish setup with the email and Finish reaches /projects', async () => {
    route({});
    const { u } = await toFinish();
    expect(screen.getByText(/You are signed in as a@x.io, but your profile is not set up yet/)).toBeTruthy();
    await u.click(screen.getByRole('radio', { name: /Developer/ }));
    await u.type(screen.getByLabelText('Registration code'), CODE);
    await u.type(screen.getByLabelText('Display name'), 'Ana');
    await u.click(screen.getByRole('button', { name: 'Finish' }));
    expect(signUp).not.toHaveBeenCalled();
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith('/projects');
  });

  it('E52h a 500 at Finish then Retry reaches /projects', async () => {
    let n = 0;
    route({ reg: () => (++n === 1 ? err(500, 'INTERNAL') : ok(USER)) });
    const { u } = await toFinish();
    await u.click(screen.getByRole('radio', { name: /Developer/ }));
    await u.type(screen.getByLabelText('Registration code'), CODE);
    await u.type(screen.getByLabelText('Display name'), 'Ana');
    await u.click(screen.getByRole('button', { name: 'Finish' }));
    expect(replace).not.toHaveBeenCalled();
    await u.click(screen.getByRole('button', { name: 'Retry' }));
    expect(replace).toHaveBeenCalledWith('/projects');
  });

  it('E52a/E52b 403 and 409 at Finish show their messages', async () => {
    route({ check: () => err(403, 'REGISTRATION_CODE_INVALID') });
    const { u } = await toFinish();
    await u.click(screen.getByRole('radio', { name: /Developer/ }));
    await u.type(screen.getByLabelText('Registration code'), CODE);
    await u.click(screen.getByRole('button', { name: 'Finish' }));
    expect(screen.getByText('Code not accepted.')).toBeTruthy();
    route({ reg: () => err(409, 'ALREADY_REGISTERED') });
    await u.click(screen.getByRole('button', { name: 'Finish' }));
    expect(screen.getByText('This account is already registered. Sign in instead.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Sign in instead' }).getAttribute('href')).toBe('/sign-in');
    expect((screen.getByLabelText('Registration code') as HTMLInputElement).value).toBe('');
  });

  it('E52c 422 at Finish puts each message under its field', async () => {
    route({
      reg: () => err(422, 'VALIDATION_FAILED', { details: [{ field: 'displayName', message: 'dn bad' }, { field: 'code', message: 'code bad' }, { field: 'role', message: 'role bad' }] }),
    });
    const { u } = await toFinish();
    await u.click(screen.getByRole('radio', { name: /Developer/ }));
    await u.type(screen.getByLabelText('Registration code'), CODE);
    await u.click(screen.getByRole('button', { name: 'Finish' }));
    expect(screen.getByText('dn bad')).toBeTruthy();
    expect(screen.getByText('code bad')).toBeTruthy();
    expect(screen.getByText('role bad')).toBeTruthy();
  });

  it('E102 a 429 without Retry-After shows 60 seconds and the timer stops on unmount', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    route({ reg: () => err(429, 'RATE_LIMITED') });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const m = mount();
    await signedOut();
    await act(async () => fbCb!({ uid: 'a', email: 'a@x.io' }));
    await m.u.click(screen.getByRole('radio', { name: /Developer/ }));
    await m.u.type(screen.getByLabelText('Registration code'), CODE);
    await m.u.click(screen.getByRole('button', { name: 'Finish' }));
    expect(screen.getByText('Too many attempts. Try again in 60 seconds.')).toBeTruthy();
    m.unmount();
    await act(async () => { vi.advanceTimersByTime(5000); });
    expect(vi.getTimerCount()).toBe(0);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('E76 Sign out calls signOutUser once and hard-navigates to /sign-in', async () => {
    route({});
    const { u } = await toFinish();
    await u.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(signOutUser).toHaveBeenCalledTimes(1);
    expect(hardNavigate).toHaveBeenCalledWith('/sign-in');
  });
});

describe('secrets and lifecycle', () => {
  function expectNoCode() {
    expect(JSON.stringify({ ...localStorage })).not.toContain(CODE);
    expect(JSON.stringify({ ...sessionStorage })).not.toContain(CODE);
    expect(document.cookie).not.toContain(CODE);
    expect(location.href).not.toContain(CODE);
    expect(text()).not.toContain(CODE);
    for (const i of Array.from(document.querySelectorAll('input'))) expect((i as HTMLInputElement).value).not.toContain(CODE);
  }

  it('E55 the code is absent everywhere after register_3 success', async () => {
    let finishReg: (r: Response) => void = () => {};
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('check-code')) return ok();
      if (url.includes('/auth/register')) return new Promise<Response>((res) => { finishReg = res; });
      return notRegistered();
    });
    const { u } = mount();
    await signedOut();
    await step1(u);
    await step2(u);
    expectNoCode();
    await act(async () => finishReg(ok(USER)));
    expectNoCode();
  });

  it('E55 the code is absent after a 409', async () => {
    route({ reg: () => err(409, 'ALREADY_REGISTERED') });
    const { u } = mount();
    await signedOut();
    await step1(u);
    await step2(u);
    expect(screen.getByText('This account is already registered. Sign in instead.')).toBeTruthy();
    await u.click(screen.getByRole('button', { name: 'Back' }));
    expectNoCode();
  });

  it('E103 unmount after signUp without setUser calls retry once and a remount starts empty at step 1', async () => {
    route({ reg: () => err(500, 'INTERNAL') });
    const m2 = mount();
    await signedOut();
    await step1(m2.u);
    vi.mocked(signUp).mockClear();
    await step2(m2.u);
    const before = calls('/api/me').length;
    m2.unmount();
    await act(async () => {});
    expect(calls('/api/me').length).toBe(before + 1);
    const m3 = mount();
    await signedOut();
    expect(screen.getByRole('heading', { name: 'Pick your role' })).toBeTruthy();
    expect((screen.getByLabelText('Registration code') as HTMLInputElement).value).toBe('');
    m3.unmount();
  });

  it('E103 unmount after setUser does not call retry', async () => {
    route({});
    const m = mount();
    await signedOut();
    await step1(m.u);
    await step2(m.u);
    expect(replace).toHaveBeenCalledWith('/projects');
    const before = calls('/api/me').length;
    m.unmount();
    await act(async () => {});
    expect(calls('/api/me').length).toBe(before);
  });

  it('E55 finish setup: the code is in the input before submit and gone after success', async () => {
    const reg = deferred<Response>();
    route({ reg: () => reg.promise as unknown as Response });
    const m = mount();
    await signedOut();
    await act(async () => fbCb!({ uid: 'a', email: 'a@x.io' }));
    await m.u.click(screen.getByRole('radio', { name: /Developer/ }));
    await m.u.type(screen.getByLabelText('Registration code'), CODE);
    expect((screen.getByLabelText('Registration code') as HTMLInputElement).value).toBe(CODE);
    await m.u.type(screen.getByLabelText('Display name'), 'Ana');
    await m.u.click(screen.getByRole('button', { name: 'Finish' }));
    await act(async () => reg.resolve(ok(USER)));
    expectNoCode();
    expect(replace).toHaveBeenCalledWith('/projects');
  });

  it('E104 code inputs disable autocomplete and the password uses new-password', async () => {
    route({});
    const { u } = mount();
    await signedOut();
    expect(screen.getByLabelText('Registration code').getAttribute('autocomplete')).toBe('off');
    await step1(u);
    expect(screen.getByLabelText('Password').getAttribute('autocomplete')).toBe('new-password');
    expect(screen.getByLabelText('Email').getAttribute('type')).toBe('email');
  });

  it('E104 the finish setup code input disables autocomplete', async () => {
    route({});
    mount();
    await signedOut();
    await act(async () => fbCb!({ uid: 'a', email: 'a@x.io' }));
    expect(screen.getByLabelText('Registration code').getAttribute('autocomplete')).toBe('off');
  });
});
