'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, addCheckpoint_13, createCheckpointLive_13, getFacts_42, healthOf, listCheckpointsLive_12, listLiveEpics_16, useDb, type Facts, type LiveCheckpoint, type LiveEpic } from '../../lib/api';
import { useProjectRoute } from '../../lib/api/project-mode';
import { useRouter } from 'next/navigation';
import { useModal, useRoute } from '../../lib/nav';
import RiskBadge from '../canvas/RiskBadge';
import { toast } from './toast';
import { fmtFull } from './people';

// Checkpoint cards (endpoint 12). Risk comes from the facts endpoint in the real build; a new checkpoint has no forecast yet.
export function CheckpointCards({ showRisk }: { showRisk: boolean }) {
  const route = useProjectRoute();
  const db = useDb();
  if (route.mode === 'live' && route.projectId) return <LiveCheckpointCards projectId={route.projectId} showRisk={showRisk} />;
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

function LiveCheckpointCards({ projectId, showRisk }: { projectId: string; showRisk: boolean }) {
  const [rows, setRows] = useState<LiveCheckpoint[]>([]);
  const [epics, setEpics] = useState<LiveEpic[]>([]);
  const [facts, setFacts] = useState<Facts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const generation = useRef(0);
  const load = useCallback(() => {
    const request = ++generation.current;
    let active = true;
    setLoading(true); setError('');
    const factsRequest = showRisk ? getFacts_42(projectId).catch(() => null) : Promise.resolve(null);
    Promise.all([listCheckpointsLive_12(projectId), listLiveEpics_16(projectId), factsRequest]).then(([nextCheckpoints, nextEpics, nextFacts]) => {
      if (active && request === generation.current) {
        setRows(nextCheckpoints);
        setEpics(nextEpics);
        setFacts(nextFacts);
      }
    }).catch((e) => { if (active && request === generation.current) setError(e instanceof ApiError ? e.message : 'Something went wrong.'); }).finally(() => { if (active && request === generation.current) setLoading(false); });
    return () => { active = false; };
  }, [projectId, showRisk]);
  useEffect(() => { const cancel = load(); const onChange = () => { void load(); }; window.addEventListener('easel-checkpoints-changed', onChange); return () => { cancel?.(); window.removeEventListener('easel-checkpoints-changed', onChange); }; }, [load]);
  if (loading) return <div className="card"><div className="sk" style={{ width: '45%' }} /><div className="sk" style={{ marginTop: 10 }} /></div>;
  if (error) return <div className="banner b-bad"><svg className="ic" aria-hidden="true"><use href="#i-alert" /></svg><span>{error}</span><button className="btn sm" type="button" onClick={() => { void load(); }}>Try again</button></div>;
  return <>{rows.map((checkpoint) => {
    const linkedEpics = epics.filter((epic) => epic.checkpointId === checkpoint.id);
    const fact = facts?.checkpoints.find((item) => item.id === checkpoint.id);
    const risk = fact?.risk === 'ON_TRACK' ? 'ok' : fact?.risk === 'AT_RISK' ? 'warn' : 'unknown';
    return <article className="card" key={checkpoint.id}><div className="row wrap between"><div className="row"><svg className="ic lg muted" aria-hidden="true"><use href="#i-flag" /></svg><h3 style={{ margin: 0 }}>{checkpoint.name}</h3>{showRisk && <RiskBadge risk={risk} />}</div></div><div className="row wrap" style={{ gap: 24, margin: '8px 0 12px' }}><span><span className="muted">Target </span><b className="num">{fmtFull(checkpoint.targetDate)}</b></span>{showRisk && !fact?.projectedDate && <span className="muted">Close a sprint to get a forecast.</span>}</div><div className="pill-list">{linkedEpics.length ? linkedEpics.map((epic) => <span className="chip c-acc" key={epic.id}>{epic.title}</span>) : <span className="chip c-line">No epics linked yet</span>}</div></article>;
  })}{rows.length === 0 && <div className="card"><b>No checkpoints yet.</b> <span className="muted">This project has no checkpoints yet. Add one to track a committed date.</span></div>}</>;
}

// Add-checkpoint form (endpoint 13).
export function AddCheckpointForm({ dialog = false }: { dialog?: boolean } = {}) {
  const route = useProjectRoute();
  const router = useRouter();
  const routeFor = useRoute();
  const modal = useModal();
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const close = () => modal.modal ? modal.close() : router.push(routeFor('Checkpoints.dc.html'));
  const submit = async () => {
    setErr('');
    if (!name.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setErr('Enter a name and a date as YYYY-MM-DD.');
      return;
    }
    setBusy(true);
    try {
      if (route.mode === 'live' && route.projectId) await createCheckpointLive_13(route.projectId, { name: name.trim(), targetDate: date });
      else await addCheckpoint_13(name.trim(), date);
      toast(`Checkpoint "${name.trim()}" added.`);
      setName('');
      setDate('');
      window.dispatchEvent(new Event('easel-checkpoints-changed'));
      if (dialog) router.push(routeFor('Checkpoints.dc.html'));
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={dialog ? 'dialog' : 'card flat'} style={{ borderStyle: dialog ? undefined : 'dashed' }}>
      <div className="row between"><h3>Add checkpoint</h3>{dialog ? <button className="btn g sm ib" type="button" aria-label="Close" onClick={close}><svg className="ic" aria-hidden="true"><use href="#i-x" /></svg></button> : null}</div>
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
