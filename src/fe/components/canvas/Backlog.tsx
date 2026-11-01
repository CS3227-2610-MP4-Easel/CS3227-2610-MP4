// @ts-nocheck
// Generated from the design canvas page Backlog.dc.html. Source of truth from here on is this file.
import { Fragment } from 'react';
import { A, css, r, useRole } from '../../lib/nav';
import BacklogList from '../live/backlog-list';
import Top from './Top';
import ProjectHead from './ProjectHead';
import StatusChip from './StatusChip';

class Logic {
props: any;
constructor(p: any) { this.props = p; }

renderVals() { return {}; }
}

export default function Backlog(props: any = {}) {
  const v = new Logic(props).renderVals();
  return (<><div className="app"><Top role={"lead"} project={"1"} />{" "}<div className="body"><main className="main"><ProjectHead role={"lead"} active={"backlog"} />{" "}<div className="wide stack" style={{gap: "16px"}}><div className="row wrap between"><div className="row wrap"><div style={{position: "relative"}}><svg className="ic muted" style={{position: "absolute", left: "10px", top: "10px"}} aria-hidden="true"><use href="#i-search" /></svg><input className="in" style={{width: "240px", paddingLeft: "32px"}} placeholder="Search by title" aria-label="Search by title" /></div>{" "}<span className="sel">Unscheduled</span><span className="sel">Unassigned</span><span className="sel">No estimate</span></div>{" "}<div className="row"><A className="btn" href={r("BacklogAddEpic.dc.html")}><svg className="ic" aria-hidden="true"><use href="#i-plus" /></svg>Add epic</A><A className="btn p" href={r("BacklogAddTask.dc.html")}><svg className="ic" aria-hidden="true"><use href="#i-plus" /></svg>Add task</A></div></div>{" "}<BacklogList />{" "}<p className="small muted">Developers see this screen read-only. Empty backlog: <b>The backlog is empty.</b> with Add epic and, for a PM, Plan with AI.</p></div></main></div></div></>);
}
