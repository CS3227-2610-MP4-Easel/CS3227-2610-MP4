'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { A, useRoute } from '../../lib/nav';
import { ApiError, listCheckpointsLive_12, listEpicsLive_16, listTasksLive_20, useDb, type LiveCheckpoint, type LiveEpic, type LiveTask } from '../../lib/api';
import { useProjectRoute } from '../../lib/api/project-mode';
import StatusChip from '../canvas/StatusChip';
import { WHO } from './people';

export default function BacklogList() {
  const route = useProjectRoute();
  const db = useDb();
  if (route.mode === 'live' && route.projectId) return <LiveBacklogList projectId={route.projectId} />;
  return <>{db.epics.map((e) => {
    const tasks = db.tasks.filter((t) => t.epic === e.title);
    const cp = db.checkpoints.find((c) => c.id === e.checkpointId);
    return <section className="card pad0" key={e.id}>
      <div className="ch" style={{ background: 'var(--head)', borderRadius: '12px 12px 0 0' }}><div className="row"><svg className="ic" aria-hidden="true"><use href="#i-down" /></svg><h3 style={{ margin: 0 }}>{e.title}</h3>{cp && <span className="chip c-acc"><svg className="ic" aria-hidden="true"><use href="#i-flag" /></svg>{cp.name}</span>}</div><div className="row"><span className="small muted">{tasks.length} task{tasks.length === 1 ? '' : 's'} · {tasks.reduce((a, t) => a + (t.points || 0), 0)} pts</span></div></div>
      {tasks.map((t) => { const sp = db.sprints.find((s) => s.id === t.sprintId); return <div className="trow" key={t.id}><span className={`chip scol ${sp ? (sp.status === 'CLOSED' ? 'c-line' : 'c-acc') : 'c-line'}`}>{sp ? sp.name : 'No sprint'}</span><span className={`pts${t.points ? '' : ' none'}`}>{t.points ?? 'Unestimated'}</span><StatusChip status={t.status} />{t.blockedReason && <span className="chip c-bad"><svg className="ic" aria-hidden="true"><use href="#i-alert" /></svg>Blocked</span>}<A className="t" href={`/projects/p1/board?task=${t.id}`}>{t.title}</A>{t.assignee ? <span className="who"><span className={`av ${WHO[t.assignee].av}`} aria-hidden="true">{WHO[t.assignee].ini}</span>{WHO[t.assignee].name}</span> : <span className="chip c-line">Unassigned</span>}</div>; })}
      {tasks.length === 0 && <div className="trow"><span className="small muted">No tasks in this epic yet.</span></div>}
    </section>;
  })}{db.epics.length === 0 && <div className="card"><b>The backlog is empty.</b></div>}</>;
}

function LiveBacklogList({ projectId }: { projectId: string }) {
  const [epics, setEpics] = useState<LiveEpic[]>([]);
  const [tasks, setTasks] = useState<LiveTask[]>([]);
  const [checkpoints, setCheckpoints] = useState<LiveCheckpoint[]>([]);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const generation = useRef(0);
  const load = useCallback(() => {
    const request = ++generation.current;
    let current = true;
    setLoading(true); setError('');
    Promise.all([listEpicsLive_16(projectId, 0, 100), listTasksLive_20(projectId, page, 20), listCheckpointsLive_12(projectId)]).then(([epicPage, taskPage, checkpointRows]) => {
      if (!current || request !== generation.current) return;
      setEpics(epicPage.items); setTasks(taskPage.items); setTotal(taskPage.total); setCheckpoints(checkpointRows);
    }).catch((e) => current && request === generation.current && setError(e instanceof ApiError ? e.message : 'Something went wrong.')).finally(() => current && request === generation.current && setLoading(false));
    return () => { current = false; };
  }, [projectId, page]);
  useEffect(() => load(), [load]);
  const grouped = useMemo(() => epics.map((epic) => ({ epic, tasks: tasks.filter((task) => task.epicId === epic.id) })), [epics, tasks]);
  if (loading) return <div className="card"><div className="sk" style={{ width: '40%' }} /><div className="sk" style={{ marginTop: 12 }} /></div>;
  if (error) return <div className="banner b-bad"><svg className="ic" aria-hidden="true"><use href="#i-alert" /></svg><span>{error}</span><button className="btn sm" type="button" onClick={() => { void load(); }}>Try again</button></div>;
  const visibleGroups = page === 0 ? grouped : grouped.filter(({ tasks: epicTasks }) => epicTasks.length > 0);
  return <>{visibleGroups.map(({ epic, tasks: epicTasks }) => { const checkpoint = checkpoints.find((item) => item.id === epic.checkpointId); return <section className="card pad0" key={epic.id}>
    <div className="ch" style={{ background: 'var(--head)', borderRadius: '12px 12px 0 0' }}><div className="row"><svg className="ic" aria-hidden="true"><use href="#i-down" /></svg><h3 style={{ margin: 0 }}>{epic.title}</h3>{checkpoint && <span className="chip c-acc"><svg className="ic" aria-hidden="true"><use href="#i-flag" /></svg>{checkpoint.name}</span>}</div><div className="row"><span className="small muted">{epic.taskCount} task{epic.taskCount === 1 ? '' : 's'} · {epic.pointsTotal} pts</span></div></div>
    {epicTasks.length ? epicTasks.map((task) => <LiveTaskRow task={task} key={task.id} />) : <div className="trow"><span className="small muted">No tasks in this epic yet.</span></div>}
  </section>; })}{visibleGroups.length === 0 && total === 0 && <div className="card"><b>The backlog is empty.</b></div>}{visibleGroups.length === 0 && total > 0 && <div className="card"><span className="muted">No tasks on this page.</span></div>}
  <div className="row between"><span className="small muted">Page {page + 1} of {Math.max(1, Math.ceil(total / 20))}</span><div className="row"><button className="btn sm" disabled={page === 0} onClick={() => setPage((current) => current - 1)}>Previous</button><button className="btn sm" disabled={(page + 1) * 20 >= total} onClick={() => setPage((current) => current + 1)}>Next</button></div></div></>;
}

function LiveTaskRow({ task }: { task: LiveTask }) {
  const routeFor = useRoute();
  const { projectId } = useProjectRoute();
  return <div className="trow"><span className={`pts${task.storyPoints ? '' : ' none'}`}>{task.storyPoints ?? 'Unestimated'}</span><StatusChip status={({ TODO: 'todo', IN_PROGRESS: 'prog', IN_REVIEW: 'rev', DONE: 'done' } as any)[task.status]} />{task.blocked && <span className="chip c-bad"><svg className="ic" aria-hidden="true"><use href="#i-alert" /></svg>Blocked</span>}<A className="t" href={routeFor(`/projects/${projectId ?? 'p1'}/board?task=${task.id}`)}>{task.title}</A>{task.assigneeId ? <span className="who"><span className="av a4" aria-hidden="true">?</span>{task.assigneeId}</span> : <span className="chip c-line">Unassigned</span>}</div>;
}
