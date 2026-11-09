'use client';

import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { signIn } from '../../lib/auth/firebase';
import { useSession } from '../../lib/auth/session';

function messageOf(e: unknown): string {
  const m = (e as { message?: unknown } | null)?.message;
  return typeof m === 'string' && m ? m : 'Something went wrong.';
}

export default function SignIn() {
  const session = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [shown, setShown] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
    } catch (e) {
      setError(messageOf(e));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (<><div className="app" style={{flexDirection: "row", flexWrap: "wrap", alignItems: "stretch"}}><section style={{flex: "1 1 420px", background: "var(--accent)", color: "#fff", padding: "64px 56px", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "48px"}}><div className="brand" style={{fontSize: "20px"}}><span className="logo" style={{background: "var(--ink)", color: "var(--bg)", fontWeight: "800"}}>E</span>Easel</div>{" "}<div className="stack" style={{maxWidth: "440px"}}><h1 style={{fontSize: "36px", lineHeight: "44px", color: "#fff"}}>Plan the sprint. Ship the work. Keep the team in sync.</h1>{" "}<p style={{fontSize: "16px", lineHeight: "26px", color: "#fff"}}>Easel keeps your backlog, board, sprints and daily standups in one place. The assistant drafts; you decide.</p></div>{" "}<p className="small" style={{color: "#fff"}}>CS3227 project platform</p></section>{" "}<section style={{flex: "1 1 480px", display: "flex", alignItems: "center", justifyContent: "center", padding: "48px 24px"}}><form className="card" onSubmit={onSubmit} style={{width: "min(420px, 100%)", padding: "32px", display: "flex", flexDirection: "column", gap: "20px"}}><div className="stack8"><h1>Sign in</h1><p className="muted">Use the email you registered with.</p></div>{" "}<div className="field"><label htmlFor="em">Email</label><input id="em" className="in" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></div>{" "}<div className="field"><label htmlFor="pw">Password</label>{" "}<div style={{position: "relative"}}><input id="pw" className="in" type={shown ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" style={{paddingRight: "64px"}} /><button type="button" className="small b" onClick={() => setShown((s) => !s)} style={{position: "absolute", right: "12px", top: "8px", color: "var(--accent-t)", background: "none", border: 0, padding: 0, cursor: "pointer"}}>{shown ? 'Hide' : 'Show'}</button></div></div>{" "}<button type="submit" className="btn p" disabled={session?.status === 'loading' || busy} aria-busy={busy ? 'true' : undefined} style={{height: "40px"}}>{busy ? 'Please wait…' : 'Sign in'}</button>{" "}<p className="muted" style={{textAlign: "center"}}>New here? <a href="/register" className="b" style={{color: "var(--accent-t)", textDecoration: "underline"}}>Create an account</a></p>{error !== null && <div className="banner b-bad"><span>{error}</span></div>}</form></section></div></>);
}
