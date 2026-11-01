// @ts-nocheck
// Generated from the design canvas page Members.dc.html. Source of truth from here on is this file.
import { Fragment } from 'react';
import { A, css, r, useRole } from '../../lib/nav';
import { MemberTable, AddMember } from '../live/members';
import Top from './Top';
import ProjectHead from './ProjectHead';
import RoleBadge from './RoleBadge';

class Logic {
props: any;
constructor(p: any) { this.props = p; }

renderVals() { return {}; }
}

export default function Members(props: any = {}) {
  const v = new Logic(props).renderVals();
  return (<><div className="app"><Top role={"lead"} project={"1"} />{" "}<div className="body"><main className="main"><ProjectHead role={"lead"} active={"members"} />{" "}<div className="wide" style={{display: "flex", flexWrap: "wrap", gap: "20px", alignItems: "flex-start"}}><MemberTable canRemove={true} removeRole="DEVELOPER" />{" "}<section className="card" style={{flex: "1 1 300px", minWidth: "0"}}><h3>Add a Developer</h3>{" "}<p className="muted small" style={{marginBottom: "12px"}}>People register themselves with a code before you can add them. The email match ignores upper and lower case.</p>{" "}<AddMember role="DEVELOPER" label="Developer" />{" "}<hr className="hr" style={{margin: "16px 0"}} />{" "}<div className="small muted stack8"><div><b style={{color: "var(--ink)"}}>Who adds whom.</b> A PM adds Dev Leads. A Dev Lead adds Developers. A Developer sees this list only.</div><div>Remove confirms first. If the person still has open tasks: <b>This person still has open tasks. Reassign them first.</b></div><div>Adding someone already in the project: toast <b>Already a member.</b></div></div></section></div></main></div></div></>);
}
