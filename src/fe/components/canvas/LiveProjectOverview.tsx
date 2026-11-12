'use client';
import { useEffect, useRef, useState } from 'react';
import { A, r } from '../../lib/nav';
import { ApiError, getProgressLive_33, getProjectLive_7, listCheckpointsLive_12, listMembersLive_9, type LiveCheckpoint, type LiveMember, type LiveProgress, type LiveProjectDetail } from '../../lib/api';
import { useProjectRoute } from '../../lib/api/project-mode';
import { ProgressCard, VelocityCard, CheckpointsCard, TeamCard } from '../live/overview';
import Top from './Top';
import ProjectHead from './ProjectHead';

const safeError = (e: unknown) => e instanceof ApiError ? e.message : 'Something went wrong. Try again.';

export default function LiveProjectOverview({ role }: { role: 'pm' | 'dev' }) {
  const { projectId } = useProjectRoute();
  const [project, setProject] = useState<LiveProjectDetail | null>(null);
  const [progress, setProgress] = useState<LiveProgress | null>(null);
  const [checkpoints, setCheckpoints] = useState<LiveCheckpoint[]>([]);
  const [members, setMembers] = useState<LiveMember[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const request = useRef(0);
  const load = () => {
    if (!projectId) return;
    const current = ++request.current;
    setLoading(true); setError(null);
    Promise.all([getProjectLive_7(projectId), getProgressLive_33(projectId), listCheckpointsLive_12(projectId), listMembersLive_9(projectId)])
      .then(([nextProject, nextProgress, nextCheckpoints, nextMembers]) => { if (request.current === current) { setProject(nextProject); setProgress(nextProgress); setCheckpoints(nextCheckpoints); setMembers(nextMembers); } })
      .catch((e: unknown) => { if (request.current === current) setError(safeError(e)); })
      .finally(() => { if (request.current === current) setLoading(false); });
  };
  useEffect(() => { load(); }, [projectId]);
  const pending = loading || (!project && !error);
  return <div className="app"><Top role={role} project={projectId ?? '1'} /><div className="body"><main className="main"><ProjectHead role={role} active="overview" project={project ?? undefined} loading={pending} error={error} onRetry={load} /><div className="wide stack" style={{ gap: 20 }}>{pending ? <div className="sk" style={{ height: 22, width: '70%' }} aria-label="Loading project details" /> : <p className="muted" style={{ maxWidth: 760 }}>{project?.brief ?? 'No project brief yet.'}</p>}<div className="g2" style={{ gridTemplateColumns: 'minmax(0, 3fr) minmax(0, 2fr)' }}><div className="stack"><ProgressCard live projectId={projectId} loading={pending} error={error} progress={progress} onRetry={load} /><VelocityCard live projectId={projectId} loading={pending} error={error} progress={progress} onRetry={load} /></div><div className="stack"><CheckpointsCard live projectId={projectId} loading={pending} error={error} onRetry={load} checkpoints={checkpoints} /><TeamCard live projectId={projectId} loading={pending} error={error} onRetry={load} members={members} /></div></div><section className="card" style={{ background: 'var(--accent-s)', borderColor: 'var(--b-info-line)' }}><div className="row wrap between" style={{ gap: 16 }}><div className="stack8"><h3 style={{ margin: 0 }}>{role === 'dev' ? 'Ready for the next standup?' : 'What would you like to do next?'}</h3><p className="muted">{role === 'dev' ? 'Upload your commits and pull requests, then generate your standup.' : 'Check how the project is tracking, or add the people who will build it.'}</p></div><div className="row wrap"><A className="btn p" href={r(role === 'pm' ? 'HealthPM.dc.html' : 'Health.dc.html', projectId ?? undefined)}>Check project health</A><A className="btn" href={r('Members.dc.html', projectId ?? undefined)}>Manage members</A></div></div></section></div></main></div></div>;
}

