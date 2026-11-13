// @ts-nocheck
// Generated from the design canvas page BacklogDev.dc.html. Source of truth from here on is this file.
import { Fragment } from 'react';
import { A, css, r, useRole } from '../../lib/nav';
import BacklogList from '../live/backlog-list';
import Top from './Top';
import ProjectHead from './ProjectHead';
import Banner from './Banner';
import StatusChip from './StatusChip';

class Logic {
props: any;
constructor(p: any) { this.props = p; }

renderVals() { return {}; }
}

export default function BacklogDev(props: any = {}) {
  const v = new Logic(props).renderVals();
  return (<><div className="app"><Top role={"dev"} project={"1"} /><div className="body"><main className="main"><ProjectHead role={"dev"} active={"backlog"} /><div className="wide stack" style={{gap: "16px"}}><BacklogList /></div></main></div></div></>);
}
