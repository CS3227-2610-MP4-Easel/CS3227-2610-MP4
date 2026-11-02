// @ts-nocheck
// Generated from the design canvas page BoardBlocked.dc.html. Source of truth from here on is this file.
import { Fragment } from 'react';
import { A, css, r, useRole } from '../../lib/nav';
import { setTaskStatus_24 } from '../../lib/api';
import { DoThen } from '../live/flows';
import Top from './Top';
import ProjectHead from './ProjectHead';

class Logic {
props: any;
constructor(p: any) { this.props = p; }

renderVals() { return {}; }
}

export default function BoardBlocked(props: any = {}) {
  const v = new Logic(props).renderVals();
  return (<><div className="app"><Top role={"lead"} project={"1"} />{" "}<div className="body"><main className="main"><ProjectHead role={"lead"} active={"board"} />{" "}<div className="wide stack"><div className="card"><div className="sk" style={{width: "200px", height: "16px", marginBottom: "12px"}}></div><div className="sk" style={{marginBottom: "8px"}}></div><div className="sk" style={{width: "80%"}}></div></div></div></main></div>{" "}<div className="scrim" role="presentation"><form className="dialog" role="dialog" aria-modal="true" aria-labelledby="mb1" style={{width: "min(480px, 100%)"}}><div className="row between"><h2 id="mb1">Mark blocked</h2><span className="btn g sm ib" aria-label="Close"><svg className="ic" aria-hidden="true"><use href="#i-x" /></svg></span></div>{" "}<p className="muted">Student ID payment</p><div className="field"><label htmlFor="r5">Reason <span style={{color: "var(--danger)"}}>*</span></label><textarea id="r5" className="in err" rows={4}></textarea><span className="err-t"><svg className="ic" style={{width: "14px", height: "14px"}} aria-hidden="true"><use href="#i-alert" /></svg>A reason is required.</span><span className="hint">Up to 500 characters. Plain text.</span></div><span className="hint num" style={{alignSelf: "flex-end"}}>0 / 500</span>{" "}<div className="dfoot"><A className="btn" href={r("Board.dc.html")}>Cancel</A><DoThen className="btn d" run={() => setTaskStatus_24("t2", "prog", "Blocked: " + (document.querySelector("textarea")?.value || "no reason given"))} ok={() => "Task marked blocked."} then="Board.dc.html">Mark blocked</DoThen></div></form></div></div></>);
}
