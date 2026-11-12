// Generated from the design canvas page OverviewLead.dc.html. Source of truth from here on is this file.
import { useEffect, useRef, useState } from 'react';
import { A, r } from '../../lib/nav';
import { ApiError, getProgressLive_33, getProjectLive_7, listCheckpointsLive_12, listMembersLive_9, type LiveCheckpoint, type LiveMember, type LiveProgress, type LiveProjectDetail } from '../../lib/api';
import { useProjectRoute } from '../../lib/api/project-mode';
import { ProgressCard, VelocityCard, CheckpointsCard, TeamCard } from '../live/overview';
import Top from './Top';
import ProjectHead from './ProjectHead';

const brief = 'A food-ordering app for campus canteens: browse stalls, order ahead, pay with a student ID and collect with a pickup code.';
const safeError = (e: unknown) => e instanceof ApiError ? e.message : 'Something went wrong. Try again.';

export default function OverviewLead() {
  const { mode, projectId } = useProjectRoute();
  const [project, setProject] = useState<LiveProjectDetail | null>(null);
  const [progress, setProgress] = useState<LiveProgress | null>(null);
  const [checkpoints, setCheckpoints] = useState<LiveCheckpoint[]>([]);
  const [members, setMembers] = useState<LiveMember[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  const request = useRef(0);
  const live = mode === 'live' && projectId !== null;
  useEffect(() => {
    if (!live || !projectId) { setProject(null); setProgress(null); setCheckpoints([]); setMembers([]); setError(null); setLoading(false); return; }
    const current = ++request.current;
    setProject(null); setProgress(null); setCheckpoints([]); setMembers([]); setError(null); setLoading(true);
    Promise.allSettled([getProjectLive_7(projectId), getProgressLive_33(projectId), listCheckpointsLive_12(projectId), listMembersLive_9(projectId)]).then((results) => {
      if (request.current !== current) return;
      const [projectResult, progressResult, checkpointsResult, membersResult] = results;
      if (projectResult.status === 'fulfilled') setProject(projectResult.value);
      if (projectResult.status === 'rejected' && !(projectResult.reason instanceof ApiError && projectResult.reason.status === 401)) setError(safeError(projectResult.reason));
      if (progressResult.status === 'fulfilled') setProgress(progressResult.value);
      if (checkpointsResult.status === 'fulfilled') setCheckpoints(checkpointsResult.value);
      if (membersResult.status === 'fulfilled') setMembers(membersResult.value);
      const failure = results.find((result) => result.status === 'rejected') as PromiseRejectedResult | undefined;
      if (failure && results.every((result) => result.status === 'rejected') && !(failure.reason instanceof ApiError && failure.reason.status === 401)) setError(safeError(failure.reason));
    }).finally(() => { if (request.current === current) setLoading(false); });
  }, [live, projectId, retry]);
  const reload = () => setRetry((n) => n + 1);
  const pending = live && (loading || (!project && !error));
  return <><div className="app"><Top role="lead" project={projectId ?? '1'} /><div className="body"><main className="main"><ProjectHead role="lead" active="overview" project={live ? project : undefined} loading={pending} error={live ? error : null} onRetry={reload} /><div className="wide stack" style={{ gap: 20 }}>{pending ? <div className="sk" style={{ height: 22, width: '70%' }} aria-label="Loading project details" /> : <p className="muted" style={{ maxWidth: 760 }}>{live ? (project?.brief ?? 'No project brief yet.') : brief}</p>}<div className="g2" style={{ gridTemplateColumns: 'minmax(0, 3fr) minmax(0, 2fr)' }}><div className="stack"><ProgressCard live={live} projectId={projectId} loading={pending} error={error} progress={progress} onRetry={reload} /><VelocityCard live={live} projectId={projectId} loading={pending} error={error} progress={progress} onRetry={reload} /></div><div className="stack"><CheckpointsCard live={live} projectId={projectId} loading={pending} error={error} onRetry={reload} checkpoints={checkpoints} /><TeamCard live={live} projectId={projectId} loading={pending} error={error} onRetry={reload} members={members} /></div></div><section className="card" style={{ background: 'var(--accent-s)', borderColor: 'var(--b-info-line)' }}><div className="row wrap between" style={{ gap: 16 }}><div className="stack8"><h3 style={{ margin: 0 }}>What would you like to do next?</h3><p className="muted">Check how the project is tracking, or add the people who will build it.</p></div><div className="row wrap"><A className="btn p" href={r('Health.dc.html', projectId ?? undefined)}>Check project health</A><A className="btn" href={r('Members.dc.html', projectId ?? undefined)}>Add developers</A></div></div></section>{!live && <section className="card flat" style={{ borderStyle: 'dashed' }}><h3>New-project checklist (shown while the project is empty)</h3><div className="g3"><div className="row"><span className="check on">✓</span><span className="b">Add developers</span></div><div className="row"><span className="check on">✓</span><span className="b">Create a sprint</span></div><div className="row"><span className="check" /><span className="b">Assign tasks</span></div></div></section>}</div></main></div></div></>;
}
