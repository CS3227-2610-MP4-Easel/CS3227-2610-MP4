// @ts-nocheck
// Generated from the design canvas page LeadOverview.dc.html. Source of truth from here on is this file.
import { Fragment } from 'react';
import { A, css, r, useRole } from '../../lib/nav';
import Top from './Top';
import RiskBadge from './RiskBadge';

class Logic {
props: any;
constructor(p: any) { this.props = p; }

renderVals() { return {}; }
}

export default function LeadOverview(props: any = {}) {
  const v = new Logic(props).renderVals();
  return (<><div className="app"><Top role={"lead"} />{" "}<div className="body"><main className="main"><div className="wide stack" style={{gap: "16px"}}><div className="row wrap between"><div className="stack8"><h1>Overview</h1><p className="muted">2 projects · as of 1 Nov 2026, 09:12</p></div></div>{" "}<div className="card pad0" style={{overflowX: "auto"}}><table className="tbl" style={{minWidth: "960px"}}><thead><tr><th>Project</th><th style={{width: "190px"}}>Progress</th><th className="r">Avg velocity</th><th>Projected finish</th><th className="r">Checkpoints at risk</th><th>Worst risk</th><th>Digest</th></tr></thead><tbody><tr><td><A href={r("Health.dc.html")} className="b" style={{color: "var(--accent-t)"}}>Campus Eats Mobile App</A></td><td><div className="row"><div className="bar" style={{flex: "1"}}><i style={{width: "30%"}}></i></div><span className="num small b">30%</span></div></td><td className="r num">13 pts</td><td className="num">Wed 20 Jan 2027</td><td className="r num">1</td><td><RiskBadge risk={"warn"} /></td><td><span className="chip c-warn"><svg className="ic" aria-hidden="true"><use href="#i-refresh" /></svg>Out of date</span></td></tr><tr><td><A href={r("Health.dc.html")} className="b" style={{color: "var(--accent-t)"}}>Library Seat Booking</A></td><td><div className="row"><div className="bar" style={{flex: "1"}}><i style={{width: "63%"}}></i></div><span className="num small b">63%</span></div></td><td className="r num">16 pts</td><td className="num">Fri 4 Dec 2026</td><td className="r num">0</td><td><RiskBadge risk={"ok"} /></td><td><span className="chip c-line">Latest digest 29 Oct</span></td></tr><tr><td><A href={r("Health.dc.html")} className="b" style={{color: "var(--accent-t)"}}>Dorm Laundry Tracker</A></td><td><span className="muted">No estimates</span></td><td className="r muted">No history</td><td className="muted">Unknown</td><td className="r num">0</td><td><RiskBadge risk={"unknown"} /></td><td><span className="chip c-line">None</span></td></tr></tbody></table></div>{" "}<p className="small muted">At-risk projects first, then by name. The whole row opens that project's health. Empty: <b>You are not a member of any project yet. Ask a PM to add you.</b> In Tier 1 the Dev Lead lands on the Projects list instead.</p></div></main></div></div></>);
}
