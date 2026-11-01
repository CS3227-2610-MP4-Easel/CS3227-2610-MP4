// @ts-nocheck
// Generated from the design canvas page ProjectHead.dc.html. Source of truth from here on is this file.
import { Fragment } from 'react';
import { A, css, r, useRole } from '../../lib/nav';
import { useDb } from '../../lib/api';


class Logic {
props: any;
constructor(p: any) { this.props = p; }

renderVals() {
const r = this.props.role || 'pm';
const a = this.props.active || 'overview';
const all = [
{ id: 'overview', label: 'Overview', href: 'Overview.dc.html', roles: ['pm','lead','dev'] },
{ id: 'board', label: 'Board', href: 'Board.dc.html', roles: ['pm','lead','dev'] },
{ id: 'backlog', label: 'Backlog', href: 'Backlog.dc.html', roles: ['pm','lead','dev'] },
{ id: 'plan', label: 'Plan', href: 'PlanIdea.dc.html', roles: ['pm'] },
{ id: 'checkpoints', label: 'Checkpoints', href: 'Checkpoints.dc.html', roles: ['pm','lead','dev'] },
{ id: 'sprints', label: 'Sprints', href: 'Sprints.dc.html', roles: ['pm','lead','dev'] },
{ id: 'health', label: 'Health', href: r === 'pm' ? 'HealthPM.dc.html' : 'Health.dc.html', roles: ['pm','lead'] },
{ id: 'standups', label: 'Standups', href: 'Standups.dc.html', roles: ['lead'] },
{ id: 'mystandup', label: 'My standup', href: 'Standup.dc.html', roles: ['dev'] },
{ id: 'members', label: 'Members', href: 'Members.dc.html', roles: ['pm','lead','dev'] },
{ id: 'settings', label: 'Settings', href: 'Settings.dc.html', roles: ['pm'] }
];
const arch = !!this.props.archived;
return { archived: arch, notArchived: !arch, tabs: all.filter((x) => x.roles.includes(r)).map((x) => ({ ...x, cls: x.id === a ? 'on' : '' })) };
}
}

export default function ProjectHead(props: any = {}) {
  const role = useRole();
  const db = useDb();
  const v = new Logic({ ...props, role, archived: props.archived || db.project.status === 'ARCHIVED' ? 'yes' : '' }).renderVals();
  return (<><div className="phead" style={{margin: "0", borderTopLeftRadius: "8px", borderTopRightRadius: "8px", borderBottomRightRadius: "10px", borderBottomLeftRadius: "10px"}}><div className="row wrap" style={{width: "1065px"}}><h1>Campus Eats Mobile App</h1>{" "}{v.archived ? (<><span className="chip c-line"><svg className="ic" aria-hidden="true"><use href="#i-lock" /></svg>Archived</span></>) : null}{" "}{v.notArchived ? (<><span className="chip c-ok"><svg className="ic" aria-hidden="true"><use href="#i-check" /></svg>Active</span></>) : null}</div>{" "}<nav className="tabs" aria-label="Project">{(v.tabs || []).map((L_t: any, i_t: number) => (<Fragment key={i_t}><A href={r(L_t.href)} className={L_t.cls}>{L_t.label}</A></Fragment>))}</nav></div></>);
}
