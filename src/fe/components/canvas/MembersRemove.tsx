// @ts-nocheck
// Generated from the design canvas page MembersRemove.dc.html. Source of truth from here on is this file.
import { Fragment } from 'react';
import { A, css, r, useRole } from '../../lib/nav';
import RemoveMember from '../live/remove-member';
import Top from './Top';
import ProjectHead from './ProjectHead';
import ConfirmDialog from './ConfirmDialog';

class Logic {
props: any;
constructor(p: any) { this.props = p; }

renderVals() { return {}; }
}

export default function MembersRemove(props: any = {}) {
  const v = new Logic(props).renderVals();
  return (<><div className="app"><Top role={"lead"} project={"1"} />{" "}<div className="body"><main className="main"><ProjectHead role={"lead"} active={"members"} />{" "}<div className="wide stack"><div className="card"><div className="sk" style={{width: "200px", height: "16px", marginBottom: "12px"}}></div><div className="sk" style={{marginBottom: "8px"}}></div><div className="sk" style={{width: "80%"}}></div></div></div></main></div>{" "}<div className="scrim" role="presentation"><RemoveMember /></div></div></>);
}
