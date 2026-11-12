// @ts-nocheck
// Generated from the design canvas page Standups.dc.html. Source of truth from here on is this file.
import { Fragment } from 'react';
import { A, css, r, useRole } from '../../lib/nav';
import Top from './Top';
import ProjectHead from './ProjectHead';
import { TeamStandupCards } from '../live/team-standups';
import { useAuthMode } from '../../lib/auth/mode-context';
import { LiveTeamStandups } from '../live/team-standups-live';

class Logic {
props: any;
constructor(p: any) { this.props = p; }

renderVals() { return {}; }
}

export default function Standups(props: any = {}) {
  // Live in `firebase` mode (W9 wiring spec SD1); the prototype keeps the markup below.
  if (useAuthMode() === 'firebase') return (<div className="app"><Top role={"lead"} project={"1"} /><div className="body"><main className="main"><ProjectHead role={"lead"} active={"standups"} /><LiveTeamStandups /></main></div></div>);
  const v = new Logic(props).renderVals();
  return (<><div className="app"><Top role={"lead"} project={"1"} />{" "}<div className="body"><main className="main"><ProjectHead role={"lead"} active={"standups"} />{" "}<div className="wide stack" style={{gap: "16px"}}><div className="row wrap between"><div className="seg" role="tablist" aria-label="Standup day"><span className="on">For today · Mon 2 Nov</span><A href={r("Standups.dc.html")}>For the next standup · Tue 3 Nov</A><A href={r("StandupsEarlier.dc.html")}>Earlier</A></div>{" "}<span className="sel">Developer: All<svg className="ic" aria-hidden="true"><use href="#i-down" /></svg></span></div>{" "}<TeamStandupCards date="2026-11-02" />{" "}{" "}<p className="small muted">Read only. The developer's thumbs rating is not shown. No developers in the project: <b>No developers have been added. Add them in Members.</b></p></div></main></div></div></>);
}
