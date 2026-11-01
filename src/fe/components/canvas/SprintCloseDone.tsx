// @ts-nocheck
// Generated from the design canvas page SprintCloseDone.dc.html. Source of truth from here on is this file.
import { Fragment } from 'react';
import { A, css, r, useRole } from '../../lib/nav';
import Top from './Top';
import ProjectHead from './ProjectHead';

class Logic {
props: any;
constructor(p: any) { this.props = p; }

renderVals() { return {}; }
}

export default function SprintCloseDone(props: any = {}) {
  const v = new Logic(props).renderVals();
  return (<><div className="app"><Top role={"lead"} project={"1"} />{" "}<div className="body"><main className="main"><ProjectHead role={"lead"} active={"sprints"} />{" "}<div className="wide stack"><div className="card"><div className="sk" style={{width: "200px", height: "16px", marginBottom: "12px"}}></div><div className="sk" style={{marginBottom: "8px"}}></div><div className="sk" style={{width: "80%"}}></div></div></div></main></div>{" "}<div className="scrim" role="presentation"><form className="dialog" role="dialog" aria-modal="true" aria-labelledby="cd1" style={{width: "min(560px, 100%)"}}><div className="row between"><h2 id="cd1">Close Sprint 2: Ordering</h2><span className="btn g sm ib" aria-label="Close"><svg className="ic" aria-hidden="true"><use href="#i-x" /></svg></span></div>{" "}<div className="banner b-ok"><svg className="ic" aria-hidden="true"><use href="#i-check" /></svg><span><b>All 5 tasks done, 26 points complete.</b> Nothing to carry over.</span></div>{" "}<p className="muted">The sprint closes with everything finished. Done tasks stay in the sprint and count toward velocity.</p>{" "}<div className="toast" style={{alignSelf: "flex-start"}}><svg className="ic" aria-hidden="true"><use href="#i-check" /></svg>After closing: Sprint closed. Velocity: 26.</div>{" "}<div className="dfoot"><A className="btn" href={r("Sprints.dc.html")}>Cancel</A><A className="btn d" href={r("Sprints.dc.html")}>Close sprint</A></div></form></div></div></>);
}
