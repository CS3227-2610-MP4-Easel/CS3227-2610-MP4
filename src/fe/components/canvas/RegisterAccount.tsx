// @ts-nocheck
// Generated from the design canvas page RegisterAccount.dc.html. Source of truth from here on is this file.
import { Fragment } from 'react';
import { A, css, r, useRole } from '../../lib/nav';


class Logic {
props: any;
constructor(p: any) { this.props = p; }

renderVals() { return {}; }
}

export default function RegisterAccount(props: any = {}) {
  const v = new Logic(props).renderVals();
  return (<><div className="app" style={{alignItems: "center", padding: "40px 24px 64px", gap: "28px"}}><A className="brand" href={r("Main.dc.html")} style={{fontSize: "20px"}}><span className="logo" style={{fontWeight: "800", fontSize: "13px"}}>E</span>Easel</A>{" "}<div className="stepper wrap" aria-label="Registration steps"><div className="step"><span className="n">1</span>Role and code</div><svg className="ic" aria-hidden="true"><use href="#i-right" /></svg>{" "}<div className="step on"><span className="n">2</span>Account</div></div>{" "}<div style={{display: "flex", justifyContent: "center", maxWidth: "540px", width: "100%"}}><section className="card" style={{flex: "1 1 400px", maxWidth: "540px", padding: "32px", display: "flex", flexDirection: "column", gap: "18px"}}><div className="stack8"><span className="chip c-ok" style={{alignSelf: "flex-start"}}><svg className="ic" aria-hidden="true"><use href="#i-check" /></svg>Role: Project Manager, code accepted</span><h2>Create your account</h2></div>{" "}<div className="field"><label htmlFor="n">Display name</label><input id="n" className="in" defaultValue="Aisha Rahman" /></div>{" "}<div className="field"><label htmlFor="e">Email</label><input id="e" className="in" defaultValue="aisha.rahman@example.edu" /></div>{" "}<div className="field"><label htmlFor="p">Password</label><input id="p" className="in" type="password" defaultValue="password123" /></div>{" "}<div className="row between"><A href={r("Register.dc.html")} className="muted b">Back</A><a className="btn p" href="/api/as?role=pm&to=/projects" style={{height: "40px", padding: "0 24px"}}>Create account</a></div>{" "}<div className="banner b-info"><svg className="ic" aria-hidden="true"><use href="#i-info" /></svg><div><div className="b">Finish setup</div>If you already have an account but no profile, you land here with role, code and name only. You never create the account twice.</div></div></section></div>{" "}<div className="banner b-warn" style={{maxWidth: "540px", width: "100%"}}><svg className="ic" aria-hidden="true"><use href="#i-alert" /></svg><div>Registered twice shows: <b>This email is already registered. Sign in instead.</b></div></div></div></>);
}
