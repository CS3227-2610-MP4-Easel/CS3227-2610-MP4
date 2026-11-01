'use client';
import { A, r } from '../../lib/nav';
import { setTaskStatus_24, useDb, type TaskStatus } from '../../lib/api';
import { toast } from './toast';

const LABEL: Record<TaskStatus, string> = { todo: 'To do', prog: 'In progress', rev: 'In review', done: 'Done' };
const ME = 'pn';
// The Library Seat Booking project is not in the prototype data: one extra open and one blocked task come from it.
const OTHER = { open: 1, blocked: 1 };

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
