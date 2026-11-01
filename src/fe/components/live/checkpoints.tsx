'use client';
import { useState } from 'react';
import { ApiError, addCheckpoint_13, healthOf, useDb } from '../../lib/api';
import RiskBadge from '../canvas/RiskBadge';
import { toast } from './toast';
import { fmtFull } from './people';

// Checkpoint cards (endpoint 12). Risk comes from the facts endpoint in the real build; a new checkpoint has no forecast yet.
export function CheckpointCards({ showRisk }: { showRisk: boolean }) {
  const db = useDb();
  const rows = healthOf(db).rows;
  return (
    <>
      {rows.map(({ checkpoint: c, risk, epics, projected }) => (
        <article className="card" key={c.id}>
          <div className="row wrap between">
            <div className="row">
              <svg className="ic lg muted" aria-hidden="true"><use href="#i-flag" /></svg>
              <h3 style={{ margin: 0 }}>{c.name}</h3>
              {showRisk && <RiskBadge risk={risk} />}
            </div>
          </div>
          <div className="row wrap" style={{ gap: 24, margin: '8px 0 12px' }}>
            <span><span className="muted">Target </span><b className="num">{fmtFull(c.targetDate)}</b></span>
            {showRisk && !projected && <span className="muted">Close a sprint to get a forecast.</span>}
          </div>
          <div className="pill-list">{epics.length ? epics.map((e) => <span className="chip c-acc" key={e}>{e}</span>) : <span className="chip c-line">No epics linked yet</span>}</div>
        </article>
      ))}
      {db.checkpoints.length === 0 && (
        <div className="card"><b>No checkpoints yet.</b> <span className="muted">A checkpoint is a date the team commits to.</span></div>
      )}
    </>
  );
}

// Add-checkpoint form (endpoint 13).
export function AddCheckpointForm() {
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setErr('');
    if (!name.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setErr('Enter a name and a date as YYYY-MM-DD.');
      return;
    }
    setBusy(true);
    try {
      await addCheckpoint_13(name.trim(), date);
      toast(`Checkpoint "${name.trim()}" added.`);
      setName('');
      setDate('');
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="card flat" style={{ borderStyle: 'dashed' }}>
      <h3>Add checkpoint</h3>
      <div className="field" style={{ marginBottom: 12 }}>
        <label htmlFor="cn">Name</label>
        <input id="cn" className="in" value={name} onChange={(e) => setName(e.target.value)} placeholder="Pilot with two canteens" />
      </div>
      <div className="field" style={{ marginBottom: 12 }}>
        <label htmlFor="cd">Target date</label>
        <input id="cd" className={`in${err ? ' err' : ''}`} value={date} onChange={(e) => setDate(e.target.value)} placeholder="2027-01-29" />
        <span className="hint">YYYY-MM-DD, Singapore time</span>
        {err && <span className="err-t">{err}</span>}
      </div>
      <div className="dfoot"><button className="btn p" disabled={busy} onClick={submit}>Add</button></div>
    </div>
  );
}
