// @ts-nocheck
// Generated from the design canvas page Top.dc.html. Source of truth from here on is this file.
import { Fragment, useEffect, useState } from 'react';
import { A, css, r, useRole } from '../../lib/nav';
import { useProjectRoute } from '../../lib/api/project-mode';
import { initialsOf, ROLE_LABEL, useSession } from '../../lib/auth/session';
import { ApiError, listProjectsLive_6, type LiveProjectDetail } from '../../lib/api';
import { useAuthMode } from '../../lib/auth/mode-context';


class Logic {
props: any;
constructor(p: any) { this.props = p; }

renderVals() {
const r = this.props.role || 'pm';
const m = {
pm: { name: 'Aisha Rahman', email: 'aisha.rahman@example.edu', initials: 'AR', av: 'a1', rc: 'r-pm', rl: 'Project Manager', href: 'Projects.dc.html', icon: '#i-folder', hint: 'Open your projects list' },
lead: { name: 'Daniel Tan', email: 'daniel.tan@example.edu', initials: 'DT', av: 'a2', rc: 'r-lead', rl: 'Dev Lead', href: 'LeadOverview.dc.html', icon: '#i-pulse', hint: 'Open the overview of all your projects' },
dev: { name: 'Priya Nair', email: 'priya.nair@example.edu', initials: 'PN', av: 'a3', rc: 'r-dev', rl: 'Developer', href: 'MyWork.dc.html', icon: '#i-task', hint: 'Open My work: your tasks across projects' }
}[r];
const inProject = !!this.props.project;
const list = [['Campus Eats Mobile App', 'Active'], ['Library Seat Booking', 'Active'], ['Orientation Week Planner', 'Archived, read-only']];
return {
current: inProject ? 'Campus Eats Mobile App' : 'All projects', curIcon: inProject ? '#i-folder' : m.icon,
menuOpen: !!this.props.menu,
allHref: m.href, allIcon: m.icon, allHint: m.hint, allCls: inProject ? '' : 'on',
projects: list.map((x, i) => ({ name: x[0], sub: x[1], icon: i === 2 ? '#i-lock' : '#i-folder', cur: inProject && i === 0, cls: inProject && i === 0 ? 'on' : '' })),
name: m.name, email: m.email, initials: m.initials, avClass: m.av, roleClass: m.rc, roleLabel: m.rl };
}
}

export default function Top(props: any = {}) {
  const role = useRole();
  const route = useProjectRoute();
  const [open, setOpen] = useState(false);
  const session = useSession();
  const authMode = useAuthMode();
  const [liveProjects, setLiveProjects] = useState<LiveProjectDetail[] | null>(null);
  useEffect(() => {
    if (authMode !== 'firebase' || !session?.user) { setLiveProjects(null); return; }
    let active = true;
    listProjectsLive_6(0, 100).then((page) => { if (active) setLiveProjects(page.items); }).catch((error: unknown) => {
      if (active && !(error instanceof ApiError && error.status === 401)) setLiveProjects([]);
    });
    return () => { active = false; };
  }, [authMode, session?.user]);
  const v = new Logic({ ...props, role, project: route.projectId ?? props.project, menu: props.menu || open ? 'open' : '' }).renderVals();
  const u = session && session.user;
  if (u) {
    const k = { PM: ['a1', 'r-pm'], DEV_LEAD: ['a2', 'r-lead'], DEVELOPER: ['a3', 'r-dev'] }[u.role] || ['a3', 'r-dev'];
    Object.assign(v, { name: u.displayName, email: u.email, initials: initialsOf(u.displayName), avClass: k[0], roleClass: k[1], roleLabel: ROLE_LABEL[u.role] ?? '' });
  }
  if (liveProjects) {
    v.projects = liveProjects.map((project) => ({ name: project.name, sub: project.status === 'ARCHIVED' ? 'Archived, read-only' : 'Active', icon: project.status === 'ARCHIVED' ? '#i-lock' : '#i-folder', cur: project.id === route.projectId, cls: project.id === route.projectId ? 'on' : '', href: `/projects/${project.id}` }));
    v.current = route.projectId ? liveProjects.find((project) => project.id === route.projectId)?.name ?? 'All projects' : 'All projects';
  }
  return (<><header className="top"><A className="brand" href={r(v.allHref)}><span className="logo" style={{fontWeight: "800", fontSize: "13px"}}>E</span>Easel</A>{" "}<div className="switch"><span className="btn sm" role="button" tabIndex="0" onClick={() => setOpen(!open)} style={{cursor: "pointer"}} aria-haspopup="menu" aria-expanded={v.menuOpen} aria-label="Switch project"><svg className="ic" aria-hidden="true"><use href={v.curIcon} /></svg>{v.current}<svg className="ic" aria-hidden="true"><use href="#i-down" /></svg></span>{" "}{v.menuOpen ? (<><div className="menu" role="menu"><A className={`mi ${v.allCls}`} role="menuitem" href={r(v.allHref)}><svg className="ic lg" aria-hidden="true"><use href={v.allIcon} /></svg><span><span className="b">All projects</span><span className="sub">{v.allHint}</span></span></A>{" "}<hr className="hr" style={{margin: "4px 0"}} />{" "}<div className="mh">Your projects</div>{" "}{(v.projects || []).map((L_p: any, i_p: number) => (<Fragment key={i_p}><A className={`mi ${L_p.cls}`} role="menuitem" href={L_p.href ?? r(L_p.sub.startsWith("Archived") ? "BoardArchived.dc.html" : "Overview.dc.html")}><svg className="ic lg" aria-hidden="true"><use href={L_p.icon} /></svg><span style={{flex: "1"}}><span className="b">{L_p.name}</span><span className="sub">{L_p.sub}</span></span>{L_p.cur ? (<><svg className="ic" aria-hidden="true"><use href="#i-check" /></svg></>) : null}</A></Fragment>))}</div></>) : null}</div>{" "}<span className="sp"></span>{" "}<A className="btn g sm" href={r("Usage.dc.html")}><svg className="ic" aria-hidden="true"><use href="#i-chart" /></svg>Usage</A>{" "}<div className="row" style={{gap: "10px", paddingLeft: "12px", borderLeft: "1px solid var(--line)"}}><span className={`av ${v.avClass}`} aria-hidden="true">{v.initials}</span>{" "}<div style={{display: "flex", flexDirection: "column", lineHeight: "1.25"}}><span className="b" style={{fontSize: "13px"}}>{v.name}</span><span className="small muted">{v.email}</span></div>{" "}<span className={`role ${v.roleClass}`}>{v.roleLabel}</span>{" "}{session ? (<button className="btn g sm" type="button" onClick={() => { session.signOut().catch(() => {}); }}>Sign out</button>) : (<a className="btn g sm" href="/api/as?role=out&to=/sign-in">Sign out</a>)}</div></header></>);
}
