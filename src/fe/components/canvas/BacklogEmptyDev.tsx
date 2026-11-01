// @ts-nocheck
// Generated from the design canvas page BacklogEmptyDev.dc.html. Source of truth from here on is this file.
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

export default function BacklogEmptyDev(props: any = {}) {
  const v = new Logic(props).renderVals();
  return (<><div className="app"><Top role={"dev"} project={"1"} />{" "}<div className="body"><main className="main"><ProjectHead role={"dev"} active={"backlog"} />{" "}<div className="wide stack" style={{gap: "16px"}}><div className="row wrap between"><h2>Backlog</h2></div><EmptyState icon={"list"} title={"Nothing planned yet."} text={"The Dev Lead and PM add epics and tasks here."} action={""} /></div></main></div></div></>);
}
