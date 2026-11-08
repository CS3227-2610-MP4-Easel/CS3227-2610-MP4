'use client';

import { useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { ApiError, checkCode_2, register_3 } from '../../lib/api';
import type { ApiRole } from '../../lib/api';
import { signUp } from '../../lib/auth/firebase';
import { ROLE_LABEL, useSession } from '../../lib/auth/session';

const ROLES: { value: ApiRole; blurb: string }[] = [
  { value: 'PM', blurb: 'Creates projects, plans the work with the assistant and follows progress.' },
  { value: 'DEV_LEAD', blurb: 'Staffs the team, estimates and assigns tasks, runs sprints and checks project health.' },
  { value: 'DEVELOPER', blurb: 'Works on assigned tasks and prepares a daily standup from their own activity.' },
];

type Fail =
  | { kind: 'generic'; requestId: string | null }
  | { kind: 'firebase'; message: string; signIn: boolean }
  | { kind: 'conflict' }
  | { kind: 'expired' }
  | { kind: 'form'; messages: string[] };
type FieldErrors = { role?: string; code?: string };

function FieldError({ id, text }: { id: string; text?: string }) {
  if (!text) return null;
  return <span className="err-t" id={id}>{text}</span>;
}

function RoleGroup({ role, onPick, error }: { role: ApiRole | null; onPick: (r: ApiRole) => void; error?: string }) {
  return (
    <div className="stack8">
      <div className="stack8" role="radiogroup" aria-label="Role">
        {ROLES.map((r) => (
          <label key={r.value} className="card flat" style={{padding: "14px 16px", display: "flex", gap: "12px", alignItems: "flex-start", cursor: "pointer", ...(role === r.value ? {border: "2px solid var(--accent)", background: "var(--accent-s)"} : {})}}>
            <input type="radio" name="role" value={r.value} checked={role === r.value} onChange={() => onPick(r.value)} style={{marginTop: "4px"}} />
            <div><div className="b">{ROLE_LABEL[r.value]}</div><div className="small muted">{r.blurb}</div></div>
          </label>
        ))}
      </div>
      <FieldError id="role-err" text={error} />
    </div>
  );
}

function CodeField({ id, value, onChange, error, hint }: { id: string; value: string; onChange: (v: string) => void; error?: string; hint?: string }) {
  return (
    <div className="field">
      <label htmlFor={id}>Registration code</label>
      <input id={id} className={error ? 'in err' : 'in'} type="password" autoComplete="off" value={value} onChange={(e) => onChange(e.target.value)} aria-describedby={error ? `${id}-err` : undefined} />
      <FieldError id={`${id}-err`} text={error} />
      {hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}

function Stepper({ step, finish }: { step: 1 | 2; finish: boolean }) {
  const cls = (n: number) => (!finish && n === step ? 'step on' : 'step');
  return (
    <div className="stepper wrap" aria-label="Registration steps">
      <div className={cls(1)}><span className="n">1</span>Role and code</div>
      <svg className="ic" aria-hidden="true"><use href="#i-right" /></svg>
      <div className={cls(2)}><span className="n">2</span>Account</div>
      {finish ? (
        <>
          <svg className="ic" aria-hidden="true"><use href="#i-right" /></svg>
          <div className="step on"><span className="n">3</span>Finish setup</div>
        </>
      ) : null}
    </div>
  );
}

export default function Register() {
  const session = useSession();
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const [step, setStep] = useState<1 | 2>(1);
  const [role, setRole] = useState<ApiRole | null>(null);
  const [code, setCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fields, setFields] = useState<FieldErrors>({});
  const [dnError, setDnError] = useState<string | undefined>(undefined);
  const [fail, setFail] = useState<Fail | null>(null);
  const [wait, setWait] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [accountMade, setAccountMade] = useState(false);
  const inFlight = useRef(false);
  const signedUp = useRef(false);
  const lastStep = useRef<1 | 2 | 3>(1);

  const cooling = wait !== null;
  const coolingRef = useRef(false);
  coolingRef.current = cooling;
  useEffect(() => {
    if (!cooling) return;
    const id = setInterval(() => setWait((w) => (w === null || w <= 1 ? null : w - 1)), 1000);
    return () => clearInterval(id);
  }, [cooling]);

  const finish = session?.status === 'unregistered' && !accountMade;
  const blocked = busy || cooling || session?.status === 'loading';

  function handle(e: unknown, from: 1 | 2 | 3) {
    const next: FieldErrors = {};
    if (e instanceof ApiError) {
      if (e.status === 401 && from !== 1) {
        // apiFetch has signed the Firebase user out, so the next attempt starts from sign-up again.
        signedUp.current = false;
        setAccountMade(false);
        setCode('');
        setFail({ kind: 'expired' });
        return;
      }
      if (e.status === 429 || e.code === 'RATE_LIMITED') {
        setWait(Math.max(1, e.retryAfterSeconds ?? 60));
        return;
      }
      if (e.status === 403 && e.code === 'REGISTRATION_CODE_INVALID') {
        setFields({ code: 'Code not accepted.' });
        if (from === 2) setStep(1);
        return;
      }
      if (e.status === 409 && e.code === 'ALREADY_REGISTERED') {
        setCode('');
        setFail({ kind: 'conflict' });
        return;
      }
      if (e.status === 422 && e.code === 'VALIDATION_FAILED') {
        const rest: string[] = [];
        for (const d of e.details) {
          if (d.field === 'displayName') setDnError(d.message);
          else if (d.field === 'role' || d.field === 'code') next[d.field] = d.message;
          else rest.push(d.message);
        }
        setFields(next);
        if (rest.length) setFail({ kind: 'form', messages: rest });
        if (from === 2 && (next.role || next.code)) setStep(1);
        return;
      }
      setFail({ kind: 'generic', requestId: e.requestId });
      return;
    }
    const c = (e as { code?: unknown } | null)?.code;
    const m = (e as { message?: unknown } | null)?.message;
    if (typeof c === 'string' && c.startsWith('auth/') && typeof m === 'string') {
      setFail({ kind: 'firebase', message: m, signIn: c === 'auth/email-already-in-use' });
      return;
    }
    setFail({ kind: 'generic', requestId: null });
  }

  async function run(from: 1 | 2 | 3, work: () => Promise<void>) {
    if (inFlight.current || coolingRef.current) return;
    inFlight.current = true;
    lastStep.current = from;
    setBusy(true);
    setFail(null);
    setFields({});
    if (from !== 1) setDnError(undefined);
    try {
      await work();
    } catch (e) {
      handle(e, from);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  function onNext(ev?: FormEvent) {
    ev?.preventDefault();
    if (!role) return;
    void run(1, async () => {
      await checkCode_2(role, code);
      setStep(2);
    });
  }

  async function complete(r: ApiRole) {
    const u = await register_3(r, code, displayName);
    setCode('');
    sessionRef.current?.setUser(u);
  }

  function onCreate(ev?: FormEvent) {
    ev?.preventDefault();
    if (!role) return;
    void run(2, async () => {
      const release = sessionRef.current?.holdForRegistration();
      try {
        if (!signedUp.current) {
          await signUp(email, password);
          signedUp.current = true;
          setAccountMade(true);
        }
        await complete(role);
      } finally {
        release?.();
      }
    });
  }

  function onFinish(ev?: FormEvent) {
    ev?.preventDefault();
    if (!role) return;
    void run(3, async () => {
      await checkCode_2(role, code);
      await complete(role);
    });
  }

  function retry() {
    if (lastStep.current === 1) onNext();
    else if (lastStep.current === 2) onCreate();
    else onFinish();
  }

  const label =(text: string) => (busy ? 'Please wait…' : text);
  const busyAttr = busy ? 'true' : undefined;

  const banners: ReactNode = (
    <>
      {wait !== null && (
        <div className="banner b-warn" role="alert"><span>Too many attempts. Try again in {wait} {wait === 1 ? 'second' : 'seconds'}.</span></div>
      )}
      {fail?.kind === 'conflict' && (
        <div className="banner b-bad"><span>This account is already registered. Sign in instead.</span> <a href="/sign-in">Sign in instead</a></div>
      )}
      {fail?.kind === 'expired' && (
        <div className="banner b-bad"><span>Something went wrong.</span> <a href="/sign-in">Sign in instead</a></div>
      )}
      {fail?.kind === 'firebase' && (
        <div className="banner b-bad"><span>{fail.message}</span>{fail.signIn ? <> <a href="/sign-in">Sign in instead</a></> : null}</div>
      )}
      {fail?.kind === 'form' && (
        <div className="banner b-bad">{fail.messages.map((m, i) => <span key={i}>{m}</span>)}</div>
      )}
      {fail?.kind === 'generic' && (
        <div className="banner b-bad">
          <span>Something went wrong.</span>
          <button type="button" className="btn" onClick={retry} disabled={blocked}>Retry</button>
          {fail.requestId ? <span className="small">Request ID: {fail.requestId}</span> : null}
        </div>
      )}
    </>
  );

  const shell = (children: ReactNode) => (
    <div className="app" style={{alignItems: "center", padding: "40px 24px 64px", gap: "28px"}}>
      <div className="brand" style={{fontSize: "20px"}}><span className="logo" style={{fontWeight: "800", fontSize: "13px"}}>E</span>Easel</div>
      <Stepper step={step} finish={finish} />
      <div style={{display: "flex", justifyContent: "center", maxWidth: "540px", width: "100%"}}>{children}</div>
    </div>
  );
  const cardStyle = {flex: "1 1 400px", maxWidth: "540px", padding: "32px", display: "flex", flexDirection: "column" as const, gap: "20px"};

  if (finish) {
    return shell(
      <form className="card" onSubmit={onFinish} style={cardStyle}>
        <div className="stack8">
          <h1>Finish setting up</h1>
          <p className="muted">You are signed in as {session?.firebaseEmail}, but your profile is not set up yet. You do not need to create the account again.</p>
        </div>
        <RoleGroup role={role} onPick={setRole} error={fields.role} />
        <CodeField id="fc" value={code} onChange={setCode} error={fields.code} />
        <div className="field">
          <label htmlFor="fn">Display name</label>
          <input id="fn" className={dnError ? 'in err' : 'in'} value={displayName} onChange={(e) => setDisplayName(e.target.value)} autoComplete="name" />
          <FieldError id="fn-err" text={dnError} />
          <span className="hint">1 to 100 characters</span>
        </div>
        {banners}
        <div className="row between">
          <button type="button" className="muted b" onClick={() => { void sessionRef.current?.signOut().catch(() => {}); }} style={{background: "none", border: 0, padding: 0, cursor: "pointer"}}>Sign out</button>
          <button type="submit" className="btn p" disabled={blocked || !role} aria-busy={busyAttr} style={{height: "40px", padding: "0 24px"}}>{label('Finish')}</button>
        </div>
      </form>,
    );
  }

  if (step === 1) {
    return shell(
      <form className="card" onSubmit={onNext} style={cardStyle}>
        <div className="stack8"><h1>Pick your role</h1><p className="muted">Your role decides what you can do. It cannot be changed after you register.</p></div>
        <RoleGroup role={role} onPick={setRole} error={fields.role} />
        <CodeField id="code" value={code} onChange={setCode} error={fields.code} hint="Ask your course team for the code for your role. It is checked before any account is created." />
        {banners}
        <div className="row between">
          <a href="/sign-in" className="muted b">Back to sign in</a>
          <button type="submit" className="btn p" disabled={blocked || !role} aria-busy={busyAttr} style={{height: "40px", padding: "0 24px"}}>{label('Next')}</button>
        </div>
      </form>,
    );
  }

  return shell(
    <form className="card" onSubmit={onCreate} style={cardStyle}>
      <div className="stack8">
        <span className="chip c-ok" style={{alignSelf: "flex-start"}}><svg className="ic" aria-hidden="true"><use href="#i-check" /></svg>Role: {role ? ROLE_LABEL[role] : ''}, code accepted</span>
        <h2>Create your account</h2>
      </div>
      <div className="field">
        <label htmlFor="n">Display name</label>
        <input id="n" className={dnError ? 'in err' : 'in'} value={displayName} onChange={(e) => setDisplayName(e.target.value)} autoComplete="name" />
        <FieldError id="n-err" text={dnError} />
      </div>
      <div className="field"><label htmlFor="e">Email</label><input id="e" className="in" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" disabled={accountMade} /></div>
      <div className="field"><label htmlFor="p">Password</label><input id="p" className="in" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" disabled={accountMade} /></div>
      {banners}
      <div className="row between">
        <button type="button" className="muted b" onClick={() => { setStep(1); setFail(null); setFields({}); }} style={{background: "none", border: 0, padding: 0, cursor: "pointer"}}>Back</button>
        <button type="submit" className="btn p" disabled={blocked} aria-busy={busyAttr} style={{height: "40px", padding: "0 24px"}}>{label('Create account')}</button>
      </div>
    </form>,
  );
}
