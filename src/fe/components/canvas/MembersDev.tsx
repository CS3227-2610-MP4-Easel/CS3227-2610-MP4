// @ts-nocheck
// Generated from the design canvas page MembersDev.dc.html. Source of truth from here on is this file.
import { Fragment } from 'react';
import { A, css, r, useRole } from '../../lib/nav';
import { MemberTable } from '../live/members';
import Top from './Top';
import ProjectHead from './ProjectHead';
import Banner from './Banner';
import RoleBadge from './RoleBadge';

class Logic {
props: any;
constructor(p: any) { this.props = p; }

renderVals() { return {}; }
}

export default function MembersDev(props: any = {}) {
  const v = new Logic(props).renderVals();
  return (<><div className="app"><Top role={"dev"} project={"1"} />{" "}<div className="body"><main className="main"><ProjectHead role={"dev"} active={"members"} />{" "}<div className="wide" style={{display: "flex", flexWrap: "wrap", gap: "20px", alignItems: "flex-start"}}><Banner kind={"info"} text={"Developers see the member list only. Your Dev Lead adds developers."} icon={"eye"} />{" "}<MemberTable canRemove={false} removeRole="DEVELOPER" wide /></div></main></div></div></>);
}
