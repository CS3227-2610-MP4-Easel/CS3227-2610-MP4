// @ts-nocheck
// Generated from the design canvas page BoardPM.dc.html. Source of truth from here on is this file.
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

export default function BoardPM(props: any = {}) {
  const v = new Logic(props).renderVals();
  return (<><div className="app"><Top role={"pm"} project={"1"} />{" "}<div className="body"><main className="main"><ProjectHead role={"pm"} active={"board"} />{" "}<BoardView show={"todo,prog,rev,done"} open-id={""} role={"pm"} /></main></div></div></>);
}
