// @ts-nocheck
// Generated from the design canvas page BacklogEmptyPM.dc.html. Source of truth from here on is this file.
import { Fragment } from 'react';
import { A, css, r, useRole } from '../../lib/nav';
import Top from './Top';
import ProjectHead from './ProjectHead';
import EmptyState from './EmptyState';

class Logic {
props: any;
constructor(p: any) { this.props = p; }

renderVals() { return {}; }
}

export default function BacklogEmptyPM(props: any = {}) {
  const role = useRole();
  const v = new Logic(props).renderVals();
  return (<><div className="app"><Top role={"pm"} project={"1"} />{" "}<div className="body"><main className="main"><ProjectHead role={"pm"} active={"backlog"} />{" "}<div className="wide stack" style={{gap: "16px"}}><div className="row wrap between"><h2>Backlog</h2><div className="row"><A className="btn" href={r("BacklogAddEpic.dc.html")}><svg className="ic" aria-hidden="true"><use href="#i-plus" /></svg>Add epic</A><A className="btn p" href={r("BacklogAddTask.dc.html")}><svg className="ic" aria-hidden="true"><use href="#i-plus" /></svg>Add task</A></div></div><EmptyState icon={"list"} title={"The backlog is empty."} text={"Add the first epic, or plan the work with the assistant."} action={role === "pm" ? "Plan with AI" : "Add epic"} href={role === "pm" ? "PlanIdea.dc.html" : "BacklogAddEpic.dc.html"} /></div></main></div></div></>);
}
