'use client';
import { useEffect, useState } from 'react';
import { A, r } from '../../lib/nav';
import { ApiError, getLiveProject_7, listLiveCheckpoints_12, listLiveEpics_16, listLiveTasks_20, type LiveCheckpoint, type LiveEpic, type LiveTask } from '../../lib/api';

const STATUS: Record<LiveTask['status'], { label: string; cls: string }> = {
  TODO: { label: 'To do', cls: 'c-todo' },
  IN_PROGRESS: { label: 'In progress', cls: 'c-acc' },
  IN_REVIEW: { label: 'In review', cls: 'c-warn' },
  DONE: { label: 'Done', cls: 'c-done' },
};

// The real backlog: epics, their tasks and checkpoint names, read from the API (endpoints 12, 16, 20).
// Sprints (27) and assignee names (9) are not linked yet, so those columns show the plain state.
export default function LiveBacklog() {
  const [data, setData] = useState<{ project: string; epics: LiveEpic[]; tasks: LiveTask[]; checkpoints: LiveCheckpoint[] } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    Promise.all([getLiveProject_7(), listLiveEpics_16(), listLiveTasks_20(), listLiveCheckpoints_12()])
      .then(([project, epics, tasks, checkpoints]) => live && setData({ project: project.name, epics, tasks, checkpoints }))
      .catch((e) => live && setError(e instanceof ApiError ? e.message : 'Something went wrong.'));
    return () => {
      live = false;
    };
  }, []);

  if (error) return <div className="banner b-bad" role="alert"><svg className="ic" aria-hidden="true"><use href="#i-alert" /></svg><div>{error}</div></div>;
  if (!data) return <div className="card"><div className="sk" style={{ width: '40%', height: 16, marginBottom: 12 }}></div><div className="sk"></div></div>;
  if (data.epics.length === 0) {
    return (
      <div className="card stack8">
        <b>The backlog is empty.</b>
        <div className="row"><A className="btn p" href={r('PlanIdea.dc.html')}>Plan with AI</A></div>
      </div>
    );
  }

  return (
    <>
      <div className="banner b-info"><div>Live data from the API for <b>{data.project}</b>. Sprint and assignee names are not linked yet.</div></div>
      {data.epics.map((e) => {
        const tasks = data.tasks.filter((t) => t.epicId === e.id);
        const cp = data.checkpoints.find((c) => c.id === e.checkpointId);
        return (
          <section className="card pad0" key={e.id}>
            <div className="ch" style={{ background: 'var(--head)', borderRadius: '12px 12px 0 0' }}>
              <div className="row">
                <h3 style={{ margin: 0 }}>{e.title}</h3>
                {cp && <span className="chip c-acc"><svg className="ic" aria-hidden="true"><use href="#i-flag" /></svg>{cp.name}, {cp.targetDate}</span>}
              </div>
              <div className="row"><span className="small muted">{tasks.length} task{tasks.length === 1 ? '' : 's'}, {e.pointsTotal} pts</span></div>
            </div>
            {e.description && <div className="trow"><span className="small muted">{e.description}</span></div>}
            {tasks.map((t) => (
              <div className="trow" key={t.id} title={t.acceptanceCriteria.join('\n')}>
                <span className="chip scol c-line">{t.sprintId ? 'In a sprint' : 'No sprint'}</span>
                <span className={`pts${t.storyPoints ? '' : ' none'}`}>{t.storyPoints ?? 'Unestimated'}</span>
                <span className={`chip ${STATUS[t.status].cls}`}>{STATUS[t.status].label}</span>
                {t.blocked && <span className="chip c-bad" title={t.blockedReason ?? ''}>Blocked</span>}
                <span className="t">{t.title}</span>
                <span className="chip c-line">{t.assigneeId ? 'Assigned' : 'Unassigned'}</span>
              </div>
            ))}
            {tasks.length === 0 && <div className="trow"><span className="small muted">No tasks in this epic yet.</span></div>}
          </section>
        );
      })}
    </>
  );
}
