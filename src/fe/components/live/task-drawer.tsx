'use client';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { A, r, useModal, useRoute } from '../../lib/nav';
import { ApiError, deleteTask_25, getTaskLive_22, listMembersLive_9, listSprintsLive_27, setTaskStatus_24, setTaskStatusLive_24, updateTaskLive_23, updateTask_23, useDb, validPoints, type LiveMember, type LiveSprint, type LiveTask, type TaskStatus } from '../../lib/api';
import { useProjectRoute } from '../../lib/api/project-mode';
import { useRole } from '../../lib/nav';
import { useSession } from '../../lib/auth/session';
import StatusChip from '../canvas/StatusChip';
import { toast } from './toast';
import { WHO } from './people';

const LABEL: Record<TaskStatus, string> = { todo: 'To do', prog: 'In progress', rev: 'In review', done: 'Done' };
const LIVE_STATUS: Record<string, 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE'> = { todo: 'TODO', prog: 'IN_PROGRESS', rev: 'IN_REVIEW', done: 'DONE' };
const mutationMessage = (error: unknown) => error instanceof ApiError && error.code === 'CONFLICT_STATE' ? 'This task is in a closed sprint and cannot be changed.' : error instanceof ApiError ? error.message : 'Something went wrong.';

function Drawer({ projectId }: { projectId?: string | null }) {
  const searchParams = useSearchParams();
  const modal = useModal();
  const id = modal.modal?.params?.task || searchParams.get('task') || 't5';
  const route = useProjectRoute();
  if (route.mode === 'live' && route.projectId) return <LiveDrawer taskId={id} projectId={projectId ?? route.projectId} />;
  return <PrototypeDrawer id={id} />;
}

function LiveDrawer({ taskId, projectId }: { taskId: string; projectId: string }) {
  const route = useRoute();
  const role = useRole();
  const session = useSession();
  const [task, setTask] = useState<LiveTask | null>(null);
  const [members, setMembers] = useState<LiveMember[]>([]);
  const [sprints, setSprints] = useState<LiveSprint[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [missing, setMissing] = useState(false);
  const generation = useRef(0);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [pts, setPts] = useState('');
  const [err, setErr] = useState('');
  const [errorField, setErrorField] = useState<'title' | 'storyPoints' | 'sprint' | null>(null);
  const [reloadable, setReloadable] = useState(false);
  const load = useCallback(() => {
    const request = ++generation.current;
    let active = true;
    setLoading(true);
    setLoadError('');
    setMissing(false);
    setTask(null);
    getTaskLive_22(taskId).then((next) => {
      if (!active || request !== generation.current) return;
      if (!next || next.projectId !== projectId) { setMissing(true); return; }
      setTask(next);
    }).catch((e) => {
      if (!active || request !== generation.current) return;
      if (e instanceof ApiError && (e.status === 404 || e.code === 'NOT_FOUND')) setMissing(true);
      else setLoadError(e instanceof ApiError ? e.message : 'Something went wrong.');
    }).finally(() => {
      if (active && request === generation.current) setLoading(false);
    });
    return () => { active = false; };
  }, [taskId, projectId]);
  useEffect(() => load(), [load]);
  useEffect(() => { let current = true; void listMembersLive_9(projectId).then((rows) => { if (current) setMembers(rows); }).catch(() => undefined); return () => { current = false; }; }, [projectId]);
  useEffect(() => { if (role !== 'lead') return; let current = true; void listSprintsLive_27(projectId, 0, 100).then((page) => { if (current) setSprints(page.items.filter((sprint) => sprint.status !== 'CLOSED')); }).catch(() => undefined); return () => { current = false; }; }, [projectId, role]);
  if (loading) return <aside className="drawer" role="dialog" aria-modal="true"><div className="sk" style={{ width: '60%' }} /><div className="sk" style={{ marginTop: 12 }} /></aside>;
  if (loadError) return <aside className="drawer" role="dialog" aria-modal="true"><h2>Unable to load task</h2><p className="muted">{loadError}</p><button className="btn p" type="button" onClick={load}>Try again</button></aside>;
  if (missing || !task) return <aside className="drawer" role="dialog" aria-modal="true"><h2>Task not found</h2><p className="muted">This task is unavailable.</p><A className="btn" href={r('Board.dc.html')}>Back to the board</A></aside>;
  const canMutate = role === 'lead' || (role === 'dev' && task.assigneeId === session?.user?.id);
  const save = async () => {
    if (pts !== '' && !validPoints(pts)) { setErr('Whole number from 1 to 20.'); setErrorField('storyPoints'); return; }
    try { const updated = await updateTaskLive_23(task.id, { title, description: desc, storyPoints: pts ? Number(pts) as any : null, version: task.version }); setTask(updated); setEditing(false); setErr(''); setErrorField(null); window.dispatchEvent(new Event('easel-board-refresh')); toast('Task saved.'); }
    catch (e) { setErr(mutationMessage(e)); setErrorField('title'); setReloadable(e instanceof ApiError && e.code === 'CONFLICT_VERSION'); }
  };
  const status = ({ TODO: 'todo', IN_PROGRESS: 'prog', IN_REVIEW: 'rev', DONE: 'done' } as any)[task.status] as TaskStatus;
  const assignee = task.assigneeId ? members.find((member) => member.userId === task.assigneeId) : null;
  const assigneeName = assignee?.displayName ?? (task.assigneeId ? 'Unknown member' : null);
  const assigneeInitials = assigneeName ? assigneeName.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase() : '';
  const changeStatus = async (next: TaskStatus, blocked = task.blocked, blockedReason?: string | null) => {
    try { const updated = await setTaskStatusLive_24(task.id, { status: LIVE_STATUS[next], blocked, blockedReason, version: task.version }); setTask(updated); setErr(''); setErrorField(null); window.dispatchEvent(new Event('easel-board-refresh')); toast(`Moved to ${LABEL[next]}.`); }
    catch (e) { setErr(mutationMessage(e)); setErrorField(null); setReloadable(e instanceof ApiError && e.code === 'CONFLICT_VERSION'); }
  };
  const changeSprint = async (sprintId: string) => {
    if (sprintId && task.storyPoints == null) { setErr('Add story points before assigning this task to a sprint.'); setErrorField('sprint'); setReloadable(false); return; }
    try { const updated = await updateTaskLive_23(task.id, { sprintId: sprintId || null, version: task.version }); setTask(updated); setErr(''); setErrorField(null); window.dispatchEvent(new Event('easel-board-refresh')); toast(sprintId ? 'Task assigned to sprint.' : 'Task moved to backlog.'); }
    catch (e) { setErr(mutationMessage(e)); setErrorField('sprint'); setReloadable(e instanceof ApiError && e.code === 'CONFLICT_VERSION'); }
  };
  return <aside className="drawer" role="dialog" aria-modal="true" aria-labelledby="tt"><div className="row between"><span className="small muted">Epic {task.epicId}</span><div className="row">{canMutate && !editing && <button className="btn sm" onClick={() => { setTitle(task.title); setDesc(task.description ?? ''); setPts(task.storyPoints ? String(task.storyPoints) : ''); setEditing(true); }}>Edit</button>}{canMutate && editing && <button className="btn sm p" onClick={save}>Save</button>}<A className="btn g sm ib" href={r('Board.dc.html')} aria-label="Close"><svg className="ic" aria-hidden="true"><use href="#i-x" /></svg></A></div></div>
    {err && <div className="banner b-bad" role="alert"><svg className="ic" aria-hidden="true"><use href="#i-alert" /></svg><span>{err}</span>{reloadable && <button className="btn sm" type="button" onClick={load}>Reload</button>}</div>}
    {editing ? <div className="field"><input className={`in${errorField === 'title' ? ' err' : ''}`} aria-label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />{err && errorField === 'title' && <span className="err-t">{err}</span>}</div> : <h2 id="tt">{task.title}</h2>}
    <div className="row wrap"><StatusChip status={status} />{task.blocked && <span className="chip c-bad"><svg className="ic" aria-hidden="true"><use href="#i-alert" /></svg>Blocked</span>}</div>
    {task.blocked && <div className="banner b-bad"><svg className="ic" aria-hidden="true"><use href="#i-alert" /></svg><div><div className="b">Blocked</div>{task.blockedReason || 'This task is blocked.'}</div></div>}
    {canMutate && <><div className="g2" style={{ gap: 12 }}><div className="field"><span className="lbl">Status</span><select className="in" aria-label="Status" value={status} onChange={(e) => changeStatus(e.target.value as TaskStatus)}>{(Object.keys(LABEL) as TaskStatus[]).map((key) => <option key={key} value={key}>{LABEL[key]}</option>)}</select></div><div className="field"><span className="lbl">Blocked</span>{task.blocked ? <button className="btn" onClick={() => changeStatus(status, false, null)}><svg className="ic" aria-hidden="true"><use href="#i-check" /></svg>Unblock</button> : <button className="btn" onClick={() => changeStatus(status, true, 'Blocked')}><svg className="ic" aria-hidden="true"><use href="#i-alert" /></svg>Mark blocked</button>}</div></div>{role === 'lead' && <div className="field" style={{ marginTop: 12 }}><label className="lbl" htmlFor="task-sprint">Sprint</label><select id="task-sprint" className={`in${errorField === 'sprint' ? ' err' : ''}`} aria-label="Sprint" value={task.sprintId ?? ''} onChange={(e) => { void changeSprint(e.target.value); }}><option value="">No sprint</option>{sprints.map((sprint) => <option key={sprint.id} value={sprint.id}>{sprint.name}</option>)}</select>{errorField === 'sprint' && err && <span className="err-t">{err}</span>}</div>}</>}
    <hr className="hr" /><div className="stack8"><h3 style={{ margin: 0 }}>Description</h3>{editing && canMutate ? <textarea className="in" rows={4} value={desc} onChange={(e) => setDesc(e.target.value)} /> : <p>{task.description || <span className="muted">No description yet.</span>}</p>}</div>
    {task.acceptanceCriteria.length > 0 && <div className="stack8"><h3 style={{ margin: 0 }}>Acceptance criteria</h3>{task.acceptanceCriteria.map((criterion, index) => <div className="row" key={index}><svg className="ic muted" aria-hidden="true"><use href="#i-circle" /></svg><span>{criterion}</span></div>)}</div>}
    <div className="g2" style={{ gap: '12px 16px' }}><div><div className="small muted">Story points</div>{editing ? <input className={`in${errorField === 'storyPoints' ? ' err' : ''}`} aria-label="Story points" type="number" min={1} max={20} step={1} value={pts} onChange={(e) => setPts(e.target.value)} /> : <span className={`pts${task.storyPoints ? '' : ' none'}`}>{task.storyPoints ?? 'Unestimated'}</span>}</div><div><div className="small muted">Assignee</div>{assigneeName ? <span className="who"><span className="av a4" aria-hidden="true">{assigneeInitials}</span>{assigneeName}</span> : <span className="chip c-line">Unassigned</span>}</div></div>
  </aside>;
}

function PrototypeDrawer({ id }: { id: string }) {
  const db = useDb();
  const router = useRouter();
  const route = useRoute();
  const t = db.tasks.find((x) => x.id === id);
  const [editing, setEditing] = useState(false); const [title, setTitle] = useState(''); const [desc, setDesc] = useState(''); const [pts, setPts] = useState(''); const [err, setErr] = useState('');
  if (!t) return <aside className="drawer" role="dialog" aria-modal="true"><h2>Task not found</h2><p className="muted">It may have been deleted.</p><A className="btn" href={r('Board.dc.html')}>Back to the board</A></aside>;
  const save = async () => { if (pts !== '' && !validPoints(pts)) { setErr('Whole number from 1 to 20.'); return; } try { await updateTask_23(t.id, { title, description: desc, points: pts ? Number(pts) : null }); setEditing(false); setErr(''); toast('Task saved.'); } catch (e) { setErr(e instanceof ApiError ? e.message : 'Something went wrong.'); } };
  return <aside className="drawer" role="dialog" aria-modal="true" aria-labelledby="tt"><div className="row between"><span className="small muted">{t.epic}</span><div className="row">{!editing && <button className="btn sm" onClick={() => { setTitle(t.title); setDesc(t.description); setPts(t.points ? String(t.points) : ''); setEditing(true); }}>Edit</button>}{editing && <button className="btn sm p" onClick={save}>Save</button>}<button className="btn sm" style={{ color: 'var(--danger)' }} onClick={async () => { try { await deleteTask_25(t.id); toast('Task deleted.'); router.push(route('Board.dc.html')); } catch (e) { toast(e instanceof ApiError ? e.message : 'Something went wrong.', 'bad'); } }}>Delete</button><A className="btn g sm ib" href={r('Board.dc.html')} aria-label="Close"><svg className="ic" aria-hidden="true"><use href="#i-x" /></svg></A></div></div>{editing ? <div className="field"><input className={`in${err ? ' err' : ''}`} aria-label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />{err && <span className="err-t">{err}</span>}</div> : <h2 id="tt">{t.title}</h2>}<div className="row wrap"><StatusChip status={t.status} />{t.blockedReason && <span className="chip c-bad">Blocked</span>}</div><div className="g2" style={{ gap: 12 }}><div className="field"><span className="lbl">Status</span><select className="in" aria-label="Status" value={t.status} onChange={async (e) => { await setTaskStatus_24(t.id, e.target.value as TaskStatus); toast(`Moved to ${LABEL[e.target.value as TaskStatus]}.`); }}>{(Object.keys(LABEL) as TaskStatus[]).map((key) => <option key={key} value={key}>{LABEL[key]}</option>)}</select></div></div><hr className="hr" /><div className="stack8"><h3 style={{ margin: 0 }}>Description</h3>{editing ? <textarea className="in" rows={4} value={desc} onChange={(e) => setDesc(e.target.value)} /> : <p>{t.description || <span className="muted">No description yet.</span>}</p>}</div><div className="g2"><div><div className="small muted">Story points</div>{editing ? <input className="in" aria-label="Story points" type="number" min={1} max={20} step={1} value={pts} onChange={(e) => setPts(e.target.value)} /> : <span className={`pts${t.points ? '' : ' none'}`}>{t.points ?? 'Unestimated'}</span>}</div><div><div className="small muted">Assignee</div><span className="chip c-line">{t.assignee ? WHO[t.assignee].name : 'Unassigned'}</span></div></div></aside>;
}

export default function TaskDrawer({ projectId }: { projectId?: string | null } = {}) { return <Suspense fallback={null}><Drawer projectId={projectId} /></Suspense>; }
