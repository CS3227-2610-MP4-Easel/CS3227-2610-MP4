// @ts-nocheck
// Generated from the design canvas page Standups.dc.html. Source of truth from here on is this file.
import { Fragment } from 'react';
import { A, css, r, useRole } from '../../lib/nav';
import Top from './Top';
import ProjectHead from './ProjectHead';
import { TeamStandupCards } from '../live/team-standups';

class Logic {
props: any;
constructor(p: any) { this.props = p; }

renderVals() { return {}; }
}

export default function Standups(props: any = {}) {
  const v = new Logic(props).renderVals();
  return (<><div className="app"><Top role={"lead"} project={"1"} />{" "}<div className="body"><main className="main"><ProjectHead role={"lead"} active={"standups"} />{" "}<div className="wide stack" style={{gap: "16px"}}><div className="row wrap between"><div className="seg" role="tablist" aria-label="Standup day"><span className="on">For today · Mon 2 Nov</span><A href={r("Standups.dc.html")}>For the next standup · Tue 3 Nov</A><A href={r("StandupsEarlier.dc.html")}>Earlier</A></div>{" "}<span className="sel">Developer: All<svg className="ic" aria-hidden="true"><use href="#i-down" /></svg></span></div>{" "}<TeamStandupCards date="2026-11-02" />{" "}{" "}<p className="small muted">Read only. The developer's thumbs rating is not shown. No developers in the project: <b>No developers have been added. Add them in Members.</b></p></div></main></div></div></>);
}
