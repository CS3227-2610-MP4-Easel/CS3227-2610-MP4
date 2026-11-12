// @ts-nocheck
// Generated from the design canvas page BacklogPM.dc.html. Source of truth from here on is this file.
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

export default function BacklogPM(props: any = {}) {
  const v = new Logic(props).renderVals();
  return (<><div className="app"><Top role={"pm"} project={"1"} /><div className="body"><main className="main"><ProjectHead role={"pm"} active={"backlog"} /><div className="wide stack" style={{gap: "16px"}}><BacklogList actions={<><A className="btn" href={r("PlanIdea.dc.html")}>Plan with AI</A><A className="btn" href={r("BacklogAddEpic.dc.html")}>Add epic</A><A className="btn p" href={r("BacklogAddTask.dc.html")}>Add task</A></>} /><p className="small muted">The PM sees the same backlog as the Dev Lead and can add and edit epics and tasks.</p></div></main></div></div></>);
}
