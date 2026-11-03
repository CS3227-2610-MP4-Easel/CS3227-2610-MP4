'use client';
import { useState } from 'react';
import { A, r } from '../../lib/nav';
import { ApiError, deleteSprint_32, startSprint_30, useDb, type Sprint } from '../../lib/api';
import StatusChip from '../canvas/StatusChip';
import { toast } from './toast';
import { WHO, fmtDay } from './people';

const ORDER = { ACTIVE: 0, PLANNED: 1, CLOSED: 2 } as const;

// Sprint sections for the Dev Lead, read from the data layer (endpoints 27, 30, 32).
export default function SprintList({ readOnly = false }: { readOnly?: boolean }) {
  const db = useDb();
  const [busy, setBusy] = useState('');
  const hasActive = db.sprints.some((s) => s.status === 'ACTIVE');
  const sorted = [...db.sprints].sort((a, b) => ORDER[a.status] - ORDER[b.status] || a.startDate.localeCompare(b.startDate));

  const run = async (id: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(id);
    try {
      await fn();
      toast(ok);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Something went wrong.', 'bad');
    } finally {
      setBusy('');
    }
  };

  return (
    <>
      {sorted.map((s: Sprint) => {
        const tasks = db.tasks.filter((t) => t.sprintId === s.id);
        const pts = tasks.reduce((a, t) => a + (t.points || 0), 0);
        const done = tasks.filter((t) => t.status === 'done').reduce((a, t) => a + (t.points || 0), 0);
        const dates = `${fmtDay(s.startDate)} to ${fmtDay(s.endDate)}`;
        return (
          <section className="card pad0" key={s.id}>
            <div className="ch">
              <div className="row wrap">
                <svg className="ic" aria-hidden="true"><use href={s.status === 'ACTIVE' ? '#i-down' : '#i-right'} /></svg>
                <h3 style={{ margin: 0 }}>{s.name}</h3>
                {s.status === 'ACTIVE' && <span className="chip c-prog"><svg className="ic" aria-hidden="true"><use href="#i-zap" /></svg>Active</span>}
                {s.status === 'PLANNED' && <span className="chip c-line"><svg className="ic" aria-hidden="true"><use href="#i-cal" /></svg>Planned</span>}
                {s.status === 'CLOSED' && <span className="chip c-done"><svg className="ic" aria-hidden="true"><use href="#i-check" /></svg>Closed</span>}
              </div>
              <div className="row">
                <span className="small muted num">{dates} · {s.status === 'CLOSED' ? `${done} pts completed` : `${pts} pts planned`}</span>
                {!readOnly && s.status === 'ACTIVE' && <A className="btn sm d" href={r('SprintClose.dc.html')}>Close sprint</A>}
                {!readOnly && s.status === 'PLANNED' && (
                  <>
                    <button className={`btn sm${hasActive ? ' dis' : ''}`} disabled={hasActive || busy === s.id} title={hasActive ? 'Another sprint is active' : ''} aria-disabled={hasActive} onClick={() => run(s.id, () => startSprint_30(s.id), `${s.name} started.`)}>Start</button>
                    <A className="btn sm" href={r('SprintsNew.dc.html')}><svg className="ic" aria-hidden="true"><use href="#i-edit" /></svg>Edit</A>
                    <button className="btn sm" style={{ color: 'var(--danger)' }} disabled={busy === s.id} onClick={() => run(s.id, () => deleteSprint_32(s.id), `${s.name} deleted. Its tasks are back in the backlog.`)}>
                      <svg className="ic" aria-hidden="true"><use href="#i-trash" /></svg>Delete
                    </button>
                  </>
                )}
              </div>
            </div>
            {s.status !== 'CLOSED' && tasks.map((t) => (
              <div className="trow" key={t.id}>
                <span className={`pts${t.points ? '' : ' none'}`}>{t.points ?? ''}</span>
                <StatusChip status={t.status} />
                <A className="t" href={`/projects/p1/board?task=${t.id}`}>{t.title}</A>
                {t.assignee ? (
                  <span className="who"><span className={`av ${WHO[t.assignee].av}`} aria-hidden="true">{WHO[t.assignee].ini}</span>{WHO[t.assignee].name}</span>
                ) : (
                  <span className="chip c-line">Unassigned</span>
                )}
              </div>
            ))}
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
