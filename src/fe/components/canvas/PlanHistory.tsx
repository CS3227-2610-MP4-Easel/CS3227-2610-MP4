// @ts-nocheck
// Generated from the design canvas page PlanHistory.dc.html. Source of truth from here on is this file.
import { Fragment } from 'react';
import { A, css, r, useRole } from '../../lib/nav';
import Top from './Top';
import ProjectHead from './ProjectHead';

class Logic {
props: any;
constructor(p: any) { this.props = p; }

renderVals() { return {}; }
}

export default function PlanHistory(props: any = {}) {
  const v = new Logic(props).renderVals();
  return (<><div className="app"><Top role={"pm"} project={"1"} />{" "}<div className="body"><main className="main"><ProjectHead role={"pm"} active={"plan"} />{" "}<div className="wide stack" style={{gap: "16px"}}><div className="banner b-ok"><svg className="ic" aria-hidden="true"><use href="#i-check" /></svg><div className="row wrap between" style={{flex: "1"}}><span><b>Created 3 checkpoints, 6 epics and 31 tasks.</b> (Shown after approving.)</span><span className="row"><A className="btn sm" href={r("Backlog.dc.html")}>Open backlog</A><A className="btn sm" href={r("Board.dc.html")}>Open board</A></span></div></div>{" "}<div className="row wrap between"><h2>Plan history</h2><A className="btn p" href={r("PlanIdea.dc.html")}><svg className="ic" aria-hidden="true"><use href="#i-spark" /></svg>Plan with AI</A></div>{" "}<div className="card" style={{background: "var(--warn-s)", borderColor: "var(--b-warn-line)"}}><div className="row wrap between"><div className="row"><svg className="ic lg" style={{color: "var(--warn)"}} aria-hidden="true"><use href="#i-half" /></svg><div><b>You have a plan in progress.</b><div className="small" style={{color: "var(--b-warn-t)"}}>Started 31 Oct · 4 of 6 epics ready</div></div></div><A className="btn p" href={r("Plan.dc.html")}>Continue plan</A></div></div>{" "}<div className="seg" style={{alignSelf: "flex-start"}} role="tablist" aria-label="Status"><span className="on">All</span><A href={r("PlanHistory.dc.html")}>Draft</A><A href={r("PlanHistory.dc.html")}>Approved</A><A href={r("PlanHistory.dc.html")}>Rejected</A><A href={r("PlanHistory.dc.html")}>Replaced</A></div>{" "}<div className="card pad0"><table className="tbl"><thead><tr><th>Created</th><th>Status</th><th className="r">Epics</th><th>Notes</th><th></th></tr></thead><tbody><tr><td className="num b">31 Oct 2026</td><td><span className="chip c-warn"><svg className="ic" aria-hidden="true"><use href="#i-half" /></svg>Draft</span></td><td className="r num">6</td><td><span className="flagm"><svg className="ic" aria-hidden="true"><use href="#i-flag" /></svg>Flagged for review</span></td><td className="r"><A className="btn sm" href={r("Plan.dc.html")}>Open</A></td></tr><tr><td className="num b">12 Oct 2026</td><td><span className="chip c-line"><svg className="ic" aria-hidden="true"><use href="#i-refresh" /></svg>Replaced</span></td><td className="r num">5</td><td className="muted">A newer plan replaced this one.</td><td className="r"><A className="btn sm" href={r("Plan.dc.html")}>Open</A></td></tr><tr><td className="num b">10 Oct 2026</td><td><span className="chip c-bad"><svg className="ic" aria-hidden="true"><use href="#i-x" /></svg>Rejected</span></td><td className="r num">4</td><td className="muted">This plan was discarded.</td><td className="r"><A className="btn sm" href={r("Plan.dc.html")}>Open</A></td></tr></tbody></table></div>{" "}<p className="small muted">Empty: <b>No plans yet.</b> with Plan with AI. An approved plan shows its plan as approved; a discarded plan is greyed with Start a new plan.</p></div></main></div></div></>);
}
