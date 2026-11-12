'use client';
import { healthOf, useDb, type Facts } from '../../lib/api';
import RiskBadge from '../canvas/RiskBadge';
import { WHO, fmtFull } from './people';

const Tag = () => <span className="chip c-line" style={{ marginLeft: 4 }}>from project data</span>;

// Progress, velocity, checkpoint risk and overload, read from the data layer (endpoints 12, 33 and 20).
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '?';

function LiveHealthNumbers({ facts }: { facts: Facts }) {
  const percent = facts.pointsTotal ? Math.round((facts.pointsDone / facts.pointsTotal) * 100) : 0;
  const atRisk = facts.checkpoints.filter((checkpoint) => checkpoint.risk === 'AT_RISK').length;
  return (
    <>
      <div className="g3">
        <section className="card"><div className="small muted">Progress <Tag /></div><div style={{ fontSize: 30, fontWeight: 700 }} className="num">{percent}%</div><div className="bar" style={{ margin: '6px 0' }}><i style={{ width: `${percent}%` }}></i></div><div className="small muted num">{facts.pointsDone} of {facts.pointsTotal} pts · {facts.pointsRemaining} remaining · {facts.unestimatedTasks} task{facts.unestimatedTasks === 1 ? '' : 's'} without estimate</div></section>
        <section className="card"><div className="small muted">Velocity <Tag /></div><div style={{ fontSize: 30, fontWeight: 700 }} className="num">{facts.avgVelocity == null ? 'No data' : `${Math.round(facts.avgVelocity)} pts`}</div><div className="small muted">{facts.velocity.length ? `Average of last ${facts.velocity.length} closed sprint${facts.velocity.length === 1 ? '' : 's'}` : 'Close a sprint to get a velocity.'}</div>{facts.projectedCompletionDate && <div className="small" style={{ marginTop: 6 }}>Projected completion <b className="num">{fmtFull(facts.projectedCompletionDate)}</b></div>}</section>
        <section className="card"><div className="small muted">Checkpoints <Tag /></div><div style={{ fontSize: 30, fontWeight: 700 }} className="num">{atRisk} at risk</div><div className="small muted">of {facts.checkpoints.length} checkpoint{facts.checkpoints.length === 1 ? '' : 's'}</div></section>
      </div>
      <section className="card pad0"><div className="ch"><h3 style={{ margin: 0 }}>Checkpoint risk</h3></div><table className="tbl"><thead><tr><th>Checkpoint</th><th>Target</th><th className="r">Remaining</th><th>Projected</th><th>Risk</th></tr></thead><tbody>{facts.checkpoints.map((checkpoint) => <tr key={checkpoint.id}><td className="b">{checkpoint.name}</td><td className="num">{fmtFull(checkpoint.targetDate)}</td><td className="r num">{checkpoint.remainingPoints} pts</td><td className="num">{checkpoint.remainingPoints === 0 ? 'No open work' : checkpoint.projectedDate ? fmtFull(checkpoint.projectedDate) : 'No forecast'}</td><td><RiskBadge risk={checkpoint.risk === 'ON_TRACK' ? 'ok' : checkpoint.risk === 'AT_RISK' ? 'warn' : 'unknown'} /></td></tr>)}</tbody></table></section>
      <section className="card pad0"><div className="ch"><h3 style={{ margin: 0 }}>Overload</h3><span className="small muted">Across your own projects only</span></div>{facts.overload.length === 0 ? <div className="trow"><span className="small muted">Nobody is carrying more than the team's usual load.</span></div> : <table className="tbl"><thead><tr><th>Person</th><th className="r">Open points</th><th className="r">Avg per sprint</th><th>Projects</th></tr></thead><tbody>{facts.overload.map((person) => <tr key={person.userId}><td><div className="row"><span className="av a4">{initials(person.displayName)}</span><b>{person.displayName}</b></div></td><td className="r num b">{person.openPoints}</td><td className="r num">{person.avgCompletedPerSprint == null ? 'No data' : person.avgCompletedPerSprint.toFixed(1)}</td><td>{person.projects.map((project) => project.name).join(', ')}</td></tr>)}</tbody></table>}</section>
    </>
  );
}

export default function HealthNumbers({ facts, loading = false, error }: { facts?: Facts | null; loading?: boolean; error?: string | null } = {}) {
  if (loading) return <div className="g3"><section className="card"><div className="sk" style={{ width: '40%', height: '18px' }}></div><div className="sk" style={{ marginTop: 12 }}></div><div className="sk" style={{ width: '75%', marginTop: 8 }}></div></section><section className="card"><div className="sk" style={{ width: '40%', height: '18px' }}></div><div className="sk" style={{ marginTop: 12 }}></div><div className="sk" style={{ width: '75%', marginTop: 8 }}></div></section><section className="card"><div className="sk" style={{ width: '40%', height: '18px' }}></div><div className="sk" style={{ marginTop: 12 }}></div><div className="sk" style={{ width: '75%', marginTop: 8 }}></div></section></div>;
  if (error) return <div className="banner b-bad"><svg className="ic" aria-hidden="true"><use href="#i-alert" /></svg><span>{error}</span></div>;
  if (facts) return <LiveHealthNumbers facts={facts} />;
  const db = useDb();
  const h = healthOf(db);
  const p = h.progress;
  return (
    <>
      <div className="g3">
        <section className="card">
          <div className="small muted">Progress <Tag /></div>
          <div style={{ fontSize: 30, fontWeight: 700 }} className="num">{p.percent}%</div>
          <div className="bar" style={{ margin: '6px 0' }}><i style={{ width: `${p.percent}%` }}></i></div>
          <div className="small muted num">{p.pointsDone} of {p.pointsTotal} pts · {p.pointsTotal - p.pointsDone} remaining · {p.unestimatedTasks} task{p.unestimatedTasks === 1 ? '' : 's'} without estimate</div>
        </section>
        <section className="card">
          <div className="small muted">Velocity <Tag /></div>
          <div style={{ fontSize: 30, fontWeight: 700 }} className="num">{h.closed ? `${h.avg} pts` : 'No data'}</div>
          <div className="small muted">{h.closed ? `Average of last 3 sprints (${h.closed} closed)` : 'Close a sprint to get a velocity.'}</div>
          {h.projectedAll && <div className="small" style={{ marginTop: 6 }}>Projected completion <b className="num">{fmtFull(h.projectedAll)}</b></div>}
        </section>
        <section className="card">
          <div className="small muted">Checkpoints <Tag /></div>
          <div style={{ fontSize: 30, fontWeight: 700 }} className="num">{h.atRisk} at risk</div>
          <div className="small muted">of {h.rows.length} checkpoint{h.rows.length === 1 ? '' : 's'}</div>
        </section>
      </div>
      <section className="card pad0">
        <div className="ch"><h3 style={{ margin: 0 }}>Checkpoint risk</h3></div>
        <table className="tbl">
          <thead><tr><th>Checkpoint</th><th>Target</th><th className="r">Remaining</th><th>Projected</th><th>Risk</th></tr></thead>
          <tbody>
            {h.rows.map((x) => (
              <tr key={x.checkpoint.id}>
                <td className="b">{x.checkpoint.name}</td>
                <td className="num">{fmtFull(x.checkpoint.targetDate)}</td>
                <td className="r num">{x.remaining} pts</td>
                <td className="num" style={x.risk === 'warn' || x.risk === 'bad' ? { color: 'var(--warn)', fontWeight: 650 } : undefined}>{x.remaining === 0 ? 'No open work' : x.projected ? fmtFull(x.projected) : 'No forecast'}</td>
                <td><RiskBadge risk={x.risk} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="card pad0">
        <div className="ch"><h3 style={{ margin: 0 }}>Overload</h3><span className="small muted">Across your own projects only</span></div>
        {h.overload.length === 0 ? (
          <div className="trow"><span className="small muted">Nobody is carrying more than the team's usual load.</span></div>
        ) : (
          <table className="tbl">
            <thead><tr><th>Person</th><th className="r">Open points</th><th className="r">Avg per sprint</th><th>Projects</th></tr></thead>
            <tbody>
              {h.overload.map((o) => (
                <tr key={o.who}>
                  <td><div className="row"><span className={`av ${WHO[o.who as keyof typeof WHO].av}`}>{WHO[o.who as keyof typeof WHO].ini}</span><b>{WHO[o.who as keyof typeof WHO].name}</b></div></td>
                  <td className="r num b">{o.pts}</td>
                  <td className="r num">{h.avg}</td>
                  <td>{db.project.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
