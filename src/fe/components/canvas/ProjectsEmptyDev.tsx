// @ts-nocheck
// Generated from the design canvas page ProjectsEmptyDev.dc.html. Source of truth from here on is this file.
import { Fragment } from 'react';
import { A, css, r, useRole } from '../../lib/nav';
import Top from './Top';
import EmptyState from './EmptyState';

class Logic {
props: any;
constructor(p: any) { this.props = p; }

renderVals() { return {}; }
}

export default function ProjectsEmptyDev(props: any = {}) {
  const v = new Logic(props).renderVals();
  return (<><div className="app"><Top role={"lead"} />{" "}<div className="body"><main className="main"><div className="wide stack" style={{gap: "20px"}}><div className="row wrap between"><div className="stack8"><h1>Projects</h1><p className="muted">Projects you are a member of.</p></div></div><EmptyState icon={"folder"} title={"You are not in any project yet."} text={"Ask your PM to add you."} action={""} /></div></main></div></div></>);
}
