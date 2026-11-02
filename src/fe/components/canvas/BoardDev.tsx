// @ts-nocheck
// Generated from the design canvas page BoardDev.dc.html. Source of truth from here on is this file.
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

export default function BoardDev(props: any = {}) {
  const v = new Logic(props).renderVals();
  return (<><div className="app"><Top role={"dev"} project={"1"} />{" "}<div className="body"><main className="main"><ProjectHead role={"dev"} active={"board"} />{" "}<BoardView show={"todo,prog,rev,done"} open-id={"t2"} role={"dev"} /></main></div></div></>);
}
