// @ts-nocheck
// Generated from the design canvas page BacklogAddTask.dc.html. Source of truth from here on is this file.
import { Fragment } from 'react';
import { A, css, r, useRole } from '../../lib/nav';
import Top from './Top';
import ProjectHead from './ProjectHead';

class Logic {
props: any;
constructor(p: any) { this.props = p; }

renderVals() { return {}; }
}

export default function BacklogAddTask(props: any = {}) {
  const v = new Logic(props).renderVals();
  return (<><div className="app"><Top role={"lead"} project={"1"} />{" "}<div className="body"><main className="main"><ProjectHead role={"lead"} active={"backlog"} />{" "}<div className="wide stack"><div className="card"><div className="sk" style={{width: "200px", height: "16px", marginBottom: "12px"}}></div><div className="sk" style={{marginBottom: "8px"}}></div><div className="sk" style={{width: "80%"}}></div></div></div></main></div>{" "}<div className="scrim" role="presentation"><form className="dialog" role="dialog" aria-modal="true" aria-labelledby="at1" style={{width: "min(640px, 100%)"}}><div className="row between"><h2 id="at1">Add task</h2><span className="btn g sm ib" aria-label="Close"><svg className="ic" aria-hidden="true"><use href="#i-x" /></svg></span></div>{" "}<div className="field"><label htmlFor="e1">Epic <span style={{color: "var(--danger)"}}>*</span></label><span className="sel" style={{height: "36px", justifyContent: "space-between"}}>Order and pay<svg className="ic" aria-hidden="true"><use href="#i-down" /></svg></span></div><div className="field"><label htmlFor="t1">Title <span style={{color: "var(--danger)"}}>*</span></label><input id="t1" className="in err" defaultValue="" /><span className="err-t"><svg className="ic" style={{width: "14px", height: "14px"}} aria-hidden="true"><use href="#i-alert" /></svg>Title is required.</span></div><div className="field"><label htmlFor="d1">Description</label><textarea id="d1" className="in" rows={3}></textarea></div><div className="field"><span className="lbl">Acceptance criteria</span><div className="stack8"><div className="row"><input className="in" aria-label="Criterion 1" defaultValue="Balance is shown before payment" /><span className="btn g sm ib" aria-label="Remove criterion"><svg className="ic" aria-hidden="true"><use href="#i-x" /></svg></span></div><div className="row"><input className="in" aria-label="Criterion 2" defaultValue="A low balance blocks the order" /><span className="btn g sm ib" aria-label="Remove criterion"><svg className="ic" aria-hidden="true"><use href="#i-x" /></svg></span></div><span className="btn sm" style={{alignSelf: "flex-start"}}><svg className="ic" aria-hidden="true"><use href="#i-plus" /></svg>Add criterion</span></div><span className="hint">Up to 12 criteria of 300 characters. Plain text.</span></div><div className="g2"><div className="field"><label htmlFor="sp">Story points</label><span className="sel" style={{height: "36px", justifyContent: "space-between"}}>5<svg className="ic" aria-hidden="true"><use href="#i-down" /></svg></span><span className="hint">1, 2, 3, 5, 8, 13 or none</span></div><div className="field"><label htmlFor="as">Assignee</label><span className="sel" style={{height: "36px", justifyContent: "space-between"}}>Marcus Lim<svg className="ic" aria-hidden="true"><use href="#i-down" /></svg></span><span className="hint">Project members only</span></div></div>{" "}<div className="dfoot"><A className="btn" href={r("Backlog.dc.html")}>Cancel</A><A className="btn p" href={r("Backlog.dc.html")}>Add task</A></div></form></div></div></>);
}
