'use client';
import { useEffect, useState } from 'react';
import { A, r } from '../../lib/nav';
import { ApiError, approvePlan_40, createPlan_34, expandEpic_37, getProposal_35, rejectPlan_41, type PlanApproved, type PlanProposal } from '../../lib/api';
import { toast } from './toast';

const KEY = 'easel-live-proposal';
const remember = (id: string | null) => {
  try {
    if (id) window.sessionStorage.setItem(KEY, id);
    else window.sessionStorage.removeItem(KEY);
  } catch {}
};
const recall = () => {
  try {
    return window.sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
};
const message = (e: unknown) => (e instanceof ApiError ? e.message : 'Something went wrong.');

// The PM plan flow against the real API (endpoints 34, 35, 37, 40, 41). Rendered by the plan screens when LLM_MODE=live.
export default function LivePlan() {
  const [idea, setIdea] = useState('');
  const [proposal, setProposal] = useState<PlanProposal | null>(null);
  const [approved, setApproved] = useState<PlanApproved | null>(null);
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
      setError(message(e));
    } finally {
      setBusy('');
    }
  };

  const generate = () =>
    run('generate', async () => {
      const p = await createPlan_34(idea);
      remember(p.id);
      setProposal(p);
    });

  const expand = (index: number) =>
    run(`expand-${index}`, async () => {
      if (!proposal) return;
      await expandEpic_37(proposal.id, index);
      setProposal(await getProposal_35(proposal.id));
    });

  const expandAll = () =>
    run('expand-all', async () => {
      if (!proposal) return;
      for (const e of proposal.epics) if (e.expansion.status !== 'DONE') await expandEpic_37(proposal.id, e.index);
      setProposal(await getProposal_35(proposal.id));
    });

  const approve = () =>
    run('approve', async () => {
      if (!proposal) return;
      const latest = await getProposal_35(proposal.id);
      const res = await approvePlan_40(latest.id, latest.version);
      remember(null);
      setApproved(res);
      toast('Plan approved.');
    });

  const reject = () =>
    run('reject', async () => {
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

  if (approved) {
    const { checkpoints, epics, tasks } = approved.created;
    return (
      <div className="card stack">
        <h2>Plan approved</h2>
        <p>
          Created <b className="num">{checkpoints} checkpoints, {epics} epics and {tasks} tasks</b> in the backlog.
        </p>
        <div className="row"><A className="btn p" href={r('Backlog.dc.html')}>Open backlog</A></div>
      </div>
    );
  }

  if (!proposal) {
    const len = [...idea].length;
    return (
      <section className="card stack">
        <div className="field">
          <label htmlFor="idea">Describe the idea</label>
          <textarea id="idea" className="in" rows={7} value={idea} onChange={(e) => setIdea(e.target.value)} />
          <div className="row between">
            <span className="hint">20 to 6000 characters.</span>
            <span className="hint num">{len} / 6000</span>
          </div>
        </div>
        {banner}
        <div className="row wrap between">
          <A href={r('Backlog.dc.html')} className="b muted" style={{ textDecoration: 'underline' }}>Create manually</A>
          <button className="btn p" disabled={busy !== '' || len < 20 || len > 6000} onClick={generate}>
            {busy === 'generate' ? 'Generating…' : 'Generate plan'}
          </button>
        </div>
      </section>
    );
  }

  const ready = proposal.epics.filter((e) => e.expansion.status === 'DONE').length;
  const pending = proposal.status === 'PENDING';
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="row wrap">
        <h2>Plan draft</h2>
        <span className="chip c-warn">{proposal.status === 'PENDING' ? 'Draft' : proposal.status}</span>
        <span className="b num">{ready} of {proposal.epics.length} epics ready</span>
        {proposal.flagged && <span className="flagm">Flagged for review</span>}
      </div>
      {banner}
      <section className="card stack8">
        <h3>Approach</h3>
        <p>{proposal.approach}</p>
        {proposal.checkpoints.length > 0 && (
          <ul>{proposal.checkpoints.map((c) => <li key={c.name}>{c.name} <span className="muted num">{c.targetDate}</span></li>)}</ul>
        )}
      </section>
      {proposal.epics.map((e) => (
        <article className="card stack8" key={e.index}>
          <div className="row between">
            <h3>{e.title}</h3>
            <span className={`chip ${e.expansion.status === 'DONE' ? 'c-done' : e.expansion.status === 'FAILED' ? 'c-bad' : 'c-todo'}`}>{e.expansion.status === 'DONE' ? 'Ready' : e.expansion.status === 'FAILED' ? 'Failed' : 'Not expanded'}</span>
          </div>
          <p className="muted">{e.description}</p>
          {e.expansion.error && <small>{e.expansion.error}</small>}
          {e.expansion.tasks && <ul>{e.expansion.tasks.map((t) => <li key={t.title}>{t.title}{t.storyPoints ? <span className="muted num"> · {t.storyPoints} pts</span> : null}</li>)}</ul>}
          {pending && e.expansion.status !== 'DONE' && (
            <div className="row">
              <button className="btn sm" disabled={busy !== ''} onClick={() => expand(e.index)}>
                {busy === `expand-${e.index}` ? 'Expanding…' : e.expansion.status === 'FAILED' ? 'Retry' : 'Expand'}
              </button>
            </div>
          )}
        </article>
      ))}
      {pending && (
        <div className="row wrap between">
          <button className="btn d" disabled={busy !== ''} onClick={reject}>{busy === 'reject' ? 'Rejecting…' : 'Reject plan'}</button>
          <div className="row">
            {ready < proposal.epics.length && <button className="btn" disabled={busy !== ''} onClick={expandAll}>{busy === 'expand-all' ? 'Expanding…' : 'Expand all epics'}</button>}
            <button className="btn p" disabled={busy !== '' || ready < proposal.epics.length} onClick={approve}>{busy === 'approve' ? 'Approving…' : 'Approve plan'}</button>
          </div>
        </div>
      )}
    </div>
  );
}
