'use client';
import { useCallback, useEffect, useState } from 'react';
import { ApiError, getProjectLive_7, type LiveProjectDetail } from '../../lib/api';
import Top from '../canvas/Top';
import ProjectHead from '../canvas/ProjectHead';

// The Settings page on the real project (endpoint 7). The API has no project update or archive route yet
// (PM_PROJECT_UPDATE is in the contract only), so the details are shown read-only.
export default function LiveSettings({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<LiveProjectDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    let active = true;
    setProject(null); setError(null);
    getProjectLive_7(projectId)
      .then((p) => { if (active) setProject(p); })
      .catch((e) => { if (active) setError(e instanceof ApiError ? e.message : 'Something went wrong.'); });
    return () => { active = false; };
  }, [projectId]);
  useEffect(() => load(), [load]);

  return (
    <div className="app">
      <Top role="pm" />
      <div className="body">
        <main className="main">
          <ProjectHead role="pm" active="settings" project={project} loading={!project && !error} error={error} onRetry={() => { void load(); }} />
          <div className="stack" style={{ width: '100%', gap: 20 }}>
            <section className="card">
              <h3>Details</h3>
              <div className="stack">
                <div className="field"><label htmlFor="sn">Name</label><input id="sn" className="in" value={project?.name ?? ''} readOnly /></div>
                <div className="field">
                  <label htmlFor="sb">Brief</label>
                  <textarea id="sb" className="in" rows={4} value={project?.brief ?? ''} readOnly />
                  <span className="hint num" style={{ alignSelf: 'flex-end' }}>{(project?.brief ?? '').length} / 4000</span>
                </div>
                <div className="banner b-info"><span>Editing the details and archiving a project are not available yet: the API has no project update route.</span></div>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
