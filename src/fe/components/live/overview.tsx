'use client';
import { A, r } from '../../lib/nav';
import { progressOf, useDb, type LiveCheckpoint, type LiveMember, type LiveProgress } from '../../lib/api';
import RoleBadge from '../canvas/RoleBadge';
import { fmtFull } from './people';

const ROLE = { PM: 'pm', DEV_LEAD: 'lead', DEVELOPER: 'dev' } as const;
const AV = ['a1', 'a2', 'a3', 'a4'];
const ini = (n: string) => n.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();
const sprintLabel = (name: string) => name.match(/^Sprint\s+\d+/i)?.[0] ?? name;

export type OverviewLiveProps = { live?: boolean; projectId?: string | null; loading?: boolean; error?: string | null; onRetry?: () => void; progress?: LiveProgress | null; checkpoints?: LiveCheckpoint[]; members?: LiveMember[] };

function LiveState({ loading, error, onRetry, children }: { loading?: boolean; error?: string | null; onRetry?: () => void; children: React.ReactNode }) {
  if (loading) return <div className="card"><div className="sk" style={{ height: 18, width: '35%' }}></div><div className="sk" style={{ height: 38, marginTop: 12 }}></div></div>;
  if (error) return <div className="banner b-bad" role="alert"><span className="sp">{error}</span>{onRetry ? <button className="btn sm" type="button" onClick={onRetry}>Try again</button> : null}</div>;
  return <>{children}</>;
}

// Overview cards, read from the data layer (endpoints 33, 12 and 9).
export function ProgressCard(props: OverviewLiveProps = {}) {
  const db = useDb();
  if (props.live) { const p = props.progress; const percent = Math.round((p?.percent ?? 0) * 100) / 100; return <LiveState loading={props.loading} error={props.error} onRetry={props.onRetry}><section className="card"><h3>Progress</h3><div className="row between" style={{ alignItems: 'flex-end' }}><div><span style={{ fontSize: 36, fontWeight: 700, lineHeight: 1 }} className="num">{percent}%</span><span className="muted"> done</span></div><span className="b num">{p?.pointsDone ?? 0} of {p?.pointsTotal ?? 0} points done</span></div><div className="bar big" style={{ margin: '12px 0' }}><i style={{ width: `${percent}%` }}></i></div>{(p?.unestimatedTasks ?? 0) > 0 && <div className="chip c-warn">{p!.unestimatedTasks} task{p!.unestimatedTasks === 1 ? ' has' : 's have'} no estimate</div>}</section></LiveState>; }
  const p = progressOf(db);
  const percent = Math.round(p.percent * 100) / 100;
  return (
    <section className="card">
      <h3>Progress</h3>
      <div className="row between" style={{ alignItems: 'flex-end' }}>
        <div><span style={{ fontSize: 36, fontWeight: 700, lineHeight: 1 }} className="num">{percent}%</span><span className="muted"> done</span></div>
        <span className="b num">{p.pointsDone} of {p.pointsTotal} points done</span>
      </div>
      <div className="bar big" style={{ margin: '12px 0' }}><i style={{ width: `${percent}%` }}></i></div>
      {p.unestimatedTasks > 0 && (
        <div className="chip c-warn"><svg className="ic" aria-hidden="true"><use href="#i-alert" /></svg>{p.unestimatedTasks} task{p.unestimatedTasks === 1 ? ' has' : 's have'} no estimate</div>
      )}
    </section>
  );
}

export function VelocityCard(props: OverviewLiveProps = {}) {
  const db = useDb();
  if (props.live) { const p = props.progress; const velocity = (p?.velocity ?? []).map((v) => ({ ...v, name: sprintLabel(v.name) })); const max = Math.max(1, ...velocity.map((v) => v.completedPoints)); const average = velocity.length ? Math.round(velocity.reduce((sum, v) => sum + v.completedPoints, 0) / velocity.length) : 0; return <LiveState loading={props.loading} error={props.error} onRetry={props.onRetry}><section className="card"><div className="row between" style={{ marginBottom: 12 }}><h3 style={{ margin: 0 }}>Velocity</h3><span className="small muted">Completed points per closed sprint</span></div>{!velocity.length ? <p className="muted">Close a sprint to see velocity.</p> : <><div style={{ display: 'grid', gridTemplateColumns: `repeat(${velocity.length}, 72px)`, gap: 16, alignItems: 'end', justifyContent: 'start', height: 120, borderBottom: '1px solid var(--line)', padding: '0 8px' }}>{velocity.map((v) => <div key={v.sprintId} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', width: 72, height: '100%' }}><span className="b num small">{v.completedPoints}</span><div style={{ width: '100%', height: Math.max(4, Math.round((v.completedPoints / max) * 100)), background: 'var(--accent)', borderRadius: '6px 6px 0 0' }}></div></div>)}</div><div style={{ display: 'grid', gridTemplateColumns: `repeat(${velocity.length}, 72px)`, gap: 16, justifyContent: 'start', padding: '8px 8px 0' }}>{velocity.map((v) => <span key={v.sprintId} className="small muted" style={{ width: 72, overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'center', whiteSpace: 'nowrap' }}>{v.name}</span>)}</div><div className="row small muted" style={{ justifyContent: 'flex-end', padding: '8px 8px 0' }}><span>Average of last {velocity.length} closed sprint{velocity.length === 1 ? '' : 's'}: <b className="num" style={{ color: 'var(--ink)' }}>{average} pts</b></span></div></>}</section></LiveState>; }
  const p = progressOf(db);
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
            {p.velocity.map((v) => <span key={v.name} style={{ width: 72, textAlign: 'center', marginRight: 16 }}>{sprintLabel(v.name)}</span>)}
            <span className="sp"></span><span>Average of last three: <b className="num" style={{ color: 'var(--ink)' }}>{avg} pts</b></span>
          </div>
        </>
      )}
    </section>
  );
}

export function CheckpointsCard(props: OverviewLiveProps = {}) {
  const db = useDb();
  if (props.live) return <LiveState loading={props.loading} error={props.error} onRetry={props.onRetry}><section className="card"><div className="row between" style={{ marginBottom: 8 }}><h3 style={{ margin: 0 }}>Next checkpoints</h3><A href={r('Checkpoints.dc.html', props.projectId ?? undefined)} className="small b" style={{ color: 'var(--accent-t)' }}>All checkpoints</A></div><div className="stack8">{(props.checkpoints ?? []).map((c) => <div className="row between" key={c.id}><span className="b">{c.name}</span><span className="num muted">{fmtFull(c.targetDate)}</span></div>)}{!(props.checkpoints ?? []).length && <span className="muted">No checkpoints yet.</span>}</div></section></LiveState>;
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

export function TeamCard(props: OverviewLiveProps = {}) {
  const db = useDb();
  if (props.live) return <LiveState loading={props.loading} error={props.error} onRetry={props.onRetry}><section className="card"><div className="row between" style={{ marginBottom: 8 }}><h3 style={{ margin: 0 }}>Team</h3><A href={r('Members.dc.html', props.projectId ?? undefined)} className="small b" style={{ color: 'var(--accent-t)' }}>Manage</A></div><div className="stack8">{(props.members ?? []).map((m, i) => <div className="row" key={m.userId}><span className={`av ${AV[i % 4]}`}>{ini(m.displayName)}</span><span className="sp b">{m.displayName}</span><RoleBadge role={ROLE[m.role]} /></div>)}{!(props.members ?? []).length && <span className="muted">No developers yet.</span>}</div></section></LiveState>;
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
