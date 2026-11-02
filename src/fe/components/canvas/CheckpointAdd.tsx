// @ts-nocheck
// Generated from the design canvas page CheckpointAdd.dc.html. Source of truth from here on is this file.
import { Fragment } from 'react';
import { A, css, r, useRole } from '../../lib/nav';
import Top from './Top';
import ProjectHead from './ProjectHead';

class Logic {
props: any;
constructor(p: any) { this.props = p; }

renderVals() { return {}; }
}

export default function CheckpointAdd(props: any = {}) {
  const v = new Logic(props).renderVals();
  return (<><div className="app"><Top role={"pm"} project={"1"} />{" "}<div className="body"><main className="main"><ProjectHead role={"pm"} active={"checkpoints"} />{" "}<div className="wide stack"><div className="card"><div className="sk" style={{width: "200px", height: "16px", marginBottom: "12px"}}></div><div className="sk" style={{marginBottom: "8px"}}></div><div className="sk" style={{width: "80%"}}></div></div></div></main></div>{" "}<div className="scrim" role="presentation"><form className="dialog" role="dialog" aria-modal="true" aria-labelledby="ac1" style={{width: "min(480px, 100%)"}}><div className="row between"><h2 id="ac1">Add checkpoint</h2><span className="btn g sm ib" aria-label="Close"><svg className="ic" aria-hidden="true"><use href="#i-x" /></svg></span></div>{" "}<div className="field"><label htmlFor="n3">Name <span style={{color: "var(--danger)"}}>*</span></label><input id="n3" className="in" defaultValue="Pilot with two canteens" /></div><div className="field"><label htmlFor="d3">Target date <span style={{color: "var(--danger)"}}>*</span></label><input id="d3" className="in err" defaultValue="29 Jan" /><span className="err-t"><svg className="ic" style={{width: "14px", height: "14px"}} aria-hidden="true"><use href="#i-alert" /></svg>Enter a date as YYYY-MM-DD.</span><span className="hint">YYYY-MM-DD, Singapore time</span></div>{" "}<div className="dfoot"><A className="btn" href={r("Checkpoints.dc.html")}>Cancel</A><A className="btn p" href={r("Checkpoints.dc.html")}>Add checkpoint</A></div></form></div></div></>);
}
