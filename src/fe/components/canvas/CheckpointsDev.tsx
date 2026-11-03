// @ts-nocheck
// Generated from the design canvas page CheckpointsDev.dc.html. Source of truth from here on is this file.
import { Fragment } from 'react';
import { A, css, r, useRole } from '../../lib/nav';
import { CheckpointCards, AddCheckpointForm } from '../live/checkpoints';
import Top from './Top';
import ProjectHead from './ProjectHead';
import Banner from './Banner';

class Logic {
props: any;
constructor(p: any) { this.props = p; }

renderVals() { return {}; }
}

export default function CheckpointsDev(props: any = {}) {
  const v = new Logic(props).renderVals();
  return (<><div className="app"><Top role={"dev"} project={"1"} />{" "}<div className="body"><main className="main"><ProjectHead role={"dev"} active={"checkpoints"} />{" "}<div className="wide stack" style={{gap: "16px"}}><div className="stack8"><h2>Checkpoints</h2><p className="muted">A checkpoint is a date the team commits to.</p></div>{" "}<CheckpointCards showRisk={false} />{" "}<Banner kind={"info"} text={"Developers see dates and linked epics only. Risk and forecast are for the Dev Lead and PM."} icon={"eye"} /></div></main></div></div></>);
}
