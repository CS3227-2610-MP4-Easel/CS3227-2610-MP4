// @ts-nocheck
// Generated from the design canvas page ProjectSwitcher.dc.html. Source of truth from here on is this file.
import { Fragment } from 'react';
import { A, css, r, useRole } from '../../lib/nav';
import Top from './Top';
import ProjectHead from './ProjectHead';
import BoardView from './BoardView';

class Logic {
props: any;
constructor(p: any) { this.props = p; }

renderVals() { return {}; }
}

export default function ProjectSwitcher(props: any = {}) {
  const v = new Logic(props).renderVals();
  return (<><div className="app"><Top role={"lead"} project={"1"} menu={"open"} />{" "}<div className="body"><main className="main"><ProjectHead role={"lead"} active={"board"} />{" "}<BoardView show={"todo,prog,rev,done"} open-id={"t3"} /></main></div></div></>);
}
