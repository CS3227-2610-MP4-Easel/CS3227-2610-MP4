'use client';
import { healthOf, useDb } from '../../lib/api';
import RiskBadge from '../canvas/RiskBadge';
import { WHO, fmtFull } from './people';

const Tag = () => <span className="chip c-line" style={{ marginLeft: 4 }}>from project data</span>;

// Progress, velocity, checkpoint risk and overload, read from the data layer (endpoints 12, 33 and 20).
export default function HealthNumbers() {
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
