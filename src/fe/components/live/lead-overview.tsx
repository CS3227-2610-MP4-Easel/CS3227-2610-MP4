'use client';

import { useEffect, useState } from 'react';
import { A, routeFor } from '../../lib/nav';
import { ApiError, getFacts_42, getLatestDigest_45, listProjectsLive_6, type Facts, type LeadDigest, type LiveProjectDetail } from '../../lib/api';
import Top from '../canvas/Top';
import RiskBadge from '../canvas/RiskBadge';

type Row = { project: LiveProjectDetail; facts: Facts; digest: LeadDigest | null };
const fallbackFacts = (project: LiveProjectDetail): Facts => ({ asOf: project.updatedAt, pointsTotal: project.progress.pointsTotal, pointsDone: project.progress.pointsDone, pointsRemaining: Math.max(0, project.progress.pointsTotal - project.progress.pointsDone), unestimatedTasks: project.progress.unestimatedTasks, velocity: [], avgVelocity: null, projectedCompletionDate: null, checkpoints: [], overload: [] });
const safeError = (e: unknown) => e instanceof ApiError ? e.message : 'Something went wrong. Try again.';
const riskOf = (facts: Facts): 'ok' | 'warn' | 'unknown' => facts.checkpoints.some((c) => c.risk === 'AT_RISK') ? 'warn' : facts.checkpoints.some((c) => c.risk === 'UNKNOWN') ? 'unknown' : 'ok';
const date = (value: string | null) => value ? new Date(value).toLocaleDateString('en-GB', { dateStyle: 'medium' }) : 'Unknown';

export default function LiveLeadOverview() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setRows(null); setError(null);
    listProjectsLive_6(0, 100).then(async (page) => {
      const next = await Promise.all(page.items.map(async (project) => {
        const [factsResult, digestResult] = await Promise.allSettled([
          getFacts_42(project.id),
          getLatestDigest_45(project.id).catch((e: unknown) => e instanceof ApiError && e.status === 404 ? null : Promise.reject(e)),
        ]);
        return { project, facts: factsResult.status === 'fulfilled' ? factsResult.value : fallbackFacts(project), digest: digestResult.status === 'fulfilled' ? digestResult.value : null };
      }));
      if (active) setRows(next);
    }).catch((e: unknown) => { if (active) setError(safeError(e)); });
    return () => { active = false; };
  }, [retry]);
  return <><div className="app"><Top role="lead" /><div className="body"><main className="main"><div className="wide stack" style={{ gap: 16 }}><div className="row wrap between"><div className="stack8"><h1>Overview</h1><p className="muted">Your projects and current delivery health.</p></div></div>{rows === null && !error ? <div className="card"><div className="sk" style={{ height: 22, width: '40%' }} /><div className="sk" style={{ height: 80, marginTop: 12 }} /></div> : error ? <div className="banner b-bad" role="alert"><span>{error}</span><button className="btn sm" type="button" onClick={() => setRetry((n) => n + 1)}>Try again</button></div> : rows?.length ? <div className="card pad0" style={{ overflowX: 'auto' }}><table className="tbl" style={{ minWidth: 960 }}><thead><tr><th>Project</th><th>Progress</th><th className="r">Avg velocity</th><th>Projected finish</th><th className="r">Checkpoints at risk</th><th>Worst risk</th><th>Digest</th></tr></thead><tbody>{rows.map(({ project, facts, digest }) => { const risk = riskOf(facts); const percent = facts.pointsTotal ? Math.round(facts.pointsDone / facts.pointsTotal * 100) : 0; return <tr key={project.id}><td><A href={routeFor(`/projects/${project.id}/health`)} className="b" style={{ color: 'var(--accent-t)' }}>{project.name}</A></td><td><div className="row"><div className="bar" style={{ flex: 1 }}><i style={{ width: `${percent}%` }} /></div><span className="num small b">{percent}%</span></div></td><td className="r num">{facts.avgVelocity == null ? 'No history' : `${Math.round(facts.avgVelocity)} pts`}</td><td className="num">{date(facts.projectedCompletionDate)}</td><td className="r num">{facts.checkpoints.filter((c) => c.risk === 'AT_RISK').length}</td><td><RiskBadge risk={risk} /></td><td><span className={`chip ${digest ? 'c-line' : 'c-line'}`}>{digest ? `Latest digest ${date(digest.createdAt)}` : 'None'}</span></td></tr>; })}</tbody></table></div> : <div className="empty card"><b>You are not a member of any project yet.</b><p className="muted">Ask a PM to add you.</p></div>}</div></main></div></div></>;
}
