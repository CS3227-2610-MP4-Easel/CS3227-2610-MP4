// @ts-nocheck
// Generated from the design canvas page RegisterFinish.dc.html. Source of truth from here on is this file.
import { Fragment } from 'react';
import { A, css, r, useRole } from '../../lib/nav';


class Logic {
props: any;
constructor(p: any) { this.props = p; }

renderVals() { return {}; }
}

export default function RegisterFinish(props: any = {}) {
  const v = new Logic(props).renderVals();
  return (<><div className="app" style={{alignItems: "center", padding: "40px 24px 64px", gap: "24px"}}><A className="brand" href={r("Main.dc.html")} style={{fontSize: "20px"}}><span className="logo" style={{fontWeight: "800", fontSize: "13px"}}>E</span>Easel</A>{" "}<div className="stepper wrap"><div className="step"><span className="n">1</span>Role and code</div><svg className="ic" aria-hidden="true"><use href="#i-right" /></svg><div className="step"><span className="n">2</span>Account</div><svg className="ic" aria-hidden="true"><use href="#i-right" /></svg><div className="step on"><span className="n">3</span>Finish setup</div></div>{" "}<section className="card" style={{width: "min(560px, 100%)", padding: "32px", display: "flex", flexDirection: "column", gap: "20px"}}><div className="stack8"><h1>Finish setting up</h1><p className="muted">You are signed in as aisha.rahman@example.edu, but your profile is not set up yet. You do not need to create the account again.</p></div>{" "}<div className="stack8" role="radiogroup" aria-label="Role"><div className="card flat" style={{padding: "14px 16px", display: "flex", gap: "12px", alignItems: "flex-start"}}><svg className="ic" style={{marginTop: "2px"}} aria-hidden="true"><use href="#i-circle" /></svg><div><div className="b">Project Manager</div><div className="small muted">Creates projects, plans the work and follows progress.</div></div></div><div className="card flat" style={{padding: "14px 16px", display: "flex", gap: "12px", alignItems: "flex-start"}}><svg className="ic" style={{marginTop: "2px"}} aria-hidden="true"><use href="#i-circle" /></svg><div><div className="b">Dev Lead</div><div className="small muted">Staffs the team, runs sprints, checks health.</div></div></div><div className="card flat" style={{padding: "14px 16px", border: "2px solid var(--accent)", background: "var(--accent-s)", display: "flex", gap: "12px", alignItems: "flex-start"}}><svg className="ic" style={{marginTop: "2px"}} aria-hidden="true"><use href="#i-check" /></svg><div><div className="b">Developer</div><div className="small muted">Works on assigned tasks and prepares a daily standup.</div></div></div></div>{" "}<div className="field"><label htmlFor="fc">Registration code</label><input id="fc" className="in" type="password" defaultValue="••••••••••" /></div>{" "}<div className="field"><label htmlFor="fn">Display name</label><input id="fn" className="in" defaultValue="Aisha Rahman" /><span className="hint">1 to 100 characters</span></div>{" "}<a className="btn p" href="/api/as?role=pm&to=/projects" style={{height: "40px"}}>Finish</a></section></div></>);
}
