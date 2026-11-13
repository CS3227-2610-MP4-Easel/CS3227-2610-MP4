// Generated from the design canvas page ProjectHead.dc.html. Source of truth from here on is this file.
import { Fragment, useEffect, useRef, useState } from 'react';
import { A, r, useRole } from '../../lib/nav';
import { ApiError, getProjectLive_7, useDb, type LiveProjectDetail } from '../../lib/api';
import { useProjectRoute } from '../../lib/api/project-mode';

const safeError = (e: unknown) => e instanceof ApiError ? e.message : 'Something went wrong. Try again.';
const isUnauthorized = (e: unknown) => e instanceof ApiError && e.status === 401;
type Tab = [string, string, string, string[]];

export default function ProjectHead(props: { role?: string; active?: string; archived?: boolean; project?: LiveProjectDetail | null; loading?: boolean; error?: string | null; onRetry?: () => void } = {}) {
  const role = useRole();
  const route = useProjectRoute();
  const db = useDb();
  const [fetched, setFetched] = useState<LiveProjectDetail | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  const request = useRef(0);
  const supplied = props.project !== undefined;
  useEffect(() => {
    if (route.mode !== 'live' || !route.projectId || supplied) { setFetched(null); setFetchError(null); setFetching(false); return; }
    let loadProject: typeof getProjectLive_7 | null = null;
    try { loadProject = getProjectLive_7; } catch { setFetching(false); return; }
    if (!loadProject) { setFetching(false); return; }
    const current = ++request.current;
    setFetching(true); setFetched(null); setFetchError(null);
    loadProject(route.projectId).then((p) => { if (request.current === current) setFetched(p); }).catch((e: unknown) => { if (request.current === current && !isUnauthorized(e)) setFetchError(safeError(e)); }).finally(() => { if (request.current === current) setFetching(false); });
  }, [route.mode, route.projectId, supplied]);
  const live = route.mode === 'live' && route.projectId !== null;
  const project = supplied ? props.project : fetched;
  const loading = props.loading ?? (live && fetching);
  const error = props.error ?? (live ? fetchError : null);
  const currentRole = props.role || role || 'pm';
  const active = props.active || 'overview';
  const allTabs: Tab[] = [
    ['overview', 'Overview', 'Overview.dc.html', ['pm', 'lead', 'dev']], ['board', 'Board', 'Board.dc.html', ['pm', 'lead', 'dev']], ['backlog', 'Backlog', 'Backlog.dc.html', ['pm', 'lead', 'dev']], ['plan', 'Plan', 'PlanIdea.dc.html', ['pm']], ['checkpoints', 'Checkpoints', 'Checkpoints.dc.html', ['pm', 'lead', 'dev']], ['health', 'Health', currentRole === 'pm' ? 'HealthPM.dc.html' : 'Health.dc.html', ['pm', 'lead']], ['standups', 'Standups', 'Standups.dc.html', ['lead']], ['mystandup', 'My standup', 'Standup.dc.html', ['dev']], ['members', 'Members', 'Members.dc.html', ['pm', 'lead', 'dev']], ['settings', 'Settings', 'Settings.dc.html', ['pm']],
  ];
  const tabs = allTabs.filter((tab) => tab[3].includes(currentRole));
  // Tabs a role can look at but not change, shown as a pill at the right of the tab bar.
  const MAINTAINED = 'View Only: This tab is maintained by the Dev Leads';
  const viewOnlyTabs: Record<string, Record<string, string>> = {
    pm: { board: MAINTAINED, health: 'View Only: These data are dynamically generated' },
    dev: { backlog: 'View Only: This tab is maintained by your Dev Lead' },
  };
  const viewOnly = viewOnlyTabs[currentRole]?.[active];
  const archived = live ? project?.status === 'ARCHIVED' : props.archived || db.project.status === 'ARCHIVED';
  return <><div className="phead" style={{ margin: 0, borderTopLeftRadius: 8, borderTopRightRadius: 8, borderBottomRightRadius: 10, borderBottomLeftRadius: 10 }}><div className="row wrap" style={{ width: 1065 }}><h1>{live ? project?.name ?? (loading ? 'Loading project…' : 'Project') : 'Campus Eats Mobile App'}</h1>{archived ? <span className="chip c-line"><svg className="ic" aria-hidden="true"><use href="#i-lock" /></svg>Archived</span> : !live || project ? <span className="chip c-ok"><svg className="ic" aria-hidden="true"><use href="#i-check" /></svg>Active</span> : null}</div><div className="tabbar"><nav className="tabs" aria-label="Project">{tabs.map((tab) => <Fragment key={tab[0]}><A href={r(tab[2], live ? route.projectId ?? undefined : undefined)} className={tab[0] === active ? 'on' : ''}>{tab[1]}</A></Fragment>)}</nav>{viewOnly && <span className="vo-pill"><svg className="ic" aria-hidden="true"><use href="#i-info" /></svg>{viewOnly}</span>}</div></div>{error ? <div className="banner b-bad" role="alert"><span className="sp">{error}</span><button className="btn sm" type="button" onClick={props.onRetry}>Try again</button></div> : null}</>;
}
