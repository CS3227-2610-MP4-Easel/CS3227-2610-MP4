// @ts-nocheck
// Generated from the design canvas page CheckpointsDev.dc.html. Source of truth from here on is this file.
import { Fragment } from 'react';
import { A, css, r, useRole } from '../../lib/nav';
import Top from './Top';
import ProjectHead from './ProjectHead';
import Banner from './Banner';

class Logic {
props: any;
constructor(p: any) { this.props = p; }

renderVals() { return {}; }
}

export default function CheckpointsDev(props: any = {}) {
  const v = new Logic(props).renderVals();
  return (<><div className="app"><Top role={"dev"} project={"1"} />{" "}<div className="body"><main className="main"><ProjectHead role={"dev"} active={"checkpoints"} />{" "}<div className="wide stack" style={{gap: "16px"}}><div className="stack8"><h2>Checkpoints</h2><p className="muted">A checkpoint is a date the team commits to.</p></div>{" "}<article className="card"><div className="row"><span className="muted"><svg className="ic" aria-hidden="true"><use href="#i-flag" /></svg></span><h3 style={{margin: "0"}}>Alpha demo</h3></div><div className="row wrap" style={{gap: "24px", margin: "8px 0 12px"}}><span><span className="muted">Target </span><b className="num">Fri 20 Nov</b></span></div><div className="pill-list"><span className="chip c-line">Browse stalls and menus · 3 tasks · 13 pts</span></div></article>{" "}<article className="card"><div className="row"><span className="muted"><svg className="ic" aria-hidden="true"><use href="#i-flag" /></svg></span><h3 style={{margin: "0"}}>Beta release</h3></div><div className="row wrap" style={{gap: "24px", margin: "8px 0 12px"}}><span><span className="muted">Target </span><b className="num">Fri 18 Dec</b></span></div><div className="pill-list"><span className="chip c-line">Order and pay · 3 tasks · 13 pts</span><span className="chip c-line">Pickup · 2 tasks · 8 pts</span></div></article>{" "}<article className="card"><div className="row"><span className="muted"><svg className="ic" aria-hidden="true"><use href="#i-flag" /></svg></span><h3 style={{margin: "0"}}>Launch</h3></div><div className="row wrap" style={{gap: "24px", margin: "8px 0 12px"}}><span><span className="muted">Target </span><b className="num">Fri 15 Jan</b></span></div><div className="pill-list"><span className="chip c-line">No epics linked yet</span></div></article>{" "}<Banner kind={"info"} text={"Developers see dates and linked epics only. Risk and forecast are for the Dev Lead and PM."} icon={"eye"} /></div></main></div></div></>);
}
