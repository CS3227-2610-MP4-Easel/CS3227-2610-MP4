// @ts-nocheck
// Generated from the design canvas page PlanSuperseded.dc.html. Source of truth from here on is this file.
import { Fragment } from 'react';
import { A, css, r, useRole } from '../../lib/nav';
import Top from './Top';
import ProjectHead from './ProjectHead';

class Logic {
props: any;
constructor(p: any) { this.props = p; }

renderVals() { return {}; }
}

export default function PlanSuperseded(props: any = {}) {
  const v = new Logic(props).renderVals();
  return (<><div className="app"><Top role={"pm"} project={"1"} />{" "}<div className="body"><main className="main"><ProjectHead role={"pm"} active={"plan"} />{" "}<div className="wide stack" style={{gap: "16px"}}><div className="banner b-info"><svg className="ic" aria-hidden="true"><use href="#i-info" /></svg><div className="row wrap between" style={{flex: "1"}}><span><b>A newer plan replaced this one.</b></span><span className="row"><A className="btn sm" href={r("Plan.dc.html")}>Open the newer plan</A><A className="btn sm" href={r("PlanIdea.dc.html")}>Start a new plan</A></span></div></div><div className="row wrap"><h2>Plan</h2><span className="chip c-line"><svg className="ic" aria-hidden="true"><use href="#i-refresh" /></svg>Replaced</span></div><div className="stack" style={{gap: "12px", opacity: ".6"}}><section className="card"><h3>Approach</h3><p>Start with the read-only path, then ordering and payment, then pickup.</p></section><article className="card pad0"><div className="ch"><div className="row wrap"><span className="chip c-line">1</span><h3 style={{margin: "0"}}>Browse stalls and menus</h3><span className="chip c-acc"><svg className="ic" aria-hidden="true"><use href="#i-flag" /></svg>Alpha demo</span></div><span className="small muted num">3 tasks · 13 pts</span></div></article><article className="card pad0"><div className="ch"><div className="row wrap"><span className="chip c-line">2</span><h3 style={{margin: "0"}}>Order and pay</h3><span className="chip c-acc"><svg className="ic" aria-hidden="true"><use href="#i-flag" /></svg>Beta release</span></div><span className="small muted num">3 tasks · 13 pts</span></div></article><article className="card pad0"><div className="ch"><div className="row wrap"><span className="chip c-line">3</span><h3 style={{margin: "0"}}>Pickup</h3><span className="chip c-acc"><svg className="ic" aria-hidden="true"><use href="#i-flag" /></svg>Beta release</span></div><span className="small muted num">2 tasks · 8 pts</span></div></article></div></div></main></div></div></>);
}
