'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { A, r } from '../../lib/nav';
import { currentProject } from '../../lib/screens';
import {
  ApiError, addEpic_59, approvePlan_40, createPlan_34, deleteEpic_60, editEpic_38, expandAll_61, expandEpic_37, getProposal_35,
  regenerateEpic_39, rejectPlan_41, setCheckpoints_58, validPoints,
  type CheckpointDraft, type PlanEpic, type PlanProposal, type PlanTask,
} from '../../lib/api';
import { toast } from './toast';

// The draft in progress is remembered per project, so another project never shows this one's plan.
const key = () => `easel-live-proposal:${currentProject()}`;
const remember = (id: string | null) => {
  try {
    if (id) window.sessionStorage.setItem(key(), id);
    else window.sessionStorage.removeItem(key());
  } catch {}
};
const recall = () => {
  try {
    return window.sessionStorage.getItem(key());
  } catch {
    return null;
  }
};

// ---- task and epic drafts (strings while typing, parsed on save) ----
type TaskDraft = { title: string; description: string; criteria: string; points: number; pointsText: string };
const toDraft = (t: PlanTask): TaskDraft => ({ title: t.title, description: t.description, criteria: t.acceptanceCriteria.join('\n'), points: t.storyPoints ?? 3, pointsText: String(t.storyPoints ?? 3) });
const toTask = (d: TaskDraft): PlanTask => ({ title: d.title.trim(), description: d.description.trim(), acceptanceCriteria: d.criteria.split('\n').map((s) => s.trim()).filter(Boolean), storyPoints: d.points });
const blankTask = (): TaskDraft => ({ title: '', description: '', criteria: '', points: 3, pointsText: '3' });

function EpicEditor({ epic, checkpoints, busy, withTasks = true, onSave, onCancel }: { epic: PlanEpic; checkpoints: string[]; busy: boolean; withTasks?: boolean; onSave: (patch: { title?: string; description?: string; checkpointName?: string | null; tasks?: PlanTask[] }) => void; onCancel: () => void }) {
  const [title, setTitle] = useState(epic.title);
  const [description, setDescription] = useState(epic.description);
  const [checkpoint, setCheckpoint] = useState<string | null>(epic.checkpointName);
  const [tasks, setTasks] = useState<TaskDraft[]>((epic.expansion.tasks ?? []).map(toDraft));
  const [problem, setProblem] = useState('');
  const done = epic.expansion.status === 'DONE';
  const setTask = (i: number, patch: Partial<TaskDraft>) => setTasks((ts) => ts.map((t, j) => (j === i ? { ...t, ...patch } : t)));

  const save = () => {
    const parsed = tasks.map(toTask);
    if (!title.trim()) return setProblem('Give the epic a title.');
    if (withTasks && tasks.length > 8) return setProblem('An epic has at most 8 tasks.');
    if (withTasks && parsed.some((t) => !t.title)) return setProblem('Every task needs a title.');
    if (withTasks && tasks.some((t) => !validPoints(t.pointsText))) return;
    const patch: { title?: string; description?: string; checkpointName?: string | null; tasks?: PlanTask[] } = {};
    if (title.trim() !== epic.title) patch.title = title.trim();
    if (description !== epic.description) patch.description = description;
    if (checkpoint !== epic.checkpointName) patch.checkpointName = checkpoint;
    // Sending tasks marks the epic ready, so send them only when the PM wrote or changed some.
    if (withTasks && parsed.length > 0 && JSON.stringify(parsed) !== JSON.stringify(epic.expansion.tasks)) patch.tasks = parsed;
    if (Object.keys(patch).length === 0) return onCancel();
    onSave(patch);
  };

  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="field"><label htmlFor={`t-${epic.index}`}>Epic title</label><input id={`t-${epic.index}`} className="in" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} /></div>
      <div className="field"><label htmlFor={`d-${epic.index}`}>Description</label><textarea id={`d-${epic.index}`} className="in" rows={3} value={description} maxLength={4000} onChange={(e) => setDescription(e.target.value)} /></div>
      {done && (title.trim() !== epic.title || description !== epic.description) && (
        <div className="banner b-info"><div>The tasks below are kept when you change the title or description. For a substantial change, add a new epic instead.</div></div>
      )}
      <div className="field">
        <label htmlFor={`c-${epic.index}`}>Checkpoint</label>
        <select id={`c-${epic.index}`} className="in" value={checkpoint ?? ''} onChange={(e) => setCheckpoint(e.target.value || null)}>
          <option value="">No checkpoint</option>
          {checkpoints.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      {withTasks && <h4 style={{ margin: 0 }}>Tasks {epic.expansion.status !== 'DONE' && <span className="muted small">(write them here to skip the model; they mark this epic ready)</span>}</h4>}
      {withTasks && tasks.map((t, i) => (
        <div className="card flat stack8" key={i}>
          <div className="row">
            <input className="in" style={{ flex: 1 }} aria-label={`Task ${i + 1} title`} placeholder="Task title" value={t.title} maxLength={200} onChange={(e) => setTask(i, { title: e.target.value })} />
            <div><input className="in" style={{ width: 80 }} type="number" min={1} max={20} step={1} aria-label={`Task ${i + 1} story points`} value={t.pointsText === 'invalid' ? '' : t.pointsText} onChange={(e) => { const text = e.currentTarget.validity.badInput ? 'invalid' : e.currentTarget.value; setTask(i, { pointsText: text, points: Number(text) }); }} />
              {!validPoints(t.pointsText) && <div className="err-t">Whole number from 1 to 20.</div>}</div>
            <button className="btn sm" type="button" onClick={() => setTasks((ts) => ts.filter((_, j) => j !== i))}>Remove</button>
          </div>
          <textarea className="in" rows={2} aria-label={`Task ${i + 1} description`} placeholder="Description" value={t.description} maxLength={4000} onChange={(e) => setTask(i, { description: e.target.value })} />
          <textarea className="in" rows={2} aria-label={`Task ${i + 1} acceptance criteria`} placeholder="Acceptance criteria, one per line" value={t.criteria} onChange={(e) => setTask(i, { criteria: e.target.value })} />
        </div>
      ))}
      {withTasks && <div className="row"><button className="btn sm" type="button" disabled={tasks.length >= 8} onClick={() => setTasks((ts) => [...ts, blankTask()])}>Add task</button></div>}
      {problem && <div className="banner b-bad" role="alert"><div>{problem}</div></div>}
      <div className="row"><button className="btn p" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save epic'}</button><button className="btn" disabled={busy} onClick={onCancel}>Cancel</button></div>
    </div>
  );
}

function CheckpointEditor({ proposal, busy, onSave, onCancel }: { proposal: PlanProposal; busy: boolean; onSave: (list: CheckpointDraft[]) => void; onCancel: () => void }) {
  const [rows, setRows] = useState<CheckpointDraft[]>(proposal.checkpoints.map((c) => ({ ...c, previousName: c.name })));
  const [problem, setProblem] = useState('');
  const set = (i: number, patch: Partial<CheckpointDraft>) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const save = () => {
    if (rows.some((x) => !x.name.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(x.targetDate))) return setProblem('Each checkpoint needs a name and a date.');
    const names = rows.map((x) => x.name.trim().toLowerCase());
    if (new Set(names).size !== names.length) return setProblem('Checkpoint names must be different.');
    // previousName keeps epics attached when a checkpoint is renamed; new rows have none.
    onSave(rows.map((x) => ({ name: x.name.trim(), targetDate: x.targetDate, ...(x.previousName ? { previousName: x.previousName } : {}) })));
  };
  return (
    <section className="card stack8">
      <h3>Edit checkpoints</h3>
      {rows.map((x, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '160px minmax(0, 1fr) auto', gap: 8, alignItems: 'center' }}>
          <input className="in" type="date" style={{ width: '100%', minWidth: 0 }} aria-label={`Checkpoint ${i + 1} date`} value={x.targetDate} onChange={(e) => set(i, { targetDate: e.target.value })} />
          <input className="in" style={{ width: '100%', minWidth: 0 }} aria-label={`Checkpoint ${i + 1} name`} placeholder="Checkpoint name" value={x.name} maxLength={200} onChange={(e) => set(i, { name: e.target.value })} />
          <button className="btn sm" type="button" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>Remove</button>
        </div>
      ))}
      <div className="row"><button className="btn sm" type="button" disabled={rows.length >= 8} onClick={() => setRows((rs) => [...rs, { name: '', targetDate: '' }])}>Add checkpoint</button></div>
      {problem && <div className="banner b-bad" role="alert"><div>{problem}</div></div>}
      <div className="row"><button className="btn p" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save checkpoints'}</button><button className="btn" disabled={busy} onClick={onCancel}>Cancel</button></div>
    </section>
  );
}

function NewEpic({ checkpoints, busy, onSave, onCancel }: { checkpoints: string[]; busy: boolean; onSave: (e: { title: string; description: string; checkpointName: string | null }) => void; onCancel: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [checkpoint, setCheckpoint] = useState<string | null>(null);
  return (
    <section className="card stack8">
      <h3>Add an epic</h3>
      <div className="field"><label htmlFor="ne-t">Epic title</label><input id="ne-t" className="in" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} /></div>
      <div className="field"><label htmlFor="ne-d">Description</label><textarea id="ne-d" className="in" rows={3} value={description} maxLength={4000} onChange={(e) => setDescription(e.target.value)} /></div>
      <div className="field">
        <label htmlFor="ne-c">Checkpoint</label>
        <select id="ne-c" className="in" value={checkpoint ?? ''} onChange={(e) => setCheckpoint(e.target.value || null)}>
          <option value="">No checkpoint</option>
          {checkpoints.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="row">
        <button className="btn p" disabled={busy || !title.trim()} onClick={() => onSave({ title: title.trim(), description, checkpointName: checkpoint })}>{busy ? 'Adding…' : 'Add epic'}</button>
        <button className="btn" disabled={busy} onClick={onCancel}>Cancel</button>
      </div>
    </section>
  );
}

// The PM plan flow against the real API (endpoints 34 to 41 and 58 to 60). Rendered by the plan screens when LLM_MODE=live.
export default function LivePlan() {
  const [idea, setIdea] = useState('');
  const [proposal, setProposal] = useState<PlanProposal | null>(null);
  const router = useRouter();
  const [editing, setEditing] = useState<number | 'new' | 'checkpoints' | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const id = recall();
    if (id) getProposal_35(id).then(setProposal).catch(() => remember(null));
  }, []);

  const run = async (what: string, fn: () => Promise<void>) => {
    setBusy(what);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong.');
      // A stale version means another tab or call changed the plan: show the current one.
      if (e instanceof ApiError && (e.code === 'CONFLICT_VERSION' || e.code === 'CONFLICT_STATE') && proposal) getProposal_35(proposal.id).then(setProposal).catch(() => {});
    } finally {
      setBusy('');
    }
  };

  // Every edit answers with the fresh proposal; the next edit needs its version.
  const change = (what: string, fn: (p: PlanProposal) => Promise<PlanProposal>, after?: string) =>
    run(what, async () => {
      if (!proposal) return;
      setProposal(await fn(proposal));
      setEditing(null);
      if (after) toast(after);
    });

  const generate = () => run('generate', async () => {
    const p = await createPlan_34(idea);
    remember(p.id);
    setProposal(p);
  });

  const expand = (index: number) => run(`expand-${index}`, async () => {
    if (!proposal) return;
    await expandEpic_37(proposal.id, index);
    setProposal(await getProposal_35(proposal.id));
  });

  const expandAll = () => run('expand-all', async () => {
    if (!proposal) return;
    const result = await expandAll_61(proposal.id, proposal.version);
    setProposal(result);
    const unfinished = result.epics.filter((e) => e.expansion.status !== 'DONE').length;
    if (unfinished) setError(`${unfinished} epics could not be saved or finished. Retry them, or open Edit and write the tasks yourself.`);
  });

  const approve = () => run('approve', async () => {
    if (!proposal) return;
    const latest = await getProposal_35(proposal.id);
    const res = await approvePlan_40(latest.id, latest.version);
    remember(null);
    const { checkpoints, epics, tasks } = res.created;
    toast(`Plan approved: ${checkpoints} checkpoints, ${epics} epics and ${tasks} tasks created.`);
    router.push(r('Backlog.dc.html'));
  });

  const reject = () => run('reject', async () => {
    if (!proposal) return;
    const latest = await getProposal_35(proposal.id);
    await rejectPlan_41(latest.id, latest.version);
    remember(null);
    setProposal(null);
    setIdea('');
    toast('Plan rejected.', 'info');
  });

  const banner = error && (
    <div className="banner b-bad" role="alert">
      <svg className="ic" aria-hidden="true"><use href="#i-alert" /></svg>
      <div>{error}</div>
    </div>
  );

  if (!proposal) {
    const len = [...idea].length;
    return (
      <section className="card stack">
        <div className="field">
          <label htmlFor="idea">Describe the idea</label>
          <textarea id="idea" className="in" rows={7} value={idea} onChange={(e) => setIdea(e.target.value)} />
          <div className="row between"><span className="hint">20 to 6000 characters.</span><span className="hint num">{len} / 6000</span></div>
        </div>
        {banner}
        <div className="row wrap between">
          <A href={r('Backlog.dc.html')} className="b muted" style={{ textDecoration: 'underline' }}>Create manually</A>
          <button className="btn p" disabled={busy !== '' || len < 20 || len > 6000} onClick={generate}>{busy === 'generate' ? 'Generating…' : 'Generate plan'}</button>
        </div>
      </section>
    );
  }

  const ready = proposal.epics.filter((e) => e.expansion.status === 'DONE').length;
  const pending = proposal.status === 'PENDING';
  const names = proposal.checkpoints.map((c) => c.name);
  const idle = busy === '';
  // Step 1: the model's outline, nothing expanded yet. Step 2: tasks exist (or an expansion failed and needs a retry).
  const outline = pending && proposal.epics.every((e) => e.expansion.status === 'PENDING');
  return (
    <fieldset className="stack" disabled={busy === 'expand-all'} style={{ gap: 16, border: 0, padding: 0, margin: 0, minWidth: 0 }}>
      <div className="row wrap">
        <h2>Plan draft</h2>
        <span className="chip c-warn">{pending ? 'Draft' : proposal.status}</span>
        <span className="b num">{ready} of {proposal.epics.length} epics ready</span>
        {proposal.flagged && <span className="flagm">Flagged for review</span>}
      </div>
      {banner}

      {editing === 'checkpoints' ? (
        <CheckpointEditor proposal={proposal} busy={!idle} onCancel={() => setEditing(null)} onSave={(list) => change('checkpoints', (p) => setCheckpoints_58(p.id, p.version, list), 'Checkpoints saved.')} />
      ) : (
        <section className="card stack8">
          <div className="row between"><h3>Approach and checkpoints</h3>{pending && <button className="btn sm" disabled={!idle} onClick={() => setEditing('checkpoints')}>Edit checkpoints</button>}</div>
          <p>{proposal.approach}</p>
          {proposal.checkpoints.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '160px minmax(0, 1fr)', gap: '6px 8px' }}>
              {proposal.checkpoints.map((c) => (
                <div key={c.name} style={{ display: 'contents' }}>
                  <span className="muted num">{c.targetDate}</span>
                  <span>{c.name}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {outline && (
        <section className="card stack">
          <div className="row between">
            <h3>Epics</h3>
            <span className="small muted">Check the epics before any tasks are generated. You can edit, add and delete them.</span>
          </div>
          {proposal.epics.map((e) => (
            <div className="card flat stack8" key={`${e.index}-${e.contentHash}`}>
              {editing === e.index ? (
                <EpicEditor epic={e} withTasks={false} checkpoints={names} busy={!idle} onCancel={() => setEditing(null)} onSave={(patch) => change(`edit-${e.index}`, (p) => editEpic_38(p.id, e.index, p.version, patch), 'Epic saved.')} />
              ) : (
                <>
                  <div className="row between">
                    <b>{e.title}</b>
                    {e.checkpointName ? <span className="chip c-acc"><svg className="ic" aria-hidden="true"><use href="#i-flag" /></svg>{e.checkpointName}</span> : <span className="chip c-line">No checkpoint</span>}
                  </div>
                  <p className="muted">{e.description}</p>
                  <div className="row">
                    <button className="btn sm" disabled={!idle} onClick={() => setEditing(e.index)}>Edit</button>
                    <button className="btn sm d" disabled={!idle || proposal.epics.length <= 1} onClick={() => window.confirm(`Delete "${e.title}"?`) && change(`del-${e.index}`, (p) => deleteEpic_60(p.id, e.index, p.version), 'Epic deleted.')}>Delete</button>
                  </div>
                </>
              )}
            </div>
          ))}
        </section>
      )}

      {!outline && proposal.epics.map((e) => (
        <article className="card stack8" key={`${e.index}-${e.contentHash}`}>
          {editing === e.index ? (
            <EpicEditor epic={e} checkpoints={names} busy={!idle} onCancel={() => setEditing(null)} onSave={(patch) => change(`edit-${e.index}`, (p) => editEpic_38(p.id, e.index, p.version, patch), 'Epic saved.')} />
          ) : (
            <>
              <div className="row between">
                <h3>{e.title}</h3>
                <span className={`chip ${e.expansion.status === 'DONE' ? 'c-done' : e.expansion.status === 'FAILED' ? 'c-bad' : 'c-todo'}`}>{e.expansion.status === 'DONE' ? 'Ready' : e.expansion.status === 'FAILED' ? 'Failed' : 'Not expanded'}</span>
              </div>
              {e.checkpointName && <div className="small muted">Checkpoint: {e.checkpointName}</div>}
              <p className="muted">{e.description}</p>
              {e.expansion.error && <small>{e.expansion.error}</small>}
              {e.expansion.tasks && (
                <ul>{e.expansion.tasks.map((t) => <li key={t.title}>{t.title}{t.storyPoints ? <span className="muted num"> · {t.storyPoints} pts</span> : null}</li>)}</ul>
              )}
              {pending && (
                <div className="row wrap">
                  {e.expansion.status !== 'DONE' && <button className="btn sm" disabled={!idle} onClick={() => expand(e.index)}>{busy === `expand-${e.index}` ? 'Expanding…' : e.expansion.status === 'FAILED' ? 'Retry' : 'Expand'}</button>}
                  {e.expansion.status === 'DONE' && <button className="btn sm" disabled={!idle} onClick={() => change(`regen-${e.index}`, (p) => regenerateEpic_39(p.id, e.index, p.version), 'Epic regenerated.')}>{busy === `regen-${e.index}` ? 'Regenerating…' : 'Regenerate'}</button>}
                  <button className="btn sm" disabled={!idle} onClick={() => setEditing(e.index)}>Edit</button>
                  <button className="btn sm d" disabled={!idle || proposal.epics.length <= 1} onClick={() => window.confirm(`Delete "${e.title}" and its tasks?`) && change(`del-${e.index}`, (p) => deleteEpic_60(p.id, e.index, p.version), 'Epic deleted.')}>Delete</button>
                </div>
              )}
            </>
          )}
        </article>
      ))}

      {pending && editing === 'new' && <NewEpic checkpoints={names} busy={!idle} onCancel={() => setEditing(null)} onSave={(epic) => change('add', (p) => addEpic_59(p.id, p.version, epic), 'Epic added.')} />}
      {pending && editing !== 'new' && proposal.epics.length < 10 && <div className="row"><button className="btn" disabled={!idle} onClick={() => setEditing('new')}>Add epic</button></div>}

      {pending && (
        <div className="row wrap between">
          <button className="btn d" disabled={!idle} onClick={reject}>{busy === 'reject' ? 'Rejecting…' : 'Reject plan'}</button>
          <div className="row">
            {outline ? (
              <button className="btn p" disabled={!idle} onClick={expandAll}>{busy === 'expand-all' ? 'Expanding all epics. This can take up to a minute.' : 'Confirm and Expand Epics'}</button>
            ) : (
              <>
                {ready < proposal.epics.length && <button className="btn" disabled={!idle} onClick={expandAll}>{busy === 'expand-all' ? 'Expanding all epics. This can take up to a minute.' : 'Retry failed epics'}</button>}
                <button className="btn p" disabled={!idle || ready < proposal.epics.length} onClick={approve}>{busy === 'approve' ? 'Approving…' : 'Approve plan'}</button>
              </>
            )}
          </div>
        </div>
      )}
    </fieldset>
  );
}
