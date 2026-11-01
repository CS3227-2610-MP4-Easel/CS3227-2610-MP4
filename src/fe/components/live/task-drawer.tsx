'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { A, r } from '../../lib/nav';
import { ApiError, deleteTask_25, setTaskStatus_24, updateTask_23, useDb, type TaskStatus } from '../../lib/api';
import StatusChip from '../canvas/StatusChip';
import { toast } from './toast';
import { WHO } from './people';

const LABEL: Record<TaskStatus, string> = { todo: 'To do', prog: 'In progress', rev: 'In review', done: 'Done' };

function Drawer() {
  const id = useSearchParams().get('task') || 't5';
  const db = useDb();
  const router = useRouter();
  const t = db.tasks.find((x) => x.id === id);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [pts, setPts] = useState('');
  const [err, setErr] = useState('');
  if (!t) {
    return (
      <aside className="drawer" role="dialog" aria-modal="true">
        <h2>Task not found</h2>
        <p className="muted">It may have been deleted.</p>
        <A className="btn" href={r('Board.dc.html')}>Back to the board</A>
      </aside>
    );
  }
  const sprint = db.sprints.find((s) => s.id === t.sprintId);
  const epic = db.epics.find((e) => e.title === t.epic);
  const cp = db.checkpoints.find((c) => c.id === epic?.checkpointId);
  const save = async () => {
    try {
      await updateTask_23(t.id, { title, description: desc, points: pts ? Number(pts) : null });
      setEditing(false);
      setErr('');
      toast('Task saved.');
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Something went wrong.');
    }
  };
  return (
    <aside className="drawer" role="dialog" aria-modal="true" aria-labelledby="tt">
      <div className="row between">
        <span className="small muted">{t.epic}</span>
        <div className="row">
          {!editing && <button className="btn sm" onClick={() => { setTitle(t.title); setDesc(t.description); setPts(t.points ? String(t.points) : ''); setEditing(true); }}><svg className="ic" aria-hidden="true"><use href="#i-edit" /></svg>Edit</button>}
          {editing && <button className="btn sm p" onClick={save}>Save</button>}
          <button className="btn sm" style={{ color: 'var(--danger)' }} onClick={async () => { try { await deleteTask_25(t.id); toast('Task deleted.'); router.push(r('Board.dc.html')); } catch (e) { toast(e instanceof ApiError ? e.message : 'Something went wrong.', 'bad'); } }}><svg className="ic" aria-hidden="true"><use href="#i-trash" /></svg>Delete</button>
          <A className="btn g sm ib" href={r('Board.dc.html')} aria-label="Close"><svg className="ic" aria-hidden="true"><use href="#i-x" /></svg></A>
        </div>
      </div>
      <div className="stack8">
        {editing ? (
          <div className="field"><input className={`in${err ? ' err' : ''}`} aria-label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />{err && <span className="err-t">{err}</span>}</div>
        ) : (
          <h2 id="tt">{t.title}</h2>
        )}
        <div className="row wrap">
          <StatusChip status={t.status} />
          {t.blockedReason && <span className="chip c-bad"><svg className="ic" aria-hidden="true"><use href="#i-alert" /></svg>Blocked</span>}
        </div>
      </div>
      {t.blockedReason && (
        <div className="banner b-bad"><svg className="ic" aria-hidden="true"><use href="#i-alert" /></svg><div><div className="b">Blocked</div>{t.blockedReason.replace(/^Blocked: /, '')}</div></div>
      )}
      <div className="g2" style={{ gap: 12 }}>
        <div className="field"><span className="lbl">Status</span>
          <select className="in" aria-label="Status" value={t.status} onChange={async (e) => { await setTaskStatus_24(t.id, e.target.value as TaskStatus); toast(`Moved to ${LABEL[e.target.value as TaskStatus]}.`); }}>
            {(Object.keys(LABEL) as TaskStatus[]).map((k) => <option key={k} value={k}>{LABEL[k]}</option>)}
          </select></div>
        <div className="field"><span className="lbl">Blocked</span>
          {t.blockedReason ? (
            <button className="btn" onClick={async () => { await setTaskStatus_24(t.id, t.status, ''); toast('Task unblocked.'); }}><svg className="ic" aria-hidden="true"><use href="#i-check" /></svg>Unblock</button>
          ) : (
            <A className="btn" href={r('BoardBlocked.dc.html')}><svg className="ic" aria-hidden="true"><use href="#i-alert" /></svg>Mark blocked</A>
          )}</div>
      </div>
      <hr className="hr" />
      <div className="stack8">
        <h3 style={{ margin: 0 }}>Description</h3>
        {editing ? <textarea className="in" rows={4} value={desc} onChange={(e) => setDesc(e.target.value)} /> : <p>{t.description || <span className="muted">No description yet.</span>}</p>}
      </div>
      {t.criteria.length > 0 && (
        <div className="stack8">
          <h3 style={{ margin: 0 }}>Acceptance criteria</h3>
          <div className="stack8" style={{ gap: 6 }}>
            {t.criteria.map((c, i) => (
              <div className="row" key={i} style={{ alignItems: 'flex-start' }}><svg className="ic muted" style={{ marginTop: 3 }} aria-hidden="true"><use href="#i-circle" /></svg><span>{c}</span></div>
            ))}
          </div>
        </div>
      )}
      <div className="g2" style={{ gap: '12px 16px' }}>
        <div><div className="small muted">Story points</div>{editing ? <select className="in" aria-label="Story points" value={pts} onChange={(e) => setPts(e.target.value)}>{['', '1', '2', '3', '5', '8', '13'].map((p) => <option key={p} value={p}>{p || 'None'}</option>)}</select> : <span className={`pts${t.points ? '' : ' none'}`}>{t.points ?? 'Unestimated'}</span>}</div>
        <div><div className="small muted">Assignee</div>{t.assignee ? <div className="row"><span className={`av ${WHO[t.assignee].av}`}>{WHO[t.assignee].ini}</span>{WHO[t.assignee].name}</div> : <span className="chip c-line">Unassigned</span>}</div>
        <div><div className="small muted">Sprint</div><span className="chip c-acc">{sprint ? sprint.name : 'No sprint'}</span></div>
        <div><div className="small muted">Checkpoint (from epic)</div>{cp ? <span className="chip c-acc"><svg className="ic" aria-hidden="true"><use href="#i-flag" /></svg>{cp.name}</span> : <span className="muted">None</span>}</div>
      </div>
    </aside>
  );
}

export default function TaskDrawer() {
  return (
    <Suspense fallback={null}>
      <Drawer />
    </Suspense>
  );
}
