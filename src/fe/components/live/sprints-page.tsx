'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiError, listMembersLive_9, listSprintsLive_27, readProgressLive_33, type LiveMember, type LiveProgress, type LiveSprint } from '../../lib/api';
import { useProjectRoute } from '../../lib/api/project-mode';
import { VelocityCard } from './overview';
import SprintList from './sprint-list';

const errorMessage = (error: unknown) => error instanceof ApiError ? error.message : 'Unable to load sprints. Try again.';

export default function SprintsPage({ readOnly = false }: { readOnly?: boolean }) {
  const route = useProjectRoute();
  const [sprints, setSprints] = useState<LiveSprint[] | null>(null);
  const [progress, setProgress] = useState<LiveProgress | null>(null);
  const [members, setMembers] = useState<LiveMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (route.mode !== 'live' || !route.projectId) return;
    let current = true;
    setLoading(true);
    setError(null);
    Promise.all([listSprintsLive_27(route.projectId, 0, 100), readProgressLive_33(route.projectId), listMembersLive_9(route.projectId)])
      .then(([page, projectProgress, projectMembers]) => {
        if (!current) return;
        setSprints(page.items);
        setProgress(projectProgress);
        setMembers(projectMembers);
      })
      .catch((reason: unknown) => { if (current) setError(errorMessage(reason)); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [route.mode, route.projectId]);

  useEffect(() => load(), [load]);
  useEffect(() => {
    const onTaskChange = () => { void load(); };
    window.addEventListener('easel-board-refresh', onTaskChange);
    return () => window.removeEventListener('easel-board-refresh', onTaskChange);
  }, [load]);

  if (route.mode !== 'live' || !route.projectId) return <><VelocityCard /><SprintList readOnly={readOnly} /> </>;
  return <><VelocityCard live progress={progress} loading={loading} error={error} onRetry={load} /><SprintList live projectId={route.projectId} sprints={sprints ?? []} members={members} readOnly={readOnly} loading={loading} error={error} onRetry={load} onChanged={() => { void load(); }} /></>;
}
