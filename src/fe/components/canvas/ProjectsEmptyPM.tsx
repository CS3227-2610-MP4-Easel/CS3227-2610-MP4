// @ts-nocheck
// Generated from the design canvas page ProjectsEmptyPM.dc.html. Source of truth from here on is this file.
import { Fragment } from 'react';
import { A, css, r, useRole } from '../../lib/nav';
import Top from './Top';
import EmptyState from './EmptyState';

class Logic {
props: any;
constructor(p: any) { this.props = p; }

renderVals() { return {}; }
}

export default function ProjectsEmptyPM(props: any = {}) {
  const v = new Logic(props).renderVals();
  return (<><div className="app"><Top role={"pm"} />{" "}<div className="body"><main className="main"><div className="wide stack" style={{gap: "20px"}}><div className="row wrap between"><div className="stack8"><h1>Projects</h1><p className="muted">Projects you are a member of.</p></div><A className="btn p" href={r("NewProject.dc.html")}><svg className="ic" aria-hidden="true"><use href="#i-plus" /></svg>New project</A></div><EmptyState icon={"folder"} title={"No projects yet."} text={"Create the first project, then add a Dev Lead and plan the work."} action={"New project"} href="NewProject.dc.html" /></div></main></div></div></>);
}
