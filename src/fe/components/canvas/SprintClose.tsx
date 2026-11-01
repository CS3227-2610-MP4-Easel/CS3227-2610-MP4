// @ts-nocheck
// Generated from the design canvas page SprintClose.dc.html. Source of truth from here on is this file.
import { Fragment } from 'react';
import { A, css, r, useRole } from '../../lib/nav';
import Top from './Top';
import ProjectHead from './ProjectHead';
import StatusChip from './StatusChip';

class Logic {
props: any;
constructor(p: any) { this.props = p; }

renderVals() { return {}; }
}

export default function SprintClose(props: any = {}) {
  const v = new Logic(props).renderVals();
  return (<><div className="app"><Top role={"lead"} project={"1"} />{" "}<div className="body"><main className="main"><ProjectHead role={"lead"} active={"sprints"} />{" "}<div className="wide stack"><div className="card"><div className="sk" style={{width: "200px", height: "16px", marginBottom: "12px"}}></div><div className="sk" style={{marginBottom: "8px"}}></div><div className="sk" style={{width: "80%"}}></div></div></div></main></div>{" "}<div className="scrim" role="presentation"><div className="dialog" role="dialog" aria-modal="true" aria-labelledby="ct" style={{width: "min(680px, 100%)"}}><div className="row between"><h2 id="ct">Close Sprint 2: Ordering</h2><A className="btn g sm ib" href={r("Sprints.dc.html")} aria-label="Close"><svg className="ic" aria-hidden="true"><use href="#i-x" /></svg></A></div>{" "}<div className="banner b-info"><svg className="ic" aria-hidden="true"><use href="#i-info" /></svg><span><b>2 tasks done, 8 points complete.</b> 3 tasks not done. They move to the next sprint, Sprint 3: Pickup and polish, once you confirm.</span></div>{" "}<table className="tbl" style={{border: "1px solid var(--line)", borderRadius: "10px", overflow: "hidden"}}><thead><tr><th>Not done</th><th>Status</th><th className="r">Pts</th><th>Move to</th></tr></thead><tbody><tr><td className="b">Search and filter by cuisine</td><td><StatusChip status={"todo"} /></td><td className="r num">5</td><td><span className="sel" style={{width: "230px", justifyContent: "space-between"}}>Sprint 3: Pickup and polish<svg className="ic" aria-hidden="true"><use href="#i-down" /></svg></span></td></tr><tr><td className="b">Student ID payment</td><td><StatusChip status={"prog"} /></td><td className="r num">8</td><td><span className="sel" style={{width: "230px", justifyContent: "space-between"}}>Sprint 3: Pickup and polish<svg className="ic" aria-hidden="true"><use href="#i-down" /></svg></span></td></tr><tr><td className="b">QR pickup code</td><td><StatusChip status={"todo"} /></td><td className="r num">3</td><td><span className="sel" style={{width: "230px", justifyContent: "space-between"}}>Sprint 3: Pickup and polish<svg className="ic" aria-hidden="true"><use href="#i-down" /></svg></span></td></tr></tbody></table>{" "}<p className="small muted">Default is the next sprint; choose Backlog for any task that should wait. Done tasks stay in the sprint and count toward velocity.</p>{" "}<div className="banner b-warn"><svg className="ic" aria-hidden="true"><use href="#i-alert" /></svg><span><b>Confirm:</b> 3 unfinished tasks (16 points) move to Sprint 3: Pickup and polish. This cannot be undone.</span></div>{" "}<div className="dfoot"><A className="btn" href={r("Sprints.dc.html")}>Cancel</A><A className="btn d" href={r("Sprints.dc.html")}>Close sprint and move 3 tasks</A></div>{" "}<div className="toast" style={{alignSelf: "flex-start"}}><svg className="ic" aria-hidden="true"><use href="#i-check" /></svg>After closing: Sprint closed. Velocity: 8.</div></div></div></div></>);
}
