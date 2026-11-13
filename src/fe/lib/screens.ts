// Maps each design-canvas screen to a route (ui.md section 1), a view (state or dialog) and the roles it is drawn for.
export type Role = 'pm' | 'lead' | 'dev';

export type Screen = { file: string; path: string; view?: string; roles?: Role[] };

export const PROJECT = 'p1';

// The project the open page belongs to. The prototype always uses p1; in live mode the screen sets it from the URL
// (Screen) so every project link and data call follows the project the user opened.
let current = PROJECT;
export const setCurrentProject = (id: string) => {
  current = id;
};
export const currentProject = () => current;

export const HOME: Record<Role, string> = { pm: '/projects', lead: '/projects', dev: '/my-work' };

const P = '/projects/:id';

export const SCREENS: Screen[] = [
  { file: 'Main', path: '/sign-in' },
  { file: 'SignInError', path: '/sign-in', view: 'error' },
  { file: 'Register', path: '/register' },
  { file: 'RegisterAccount', path: '/register', view: 'step2' },
  { file: 'RegisterFinish', path: '/register', view: 'step3' },
  { file: 'MyWork', path: '/my-work', roles: ['dev'] },
  { file: 'Projects', path: '/projects', roles: ['pm', 'lead'] },
  { file: 'ProjectsEmptyPM', path: '/projects', view: 'empty', roles: ['pm'] },
  { file: 'ProjectsEmptyDev', path: '/projects', view: 'empty', roles: ['lead', 'dev'] },
  { file: 'Projects1024', path: '/projects', view: 'narrow' },
  { file: 'NewProject', path: '/projects', view: 'new', roles: ['pm'] },
  { file: 'Overview', path: P, roles: ['pm'] },
  { file: 'OverviewLead', path: P, roles: ['lead'] },
  { file: 'OverviewDev', path: P, roles: ['dev'] },
  { file: 'Board', path: P + '/board', roles: ['lead'] },
  { file: 'BoardPM', path: P + '/board', roles: ['pm'] },
  { file: 'BoardDev', path: P + '/board', roles: ['dev'] },
  { file: 'BoardArchived', path: P + '/board', view: 'archived' },
  { file: 'BoardBlocked', path: P + '/board', view: 'blocked', roles: ['lead', 'dev'] },
  { file: 'BoardInProgress', path: P + '/board', view: 'in-progress' },
  { file: 'BoardProgressReview', path: P + '/board', view: 'progress-review' },
  { file: 'TaskDetail', path: P + '/board', view: 'task' },
  { file: 'Backlog', path: P + '/backlog', roles: ['lead'] },
  { file: 'BacklogPM', path: P + '/backlog', roles: ['pm'] },
  { file: 'BacklogDev', path: P + '/backlog', roles: ['dev'] },
  { file: 'BacklogAddTask', path: P + '/backlog', view: 'add-task', roles: ['lead', 'pm'] },
  { file: 'BacklogAddEpic', path: P + '/backlog', view: 'add-epic', roles: ['lead', 'pm'] },
  { file: 'BacklogEmptyPM', path: P + '/backlog', view: 'empty', roles: ['pm', 'lead'] },
  { file: 'BacklogEmptyDev', path: P + '/backlog', view: 'empty', roles: ['dev'] },
  { file: 'Checkpoints', path: P + '/checkpoints', roles: ['lead'] },
  { file: 'CheckpointsPM', path: P + '/checkpoints', roles: ['pm'] },
  { file: 'CheckpointsDev', path: P + '/checkpoints', roles: ['dev'] },
  { file: 'CheckpointAdd', path: P + '/checkpoints', view: 'add', roles: ['lead', 'pm'] },
  { file: 'Health', path: P + '/health', roles: ['lead'] },
  { file: 'HealthPM', path: P + '/health', roles: ['pm'] },
  { file: 'Standups', path: P + '/standups', roles: ['lead'] },
  { file: 'StandupsEarlier', path: P + '/standups', view: 'earlier', roles: ['lead'] },
  { file: 'Standup', path: P + '/standup', roles: ['dev'] },
  { file: 'StandupDegraded', path: P + '/standup', view: 'degraded', roles: ['dev'] },
  { file: 'Members', path: P + '/members', roles: ['lead'] },
  { file: 'MembersPM', path: P + '/members', roles: ['pm'] },
  { file: 'MembersDev', path: P + '/members', roles: ['dev'] },
  { file: 'MembersRemove', path: P + '/members', view: 'remove', roles: ['lead', 'pm'] },
  { file: 'Settings', path: P + '/settings', roles: ['pm'] },
  { file: 'PlanIdea', path: P + '/plan', roles: ['pm'] },
  { file: 'Plan', path: P + '/plan', view: 'epics', roles: ['pm'] },
  { file: 'PlanApprove', path: P + '/plan', view: 'approve', roles: ['pm'] },
  { file: 'PlanApproved', path: P + '/plan', view: 'approved', roles: ['pm'] },
  { file: 'PlanRejected', path: P + '/plan', view: 'discarded', roles: ['pm'] },
  { file: 'PlanSuperseded', path: P + '/plan', view: 'replaced', roles: ['pm'] },
  { file: 'ScreenIndex', path: '/screens' },
  { file: 'Styleguide', path: '/styleguide' },
  { file: 'States', path: '/states' },
];

export function urlOf(s: Screen, projectId = current): string {
  const p = s.path.replace(':id', projectId);
  return s.view ? `${p}?view=${s.view}` : p;
}

const byFile = new Map(SCREENS.map((s) => [s.file, s]));

/** Canvas hrefs look like "Board.dc.html"; turn one into the app URL. */
export function routeOf(href: string, projectId = PROJECT): string {
  const m = href.match(/^([A-Za-z0-9]+)\.dc\.html$/);
  if (!m) return href;
  const s = byFile.get(m[1]);
  return s ? urlOf(s, projectId) : '#';
}

export type Resolved = { file: string } | { forbidden: true } | { notFound: true };

/** Pick the canvas screen for a URL, a view and the signed-in role. */
export function resolve(pathname: string, view: string | undefined, role: Role): Resolved {
  const norm = pathname.replace(/\/+$/, '') || '/';
  const generic = norm.replace(/^\/projects\/[^/]+/, '/projects/:id');
  const same = SCREENS.filter((s) => s.path === generic);
  if (!same.length) return { notFound: true };
  const wanted = view ?? undefined;
  const inView = same.filter((s) => s.view === wanted);
  if (!inView.length) return { notFound: true };
  const exact = inView.find((s) => !s.roles || s.roles.includes(role));
  if (exact) return { file: exact.file };
  return { forbidden: true };
}
