'use client';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { A, r } from '../../lib/nav';
import { ApiError, createEpic_17, createSprint_28, createTask_21, useDb, type Person } from '../../lib/api';
import { toast } from './toast';

const Err = ({ text }: { text: string }) => (
  <span className="err-t"><svg className="ic" style={{ width: 14, height: 14 }} aria-hidden="true"><use href="#i-alert" /></svg>{text}</span>
);
const Close = ({ to }: { to: string }) => (
  <A className="btn g sm ib" aria-label="Close" href={r(to)}><svg className="ic" aria-hidden="true"><use href="#i-x" /></svg></A>
);

function useSubmit(back: string, ok: string) {
  const router = useRouter();
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const go = async (fn: () => Promise<unknown>) => {
    setErr('');
    setBusy(true);
    try {
      await fn();
      toast(ok);
      router.push(r(back));
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Something went wrong.');
      setBusy(false);
    }
  };
  return { err, busy, go };
}

export function NewSprintForm() {
  const [name, setName] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const f = useSubmit('Sprints.dc.html', 'Sprint created.');
  return (
    <form className="dialog" role="dialog" aria-modal="true" aria-labelledby="ns1" style={{ width: 'min(520px, 100%)' }} onSubmit={(e) => { e.preventDefault(); f.go(() => createSprint_28(name.trim(), start, end)); }}>
      <div className="row between"><h2 id="ns1">New sprint</h2><Close to="Sprints.dc.html" /></div>
      <div className="field"><label htmlFor="n4">Name <span style={{ color: 'var(--danger)' }}>*</span></label><input id="n4" className="in" value={name} onChange={(e) => setName(e.target.value)} placeholder="Sprint 4: Polish" required /></div>
      <div className="g2">
        <div className="field"><label htmlFor="s4">Start date <span style={{ color: 'var(--danger)' }}>*</span></label><input id="s4" className={`in${f.err ? ' err' : ''}`} value={start} onChange={(e) => setStart(e.target.value)} placeholder="2026-11-30" pattern="\d{4}-\d{2}-\d{2}" required /><span className="hint">YYYY-MM-DD</span></div>
        <div className="field"><label htmlFor="e4">End date (inclusive) <span style={{ color: 'var(--danger)' }}>*</span></label><input id="e4" className="in" value={end} onChange={(e) => setEnd(e.target.value)} placeholder="2026-12-11" pattern="\d{4}-\d{2}-\d{2}" required /><span className="hint">YYYY-MM-DD</span></div>
      </div>
      {f.err && <Err text={f.err} />}
      <div className="dfoot"><A className="btn" href={r('Sprints.dc.html')}>Cancel</A><button className="btn p" disabled={f.busy}>Create sprint</button></div>
    </form>
  );
}

export function AddEpicForm() {
  const db = useDb();
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [cp, setCp] = useState('');
  const f = useSubmit('Backlog.dc.html', 'Epic added.');
  return (
    <form className="dialog" role="dialog" aria-modal="true" aria-labelledby="ae1" style={{ width: 'min(560px, 100%)' }} onSubmit={(e) => { e.preventDefault(); f.go(() => createEpic_17(title, desc, cp || null)); }}>
      <div className="row between"><h2 id="ae1">Add epic</h2><Close to="Backlog.dc.html" /></div>
      <div className="field"><label htmlFor="t2">Title <span style={{ color: 'var(--danger)' }}>*</span></label><input id="t2" className={`in${f.err ? ' err' : ''}`} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Notifications" />{f.err && <Err text={f.err} />}</div>
      <div className="field"><label htmlFor="d2">Description</label><textarea id="d2" className="in" rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
      <div className="field"><label htmlFor="cp">Checkpoint</label>
        <select id="cp" className="in" value={cp} onChange={(e) => setCp(e.target.value)}><option value="">None</option>{db.checkpoints.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <span className="hint">Optional. An epic belongs to at most one checkpoint.</span></div>
      <div className="dfoot"><A className="btn" href={r('Backlog.dc.html')}>Cancel</A><button className="btn p" disabled={f.busy}>Add epic</button></div>
    </form>
  );
}

const POINTS = ['', '1', '2', '3', '5', '8', '13'];
const PEOPLE: [Person, string][] = [['pn', 'Priya Nair'], ['ml', 'Marcus Lim'], ['wo', 'Wei Ling Ong']];

export function AddTaskForm() {
  const db = useDb();
  const [epic, setEpic] = useState(db.epics[0]?.id ?? '');
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [crit, setCrit] = useState<string[]>(['']);
  const [pts, setPts] = useState('');
  const [who, setWho] = useState('');
  const f = useSubmit('Backlog.dc.html', 'Task added.');
  const setAt = (i: number, v: string) => setCrit((c) => c.map((x, j) => (j === i ? v : x)));
  return (
    <form className="dialog" role="dialog" aria-modal="true" aria-labelledby="at1" style={{ width: 'min(640px, 100%)' }} onSubmit={(e) => { e.preventDefault(); f.go(() => createTask_21({ epicId: epic, title, description: desc, criteria: crit, points: pts ? Number(pts) : null, assignee: (who || null) as Person | null })); }}>
      <div className="row between"><h2 id="at1">Add task</h2><Close to="Backlog.dc.html" /></div>
      <div className="field"><label htmlFor="e1">Epic <span style={{ color: 'var(--danger)' }}>*</span></label>
        <select id="e1" className="in" value={epic} onChange={(e) => setEpic(e.target.value)}>{db.epics.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}</select></div>
      <div className="field"><label htmlFor="t1">Title <span style={{ color: 'var(--danger)' }}>*</span></label><input id="t1" className={`in${f.err ? ' err' : ''}`} value={title} onChange={(e) => setTitle(e.target.value)} />{f.err && <Err text={f.err} />}</div>
      <div className="field"><label htmlFor="d1">Description</label><textarea id="d1" className="in" rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
      <div className="field"><span className="lbl">Acceptance criteria</span>
        <div className="stack8">
          {crit.map((c, i) => (
            <div className="row" key={i}>
              <input className="in" aria-label={`Criterion ${i + 1}`} value={c} onChange={(e) => setAt(i, e.target.value)} maxLength={300} />
              <button type="button" className="btn g sm ib" aria-label="Remove criterion" onClick={() => setCrit((x) => (x.length > 1 ? x.filter((_, j) => j !== i) : ['']))}><svg className="ic" aria-hidden="true"><use href="#i-x" /></svg></button>
            </div>
          ))}
          <button type="button" className="btn sm" style={{ alignSelf: 'flex-start' }} disabled={crit.length >= 12} onClick={() => setCrit((x) => [...x, ''])}><svg className="ic" aria-hidden="true"><use href="#i-plus" /></svg>Add criterion</button>
        </div>
        <span className="hint">Up to 12 criteria of 300 characters. Plain text.</span></div>
      <div className="g2">
        <div className="field"><label htmlFor="sp">Story points</label>
          <select id="sp" className="in" value={pts} onChange={(e) => setPts(e.target.value)}>{POINTS.map((p) => <option key={p} value={p}>{p || 'None'}</option>)}</select>
          <span className="hint">1, 2, 3, 5, 8, 13 or none</span></div>
        <div className="field"><label htmlFor="as">Assignee</label>
          <select id="as" className="in" value={who} onChange={(e) => setWho(e.target.value)}><option value="">Unassigned</option>{PEOPLE.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select>
          <span className="hint">Project members only</span></div>
      </div>
      <div className="dfoot"><A className="btn" href={r('Backlog.dc.html')}>Cancel</A><button className="btn p" disabled={f.busy}>Add task</button></div>
    </form>
  );
}

export function Wrap({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
