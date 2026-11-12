'use client';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { A, useRoute } from '../../lib/nav';
import { ApiError, listCheckpointsLive_12, listEpicsLive_16, listMembersLive_9, listSprintsLive_27, listTasksLive_20, useDb, type LiveCheckpoint, type LiveEpic, type LiveMember, type LiveSprint, type LiveTask } from '../../lib/api';
import { useProjectRoute } from '../../lib/api/project-mode';
import StatusChip from '../canvas/StatusChip';
import { WHO } from './people';

const sprintLabel = (name: string) => name.match(/^Sprint\s+\d+/i)?.[0] ?? name;

export default function BacklogList({ actions }: { actions?: ReactNode } = {}) {
  const route = useProjectRoute();
  const db = useDb();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'unscheduled' | 'unassigned' | 'noEstimate' | null>(null);
  const controls = <div className="row wrap between" style={{ marginBottom: 16 }}><div className="row wrap"><div style={{ position: 'relative' }}><svg className="ic muted" style={{ position: 'absolute', left: 10, top: 10 }} aria-hidden="true"><use href="#i-search" /></svg><input className="in" style={{ width: 240, paddingLeft: 32 }} placeholder="Search by title" aria-label="Search by title" value={search} onChange={(event) => setSearch(event.target.value)} /></div>{(['unscheduled', 'unassigned', 'noEstimate'] as const).map((key) => <button type="button" className={`sel${filter === key ? ' on' : ''}`} aria-pressed={filter === key} key={key} onClick={() => setFilter((current) => current === key ? null : key)}>{key === 'unscheduled' ? 'Unscheduled' : key === 'unassigned' ? 'Unassigned' : 'No estimate'}</button>)}</div>{actions && <div className="row">{actions}</div>}</div>;
  if (route.mode === 'live' && route.projectId) return <>{controls}<LiveBacklogList projectId={route.projectId} search={search} filter={filter} /></>;
  const matches = (task: typeof db.tasks[number]) => (!search.trim() || task.title.toLowerCase().includes(search.trim().toLowerCase())) && (!filter || (filter === 'unscheduled' ? !task.sprintId : filter === 'unassigned' ? !task.assignee : !task.points));
  return <>{db.epics.map((e) => {
    const tasks = db.tasks.filter((t) => t.epic === e.title && matches(t));
    const cp = db.checkpoints.find((c) => c.id === e.checkpointId);
    return <section className="card pad0" key={e.id}>
      <div className="ch" style={{ background: 'var(--head)', borderRadius: '12px 12px 0 0' }}><div className="row"><svg className="ic" aria-hidden="true"><use href="#i-down" /></svg><h3 style={{ margin: 0 }}>{e.title}</h3>{cp && <span className="chip c-acc"><svg className="ic" aria-hidden="true"><use href="#i-flag" /></svg>{cp.name}</span>}</div><div className="row"><span className="small muted">{tasks.length} task{tasks.length === 1 ? '' : 's'} · {tasks.reduce((a, t) => a + (t.points || 0), 0)} pts</span></div></div>
      {tasks.map((t) => { const sp = db.sprints.find((s) => s.id === t.sprintId); return <div className="trow" key={t.id}><span className={`chip scol ${sp ? (sp.status === 'CLOSED' ? 'c-line' : 'c-acc') : 'c-line'}`}>{sp ? sprintLabel(sp.name) : 'No sprint'}</span><span className={`pts${t.points ? '' : ' none'}`}>{t.points ?? 'Unestimated'}</span><StatusChip status={t.status} />{t.blockedReason && <span className="chip c-bad"><svg className="ic" aria-hidden="true"><use href="#i-alert" /></svg>Blocked</span>}<A className="t" href={`/projects/p1/board?task=${t.id}`}>{t.title}</A>{t.assignee ? <span className="who"><span className={`av ${WHO[t.assignee].av}`} aria-hidden="true">{WHO[t.assignee].ini}</span>{WHO[t.assignee].name}</span> : <span className="chip c-line">Unassigned</span>}</div>; })}
      {tasks.length === 0 && <div className="trow"><span className="small muted">No tasks in this epic yet.</span></div>}
    </section>;
  })}{controls}{db.epics.length === 0 && <div className="card"><b>The backlog is empty.</b></div>}</>;
}

function LiveBacklogList({ projectId, search, filter }: { projectId: string; search: string; filter: 'unscheduled' | 'unassigned' | 'noEstimate' | null }) {
  const [epics, setEpics] = useState<LiveEpic[]>([]);
  const [tasks, setTasks] = useState<LiveTask[]>([]);
  const [checkpoints, setCheckpoints] = useState<LiveCheckpoint[]>([]);
  const [members, setMembers] = useState<LiveMember[]>([]);
  const [sprints, setSprints] = useState<LiveSprint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const generation = useRef(0);
  const load = useCallback(() => {
    const request = ++generation.current;
    let current = true;
    setLoading(true); setError('');
    Promise.all([listEpicsLive_16(projectId, 0, 100), listTasksLive_20(projectId, 0, 100), listCheckpointsLive_12(projectId), listMembersLive_9(projectId), listSprintsLive_27(projectId, 0, 100)]).then(([epicPage, taskPage, checkpointRows, memberRows, sprintPage]) => {
      if (!current || request !== generation.current) return;
      setEpics(epicPage.items); setTasks(taskPage.items); setCheckpoints(checkpointRows); setMembers(memberRows); setSprints(sprintPage.items);
    }).catch((e) => current && request === generation.current && setError(e instanceof ApiError ? e.message : 'Something went wrong.')).finally(() => current && request === generation.current && setLoading(false));
    return () => { current = false; };
  }, [projectId]);
  useEffect(() => load(), [load]);
  useEffect(() => { const refresh = () => { void load(); }; window.addEventListener('easel-board-refresh', refresh); return () => window.removeEventListener('easel-board-refresh', refresh); }, [load]);
  const visibleTasks = useMemo(() => { const needle = search.trim().toLowerCase(); return tasks.filter((task) => (!needle || task.title.toLowerCase().includes(needle)) && (!filter || (filter === 'unscheduled' ? !task.sprintId : filter === 'unassigned' ? !task.assigneeId : !task.storyPoints))); }, [tasks, search, filter]);
  const grouped = useMemo(() => epics.map((epic) => ({ epic, tasks: visibleTasks.filter((task) => task.epicId === epic.id) })), [epics, visibleTasks]);
  if (loading) return <div className="card"><div className="sk" style={{ width: '40%' }} /><div className="sk" style={{ marginTop: 12 }} /></div>;
  if (error) return <div className="banner b-bad"><svg className="ic" aria-hidden="true"><use href="#i-alert" /></svg><span>{error}</span><button className="btn sm" type="button" onClick={() => { void load(); }}>Try again</button></div>;
  return <>{grouped.map(({ epic, tasks: epicTasks }) => { const checkpoint = checkpoints.find((item) => item.id === epic.checkpointId); return <section className="card pad0" key={epic.id}>
    <div className="ch" style={{ background: 'var(--head)', borderRadius: '12px 12px 0 0' }}><div className="row"><svg className="ic" aria-hidden="true"><use href="#i-down" /></svg><h3 style={{ margin: 0 }}>{epic.title}</h3>{checkpoint && <span className="chip c-acc"><svg className="ic" aria-hidden="true"><use href="#i-flag" /></svg>{checkpoint.name}</span>}</div><div className="row"><span className="small muted">{epicTasks.length} task{epicTasks.length === 1 ? '' : 's'} · {epicTasks.reduce((sum, task) => sum + (task.storyPoints ?? 0), 0)} pts</span></div></div>
    {epicTasks.length ? epicTasks.map((task) => <LiveTaskRow task={task} members={members} sprints={sprints} key={task.id} />) : <div className="trow"><span className="small muted">No tasks in this epic yet.</span></div>}
  </section>; })}{visibleTasks.length === 0 && <div className="card"><b>{tasks.length ? 'No tasks match these filters.' : 'The backlog is empty.'}</b></div>}</>;
}

function LiveTaskRow({ task, members, sprints }: { task: LiveTask; members: LiveMember[]; sprints: LiveSprint[] }) {
  const routeFor = useRoute();
  const { projectId } = useProjectRoute();
  const member = task.assigneeId ? members.find((item) => item.userId === task.assigneeId) : null;
  const name = member?.displayName ?? (task.assigneeId ? 'Unknown member' : null);
  const initials = name ? name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase() : '';
  const sprint = task.sprintId ? sprints.find((item) => item.id === task.sprintId) : null;
  return <div className="trow"><span className={`chip scol ${sprint ? (sprint.status === 'CLOSED' ? 'c-line' : 'c-acc') : 'c-line'}`}>{sprint ? sprintLabel(sprint.name) : 'No sprint'}</span><span className={`pts${task.storyPoints ? '' : ' none'}`}>{task.storyPoints ?? 'Unestimated'}</span><StatusChip status={({ TODO: 'todo', IN_PROGRESS: 'prog', IN_REVIEW: 'rev', DONE: 'done' } as any)[task.status]} />{task.blocked && <span className="chip c-bad"><svg className="ic" aria-hidden="true"><use href="#i-alert" /></svg>Blocked</span>}<A className="t" href={routeFor(`/projects/${projectId ?? 'p1'}/board?task=${task.id}`)}>{task.title}</A>{name ? <span className="who"><span className="av a4" aria-hidden="true">{initials}</span>{name}</span> : <span className="chip c-line">Unassigned</span>}</div>;
}
