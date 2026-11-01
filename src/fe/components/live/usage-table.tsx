'use client';
import { useEffect, useState } from 'react';
import { listAiSessions_56, useDb, type AiSession } from '../../lib/api';

const OUT = {
  Accepted: ['c-ok', '#i-check'],
  Rejected: ['c-line', '#i-x'],
  Open: ['c-info', '#i-half'],
} as const;
const when = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDate()} ${d.toLocaleDateString('en-GB', { month: 'short' })}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
const n = (x: number) => x.toLocaleString('en-US');

// My AI sessions with totals (endpoint 56).
export default function UsageTable() {
  const db = useDb();
  const [rows, setRows] = useState<AiSession[]>([]);
  useEffect(() => { listAiSessions_56().then(setRows); }, [db.aiSessions]);
  const sum = (f: (s: AiSession) => number) => rows.reduce((a, s) => a + f(s), 0);
  const big = { fontSize: 28, fontWeight: 700 } as const;
  return (
    <>
      <div className="g4">
        <div className="card flat"><div className="small muted">Sessions</div><div style={big} className="num">{rows.length}</div></div>
        <div className="card flat"><div className="small muted">Prompt tokens</div><div style={big} className="num">{n(sum((s) => s.prompt))}</div></div>
        <div className="card flat"><div className="small muted">Completion tokens</div><div style={big} className="num">{n(sum((s) => s.completion))}</div></div>
        <div className="card flat"><div className="small muted">Estimated cost</div><div style={big} className="num">${sum((s) => s.cost).toFixed(4)}</div></div>
      </div>
      <div className="card pad0" style={{ overflowX: 'auto' }}>
        <table className="tbl" style={{ minWidth: 900 }}>
          <thead><tr><th>Feature</th><th>Started</th><th>Outcome</th><th className="r">Regens</th><th>Feedback</th><th className="r">Calls</th><th className="r">Prompt</th><th className="r">Completion</th><th className="r">Est. cost</th><th className="r">Elapsed</th></tr></thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id}>
                <td className="b">{s.feature}</td>
                <td className="num muted">{when(s.startedAt)}</td>
                <td><span className={`chip ${OUT[s.outcome][0]}`}><svg className="ic" aria-hidden="true"><use href={OUT[s.outcome][1]} /></svg>{s.outcome}</span></td>
                <td className="r num">{s.regens}</td>
                <td>{s.feedback ? <><svg className="ic" aria-hidden="true"><use href={s.feedback === 'up' ? '#i-up' : '#i-down2'} /></svg><span style={{ position: 'absolute', left: -9999 }}>{s.feedback === 'up' ? 'Thumbs up' : 'Thumbs down'}</span></> : <span className="muted">None</span>}</td>
                <td className="r num">{s.calls}</td>
                <td className="r num">{n(s.prompt)}</td>
                <td className="r num">{n(s.completion)}</td>
                <td className="r num">${s.cost.toFixed(4)}</td>
                <td className="r num">{s.elapsed} s</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="row between small muted" style={{ padding: '12px 16px', borderTop: '1px solid var(--line2)' }}>
          <span>Showing 1 to {rows.length} of {rows.length}</span>
          <div className="row"><span className="btn sm dis">Previous</span><span className="btn sm dis" aria-disabled="true" title="No more pages">Next</span></div>
        </div>
      </div>
    </>
  );
}
