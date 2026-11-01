// @ts-nocheck
// Generated from the design canvas page Members.dc.html. Source of truth from here on is this file.
import { Fragment } from 'react';
import { A, css, r, useRole } from '../../lib/nav';
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
  return (<><div className="app"><Top role={"lead"} project={"1"} />{" "}<div className="body"><main className="main"><ProjectHead role={"lead"} active={"members"} />{" "}<div className="wide" style={{display: "flex", flexWrap: "wrap", gap: "20px", alignItems: "flex-start"}}><section className="card pad0" style={{flex: "2 1 460px", minWidth: "0"}}><div className="ch"><h3 style={{margin: "0"}}>Members</h3><span className="small muted">5 people</span></div>{" "}<table className="tbl"><thead><tr><th>Name</th><th>Role</th><th>Added</th><th className="r"><span style={{position: "absolute", left: "-9999px"}}>Actions</span></th></tr></thead><tbody><tr><td><div className="row"><span className="av a1">AR</span><b>Aisha Rahman</b></div></td><td><RoleBadge role={"pm"} /></td><td className="muted num">12 Oct 2026</td><td></td></tr><tr><td><div className="row"><span className="av a2">DT</span><b>Daniel Tan</b></div></td><td><RoleBadge role={"lead"} /></td><td className="muted num">12 Oct 2026</td><td></td></tr><tr><td><div className="row"><span className="av a3">PN</span><b>Priya Nair</b></div></td><td><RoleBadge role={"dev"} /></td><td className="muted num">14 Oct 2026</td><td className="r"><A className="btn g sm" href={r("MembersRemove.dc.html")} style={{color: "var(--danger)"}}>Remove</A></td></tr><tr><td><div className="row"><span className="av a2">ML</span><b>Marcus Lim</b></div></td><td><RoleBadge role={"dev"} /></td><td className="muted num">14 Oct 2026</td><td className="r"><A className="btn g sm" href={r("MembersRemove.dc.html")} style={{color: "var(--danger)"}}>Remove</A></td></tr><tr><td><div className="row"><span className="av a4">WO</span><b>Wei Ling Ong</b></div></td><td><RoleBadge role={"dev"} /></td><td className="muted num">15 Oct 2026</td><td className="r"><A className="btn g sm" href={r("MembersRemove.dc.html")} style={{color: "var(--danger)"}}>Remove</A></td></tr></tbody></table></section>{" "}<section className="card" style={{flex: "1 1 300px", minWidth: "0"}}><h3>Add a Developer</h3>{" "}<p className="muted small" style={{marginBottom: "12px"}}>People register themselves with a code before you can add them. The email match ignores upper and lower case.</p>{" "}<div className="field"><label htmlFor="ae">Email</label><input id="ae" className="in err" defaultValue="sam.koh@example.edu" /><span className="err-t"><svg className="ic" style={{width: "14px", height: "14px"}} aria-hidden="true"><use href="#i-alert" /></svg>No registered Developer has that email.</span></div>{" "}<div style={{marginTop: "12px"}}><span className="btn p">Add Developer</span></div>{" "}<hr className="hr" style={{margin: "16px 0"}} />{" "}<div className="small muted stack8"><div><b style={{color: "var(--ink)"}}>Who adds whom.</b> A PM adds Dev Leads. A Dev Lead adds Developers. A Developer sees this list only.</div><div>Remove confirms first. If the person still has open tasks: <b>This person still has open tasks. Reassign them first.</b></div><div>Adding someone already in the project: toast <b>Already a member.</b></div></div></section></div></main></div></div></>);
}
