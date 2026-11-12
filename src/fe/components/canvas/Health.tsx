'use client';
// The design-canvas Health screen, with W8 data wiring for real UUID project routes.
import { useEffect, useRef, useState } from 'react';
import { A, r } from '../../lib/nav';
import { useProjectRoute } from '../../lib/api/project-mode';
import { ApiError, applySuggestions_47, createDigest_44, dismissSuggestions_48, getFacts_42, getLatestDigest_45, refreshDigest_44, type Facts, type LeadDigest } from '../../lib/api';
import { Act } from '../live/act';
import Top from './Top';
import HealthNumbers from '../live/health';
import ProjectHead from './ProjectHead';

export default function Health() {
  const { mode, projectId } = useProjectRoute();
  const [facts, setFacts] = useState<Facts | null>(null);
  const [digest, setDigest] = useState<LeadDigest | null>(null);
  const [dataProjectId, setDataProjectId] = useState<string | null>(null);
  const [dataGeneration, setDataGeneration] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const requestGeneration = useRef(0);
  const routeGeneration = useRef(0);
  const previousProjectId = useRef(projectId);
  if (previousProjectId.current !== projectId) {
    previousProjectId.current = projectId;
    routeGeneration.current++;
  }
  const currentProjectId = useRef(projectId);
  currentProjectId.current = projectId;

  useEffect(() => {
    const generation = routeGeneration.current;
    const request = ++requestGeneration.current;
    setFacts(null);
    setDigest(null);
    setDataProjectId(null);
    setDataGeneration(null);
    setLoadError(null);
    if (mode !== 'live' || !projectId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([
      getFacts_42(projectId),
      getLatestDigest_45(projectId).catch((error: unknown) => {
        if (error instanceof ApiError && error.status === 404) return null;
        throw error;
      }),
    ]).then(([nextFacts, nextDigest]) => {
      if (requestGeneration.current !== request || routeGeneration.current !== generation) return;
      setFacts(nextFacts);
      setDigest(nextDigest);
      setDataProjectId(projectId);
      setDataGeneration(generation);
    }).catch((error: unknown) => {
      if (requestGeneration.current !== request || routeGeneration.current !== generation) return;
      setLoadError(error instanceof ApiError ? error.message : 'Something went wrong.');
    }).finally(() => {
      if (requestGeneration.current === request && routeGeneration.current === generation) setLoading(false);
    });
  }, [mode, projectId]);

  const generateDigest = async () => {
    if (mode !== 'live' || !projectId) return refreshDigest_44();
    const requestedProjectId = projectId;
    const generation = routeGeneration.current;
    const next = await createDigest_44(requestedProjectId);
    if (currentProjectId.current !== requestedProjectId || routeGeneration.current !== generation) return next;
    setDigest(next);
    setFacts(next.facts);
    setDataProjectId(requestedProjectId);
    setDataGeneration(generation);
    return next;
  };
  const live = mode === 'live' && projectId !== null;
  const currentData = dataProjectId === projectId && dataGeneration === routeGeneration.current;
  const digestText = live
    ? (currentData ? digest?.explanation : undefined) ?? (currentData && digest?.degraded ? 'The AI part is unavailable right now.' : 'No digest yet.')
    : 'Progress is steady and all three checkpoints are on track at the current pace. The payment task is blocked on outside keys and holds 8 of the open points, so it is the main risk to Beta release. Wei Ling carries the largest open load across projects.';

  return (<><div className="app"><Top role={'lead'} project={projectId ?? '1'} /> <div className="body"><main className="main"><ProjectHead role={'lead'} active={'health'} /> <div className="wide stack" style={{ gap: '16px' }}><HealthNumbers facts={live && currentData ? facts : undefined} loading={live && (loading || !currentData)} error={live ? loadError : null} /> <section className="card"><div className="row wrap between" style={{ marginBottom: '8px' }}><div className="row"><svg className="ic lg" style={{ color: 'var(--accent-t)' }} aria-hidden="true"><use href="#i-spark" /></svg><h3 style={{ margin: 0 }}>Digest</h3><span className="small muted">{currentData && digest ? `Generated ${new Date(digest.createdAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}` : live ? 'No digest yet' : 'Generated 1 Nov, 09:05'}</span></div><Act className="btn sm" run={generateDigest} ok={(result) => result.cached ? 'Nothing changed since the last digest, so the same one is shown.' : 'Digest refreshed.'} busyText="Working…"><svg className="ic" aria-hidden="true"><use href="#i-refresh" /></svg>{currentData && digest ? 'Refresh digest' : 'Generate digest'}</Act></div><p>{digestText}</p>{((currentData && digest?.flagged) || (!live && true)) && <div className="row" style={{ marginTop: '8px' }}><span className="flagm"><svg className="ic" aria-hidden="true"><use href="#i-flag" /></svg>Flagged for review</span></div>}{live && currentData && digest?.degraded && <div className="banner b-info" style={{ marginTop: '12px' }}><svg className="ic" aria-hidden="true"><use href="#i-info" /></svg><span>The facts stay available while the AI part is unavailable. Try again when the service recovers.</span></div>}{!live && <div className="banner b-info" style={{ marginTop: '12px' }}><svg className="ic" aria-hidden="true"><use href="#i-info" /></svg><span>States: no digest yet shows <b>No digest yet.</b> with Generate digest. Nothing changed: <b>Nothing has changed since the last digest.</b> Model down: the facts stay and <b>The AI part is unavailable right now.</b> with Try again.</span></div>}</section>{!live && <section className="card pad0"><div className="ch"><div className="stack8" style={{ gap: '2px' }}><h3 style={{ margin: 0 }}>Suggested changes (3)</h3><span className="small muted">Each one is your decision. Nothing is applied without this step.</span></div><span className="chip c-line">Tier 2</span></div><div className="trow" style={{ alignItems: 'flex-start' }}><span className="check on"><svg className="ic" style={{ width: '12px', height: '12px', strokeWidth: '3' }} aria-hidden="true"><use href="#i-check" /></svg></span><div className="t"><div>Move task <b>Order status notifications</b> to Sprint 3</div><div className="small muted">Sprint 2 already carries 26 points against an average of 13.</div></div></div><div className="trow" style={{ alignItems: 'flex-start' }}><span className="check on"><svg className="ic" style={{ width: '12px', height: '12px', strokeWidth: '3' }} aria-hidden="true"><use href="#i-check" /></svg></span><div className="t"><div>Reassign task <b>QR pickup code</b> from Wei Ling Ong to Priya Nair</div><div className="small muted">Wei Ling has 11 open points across projects; Priya has 5.</div></div></div><div className="trow" style={{ alignItems: 'flex-start', background: 'var(--head)' }}><span className="check" style={{ opacity: '.5' }}></span><div className="t" style={{ opacity: '.7' }}><div>Move epic <b>Pickup</b> from Beta release to Launch</div><div className="chip c-bad" style={{ marginTop: '4px' }}>Out of date: the epic's checkpoint changed</div></div></div><div className="trow" style={{ justifyContent: 'flex-end' }}><Act className="btn" run={dismissSuggestions_48} ok={() => 'Suggestions dismissed.'} busyText="Working…">Dismiss all</Act><Act className="btn p" run={() => applySuggestions_47(['g1', 'g2'])} ok={(n) => `${n} suggestions applied to the plan.`} busyText="Working…">Apply selected (2)</Act></div></section>}{live && <section className="card"><h3 style={{ marginTop: 0 }}>Suggested changes</h3><p className="muted">Suggestions will become interactive when W14 adds the proposal endpoints.</p><A className="btn" href={r('OverviewLead.dc.html')}>Back to overview</A></section>}</div></main></div></div></>);
}
