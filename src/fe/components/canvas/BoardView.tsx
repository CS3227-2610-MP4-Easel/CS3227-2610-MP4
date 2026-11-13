// @ts-nocheck
// Generated from the design canvas page BoardView.dc.html. Source of truth from here on is this file.
import { Fragment } from 'react';
import { A, css, r, useRole } from '../../lib/nav';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, listEpicsLive_16, listMembersLive_9, listTasksLive_20, useDb, type LiveEpic, type LiveMember, type LiveTask, type LiveTaskListFilters } from '../../lib/api';
import { useProjectRoute } from '../../lib/api/project-mode';
import { useSession } from '../../lib/auth/session';
import TaskCard from './TaskCard';
import Select from '../live/select';
import MultiSelect from '../live/multi-select';

const UNASSIGNED = '__unassigned__';

class Logic {
props: any;
constructor(p: any) { this.props = p; }

cardsDef() {
const out = { todo: [], prog: [], rev: [], done: [] };
for (const t of this.props.tasks) out[t.status].push({ id: t.id, epic: t.epic, title: t.title, points: t.points == null ? '' : String(t.points), who: t.assignee || '', blocked: t.blockedReason });
return out;
}
renderVals() {
const all = [['todo', 'To do', '#i-circle'], ['prog', 'In progress', '#i-half'], ['rev', 'In review', '#i-eye'], ['done', 'Done', '#i-check']];
const show = (this.props.show || 'todo,prog,rev,done').split(',');
const openId = this.props.openId === undefined ? 't3' : this.props.openId;
const data = this.cardsDef();
const role = this.props.role || 'lead';
const archived = !!this.props.archived;
const canEdit = (c) => !archived && (role === 'lead' || (role === 'dev' && c.who === 'pn'));
const notes = { lead: 'Dev Lead view: any card can be dragged or changed from its more menu. A Developer can move only their own tasks. With fewer statuses shown, the remaining columns widen and their cards flow into several columns.', pm: 'Project Manager view: status is read-only, so cards have no more menu and cannot be dragged. Add task stays.', dev: 'Developer view: only your own tasks (Priya N.) have the more menu and can be moved. Other cards are read-only.' };
const sum = (k) => data[k].reduce((a, c) => a + (parseInt(c.points, 10) || 0), 0);
const key = show.join(',');
const hrefFor = (id) => {
if (key === 'todo,prog,rev,done') return id === 'prog' ? 'BoardInProgress.dc.html' : '';
if (key === 'prog') return id === 'rev' ? 'BoardProgressReview.dc.html' : id === 'prog' ? 'Board.dc.html' : '';
if (key === 'prog,rev') return id === 'rev' ? 'BoardInProgress.dc.html' : '';
return '';
};
const filters = all.map((a) => { const on = show.indexOf(a[0]) >= 0; return { label: a[1], icon: a[2], count: data[a[0]].length, on: on, off: !on, cls: on ? 'on' : '', href: hrefFor(a[0]) }; });
const cols = all.filter((a) => show.indexOf(a[0]) >= 0).map((a) => ({
label: a[1], icon: a[2], count: data[a[0]].length, pts: sum(a[0]),
cards: data[a[0]].map((c) => ({ id: c.id, epic: c.epic, title: c.title, points: c.points, who: c.who, status: a[0], blocked: c.blocked || '', menu: c.id === openId && canEdit(c) ? 'true' : '', editable: canEdit(c) ? 'yes' : 'no' }))
}));
return { archived: archived, canAdd: role !== 'dev', addCls: archived ? 'dis' : '', addTip: archived ? 'Archived projects are read-only' : '', meCls: role === 'dev' ? 'on' : '', note: archived ? 'Archived projects are read-only: no drag, no status menu, no new tasks.' : notes[role], filters: filters, cols: cols, partial: cols.length < 4, colsStyle: 'grid-template-columns: repeat(' + Math.max(cols.length, 1) + ', minmax(0, 1fr))' };
}
}

export default function BoardView(props: any = {}) {
  const route = useProjectRoute();
  const db = useDb();
  const currentRole = props.role ?? useRole();
  if (route.mode === 'live' && route.projectId) return <LiveBoard projectId={route.projectId} role={currentRole} {...props} />;
  const v = new Logic({ ...props, tasks: db.tasks, archived: props.archived || db.project.status === 'ARCHIVED' ? 'yes' : '' }).renderVals();
  return (<><div className="stack" style={{gap: "16px"}}>{v.archived ? (<><div className="banner b-warn"><svg className="ic" aria-hidden="true"><use href="#i-lock" /></svg><span>This project is archived and read-only.</span></div></>) : null}{" "}<div className="row wrap between"><div className="row wrap"><span className="sel">Sprint: All tasks<svg className="ic" aria-hidden="true"><use href="#i-down" /></svg></span>{" "}<span className="sel">Epic: Any<svg className="ic" aria-hidden="true"><use href="#i-down" /></svg></span>{" "}<span className="sel">Assignee: Anyone<svg className="ic" aria-hidden="true"><use href="#i-down" /></svg></span>{" "}<span className="sel"><span className="check" style={{width: "14px", height: "14px"}}></span>Blocked only</span>{" "}<span className={`sel ${v.meCls}`}><span className="check" style={{width: "14px", height: "14px"}}></span>Assigned to me</span></div>{" "}{v.canAdd ? (<><A className={`btn p ${v.addCls}`} href={r("BacklogAddTask.dc.html")} title={v.addTip}><svg className="ic" aria-hidden="true"><use href="#i-plus" /></svg>Add task</A></>) : null}</div>{" "}<div className="row wrap" role="group" aria-label="Status filter"><span className="small b muted" style={{marginRight: "4px"}}>Status</span>{" "}{(v.filters || []).map((L_f: any, i_f: number) => (<Fragment key={i_f}>{L_f.href ? <A href={r(L_f.href)} className={`sel ${L_f.cls}`} role="checkbox" aria-checked={L_f.on}>{L_f.on ? (<><svg className="ic" aria-hidden="true"><use href="#i-check" /></svg></>) : null}{" "}{L_f.off ? (<><span className="check" style={{width: "14px", height: "14px"}}></span></>) : null}{" "}<svg className="ic" aria-hidden="true"><use href={L_f.icon} /></svg>{L_f.label}<span className="num" style={{opacity: ".8"}}>{L_f.count}</span></A> : <span className={`sel ${L_f.cls}`} role="checkbox" aria-checked={L_f.on}>{L_f.on ? (<><svg className="ic" aria-hidden="true"><use href="#i-check" /></svg></>) : null}{" "}{L_f.off ? (<><span className="check" style={{width: "14px", height: "14px"}}></span></>) : null}{" "}<svg className="ic" aria-hidden="true"><use href={L_f.icon} /></svg>{L_f.label}<span className="num" style={{opacity: ".8"}}>{L_f.count}</span></span>}</Fragment>))}{" "}{v.partial ? (<><A className="btn g sm" href={r("Board.dc.html")}>Show all statuses</A></>) : null}</div>{" "}<div className="cols" style={css(v.colsStyle)}>{(v.cols || []).map((L_col: any, i_col: number) => (<Fragment key={i_col}><section className="col" aria-label={L_col.label}><div className="col-h"><svg className="ic" aria-hidden="true"><use href={L_col.icon} /></svg><span className="b">{L_col.label}</span><span className="chip c-line">{L_col.count}</span><span className="sp"></span><span className="small muted num">{L_col.pts} pts</span></div>{" "}<div className="cards">{(L_col.cards || []).map((L_c: any, i_c: number) => (<Fragment key={i_c}><TaskCard id={L_c.id} epic={L_c.epic} title={L_c.title} points={L_c.points} who={L_c.who} status={L_c.status} blocked={L_c.blocked} menu={L_c.menu} editable={L_c.editable} /></Fragment>))}</div></section></Fragment>))}</div>{" "}<div className="banner b-info"><svg className="ic" aria-hidden="true"><use href="#i-info" /></svg><span>{v.note}</span></div></div></>);
}

const LIVE_LABEL: Record<string, string> = { TODO: 'To do', IN_PROGRESS: 'In progress', IN_REVIEW: 'In review', DONE: 'Done' };
const LIVE_KEY: Record<string, string> = { TODO: 'todo', IN_PROGRESS: 'prog', IN_REVIEW: 'rev', DONE: 'done' };
const STATUS_OPTIONS = [
  ['TODO', 'To do', '#i-circle'],
  ['IN_PROGRESS', 'In progress', '#i-half'],
  ['IN_REVIEW', 'In review', '#i-eye'],
  ['DONE', 'Done', '#i-check'],
] as const;

function LiveBoard({ projectId, role = 'lead', archived = false }: { projectId: string; role?: string; archived?: boolean }) {
  const session = useSession();
  const [tasks, setTasks] = useState<LiveTask[]>([]);
  const [epics, setEpics] = useState<LiveEpic[]>([]);
  const [members, setMembers] = useState<LiveMember[]>([]);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState<LiveTaskListFilters>({});
  // Epic and assignee are multi-select; the API takes one value each (and has no "unassigned"), so
  // when either is used the board loads up to 100 tasks and filters and pages them here.
  const [epicIds, setEpicIds] = useState<string[]>([]);
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const generation = useRef(0);
  const multi = epicIds.length > 0 || assigneeIds.length > 0;
  const epicKey = epicIds.join(',');
  const assigneeKey = assigneeIds.join(',');

  const load = useCallback(() => {
    const request = ++generation.current;
    let current = true;
    setLoading(true);
    setError('');
    const fetchTasks = async () => {
      if (!multi) return listTasksLive_20(projectId, page, 20, filters);
      const first = await listTasksLive_20(projectId, 0, 100, filters);
      let items = first.items;
      for (let p = 1; items.length < first.total && p <= 100; p += 1) items = items.concat((await listTasksLive_20(projectId, p, 100, filters)).items);
      const kept = items.filter((task) => (epicIds.length === 0 || epicIds.includes(task.epicId))
        && (assigneeIds.length === 0 || assigneeIds.includes(task.assigneeId ?? UNASSIGNED)));
      return { items: kept.slice(page * 20, page * 20 + 20), page, size: 20, total: kept.length };
    };
    Promise.all([
      fetchTasks(),
      listEpicsLive_16(projectId, 0, 100),
      listMembersLive_9(projectId),
    ]).then(([taskPage, epicPage, memberRows]) => {
      if (!current || request !== generation.current) return;
      setTasks(taskPage.items);
      setTotal(taskPage.total);
      setEpics(epicPage.items);
      setMembers(memberRows);
    }).catch((e) => {
      if (current && request === generation.current) setError(e instanceof ApiError ? e.message : 'Something went wrong.');
    }).finally(() => {
      if (current && request === generation.current) setLoading(false);
    });
    return () => { current = false; };
  }, [projectId, page, filters.status, filters.blocked, epicKey, assigneeKey]);

  useEffect(() => {
    const cleanup = load();
    const onRefresh = () => { void load(); };
    window.addEventListener('easel-board-refresh', onRefresh);
    return () => { cleanup?.(); window.removeEventListener('easel-board-refresh', onRefresh); };
  }, [load]);

  const epicById = useMemo(() => new Map(epics.map((epic) => [epic.id, epic.title])), [epics]);
  const memberById = useMemo(() => new Map(members.map((member) => [member.userId, member.displayName])), [members]);
  const grouped = useMemo(() => STATUS_OPTIONS.map(([status, label, icon]) => ({
    status,
    label,
    icon,
    tasks: tasks.filter((task) => task.status === status),
  })), [tasks]);
  const setFilter = (key: keyof LiveTaskListFilters, value: string | boolean | undefined) => {
    setPage(0);
    setFilters((current) => ({ ...current, [key]: value || undefined }));
  };
  const pageCount = Math.max(1, Math.ceil(total / 20));
  const canMutate = (task: LiveTask) => role === 'lead' || (role === 'dev' && task.assigneeId === session?.user?.id);

  return (
    <div className="stack board-fit" style={{ gap: '16px' }}>
      {archived && <div className="banner b-warn"><svg className="ic" aria-hidden="true"><use href="#i-lock" /></svg><span>This project is archived and read-only.</span></div>}
      <div className="row wrap between">
        <div className="row" style={{ flex: '1 1 0', minWidth: 0, flexWrap: 'nowrap' }}>
          <MultiSelect bar label="Epic filter" noun="epics" placeholder="Search epics…" values={epicIds} onChange={(v) => { setPage(0); setEpicIds(v); }} options={epics.map((epic) => ({ value: epic.id, label: epic.title }))} />
          <Select compact label="Status filter" value={filters.status ?? ''} onChange={(v) => setFilter('status', v)} options={[{ value: '', label: 'All statuses' }, ...STATUS_OPTIONS.map(([value, label]) => ({ value, label }))]} />
          <MultiSelect compact label="Assignee filter" noun="people" placeholder="Anyone" values={assigneeIds} onChange={(v) => { setPage(0); setAssigneeIds(v); }} options={[{ value: UNASSIGNED, label: 'Unassigned' }, ...members.map((member) => ({ value: member.userId, label: member.displayName }))]} />
          <button type="button" className={`sel pill-toggle${filters.blocked === true ? ' on' : ''}`} aria-pressed={filters.blocked === true} onClick={() => setFilter('blocked', filters.blocked === true ? undefined : true)}>{filters.blocked === true && <svg className="ic" aria-hidden="true"><use href="#i-check" /></svg>}Blocked only</button>
        </div>
        {role === 'lead' && !archived && <A className="btn p" href={r('BacklogAddTask.dc.html')}><svg className="ic" aria-hidden="true"><use href="#i-plus" /></svg>Add task</A>}
      </div>
      {error && <div className="banner b-bad"><svg className="ic" aria-hidden="true"><use href="#i-alert" /></svg><span>{error}</span><button className="btn sm" type="button" onClick={() => { void load(); }}>Try again</button></div>}
      {loading ? <div className="cols"><div className="col"><div className="sk" /><div className="tcard"><div className="sk" /><div className="sk" /></div></div></div> : (
        <div className="cols" style={css(`grid-template-columns: repeat(${Math.max(grouped.length, 1)}, minmax(0, 1fr))`)}>
          {grouped.map((column) => <section className="col" aria-label={column.label} key={column.status}>
            <div className="col-h"><svg className="ic" aria-hidden="true"><use href={column.icon} /></svg><span className="b">{column.label}</span><span className="chip c-line">{column.tasks.length}</span><span className="sp" /><span className="small muted num">{column.tasks.reduce((sum, task) => sum + (task.storyPoints ?? 0), 0)} pts</span></div>
            <div className="cards">{column.tasks.map((task) => <TaskCard key={task.id} id={task.id} epic={epicById.get(task.epicId) ?? task.epicId} title={task.title} points={task.storyPoints == null ? '' : String(task.storyPoints)} assigneeName={task.assigneeId ? memberById.get(task.assigneeId) : ''} status={LIVE_KEY[task.status]} live={true} liveStatus={task.status} version={task.version} blocked={task.blocked ? (task.blockedReason ?? 'Blocked') : ''} editable={!archived && canMutate(task) ? 'yes' : 'no'} onStatus={() => { window.dispatchEvent(new Event('easel-board-refresh')); }} />)}</div>
          </section>)}
        </div>
      )}
      <div className="row between"><span className="small muted">Page {page + 1} of {pageCount}</span><div className="row"><button className="btn sm" disabled={page === 0 || loading} onClick={() => setPage((current) => current - 1)}>Previous</button><button className="btn sm" disabled={page + 1 >= pageCount || loading} onClick={() => setPage((current) => current + 1)}>Next</button></div></div>
    </div>
  );
}
