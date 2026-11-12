'use client';
import { useEffect, useState } from 'react';
import { A, r } from '../../lib/nav';
import { currentProject } from '../../lib/screens';
import { listProposals_36, type Page, type PlanProposal } from '../../lib/api';

const filters: { label: string; status?: PlanProposal['status'] }[] = [
  { label: 'All' }, { label: 'Draft', status: 'PENDING' }, { label: 'Approved', status: 'APPROVED' },
  { label: 'Rejected', status: 'REJECTED' }, { label: 'Replaced', status: 'SUPERSEDED' },
];

export default function LivePlanHistory() {
  const projectId = currentProject();
  const [status, setStatus] = useState<PlanProposal['status'] | undefined>();
  const [page, setPage] = useState(0);
  const [result, setResult] = useState<Page<PlanProposal> | null>(null);
  const [resultKey, setResultKey] = useState('');
  const [error, setError] = useState('');
  const [errorKey, setErrorKey] = useState('');
  useEffect(() => {
    let active = true;
    setResult(null); setError('');
    listProposals_36(projectId, page, status).then((value) => {
      if (active && currentProject() === projectId) { setResultKey(`${projectId}:${page}:${status ?? ''}`); setResult(value); }
    }).catch((e) => {
      if (active && currentProject() === projectId) { setErrorKey(`${projectId}:${page}:${status ?? ''}`); setError(e instanceof Error ? e.message : 'Something went wrong.'); }
    });
    return () => { active = false; };
  }, [projectId, page, status]);
  const visible = resultKey === `${projectId}:${page}:${status ?? ''}` ? result : null;
  const planUrl = r('PlanIdea.dc.html');
  return <div className="stack">
    <div className="row wrap between"><h2>Plan history</h2><A className="btn p" href={`${planUrl}?new=1`}>Plan with AI</A></div>
    <div className="seg" aria-label="Status">
      {filters.map((filter) => <button key={filter.label} type="button" className={status === filter.status ? 'on' : ''} aria-pressed={status === filter.status} onClick={() => { setStatus(filter.status); setPage(0); }}>{filter.label}</button>)}
    </div>
    {error && errorKey === `${projectId}:${page}:${status ?? ''}` ? <div className="banner b-bad" role="alert">{error}</div> : !visible ? <div className="card">Loading plans…</div> : visible.items.length === 0 ? <div className="card">No plans found.</div> : <div className="card pad0"><table className="tbl"><thead><tr><th>Created</th><th>Status</th><th>Epics</th><th>Notes</th><th></th></tr></thead><tbody>
      {visible.items.map((proposal) => <tr key={proposal.id}><td>{new Date(proposal.createdAt).toLocaleDateString('en-SG', { timeZone: 'Asia/Singapore' })}</td><td>{filters.find((filter) => filter.status === proposal.status)?.label ?? proposal.status}</td><td>{proposal.epics.length}</td><td>{proposal.flagged ? 'Flagged for review' : ''}</td><td><A className="btn sm" href={`${planUrl}?proposal=${encodeURIComponent(proposal.id)}`}>Open</A></td></tr>)}
    </tbody></table></div>}
    {visible && <div className="row"><button className="btn" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</button><span>Page {page + 1}</span><button className="btn" disabled={(page + 1) * visible.size >= visible.total} onClick={() => setPage((p) => p + 1)}>Next</button></div>}
  </div>;
}
