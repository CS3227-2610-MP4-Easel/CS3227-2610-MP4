'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { A, r, useRoute } from '../../lib/nav';
import { ApiError, closeSprintLive_31, listSprintsLive_27, listTasksLive_20, type LiveSprint, type LiveTask } from '../../lib/api';
import { useProjectRoute } from '../../lib/api/project-mode';
import { toast } from './toast';

const message = (error: unknown) => error instanceof ApiError ? error.message : 'Unable to load the active sprint.';

export default function LiveCloseSprintDialog() {
  const project = useProjectRoute();
  const route = useRoute();
  const router = useRouter();
  const [sprint, setSprint] = useState<LiveSprint | null>(null);
  const [tasks, setTasks] = useState<LiveTask[]>([]);
  const [planned, setPlanned] = useState<LiveSprint[]>([]);
  const [targets, setTargets] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (project.mode !== 'live' || !project.projectId) { setLoading(false); return; }
    let current = true;
    listSprintsLive_27(project.projectId, 0, 100).then(async (page) => {
      const active = page.items.find((item) => item.status === 'ACTIVE') ?? null;
      if (!active) { if (current) setSprint(null); return; }
      const sprintTasks = await listTasksLive_20(project.projectId!, 0, 100, { sprintId: active.id });
      if (!current) return;
      setSprint(active);
      setTasks(sprintTasks.items.filter((task) => task.status !== 'DONE'));
      setPlanned(page.items.filter((item) => item.status === 'PLANNED' && item.id !== active.id));
      setTargets(Object.fromEntries(sprintTasks.items.filter((task) => task.status !== 'DONE').map((task) => [task.id, 'BACKLOG'])));
    }).catch((reason: unknown) => { if (current) setError(message(reason)); }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [project.mode, project.projectId]);

  const close = async () => {
    if (!sprint || !project.projectId) return;
    setBusy(true); setError('');
    try {
      await closeSprintLive_31(sprint.id, { version: sprint.version, carryOver: tasks.map((task) => ({ taskId: task.id, to: targets[task.id] || 'BACKLOG' })) });
      toast(`${sprint.name} closed.`);
      router.push(route('Sprints.dc.html'));
    } catch (reason) {
      setError(message(reason));
      setBusy(false);
    }
  };

  return <div className="scrim" role="presentation"><div className="dialog" role="dialog" aria-modal="true" aria-labelledby="live-close-sprint" style={{ width: 'min(680px, 100%)' }}>
    <div className="row between"><h2 id="live-close-sprint">Close {sprint?.name ?? 'sprint'}</h2><A className="btn g sm ib" href={r('Sprints.dc.html')} aria-label="Close"><svg className="ic" aria-hidden="true"><use href="#i-x" /></svg></A></div>
    {error && <div className="banner b-bad" role="alert"><span>{error}</span></div>}
    {loading && !error && <p className="muted">Loading active sprint…</p>}
    {!loading && !sprint && !error && <p className="muted">There is no active sprint to close.</p>}
    {sprint && <>
      <div className="banner b-info"><svg className="ic" aria-hidden="true"><use href="#i-info" /></svg><span>{tasks.length ? `${tasks.length} unfinished task${tasks.length === 1 ? '' : 's'} will be moved.` : 'All tasks are done. Nothing needs to be carried over.'}</span></div>
      {tasks.length > 0 && <><table className="tbl"><thead><tr><th>Not done</th><th>Status</th><th className="r">Pts</th><th>Move to</th></tr></thead><tbody>{tasks.map((task) => <tr key={task.id}><td className="b">{task.title}</td><td>{task.status.replace('_', ' ')}</td><td className="r num">{task.storyPoints ?? '—'}</td><td><select className="in" value={targets[task.id] ?? 'BACKLOG'} onChange={(event) => setTargets((current) => ({ ...current, [task.id]: event.target.value }))}><option value="BACKLOG">Backlog</option>{planned.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}</select></td></tr>)}</tbody></table><p className="small muted">Done tasks stay in the sprint and count toward velocity.</p></>}
    </>}
    <div className="dfoot"><A className="btn" href={r('Sprints.dc.html')}>Cancel</A><button className="btn d" disabled={loading || !sprint || busy} onClick={close}>{busy ? 'Closing…' : 'Close sprint'}</button></div>
  </div></div>;
}
