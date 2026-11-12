'use client';
import { useEffect, useState } from 'react';
import { A, r } from '../../lib/nav';
import { ApiError, listProjectsLive_6, listTasksLive_20, setTaskStatusLive_24, setTaskStatus_24, useDb, type LiveProjectDetail, type LiveTask, type LiveTaskStatus, type TaskStatus } from '../../lib/api';
import { useSession } from '../../lib/auth/session';
import { toast } from './toast';

const LABEL: Record<TaskStatus, string> = { todo: 'To do', prog: 'In progress', rev: 'In review', done: 'Done' };
const ME = 'pn';
// The Library Seat Booking project is not in the prototype data: one extra open and one blocked task come from it.
const OTHER = { open: 1, blocked: 1 };

const LIVE_LABEL: Record<LiveTaskStatus, string> = { TODO: 'To do', IN_PROGRESS: 'In progress', IN_REVIEW: 'In review', DONE: 'Done' };

export function LiveMyWork() {
  const session = useSession();
  const userId = session?.user?.id;
  const [projects, setProjects] = useState<Array<{ project: LiveProjectDetail; tasks: LiveTask[] }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    let active = true;
    setLoading(true); setError(null);
    listProjectsLive_6(0, 100).then(async (page) => {
      const results = await Promise.allSettled(page.items.map(async (project) => {
        const tasks = await listTasksLive_20(project.id, 0, 100);
        return { project, tasks: tasks.items.filter((task) => task.assigneeId === userId && task.status !== 'DONE') };
      }));
      const rows = results.flatMap((result) => result.status === 'fulfilled' ? [result.value] : []);
      if (active) setProjects(rows.filter((row) => row.tasks.length));
    }).catch((e: unknown) => { if (active) setError(e instanceof ApiError ? e.message : 'Something went wrong. Try again.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [userId, retry]);

  const updateTask = async (task: LiveTask, next: LiveTaskStatus, blocked = task.blocked, blockedReason: string | null = task.blockedReason) => {
    try {
      const updated = await setTaskStatusLive_24(task.id, { status: next, blocked, blockedReason, version: task.version });
      setProjects((rows) => rows.map((row) => ({ ...row, tasks: row.tasks.map((item) => item.id === task.id ? updated : item).filter((item) => item.status !== 'DONE') })).filter((row) => row.tasks.length));
      toast(blocked !== task.blocked ? (blocked ? 'Task blocked.' : 'Task unblocked.') : `Moved to ${LIVE_LABEL[next]}.`);
    } catch (e: unknown) { toast(e instanceof ApiError ? e.message : 'Could not update task.', 'bad'); }
  };

  if (loading) return <div className="card"><p className="muted">Loading your work…</p></div>;
  if (error) return <div className="banner b-bad"><span>{error}</span><button className="btn sm" type="button" onClick={() => setRetry((value) => value + 1)}>Try again</button></div>;
  const open = projects.reduce((total, row) => total + row.tasks.length, 0);
  const blocked = projects.reduce((total, row) => total + row.tasks.filter((task) => task.blocked).length, 0);
  return <>
    <p className="muted num">{open} open, {blocked} blocked</p>
    {projects.length === 0 ? <section className="card"><p className="muted">No tasks are assigned to you yet.</p></section> : projects.map(({ project, tasks }) => <section className="card pad0" key={project.id}>
      <div className="ch"><A href={`/projects/${project.id}`} className="row b" style={{ color: 'var(--accent-t)' }}><svg className="ic" aria-hidden="true"><use href="#i-folder" /></svg><h3 style={{ margin: 0 }}>{project.name}</h3></A><span className="small muted">{tasks.length} open</span></div>
      {tasks.map((task) => <div className="trow" key={task.id} style={task.blocked ? { background: 'var(--danger-s)' } : undefined}>
        <A href={`/projects/${project.id}/board?task=${task.id}`} className="t" style={{ color: 'var(--ink)' }}><div>{task.title}{task.blocked && <span className="chip c-bad" style={{ marginLeft: 6 }}><svg className="ic" aria-hidden="true"><use href="#i-alert" /></svg>Blocked</span>}</div><div className="small muted">{task.sprintId ? 'Sprint assigned' : 'Backlog'}</div></A>
        <span className={`pts${task.storyPoints ? '' : ' none'}`}>{task.storyPoints ?? 'Unestimated'}</span>
        <select className="sel" aria-label={`Status for ${task.title}`} value={task.status} onChange={(event) => updateTask(task, event.target.value as LiveTaskStatus)}>{(Object.keys(LIVE_LABEL) as LiveTaskStatus[]).map((status) => <option key={status} value={status}>{LIVE_LABEL[status]}</option>)}</select>
        <button className="btn sm" type="button" onClick={() => updateTask(task, task.status, !task.blocked, task.blocked ? null : 'Blocked from My Work')}>{task.blocked ? 'Unblock' : 'Mark blocked'}</button>
      </div>)}
    </section>)}
  </>;
}

export function MyWorkCounts() {
  const db = useDb();
  const mine = db.tasks.filter((t) => t.assignee === ME && t.status !== 'done');
  return <p className="muted num">{mine.length + OTHER.open} open, {mine.filter((t) => t.blockedReason).length + OTHER.blocked} blocked</p>;
}

// My tasks in Campus Eats (endpoints 20 and 24), with a real status control.
export function MyWorkCampus() {
  const db = useDb();
  const mine = db.tasks.filter((t) => t.assignee === ME && t.status !== 'done');
  return (
    <section className="card pad0">
      <div className="ch">
        <A href={r('Overview.dc.html')} className="row b" style={{ color: 'var(--accent-t)' }}><svg className="ic" aria-hidden="true"><use href="#i-folder" /></svg><h3 style={{ margin: 0 }}>{db.project.name}</h3></A>
        <span className="small muted">{mine.length} open</span>
      </div>
      {mine.map((t) => {
        const sp = db.sprints.find((s) => s.id === t.sprintId);
        return (
          <div className="trow" key={t.id} style={t.blockedReason ? { background: 'var(--danger-s)' } : undefined}>
            <A href={`/projects/p1/board?task=${t.id}`} className="t" style={{ color: 'var(--ink)' }}>
              <div>{t.title}{t.blockedReason && <span className="chip c-bad" style={{ marginLeft: 6 }} title={t.blockedReason}><svg className="ic" aria-hidden="true"><use href="#i-alert" /></svg>Blocked</span>}</div>
              <div className="small muted">{t.epic} · {sp ? sp.name : 'No sprint'}</div>
            </A>
            <span className={`pts${t.points ? '' : ' none'}`}>{t.points ?? 'Unestimated'}</span>
            <select className="sel" aria-label="Status" value={t.status} onChange={async (e) => { await setTaskStatus_24(t.id, e.target.value as TaskStatus); toast(`Moved to ${LABEL[e.target.value as TaskStatus]}.`); }}>
              {(Object.keys(LABEL) as TaskStatus[]).map((k) => <option key={k} value={k}>{LABEL[k]}</option>)}
            </select>
            {t.blockedReason ? (
              <button className="btn sm" onClick={async () => { await setTaskStatus_24(t.id, t.status, ''); toast('Task unblocked.'); }}>Unblock</button>
            ) : (
              <A className="btn sm" href={r('BoardBlocked.dc.html')}><svg className="ic" aria-hidden="true"><use href="#i-alert" /></svg>Mark blocked</A>
            )}
          </div>
        );
      })}
      {mine.length === 0 && <div className="trow"><span className="small muted">Nothing open here. Nice work.</span></div>}
    </section>
  );
}
