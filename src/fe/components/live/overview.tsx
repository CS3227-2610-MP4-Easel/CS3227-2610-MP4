'use client';
import { A, r } from '../../lib/nav';
import { progressOf, useDb } from '../../lib/api';
import RoleBadge from '../canvas/RoleBadge';
import { fmtFull } from './people';

const ROLE = { PM: 'pm', DEV_LEAD: 'lead', DEVELOPER: 'dev' } as const;
const AV = ['a1', 'a2', 'a3', 'a4'];
const ini = (n: string) => n.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();

// Overview cards, read from the data layer (endpoints 33, 12 and 9).
export function ProgressCard() {
  const p = progressOf(useDb());
  return (
    <section className="card">
      <h3>Progress</h3>
      <div className="row between" style={{ alignItems: 'flex-end' }}>
        <div><span style={{ fontSize: 36, fontWeight: 700, lineHeight: 1 }} className="num">{p.percent}%</span><span className="muted"> done</span></div>
        <span className="b num">{p.pointsDone} of {p.pointsTotal} points done</span>
      </div>
      <div className="bar big" style={{ margin: '12px 0' }}><i style={{ width: `${p.percent}%` }}></i></div>
      {p.unestimatedTasks > 0 && (
        <div className="chip c-warn"><svg className="ic" aria-hidden="true"><use href="#i-alert" /></svg>{p.unestimatedTasks} task{p.unestimatedTasks === 1 ? ' has' : 's have'} no estimate</div>
      )}
    </section>
  );
}

export function VelocityCard() {
  const p = progressOf(useDb());
  const max = Math.max(1, ...p.velocity.map((v) => v.points));
  const last = p.velocity.slice(-3);
  const avg = last.length ? Math.round(last.reduce((a, v) => a + v.points, 0) / last.length) : 0;
  return (
    <section className="card">
      <div className="row between" style={{ marginBottom: 12 }}><h3 style={{ margin: 0 }}>Velocity</h3><span className="small muted">Completed points per closed sprint</span></div>
      {p.velocity.length === 0 ? (
        <p className="muted">Close a sprint to see velocity.</p>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, height: 120, borderBottom: '1px solid var(--line)', padding: '0 8px' }}>
            {p.velocity.map((v) => (
              <div key={v.name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: 72 }}>
                <span className="b num small">{v.points}</span>
                <div style={{ width: '100%', height: Math.max(4, Math.round((v.points / max) * 100)), background: 'var(--accent)', borderRadius: '6px 6px 0 0' }}></div>
              </div>
            ))}
          </div>
          <div className="row small muted" style={{ padding: '8px 8px 0' }}>
            {p.velocity.map((v) => <span key={v.name} style={{ width: 72, textAlign: 'center', marginRight: 16 }}>{v.name}</span>)}
            <span className="sp"></span><span>Average of last three: <b className="num" style={{ color: 'var(--ink)' }}>{avg} pts</b></span>
          </div>
        </>
      )}
    </section>
  );
}

export function CheckpointsCard() {
  const db = useDb();
  return (
    <section className="card">
      <div className="row between" style={{ marginBottom: 8 }}>
        <h3 style={{ margin: 0 }}>Next checkpoints</h3>
        <A href={r('Checkpoints.dc.html')} className="small b" style={{ color: 'var(--accent-t)' }}>All checkpoints</A>
      </div>
      <div className="stack8">
        {db.checkpoints.map((c, i) => (
          <div className="row between" key={c.id} style={{ padding: '8px 0', borderBottom: i < db.checkpoints.length - 1 ? '1px solid var(--line2)' : undefined }}>
            <div className="row"><svg className="ic muted" aria-hidden="true"><use href="#i-flag" /></svg><span className="b">{c.name}</span></div>
            <span className="num muted">{fmtFull(c.targetDate)}</span>
          </div>
        ))}
        {db.checkpoints.length === 0 && <span className="muted">No checkpoints yet.</span>}
      </div>
    </section>
  );
}

export function TeamCard() {
  const db = useDb();
  return (
    <section className="card">
      <div className="row between" style={{ marginBottom: 8 }}>
        <h3 style={{ margin: 0 }}>Team</h3>
        <A href={r('Members.dc.html')} className="small b" style={{ color: 'var(--accent-t)' }}>Manage</A>
      </div>
      <div className="stack8">
        {db.members.map((m, i) => (
          <div className="row" key={m.id}><span className={`av ${AV[i % 4]}`}>{ini(m.name)}</span><span className="sp b">{m.name}</span><RoleBadge role={ROLE[m.role]} /></div>
        ))}
      </div>
    </section>
  );
}
