// @ts-nocheck
// Generated from the design canvas page BacklogAddEpic.dc.html. Source of truth from here on is this file.
import { Fragment } from 'react';
import { A, css, r, useRole } from '../../lib/nav';
import Top from './Top';
import ProjectHead from './ProjectHead';

class Logic {
props: any;
constructor(p: any) { this.props = p; }

renderVals() { return {}; }
}

export default function BacklogAddEpic(props: any = {}) {
  const v = new Logic(props).renderVals();
  return (<><div className="app"><Top role={"lead"} project={"1"} />{" "}<div className="body"><main className="main"><ProjectHead role={"lead"} active={"backlog"} />{" "}<div className="wide stack"><div className="card"><div className="sk" style={{width: "200px", height: "16px", marginBottom: "12px"}}></div><div className="sk" style={{marginBottom: "8px"}}></div><div className="sk" style={{width: "80%"}}></div></div></div></main></div>{" "}<div className="scrim" role="presentation"><form className="dialog" role="dialog" aria-modal="true" aria-labelledby="ae1" style={{width: "min(560px, 100%)"}}><div className="row between"><h2 id="ae1">Add epic</h2><span className="btn g sm ib" aria-label="Close"><svg className="ic" aria-hidden="true"><use href="#i-x" /></svg></span></div>{" "}<div className="field"><label htmlFor="t2">Title <span style={{color: "var(--danger)"}}>*</span></label><input id="t2" className="in" defaultValue="Notifications" /></div><div className="field"><label htmlFor="d2">Description</label><textarea id="d2" className="in" rows={3} defaultValue={"Tell students when an order changes state."} /></div><div className="field"><label htmlFor="cp">Checkpoint</label><span className="sel" style={{height: "36px", justifyContent: "space-between"}}>Beta release<svg className="ic" aria-hidden="true"><use href="#i-down" /></svg></span><span className="hint">Optional. An epic belongs to at most one checkpoint.</span></div>{" "}<div className="dfoot"><A className="btn" href={r("Backlog.dc.html")}>Cancel</A><A className="btn p" href={r("Backlog.dc.html")}>Add epic</A></div></form></div></div></>);
}
