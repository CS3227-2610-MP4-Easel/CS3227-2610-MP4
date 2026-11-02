// @ts-nocheck
// Generated from the design canvas page OverviewLead.dc.html. Source of truth from here on is this file.
import { Fragment } from 'react';
import { A, css, r, useRole } from '../../lib/nav';
import { ProgressCard, VelocityCard, CheckpointsCard, TeamCard } from '../live/overview';
import Top from './Top';
import ProjectHead from './ProjectHead';
import RoleBadge from './RoleBadge';

class Logic {
props: any;
constructor(p: any) { this.props = p; }

renderVals() { return {}; }
}

export default function OverviewLead(props: any = {}) {
  const v = new Logic(props).renderVals();
  return (<><div className="app"><Top role={"lead"} project={"1"} />{" "}<div className="body"><main className="main"><ProjectHead role={"lead"} active={"overview"} />{" "}<div className="wide stack" style={{gap: "20px"}}><p className="muted" style={{maxWidth: "760px"}}>A food-ordering app for campus canteens: browse stalls, order ahead, pay with a student ID and collect with a pickup code.</p>{" "}<div className="g2" style={{gridTemplateColumns: "minmax(0, 3fr) minmax(0, 2fr)"}}><div className="stack"><ProgressCard />{" "}<VelocityCard /></div>{" "}<div className="stack"><CheckpointsCard />{" "}<TeamCard /></div></div>{" "}<section className="card" style={{background: "var(--accent-s)", borderColor: "var(--b-info-line)"}}><div className="row wrap between" style={{gap: "16px"}}><div className="stack8"><h3 style={{margin: "0"}}>What would you like to do next?</h3><p className="muted">Check how the project is tracking, or add the people who will build it.</p></div><div className="row wrap"><A className="btn p" href={r("Health.dc.html")}><svg className="ic" aria-hidden="true"><use href="#i-pulse" /></svg>Check project health</A><A className="btn" href={r("Members.dc.html")}><svg className="ic" aria-hidden="true"><use href="#i-users" /></svg>Add developers</A></div></div></section>{" "}<section className="card flat" style={{borderStyle: "dashed"}}><h3>New-project checklist (shown while the project is empty)</h3><div className="g3"><div className="row"><span className="check on"><svg className="ic" style={{width: "12px", height: "12px", strokeWidth: "3"}} aria-hidden="true"><use href="#i-check" /></svg></span><span className="b">Add developers</span></div><div className="row"><span className="check on"><svg className="ic" style={{width: "12px", height: "12px", strokeWidth: "3"}} aria-hidden="true"><use href="#i-check" /></svg></span><span className="b">Create a sprint</span></div><div className="row"><span className="check"></span><span className="b">Assign tasks</span></div></div></section></div></main></div></div></>);
}
