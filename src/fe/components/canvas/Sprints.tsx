// @ts-nocheck
// Generated from the design canvas page Sprints.dc.html. Source of truth from here on is this file.
import { Fragment } from 'react';
import { A, css, r, useRole } from '../../lib/nav';
import SprintList from '../live/sprint-list';
import SprintsPage from '../live/sprints-page';
import Top from './Top';
import ProjectHead from './ProjectHead';
import StatusChip from './StatusChip';

class Logic {
props: any;
constructor(p: any) { this.props = p; }

renderVals() { return {}; }
}

export default function Sprints(props: any = {}) {
  const v = new Logic(props).renderVals();
  return (<><div className="app"><Top role={"lead"} project={"1"} /><div className="body"><main className="main"><ProjectHead role={"lead"} active={"sprints"} /><div className="wide stack" style={{gap: "16px"}}><div className="row wrap between"><h2>Sprints</h2><A className="btn p" href={r("SprintsNew.dc.html")}><svg className="ic" aria-hidden="true"><use href="#i-plus" /></svg>New sprint</A></div><SprintsPage /><div className="banner b-bad"><svg className="ic" aria-hidden="true"><use href="#i-alert" /></svg><span>Overlapping dates show: <b>Dates overlap sprint Sprint 2: Ordering.</b> inline in the New sprint dialog. A PM or Developer sees this screen read-only.</span></div></div></main></div></div></>);
}
