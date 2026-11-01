'use client';
import { A, r } from '../../lib/nav';
import { useDb } from '../../lib/api';
import StatusChip from '../canvas/StatusChip';
import { WHO } from './people';

// Epics and their task rows (endpoints 16, 20, 12 for checkpoint names, 27 for sprint names).
export default function BacklogList() {
  const db = useDb();
  return (
    <>
      {db.epics.map((e) => {
        const tasks = db.tasks.filter((t) => t.epic === e.title);
        const pts = tasks.reduce((a, t) => a + (t.points || 0), 0);
        const cp = db.checkpoints.find((c) => c.id === e.checkpointId);
        return (
          <section className="card pad0" key={e.id}>
            <div className="ch" style={{ background: 'var(--head)', borderRadius: '12px 12px 0 0' }}>
              <div className="row">
                <svg className="ic" aria-hidden="true"><use href="#i-down" /></svg>
                <h3 style={{ margin: 0 }}>{e.title}</h3>
                {cp && <span className="chip c-acc"><svg className="ic" aria-hidden="true"><use href="#i-flag" /></svg>{cp.name}</span>}
              </div>
              <div className="row"><span className="small muted">{tasks.length} task{tasks.length === 1 ? '' : 's'} · {pts} pts</span></div>
            </div>
            {tasks.map((t) => {
              const sp = db.sprints.find((s) => s.id === t.sprintId);
              return (
                <div className="trow" key={t.id}>
                  <span className={`chip scol ${sp ? (sp.status === 'CLOSED' ? 'c-line' : 'c-acc') : 'c-line'}`}>{sp ? sp.name : 'No sprint'}</span>
                  <span className={`pts${t.points ? '' : ' none'}`}>{t.points ?? 'Unestimated'}</span>
                  <StatusChip status={t.status} />
                  {t.blockedReason && (
                    <span className="chip c-bad" title={t.blockedReason}><svg className="ic" aria-hidden="true"><use href="#i-alert" /></svg>Blocked</span>
                  )}
                  <A className="t" href={r('TaskDetail.dc.html')}>{t.title}</A>
                  {t.assignee ? (
                    <span className="who"><span className={`av ${WHO[t.assignee].av}`} aria-hidden="true">{WHO[t.assignee].ini}</span>{WHO[t.assignee].name}</span>
                  ) : (
                    <span className="chip c-line">Unassigned</span>
                  )}
                </div>
              );
            })}
            {tasks.length === 0 && <div className="trow"><span className="small muted">No tasks in this epic yet.</span></div>}
          </section>
        );
      })}
      {db.epics.length === 0 && <div className="card"><b>The backlog is empty.</b></div>}
    </>
  );
}
