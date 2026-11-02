// @ts-nocheck
// Generated from the design canvas page TaskDetail.dc.html. Source of truth from here on is this file.
import { Fragment } from 'react';
import { A, css, r, useRole } from '../../lib/nav';
import TaskDrawer from '../live/task-drawer';
import { Act } from '../live/act';
import { setTaskStatus_24 } from '../../lib/api';
import Top from './Top';
import ProjectHead from './ProjectHead';
import StatusChip from './StatusChip';

class Logic {
props: any;
constructor(p: any) { this.props = p; }

renderVals() { return {}; }
}

export default function TaskDetail(props: any = {}) {
  const v = new Logic(props).renderVals();
  return (<><div className="app"><Top role={"lead"} project={"1"} />{" "}<div className="body"><main className="main"><ProjectHead role={"lead"} active={"board"} />{" "}<div className="cols"><div className="col"><div className="sk" style={{width: "80px", margin: "6px 4px"}}></div><div className="tcard"><div className="sk" style={{width: "60%"}}></div><div className="sk"></div></div><div className="tcard"><div className="sk" style={{width: "50%"}}></div><div className="sk"></div></div></div>{" "}<div className="col"><div className="sk" style={{width: "80px", margin: "6px 4px"}}></div><div className="tcard blocked"><div className="sk" style={{width: "60%"}}></div><div className="sk"></div></div></div>{" "}<div className="col"><div className="sk" style={{width: "80px", margin: "6px 4px"}}></div><div className="tcard"><div className="sk" style={{width: "60%"}}></div><div className="sk"></div></div></div>{" "}<div className="col"><div className="sk" style={{width: "80px", margin: "6px 4px"}}></div><div className="tcard"><div className="sk" style={{width: "60%"}}></div><div className="sk"></div></div></div></div></main></div>{" "}<div className="scrim end" role="presentation"><TaskDrawer /></div></div></>);
}
