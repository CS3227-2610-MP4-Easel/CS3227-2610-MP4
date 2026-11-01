// @ts-nocheck
// Generated from the design canvas page NewProject.dc.html. Source of truth from here on is this file.
import { Fragment } from 'react';
import { A, css, r, useRole } from '../../lib/nav';
import Top from './Top';

class Logic {
props: any;
constructor(p: any) { this.props = p; }

renderVals() { return {}; }
}

export default function NewProject(props: any = {}) {
  const v = new Logic(props).renderVals();
  return (<><div className="app"><Top role={"pm"} />{" "}<div className="body"><main className="main"><div className="wide stack"><div className="row between"><h1>Projects</h1><span className="btn p"><svg className="ic" aria-hidden="true"><use href="#i-plus" /></svg>New project</span></div>{" "}<div className="card pad0"><div className="rowt" style={{padding: "20px"}}><div style={{flex: "1"}} className="stack8"><div className="sk" style={{width: "220px", height: "16px"}}></div><div className="sk" style={{width: "70%"}}></div></div><div className="sk" style={{width: "240px", height: "10px"}}></div></div></div></div></main></div>{" "}<div className="scrim" role="presentation"><form className="dialog" role="dialog" aria-modal="true" aria-labelledby="dt" style={{width: "min(560px, 100%)"}}><div className="row between"><h2 id="dt">New project</h2><A className="btn g sm ib" href={r("Projects.dc.html")} aria-label="Close"><svg className="ic" aria-hidden="true"><use href="#i-x" /></svg></A></div>{" "}<div className="field"><label htmlFor="pn">Name <span style={{color: "var(--danger)"}}>*</span></label><input id="pn" className="in" defaultValue="Campus Eats Mobile App" /><span className="hint">1 to 200 characters</span></div>{" "}<div className="field"><label htmlFor="pb">Brief <span className="muted" style={{fontWeight: "400"}}>(optional)</span></label>{" "}<textarea id="pb" className="in" rows={5} defaultValue={"A food-ordering app for campus canteens: browse stalls, order ahead, pay with a student ID and collect with a pickup code."} />{" "}<div className="row between"><span className="hint">The assistant reads the brief when you plan with AI.</span><span className="hint num">121 / 4000</span></div></div>{" "}<div className="banner b-info"><svg className="ic" aria-hidden="true"><use href="#i-info" /></svg><span>You become a member automatically. Next you add a Dev Lead and plan the work.</span></div>{" "}<div className="dfoot"><A className="btn" href={r("Projects.dc.html")}>Cancel</A><A className="btn p" href={r("Overview.dc.html")}>Create project</A></div></form></div></div></>);
}
