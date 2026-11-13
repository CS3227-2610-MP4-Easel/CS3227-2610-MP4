'use client';
import { useEffect, useRef, useState, type DragEvent, type FormEvent } from 'react';
import { currentProject } from '../../lib/screens';
import { A, useRoute } from '../../lib/nav';
import Select from './select';
import {
  ApiError, getLiveProject_7, listLiveCheckpoints_12, listLiveEpics_16, listLiveTasks_20,
  listLiveMembers_9, listSprintsLive_27, updateLiveCheckpoint_14, updateLiveEpic_18,
  updateLiveTask_23, deleteCheckpointLive_15, deleteEpicLive_19, deleteTaskLive_25, validPoints, type LiveCheckpoint, type LiveEpic, type LiveTask,
  type LiveMember, type LiveSprint,
} from '../../lib/api';

type Data = { projectId: string; project: string; checkpoints: LiveCheckpoint[]; epics: LiveEpic[]; tasks: LiveTask[]; members: LiveMember[]; sprints: LiveSprint[] };
type Editor = { kind: 'checkpoint' | 'epic' | 'task'; id: string } | null;
const STATUS: Record<LiveTask['status'], { label: string; cls: string }> = {
  TODO: { label: 'To do', cls: 'c-todo' },
  IN_PROGRESS: { label: 'In progress', cls: 'c-acc' },
  IN_REVIEW: { label: 'In review', cls: 'c-warn' },
  DONE: { label: 'Done', cls: 'c-done' },
};

async function load(projectId: string): Promise<Data> {
  const [project, checkpoints, epics, tasks, members, sprints] = await Promise.all([
    getLiveProject_7(projectId), listLiveCheckpoints_12(projectId), listLiveEpics_16(projectId),
    listLiveTasks_20(projectId), listLiveMembers_9(projectId), listSprintsLive_27(projectId, 0, 100).then((page) => page.items),
  ]);
  return { projectId, project: project.name, checkpoints, epics, tasks, members, sprints };
}

function CheckpointForm({ item, busy, blocked, onSave, onCancel }: { item: LiveCheckpoint; busy: boolean; blocked: boolean; onSave: (patch: { name?: string; targetDate?: string }) => void; onCancel: () => void }) {
  const original = useRef(item).current;
  const [name, setName] = useState(item.name), [date, setDate] = useState(item.targetDate);
  return <form className="stack8" onSubmit={(e) => { e.preventDefault(); onSave({ ...(name !== original.name ? { name } : {}), ...(date !== original.targetDate ? { targetDate: date } : {}) }); }}>
    <label>Checkpoint name<input className="in" required maxLength={200} value={name} onChange={(e) => setName(e.target.value)} /></label>
    <label>Target date<input className="in" type="date" required value={date} onChange={(e) => setDate(e.target.value)} /></label>
    <div className="row"><button className="btn p" disabled={busy || blocked || !name.trim()}>Save checkpoint</button><button className="btn" type="button" disabled={busy} onClick={onCancel}>Cancel</button></div>
  </form>;
}
function EpicForm({ item, data, busy, blocked, onSave, onCancel }: { item: LiveEpic; data: Data; busy: boolean; blocked: boolean; onSave: (patch: { title?: string; description?: string | null; checkpointId?: string | null }) => void; onCancel: () => void }) {
  const original = useRef(item).current;
  const [title, setTitle] = useState(item.title), [description, setDescription] = useState(item.description ?? ''), [checkpoint, setCheckpoint] = useState(item.checkpointId ?? '');
  return <form className="stack8" onSubmit={(e) => { e.preventDefault(); onSave({ ...(title !== original.title ? { title } : {}), ...(description !== (original.description ?? '') ? { description } : {}), ...((checkpoint || null) !== original.checkpointId ? { checkpointId: checkpoint || null } : {}) }); }}>
    <label>Epic title<input className="in" required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} /></label>
    <label>Description<textarea className="in" maxLength={4000} value={description} onChange={(e) => setDescription(e.target.value)} /></label>
    <label>Checkpoint<Select value={checkpoint} onChange={setCheckpoint} options={[{ value: '', label: 'No checkpoint' }, ...data.checkpoints.map((c) => ({ value: c.id, label: c.name }))]} /></label>
    <div className="row"><button className="btn p" disabled={busy || blocked || !title.trim()}>Save epic</button><button className="btn" type="button" disabled={busy} onClick={onCancel}>Cancel</button></div>
  </form>;
}
function TaskForm({ item, data, busy, blocked, onSave, onCancel }: { item: LiveTask; data: Data; busy: boolean; blocked: boolean; onSave: (patch: { title?: string; description?: string | null; acceptanceCriteria?: string[]; storyPoints?: number | null; epicId?: string; assigneeId?: string | null; sprintId?: string | null }) => void; onCancel: () => void }) {
  const original = useRef(item).current;
  const [title, setTitle] = useState(item.title), [description, setDescription] = useState(item.description ?? ''), [criteria, setCriteria] = useState(item.acceptanceCriteria.join('\n'));
  const [points, setPoints] = useState(item.storyPoints?.toString() ?? ''), [epic, setEpic] = useState(item.epicId), [assignee, setAssignee] = useState(item.assigneeId ?? ''), [sprint, setSprint] = useState(item.sprintId ?? '');
  const lines = criteria === original.acceptanceCriteria.join('\n') ? original.acceptanceCriteria : criteria === '' ? [] : criteria.split('\n');
  const invalidPoints = points !== '' && !validPoints(points);
  const submit = (e: FormEvent) => { e.preventDefault(); if (!title.trim() || invalidPoints || lines.length > 12 || lines.some((v) => v.length > 300)) return; onSave({ ...(title !== original.title ? { title } : {}), ...(description !== (original.description ?? '') ? { description } : {}), ...(criteria !== original.acceptanceCriteria.join('\n') ? { acceptanceCriteria: lines } : {}), ...((points === '' ? null : Number(points)) !== original.storyPoints ? { storyPoints: points === '' ? null : Number(points) } : {}), ...(epic !== original.epicId ? { epicId: epic } : {}), ...((assignee || null) !== original.assigneeId ? { assigneeId: assignee || null } : {}), ...((sprint || null) !== original.sprintId ? { sprintId: sprint || null } : {}) }); };
  return <form className="stack8" onSubmit={submit}>
    <label>Task title<input className="in" required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} /></label>
    <label>Description<textarea className="in" maxLength={4000} value={description} onChange={(e) => setDescription(e.target.value)} /></label>
    <label>Acceptance criteria, one per line<textarea className="in" value={criteria} onChange={(e) => setCriteria(e.target.value)} /></label>
    {(lines.length > 12 || lines.some((v) => v.length > 300)) && <div className="err-t">At most 12 criteria, each at most 300 characters.</div>}
    <label>Story points<input className="in" type="number" min={1} max={20} step={1} value={points} onChange={(e) => setPoints(e.currentTarget.validity.badInput ? 'invalid' : e.currentTarget.value)} /></label>
    {invalidPoints && <div className="err-t">Whole number from 1 to 20.</div>}
    <label>Epic<Select value={epic} onChange={setEpic} options={data.epics.map((v) => ({ value: v.id, label: v.title }))} /></label>
    <label>Assignee<Select value={assignee} onChange={setAssignee} options={[{ value: '', label: 'Unassigned' }, ...data.members.map((v) => ({ value: v.userId, label: v.displayName }))]} /></label>
    <label>Sprint<Select value={sprint} onChange={setSprint} options={[{ value: '', label: 'No sprint' }, ...data.sprints.map((v) => ({ value: v.id, label: v.name }))]} /></label>
    <div className="row"><button className="btn p" disabled={busy || blocked || !title.trim() || invalidPoints || lines.length > 12 || lines.some((v) => v.length > 300)}>Save task</button><button className="btn" type="button" disabled={busy} onClick={onCancel}>Cancel</button></div>
  </form>;
}

export type BacklogFilter = 'unscheduled' | 'unassigned' | 'noEstimate' | null;

export default function LiveBacklog({ search = '', filter = null }: { search?: string; filter?: BacklogFilter } = {}) {
  const projectId = currentProject();
  const routeFor = useRoute();
  const [data, setData] = useState<Data | null>(null), [error, setError] = useState(''), [editing, setEditing] = useState<Editor>(null);
  const [busy, setBusy] = useState(false), [unavailable, setUnavailable] = useState(false), [collapsed, setCollapsed] = useState<string[]>([]);
  const [expandedTasks, setExpandedTasks] = useState<string[]>([]), [collapsedEpics, setCollapsedEpics] = useState<string[]>([]), [announcement, setAnnouncement] = useState('');
  const [focusAfterMove, setFocusAfterMove] = useState<string | null>(null);
  const [dragged, setDragged] = useState<string | null>(null), [picker, setPicker] = useState<{ taskId: string; checkpointId: string } | null>(null), [destination, setDestination] = useState('');
  const epoch = useRef(0);
  const focusBeforePicker = useRef<HTMLElement | null>(null), pickerRef = useRef<HTMLSelectElement | HTMLButtonElement | null>(null);
  const stillCurrent = (id: string) => currentProject() === id;
  useEffect(() => {
    let active = true;
    epoch.current++;
    setData(null); setError(''); setEditing(null); setUnavailable(false); setPicker(null); setBusy(false); setCollapsed([]); setExpandedTasks([]); setCollapsedEpics([]); setAnnouncement(''); setFocusAfterMove(null);
    load(projectId).then((value) => { if (active && stillCurrent(projectId)) setData(value); }).catch((e) => { if (active && stillCurrent(projectId)) setError(e instanceof Error ? e.message : 'Something went wrong.'); });
    return () => { active = false; };
  }, [projectId]);
  useEffect(() => { if (picker) pickerRef.current?.focus(); }, [picker]);
  useEffect(() => {
    if (!focusAfterMove) return;
    document.getElementById(`task-toggle-${focusAfterMove}`)?.focus();
    setFocusAfterMove(null);
  }, [data, collapsed, focusAfterMove]);
  const closePicker = () => { setPicker(null); setDestination(''); focusBeforePicker.current?.focus(); };
  const mutate = async (kind: 'checkpoint' | 'epic' | 'task', id: string, request: () => Promise<unknown>) => {
    if (busy || !data || data.projectId !== projectId || !stillCurrent(projectId)) return false;
    const generation = epoch.current;
    const valid = () => stillCurrent(projectId) && epoch.current === generation;
    setBusy(true); setError('');
    try {
      await request();
      const fresh = await load(projectId);
      if (!valid()) return false;
      setData(fresh); setUnavailable(false); setEditing(null); return true;
    } catch (e) {
      if (!valid()) return false;
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      if (e instanceof ApiError && (e.code === 'CONFLICT_VERSION' || e.code === 'CONFLICT_STATE' || e.code === 'NOT_FOUND')) {
        try {
          const fresh = await load(projectId);
          if (!valid()) return false;
          const rows = kind === 'checkpoint' ? fresh.checkpoints : kind === 'epic' ? fresh.epics : fresh.tasks;
          const updated = rows.find((row) => row.id === id);
          const missing = !updated;
          // Keep the editing form under its original parents so a refresh cannot discard its draft.
          if (editing?.kind === kind && editing.id === id) {
            if (kind === 'checkpoint') {
              const old = data.checkpoints.find((row) => row.id === id);
              if (old) fresh.checkpoints = [...fresh.checkpoints.filter((row) => row.id !== id), { ...old, version: updated?.version ?? old.version }];
            }
            if (kind === 'epic' || kind === 'task') {
              const oldTask = kind === 'task' ? data.tasks.find((row) => row.id === id) : undefined;
              const epicId = oldTask?.epicId ?? id;
              const oldEpic = data.epics.find((row) => row.id === epicId);
              if (oldEpic) {
                const nextEpic = fresh.epics.find((row) => row.id === epicId);
                fresh.epics = [...fresh.epics.filter((row) => row.id !== epicId), { ...oldEpic, version: kind === 'epic' ? updated?.version ?? oldEpic.version : nextEpic?.version ?? oldEpic.version }];
                if (oldEpic.checkpointId && !fresh.checkpoints.some((row) => row.id === oldEpic.checkpointId)) {
                  fresh.checkpoints = [...fresh.checkpoints, ...data.checkpoints.filter((row) => row.id === oldEpic.checkpointId)];
                }
              }
              if (oldTask) fresh.tasks = [...fresh.tasks.filter((row) => row.id !== id), { ...oldTask, version: updated?.version ?? oldTask.version }];
            }
          }
          setData(fresh); setUnavailable(missing);
          if (missing) setError('This item is no longer available. Your changes are kept, but cannot be saved.');
        } catch { if (valid()) { setUnavailable(true); setError('Could not reload this item. Your changes are kept, but cannot be saved.'); } }
      }
      return false;
    } finally { if (valid()) setBusy(false); }
  };
  if (!data || data.projectId !== projectId) return error ? <div className="banner b-bad" role="alert">{error}</div> : <div className="card">Loading backlog…</div>;
  const move = async (taskId: string, epicId: string, keyboard = false) => {
    const task = data.tasks.find((t) => t.id === taskId);
    if (!task || task.epicId === epicId) return true;
    const moved = await mutate('task', taskId, () => updateLiveTask_23(task.id, { epicId, version: task.version }));
    if (moved) {
      const target = data.epics.find((epic) => epic.id === epicId);
      setAnnouncement(`${task.title} moved to ${target?.title ?? 'the selected epic'}.`);
      if (keyboard) {
        if (target?.checkpointId) setCollapsed((ids) => ids.filter((id) => id !== target.checkpointId));
        setFocusAfterMove(taskId);
      }
    }
    return moved;
  };
  const onDropEpic = (event: DragEvent, epicId: string) => { event.preventDefault(); event.stopPropagation(); const id = event.dataTransfer.getData('text/plain'); setDragged(null); if (id) void move(id, epicId); };
  const onDropCheckpoint = (event: DragEvent, checkpointId: string) => { event.preventDefault(); event.stopPropagation(); const id = event.dataTransfer.getData('text/plain'); setDragged(null); if (!data.tasks.some((task) => task.id === id)) return; focusBeforePicker.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; setDestination(''); setPicker({ taskId: id, checkpointId }); };
  const groups = [...data.checkpoints].sort((a, b) => a.targetDate.localeCompare(b.targetDate) || a.name.localeCompare(b.name));
  const noCheckpoint = data.epics.filter((epic) => !epic.checkpointId || !data.checkpoints.some((c) => c.id === epic.checkpointId));
  const needle = search.trim().toLowerCase();
  const shown = (task: LiveTask) => (!needle || task.title.toLowerCase().includes(needle)) && (!filter || (filter === 'unscheduled' ? !task.sprintId : filter === 'unassigned' ? !task.assigneeId : !task.storyPoints));
  const renderEpic = (epic: LiveEpic) => { const epicOpen = !collapsedEpics.includes(epic.id); return <section key={epic.id} onDragOver={(e) => { if (dragged) e.preventDefault(); }} onDrop={(e) => onDropEpic(e, epic.id)}>
    {editing?.kind === 'epic' && editing.id === epic.id ? <div className="ch"><EpicForm item={epic} data={data} busy={busy} blocked={unavailable} onCancel={() => { setEditing(null); setUnavailable(false); }} onSave={(patch) => void mutate('epic', epic.id, () => updateLiveEpic_18(epic.id, { ...patch, version: epic.version }))} /></div> : <div className="bl-ep"><div style={{ minWidth: 0 }}><div className="row"><button className="btn g sm ib" type="button" aria-label={`${epicOpen ? 'Collapse' : 'Expand'} ${epic.title}`} aria-expanded={epicOpen} disabled={editing !== null} onClick={() => setCollapsedEpics((ids) => epicOpen ? [...ids, epic.id] : ids.filter((id) => id !== epic.id))}><svg className="ic" aria-hidden="true"><use href={epicOpen ? '#i-down' : '#i-right'} /></svg></button><h3>{epic.title}</h3></div>{epicOpen && epic.description && <span className="small muted desc">{epic.description}</span>}</div><div className="row"><button className="ia" type="button" aria-label="Edit epic" data-tip="Edit epic" disabled={busy || editing !== null} onClick={() => { setError(''); setUnavailable(false); setEditing({ kind: 'epic', id: epic.id }); }}><svg className="ic" aria-hidden="true"><use href="#i-edit" /></svg></button><button className="ia d" type="button" aria-label="Delete epic" data-tip="Delete epic" disabled={busy || editing !== null} onClick={() => { const n = data.tasks.filter((t) => t.epicId === epic.id).length; if (window.confirm(`Delete epic "${epic.title}"${n ? ` and its ${n} task${n === 1 ? '' : 's'}` : ''}?`)) void mutate('epic', epic.id, () => deleteEpicLive_19(epic.id, epic.version)); }}><svg className="ic" aria-hidden="true"><use href="#i-trash" /></svg></button></div></div>}
    {epicOpen && data.tasks.filter((t) => t.epicId === epic.id && shown(t)).map((task) => {
      const expanded = expandedTasks.includes(task.id);
      return <div key={task.id} draggable={!busy && !editing} onDragStart={(e) => { e.dataTransfer.setData('text/plain', task.id); e.dataTransfer.effectAllowed = 'move'; setDragged(task.id); }} onDragEnd={() => setDragged(null)}>
        <div className="trow">
          <svg className="ic muted" aria-hidden="true"><use href="#i-grip" /></svg>
          <button id={`task-toggle-${task.id}`} className="btn g sm ib" type="button" aria-label={`${expanded ? 'Collapse' : 'Expand'} ${task.title}`} aria-expanded={expanded} disabled={editing !== null} onClick={() => setExpandedTasks((ids) => expanded ? ids.filter((id) => id !== task.id) : [...ids, task.id])}><svg className="ic" aria-hidden="true"><use href={expanded ? '#i-down' : '#i-right'} /></svg></button>
          <span className="chip scol c-line">{data.sprints.find((s) => s.id === task.sprintId)?.name ?? 'No sprint'}</span>
          <span className={`pts${task.storyPoints == null ? ' none' : ''}`}>{task.storyPoints ?? 'Unestimated'}</span>
          <span className={`chip ${STATUS[task.status].cls}`}>{STATUS[task.status].label}</span>
          {task.blocked && <span className="chip c-bad" title={task.blockedReason ?? ''}>Blocked</span>}
          <A className="t" href={routeFor(`/projects/${projectId}/board?task=${task.id}`)}>{task.title}</A>
          <span className="chip c-line">{data.members.find((m) => m.userId === task.assigneeId)?.displayName ?? 'Unassigned'}</span>
          {expanded && !(editing?.kind === 'task' && editing.id === task.id) && <><button className="ia" type="button" aria-label="Edit task" data-tip="Edit task" disabled={busy || editing !== null} onClick={() => { setError(''); setUnavailable(false); setEditing({ kind: 'task', id: task.id }); }}><svg className="ic" aria-hidden="true"><use href="#i-edit" /></svg></button><button className="ia d" type="button" aria-label="Delete task" data-tip="Delete task" disabled={busy || editing !== null} onClick={() => { if (window.confirm(`Delete task "${task.title}"?`)) void mutate('task', task.id, () => deleteTaskLive_25(task.id, task.version)); }}><svg className="ic" aria-hidden="true"><use href="#i-trash" /></svg></button></>}
        </div>
        {expanded && <div className="t-body">
          {editing?.kind === 'task' && editing.id === task.id ? <TaskForm item={task} data={data} busy={busy} blocked={unavailable} onCancel={() => { setEditing(null); setUnavailable(false); }} onSave={(patch) => void mutate('task', task.id, () => updateLiveTask_23(task.id, { ...patch, version: task.version }))} /> : <>
            {task.description && <p>{task.description}</p>}{task.acceptanceCriteria.length > 0 && <ul>{task.acceptanceCriteria.map((line, i) => <li key={i}>{line}</li>)}</ul>}
          </>}
        </div>}
      </div>;
    })}
    {epicOpen && !data.tasks.some((task) => task.epicId === epic.id && shown(task)) && <div className="trow small muted">{data.tasks.some((task) => task.epicId === epic.id) ? 'No tasks match these filters.' : 'No tasks in this epic yet.'}</div>}
  </section>; };
  return <div className="stack">
    {error && <div className="banner b-bad" role="alert">{error}</div>}
    <div className="sr-only" role="status" aria-live="polite">{announcement}</div>
    <div className="card pad0">
      {groups.map((cp) => <section key={cp.id} onDragOver={(e) => { if (dragged) e.preventDefault(); }} onDrop={(e) => onDropCheckpoint(e, cp.id)}>
        {editing?.kind === 'checkpoint' && editing.id === cp.id ? <div className="ch"><CheckpointForm item={cp} busy={busy} blocked={unavailable} onCancel={() => { setEditing(null); setUnavailable(false); }} onSave={(patch) => void mutate('checkpoint', cp.id, () => updateLiveCheckpoint_14(cp.id, { ...patch, version: cp.version }))} /></div> : <div className="ch bl-cp"><div className="row"><button className="btn g sm ib" type="button" disabled={editing !== null} aria-label={`${collapsed.includes(cp.id) ? 'Expand' : 'Collapse'} ${cp.name}`} aria-expanded={!collapsed.includes(cp.id)} onClick={() => setCollapsed((ids) => ids.includes(cp.id) ? ids.filter((id) => id !== cp.id) : [...ids, cp.id])}><svg className="ic" aria-hidden="true"><use href={collapsed.includes(cp.id) ? '#i-right' : '#i-down'} /></svg></button><span className="chip c-acc bl-date"><svg className="ic" aria-hidden="true"><use href="#i-flag" /></svg>{cp.targetDate}</span><b>{cp.name}</b></div><div className="row"><button className="ia" type="button" aria-label="Edit checkpoint" data-tip="Edit checkpoint" disabled={busy || editing !== null} onClick={() => { setError(''); setUnavailable(false); setEditing({ kind: 'checkpoint', id: cp.id }); }}><svg className="ic" aria-hidden="true"><use href="#i-edit" /></svg></button><button className="ia d" type="button" aria-label="Delete checkpoint" data-tip="Delete checkpoint" disabled={busy || editing !== null} onClick={() => { if (window.confirm(`Delete checkpoint "${cp.name}"? Its epics stay, unlinked.`)) void mutate('checkpoint', cp.id, () => deleteCheckpointLive_15(cp.id, cp.version)); }}><svg className="ic" aria-hidden="true"><use href="#i-trash" /></svg></button></div></div>}
        {!collapsed.includes(cp.id) && data.epics.filter((epic) => epic.checkpointId === cp.id).map(renderEpic)}
      </section>)}
      {noCheckpoint.length > 0 && <section><div className="ch"><h2>No checkpoint</h2></div>{noCheckpoint.map(renderEpic)}</section>}
    </div>
    {picker && <div className="card stack8" role="dialog" aria-labelledby="move-task-heading"><h3 id="move-task-heading">Choose an epic</h3>{data.epics.some((epic) => epic.checkpointId === picker.checkpointId) ? <><label>Destination epic<Select buttonRef={pickerRef as React.RefObject<HTMLButtonElement>} value={destination} onChange={setDestination} options={[{ value: '', label: 'Choose an epic' }, ...data.epics.filter((epic) => epic.checkpointId === picker.checkpointId).map((epic) => ({ value: epic.id, label: epic.title }))]} /></label><button className="btn p" disabled={!destination || busy} onClick={async () => { if (await move(picker.taskId, destination)) closePicker(); }}>Move task</button></> : <p>This checkpoint needs an epic before a task can be moved here.</p>}<button className="btn" ref={!data.epics.some((epic) => epic.checkpointId === picker.checkpointId) ? pickerRef as React.RefObject<HTMLButtonElement> : undefined} disabled={busy} onClick={closePicker}>Cancel</button></div>}
  </div>;
}

