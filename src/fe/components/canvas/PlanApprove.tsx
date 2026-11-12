// @ts-nocheck
// Generated from the design canvas page PlanApprove.dc.html. Source of truth from here on is this file.
import { Fragment } from 'react';
import { A, css, r, useRole } from '../../lib/nav';
import Top from './Top';
import ProjectHead from './ProjectHead';

class Logic {
props: any;
constructor(p: any) { this.props = p; }

renderVals() { return {}; }
}

export default function PlanApprove(props: any = {}) {
  const v = new Logic(props).renderVals();
  return (<><div className="app"><Top role={"pm"} project={"1"} />{" "}<div className="body"><main className="main"><ProjectHead role={"pm"} active={"plan"} />{" "}<div className="wide stack" style={{gap: "16px"}}><div className="row wrap"><h2>Plan draft</h2><span className="chip c-warn"><svg className="ic" aria-hidden="true"><use href="#i-half" /></svg>Draft</span><span className="b num">6 of 6 epics ready</span></div>{" "}<div className="card"><div className="sk" style={{width: "30%", height: "16px", marginBottom: "12px"}}></div><div className="sk" style={{marginBottom: "8px"}}></div><div className="sk" style={{width: "75%"}}></div></div>{" "}<div className="card"><div className="sk" style={{width: "40%", height: "16px"}}></div></div></div></main></div>{" "}<div className="scrim" role="presentation"><div className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="at" style={{width: "min(520px, 100%)"}}><h2 id="at">Approve this plan?</h2>{" "}<p>This will create <b className="num">3 checkpoints, 6 epics and 31 tasks</b> in the backlog. You can edit all of them afterwards.</p>{" "}<div className="banner b-warn"><svg className="ic" aria-hidden="true"><use href="#i-info" /></svg><span>If a newer plan replaced this one, or the project was archived, the server explains why and this page reloads.</span></div>{" "}<div className="dfoot"><A className="btn" href={r("Plan.dc.html")} style={{outline: "2px solid var(--accent)", outlineOffset: "2px"}}>Cancel</A><A className="btn p" href={r("PlanApproved.dc.html")}>Approve plan</A></div></div></div></div></>);
}
