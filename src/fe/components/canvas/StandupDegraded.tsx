// @ts-nocheck
// Generated from the design canvas page StandupDegraded.dc.html. Source of truth from here on is this file.
import { Fragment } from 'react';
import { A, css, r, useRole } from '../../lib/nav';
import { StandupBlock, RetryFailed, DownloadExample } from '../live/standup-block';
import Top from './Top';
import ProjectHead from './ProjectHead';
import Banner from './Banner';

class Logic {
props: any;
constructor(p: any) { this.props = p; }

renderVals() { return {}; }
}

export default function StandupDegraded(props: any = {}) {
  const v = new Logic(props).renderVals();
  return (<><div className="app"><Top role={"dev"} project={"1"} />{" "}<div className="body"><main className="main"><ProjectHead role={"dev"} active={"mystandup"} />{" "}<div className="wide stack" style={{gap: "20px"}}><Banner kind={"info"} text={"AI features are unavailable right now. Your standup is built from your task activity only."} icon={"info"} /><section className="card stack"><div className="row between"><div className="row"><span className="chip c-acc">2</span><h2>Summaries</h2></div><span className="b num small">Summarised 0 of 23</span></div><div className="bar big"><i style={{width: "0%"}}></i></div><div className="stack8" style={{gap: "0"}}><div className="trow"><span className="muted"><svg className="ic" aria-hidden="true"><use href="#i-commit" /></svg></span><div className="t"><div>Fix image sizing on small phones</div><div className="small muted" style={{fontStyle: "italic"}}>No summary yet</div></div></div><div className="trow"><span className="muted"><svg className="ic" aria-hidden="true"><use href="#i-commit" /></svg></span><div className="t"><div>Add menu item detail layout</div><div className="small muted" style={{fontStyle: "italic"}}>No summary yet</div></div></div><div className="trow"><span className="muted"><svg className="ic" aria-hidden="true"><use href="#i-commit" /></svg></span><div className="t"><div>Refactor menu API client</div><div className="small muted" style={{fontStyle: "italic"}}>No summary yet</div></div></div></div><div className="row between"><span className="small muted">The standup can still be generated without summaries.</span><RetryFailed count={23} /></div></section><section className="card stack"><div className="row wrap between"><div className="row"><span className="chip c-acc">3</span><h2>Standup</h2></div><div className="seg"><span className="on">For the next standup · Mon 9 Nov</span><A href={r("Standup.dc.html")}>For today · Fri 6 Nov</A></div></div><div className="row wrap"><span className="chip c-warn"><svg className="ic" aria-hidden="true"><use href="#i-info" /></svg>Built from your task activity only</span></div><StandupBlock degraded /></section></div></main></div></div></>);
}
