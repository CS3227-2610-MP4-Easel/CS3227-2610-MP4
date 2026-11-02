// @ts-nocheck
// Generated from the design canvas page StandupsEarlier.dc.html. Source of truth from here on is this file.
import { Fragment } from 'react';
import { A, css, r, useRole } from '../../lib/nav';
import Top from './Top';
import ProjectHead from './ProjectHead';
import { EarlierStandups } from '../live/team-standups';

class Logic {
props: any;
constructor(p: any) { this.props = p; }

renderVals() { return {}; }
}

export default function StandupsEarlier(props: any = {}) {
  const v = new Logic(props).renderVals();
  return (<><div className="app"><Top role={"lead"} project={"1"} />{" "}<div className="body"><main className="main"><ProjectHead role={"lead"} active={"standups"} />{" "}<div className="wide stack" style={{gap: "16px"}}><div className="row wrap between"><div className="seg"><A href={r("Standups.dc.html")}>For today</A><A href={r("Standups.dc.html")}>For the next standup</A><span className="on">Earlier</span></div><span className="sel">Developer: All<svg className="ic" aria-hidden="true"><use href="#i-down" /></svg></span></div><EarlierStandups /><p className="small muted">On Saturday and Sunday the days are listed, and the cards read "not generated".</p></div></main></div></div></>);
}
