// @ts-nocheck
// Generated from the design canvas page OverviewDev.dc.html. Source of truth from here on is this file.
import { Fragment } from 'react';
import { A, css, r, useRole } from '../../lib/nav';
import { ProgressCard, VelocityCard, CheckpointsCard, TeamCard } from '../live/overview';
import Top from './Top';
import ProjectHead from './ProjectHead';
import RoleBadge from './RoleBadge';

class Logic {
props: any;
constructor(p: any) { this.props = p; }

renderVals() { return {}; }
}

export default function OverviewDev(props: any = {}) {
  const v = new Logic(props).renderVals();
  return (<><div className="app"><Top role={"dev"} project={"1"} />{" "}<div className="body"><main className="main"><ProjectHead role={"dev"} active={"overview"} />{" "}<div className="wide stack" style={{gap: "20px"}}><p className="muted" style={{maxWidth: "760px"}}>A food-ordering app for campus canteens: browse stalls, order ahead, pay with a student ID and collect with a pickup code.</p>{" "}<div className="g2" style={{gridTemplateColumns: "minmax(0, 3fr) minmax(0, 2fr)"}}><div className="stack"><ProgressCard />{" "}<VelocityCard /></div>{" "}<div className="stack"><CheckpointsCard />{" "}<TeamCard /></div></div>{" "}<section className="card" style={{background: "var(--accent-s)", borderColor: "var(--b-info-line)"}}><div className="row wrap between" style={{gap: "16px"}}><div className="stack8"><h3 style={{margin: "0"}}>Ready for the next standup?</h3><p className="muted">Upload your commits and pull requests, then generate your standup.</p></div><div className="row wrap"><A className="btn p" href={r("Standup.dc.html")}><svg className="ic" aria-hidden="true"><use href="#i-upload" /></svg>Upload activity and standup</A></div></div></section></div></main></div></div></>);
}
