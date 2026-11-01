// @ts-nocheck
// Generated from the design canvas page SprintsNew.dc.html. Source of truth from here on is this file.
import { Fragment } from 'react';
import { A, css, r, useRole } from '../../lib/nav';
import Top from './Top';
import ProjectHead from './ProjectHead';

class Logic {
props: any;
constructor(p: any) { this.props = p; }

renderVals() { return {}; }
}

export default function SprintsNew(props: any = {}) {
  const v = new Logic(props).renderVals();
  return (<><div className="app"><Top role={"lead"} project={"1"} />{" "}<div className="body"><main className="main"><ProjectHead role={"lead"} active={"sprints"} />{" "}<div className="wide stack"><div className="card"><div className="sk" style={{width: "200px", height: "16px", marginBottom: "12px"}}></div><div className="sk" style={{marginBottom: "8px"}}></div><div className="sk" style={{width: "80%"}}></div></div></div></main></div>{" "}<div className="scrim" role="presentation"><form className="dialog" role="dialog" aria-modal="true" aria-labelledby="ns1" style={{width: "min(520px, 100%)"}}><div className="row between"><h2 id="ns1">New sprint</h2><span className="btn g sm ib" aria-label="Close"><svg className="ic" aria-hidden="true"><use href="#i-x" /></svg></span></div>{" "}<div className="field"><label htmlFor="n4">Name <span style={{color: "var(--danger)"}}>*</span></label><input id="n4" className="in" defaultValue="Sprint 4: Polish" /></div><div className="g2"><div className="field"><label htmlFor="s4">Start date <span style={{color: "var(--danger)"}}>*</span></label><input id="s4" className="in err" defaultValue="2026-11-09" /><span className="hint">YYYY-MM-DD</span></div><div className="field"><label htmlFor="e4">End date (inclusive) <span style={{color: "var(--danger)"}}>*</span></label><input id="e4" className="in" defaultValue="2026-11-20" /><span className="hint">YYYY-MM-DD</span></div></div><span className="err-t"><svg className="ic" style={{width: "14px", height: "14px"}} aria-hidden="true"><use href="#i-alert" /></svg>Dates overlap sprint Sprint 2: Ordering.</span>{" "}<div className="dfoot"><A className="btn" href={r("Sprints.dc.html")}>Cancel</A><A className="btn p" href={r("Sprints.dc.html")}>Create sprint</A></div></form></div></div></>);
}
