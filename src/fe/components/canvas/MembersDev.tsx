// @ts-nocheck
// Generated from the design canvas page MembersDev.dc.html. Source of truth from here on is this file.
import { Fragment } from 'react';
import { A, css, r, useRole } from '../../lib/nav';
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
  return (<><div className="app"><Top role={"dev"} project={"1"} />{" "}<div className="body"><main className="main"><ProjectHead role={"dev"} active={"members"} />{" "}<div className="wide" style={{display: "flex", flexWrap: "wrap", gap: "20px", alignItems: "flex-start"}}><Banner kind={"info"} text={"Developers see the member list only. Your Dev Lead adds developers."} icon={"eye"} />{" "}<section className="card pad0" style={{flex: "1 1 100%", minWidth: "0"}}><div className="ch"><h3 style={{margin: "0"}}>Members</h3><span className="small muted">5 people</span></div>{" "}<table className="tbl"><thead><tr><th>Name</th><th>Role</th><th>Added</th><th className="r"><span style={{position: "absolute", left: "-9999px"}}>Actions</span></th></tr></thead><tbody><tr><td><div className="row"><span className="av a1">AR</span><b>Aisha Rahman</b></div></td><td><RoleBadge role={"pm"} /></td><td className="muted num">12 Oct 2026</td><td></td></tr><tr><td><div className="row"><span className="av a2">DT</span><b>Daniel Tan</b></div></td><td><RoleBadge role={"lead"} /></td><td className="muted num">12 Oct 2026</td><td></td></tr><tr><td><div className="row"><span className="av a3">PN</span><b>Priya Nair</b></div></td><td><RoleBadge role={"dev"} /></td><td className="muted num">14 Oct 2026</td><td></td></tr><tr><td><div className="row"><span className="av a2">ML</span><b>Marcus Lim</b></div></td><td><RoleBadge role={"dev"} /></td><td className="muted num">14 Oct 2026</td><td></td></tr><tr><td><div className="row"><span className="av a4">WO</span><b>Wei Ling Ong</b></div></td><td><RoleBadge role={"dev"} /></td><td className="muted num">15 Oct 2026</td><td></td></tr></tbody></table></section></div></main></div></div></>);
}
