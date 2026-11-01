// @ts-nocheck
// Generated from the design canvas page SignInError.dc.html. Source of truth from here on is this file.
import { Fragment } from 'react';
import { A, css, r, useRole } from '../../lib/nav';


class Logic {
props: any;
constructor(p: any) { this.props = p; }

renderVals() { return {}; }
}

export default function SignInError(props: any = {}) {
  const v = new Logic(props).renderVals();
  return (<><div className="app" style={{flexDirection: "row", flexWrap: "wrap", alignItems: "stretch"}}><section style={{flex: "1 1 420px", background: "var(--accent)", color: "#fff", padding: "64px 56px", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "48px"}}><div className="brand" style={{fontSize: "20px"}}><span className="logo" style={{background: "var(--ink)", color: "var(--bg)", fontWeight: "800"}}>E</span>Easel</div>{" "}<div className="stack" style={{maxWidth: "440px"}}><h1 style={{fontSize: "36px", lineHeight: "44px", color: "#fff"}}>Plan the sprint. Ship the work. Keep the team in sync.</h1>{" "}<p style={{fontSize: "16px", lineHeight: "26px", color: "#fff"}}>Easel keeps your backlog, board, sprints and daily standups in one place. The assistant drafts; you decide.</p></div>{" "}<p className="small" style={{color: "#fff"}}>CS3227 project platform</p></section>{" "}<section style={{flex: "1 1 480px", display: "flex", alignItems: "center", justifyContent: "center", padding: "48px 24px"}}><form className="card" style={{width: "min(420px, 100%)", padding: "32px", display: "flex", flexDirection: "column", gap: "20px"}}><div className="stack8"><h1>Sign in</h1><p className="muted">Use the email you registered with.</p></div>{" "}<div className="field"><label htmlFor="em">Email</label><input id="em" className="in" type="email" defaultValue="aisha.rahman@example.edu" autoComplete="email" /></div>{" "}<div className="field"><label htmlFor="pw">Password</label>{" "}<div style={{position: "relative"}}><input id="pw" className="in err" type="password" defaultValue="correct horse" autoComplete="current-password" style={{paddingRight: "64px"}} /><span className="small b" style={{position: "absolute", right: "12px", top: "8px", color: "var(--accent-t)"}}>Show</span></div></div>{" "}<a className="btn p" href="/api/as?role=pm&to=/projects" style={{height: "40px"}}>Sign in</a>{" "}<div className="card flat" style={{display: "flex", flexDirection: "column", gap: "8px", borderStyle: "dashed"}}><span className="small muted">Prototype: sign in as</span><div className="row wrap"><a className="btn sm" href="/api/as?role=pm&to=/projects">Project Manager</a><a className="btn sm" href="/api/as?role=lead&to=/lead/overview">Dev Lead</a><a className="btn sm" href="/api/as?role=dev&to=/my-work">Developer</a></div></div>{" "}<p className="muted" style={{textAlign: "center"}}>New here? <A href={r("Register.dc.html")} className="b" style={{color: "var(--accent-t)", textDecoration: "underline"}}>Create an account</A></p>{" "}<div className="banner b-bad"><svg className="ic" aria-hidden="true"><use href="#i-alert" /></svg><span>Firebase: Error (auth/invalid-credential).</span></div></form></section></div></>);
}
