'use client';
import { useEffect, useState } from 'react';
import { A, r } from '../../lib/nav';
import { ApiError, deleteSprintLive_32, listTasksLive_20, startSprintLive_30, deleteSprint_32, startSprint_30, useDb, type LiveSprint, type LiveTask, type Sprint } from '../../lib/api';
import StatusChip from '../canvas/StatusChip';
import { toast } from './toast';
import { WHO, fmtDay } from './people';

const ORDER = { ACTIVE: 0, PLANNED: 1, CLOSED: 2 } as const;
const LIVE_STATUS: Record<LiveTask['status'], 'todo' | 'prog' | 'rev' | 'done'> = { TODO: 'todo', IN_PROGRESS: 'prog', IN_REVIEW: 'rev', DONE: 'done' };

// Sprint sections for the Dev Lead, read from the data layer (endpoints 27, 30, 32).
type SprintListProps = { readOnly?: boolean; live?: boolean; projectId?: string; sprints?: LiveSprint[]; loading?: boolean; error?: string | null; onRetry?: () => void; onChanged?: () => void | Promise<void> };

export default function SprintList({ readOnly = false, live = false, projectId, sprints, loading = false, error, onRetry, onChanged }: SprintListProps) {
  const db = useDb();
  const [busy, setBusy] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(() => live ? new Set() : new Set(db.sprints.filter((sprint) => sprint.status === 'ACTIVE').map((sprint) => sprint.id)));
  const [liveTasks, setLiveTasks] = useState<Record<string, LiveTask[]>>({});
  const [taskError, setTaskError] = useState('');
  const liveSprints = sprints ?? [];
  const hasActive = live ? liveSprints.some((s) => s.status === 'ACTIVE') : db.sprints.some((s) => s.status === 'ACTIVE');
  const sorted = live ? [...liveSprints].sort((a, b) => ORDER[a.status] - ORDER[b.status] || a.startDate.localeCompare(b.startDate)) : [...db.sprints].sort((a, b) => ORDER[a.status] - ORDER[b.status] || a.startDate.localeCompare(b.startDate));

  useEffect(() => {
    if (!live || !projectId || !sprints?.length) return;
    let current = true;
    setTaskError('');
    Promise.all(sprints.map((sprint) => listTasksLive_20(projectId, 0, 100, { sprintId: sprint.id }).then((page) => [sprint.id, page.items] as const)))
      .then((entries) => { if (current) setLiveTasks(Object.fromEntries(entries)); })
      .catch(() => { if (current) setTaskError('Unable to load sprint tasks.'); });
    const active = sprints.find((sprint) => sprint.status === 'ACTIVE');
    setExpanded(active ? new Set([active.id]) : new Set());
    return () => { current = false; };
  }, [live, projectId, sprints]);

  const run = async (id: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(id);
    try {
      await fn();
      await onChanged?.();
      toast(ok);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Something went wrong.', 'bad');
    } finally {
      setBusy('');
    }
  };

  if (live && loading && !sprints) return <div className="card"><div className="sk" style={{ height: 18, width: '35%' }} /><div className="sk" style={{ height: 70, marginTop: 12 }} /></div>;
  if (live && error) return <div className="banner b-bad" role="alert"><span className="sp">{error}</span>{onRetry ? <button className="btn sm" type="button" onClick={onRetry}>Try again</button> : null}</div>;
  if (live && !sorted.length) return <div className="card"><p className="muted">No sprints yet.</p></div>;

  return (
    <>
      {sorted.map((s: Sprint) => {
        const tasks = live ? [] : db.tasks.filter((t) => t.sprintId === s.id);
        const liveSprintTasks = live ? liveTasks[s.id] ?? [] : [];
        const pts = live ? liveSprintTasks.reduce((a, t) => a + (t.storyPoints ?? 0), 0) : tasks.reduce((a, t) => a + (t.points || 0), 0);
        const done = live ? ((s as LiveSprint).completedPoints ?? 0) : tasks.filter((t) => t.status === 'done').reduce((a, t) => a + (t.points || 0), 0);
        const dates = `${fmtDay(s.startDate)} to ${fmtDay(s.endDate)}`;
        const isExpanded = expanded.has(s.id);
        return (
          <section className="card pad0" key={s.id}>
            <div className="ch">
              <button type="button" className="row wrap" aria-expanded={isExpanded} onClick={() => setExpanded((current) => { const next = new Set(current); if (next.has(s.id)) next.delete(s.id); else next.add(s.id); return next; })} style={{ border: 0, background: 'transparent', padding: 0, cursor: 'pointer', textAlign: 'left' }}>
                <svg className="ic" aria-hidden="true"><use href={isExpanded ? '#i-down' : '#i-right'} /></svg>
                <h3 style={{ margin: 0 }}>{s.name}</h3>
                {s.status === 'ACTIVE' && <span className="chip c-prog"><svg className="ic" aria-hidden="true"><use href="#i-zap" /></svg>Active</span>}
                {s.status === 'PLANNED' && <span className="chip c-line"><svg className="ic" aria-hidden="true"><use href="#i-cal" /></svg>Planned</span>}
                {s.status === 'CLOSED' && <span className="chip c-done"><svg className="ic" aria-hidden="true"><use href="#i-check" /></svg>Closed</span>}
              </button>
              <div className="row">
                <span className="small muted num">{dates} · {s.status === 'CLOSED' ? `${done} pts completed` : `${pts} pts planned`}</span>
                {!readOnly && s.status === 'ACTIVE' && <A className="btn sm d" href={r('SprintClose.dc.html')}>Close sprint</A>}
                {!readOnly && s.status === 'PLANNED' && (
                  <>
                    <button className={`btn sm${hasActive ? ' dis' : ''}`} disabled={hasActive || busy === s.id} title={hasActive ? 'Another sprint is active' : ''} aria-disabled={hasActive} onClick={() => run(s.id, () => live ? startSprintLive_30(s.id, s.version) : startSprint_30(s.id), `${s.name} started.`)}>Start</button>
                    <A className="btn sm" href={`${r('SprintsNew.dc.html')}&sprint=${encodeURIComponent(s.id)}`}><svg className="ic" aria-hidden="true"><use href="#i-edit" /></svg>Edit</A>
                    <button className="btn sm" style={{ color: 'var(--danger)' }} disabled={busy === s.id} onClick={() => run(s.id, () => live ? deleteSprintLive_32(s.id, s.version) : deleteSprint_32(s.id), `${s.name} deleted. Its tasks are back in the backlog.`)}>
                      <svg className="ic" aria-hidden="true"><use href="#i-trash" /></svg>Delete
                    </button>
                  </>
                )}
              </div>
            </div>
            {!live && isExpanded && s.status !== 'CLOSED' && tasks.map((t) => (
              <div className="trow" key={t.id}>
                <span className={`pts${t.points ? '' : ' none'}`}>{t.points ?? ''}</span>
                <StatusChip status={t.status} />
                <A className="t" href={r(`Board.dc.html?task=${t.id}`)}>{t.title}</A>
                {t.assignee ? (
                  <span className="who"><span className={`av ${WHO[t.assignee].av}`} aria-hidden="true">{WHO[t.assignee].ini}</span>{WHO[t.assignee].name}</span>
                ) : (
                  <span className="chip c-line">Unassigned</span>
                )}
              </div>
            ))}
            {live && isExpanded && taskError && <div className="trow"><span className="small muted">{taskError}</span></div>}
            {live && isExpanded && !taskError && !Object.prototype.hasOwnProperty.call(liveTasks, s.id) && <div className="trow"><span className="small muted">Loading sprint tasks…</span></div>}
            {live && isExpanded && !taskError && Object.prototype.hasOwnProperty.call(liveTasks, s.id) && liveSprintTasks.map((t) => (
              <div className="trow" key={t.id}>
                <span className={`pts${t.storyPoints ? '' : ' none'}`}>{t.storyPoints ?? ''}</span>
                <StatusChip status={LIVE_STATUS[t.status]} />
                <A className="t" href={`${r('Board.dc.html')}?task=${encodeURIComponent(t.id)}`}>{t.title}</A>
              </div>
            ))}
            {live && isExpanded && !taskError && Object.prototype.hasOwnProperty.call(liveTasks, s.id) && liveSprintTasks.length === 0 && <div className="trow"><span className="small muted">No tasks assigned to this sprint.</span></div>}
            {!readOnly && s.status === 'PLANNED' && hasActive && (
              <div className="trow" style={{ background: 'var(--head)' }}>
                <svg className="ic muted" aria-hidden="true"><use href="#i-info" /></svg>
                <span className="small muted">Start is disabled: another sprint is active. Delete moves its tasks to the backlog.</span>
              </div>
            )}
            {s.status === 'PLANNED' && tasks.length === 0 && !readOnly && (
              <div className="trow"><span className="small muted">No tasks yet. Assign tasks to this sprint from the Backlog.</span></div>
            )}
          </section>
        );
      })}
    </>
  );
}
