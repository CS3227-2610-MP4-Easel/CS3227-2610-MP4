// @ts-nocheck
// Generated from the design canvas page Checkpoints.dc.html. Source of truth from here on is this file.
import { Fragment } from 'react';
import { A, css, r, useRole } from '../../lib/nav';
import { CheckpointCards, AddCheckpointForm } from '../live/checkpoints';
import Top from './Top';
import ProjectHead from './ProjectHead';
import RiskBadge from './RiskBadge';

class Logic {
props: any;
constructor(p: any) { this.props = p; }

renderVals() { return {}; }
}

export default function Checkpoints(props: any = {}) {
  const v = new Logic(props).renderVals();
  return (<><div className="app"><Top role={"lead"} project={"1"} />{" "}<div className="body"><main className="main"><ProjectHead role={"lead"} active={"checkpoints"} />{" "}<div className="wide stack" style={{gap: "16px"}}><div className="row wrap between"><div className="stack8"><h2>Checkpoints</h2><p className="muted">A checkpoint is a date the team commits to. An epic belongs to at most one.</p></div>{" "}<A className="btn p" href={r("CheckpointAdd.dc.html")}><svg className="ic" aria-hidden="true"><use href="#i-plus" /></svg>Add checkpoint</A></div>{" "}<CheckpointCards showRisk={true} />{" "}<div className="g2"><AddCheckpointForm />{" "}<div className="card flat" style={{borderStyle: "dashed"}}><h3>Notes</h3><ul className="pl muted"><li>Link an epic to a checkpoint from the epic form in the Backlog.</li><li>Developers see dates and linked epics only, with no risk badge.</li><li>Deleting a checkpoint keeps its epics and unlinks them.</li><li>Empty: <b>No checkpoints yet. A checkpoint is a date the team commits to.</b></li></ul></div></div></div></main></div></div></>);
}
