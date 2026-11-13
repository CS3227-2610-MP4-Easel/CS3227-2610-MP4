'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError, getProjectLive_7, updateProjectLive_8, type LiveProjectDetail } from '../../lib/api';
import { r } from '../../lib/nav';
import Top from '../canvas/Top';
import ProjectHead from '../canvas/ProjectHead';
import { toast } from './toast';

// The Settings page on the real project: details load from endpoint 7, Save and Archive use endpoint 8 with the version guard.
export default function LiveSettings({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [project, setProject] = useState<LiveProjectDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [brief, setBrief] = useState('');
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState('');
  const load = useCallback(() => {
    let active = true;
    setProject(null); setError(null); setSaveError(null); setStale(false);
    getProjectLive_7(projectId)
      .then((p) => { if (active) { setProject(p); setName(p.name); setBrief(p.brief ?? ''); } })
      .catch((e) => { if (active) setError(e instanceof ApiError ? e.message : 'Something went wrong.'); });
    return () => { active = false; };
  }, [projectId]);
  useEffect(() => load(), [load]);

  const dirty = !!project && (name !== project.name || brief !== (project.brief ?? ''));
  const nameOk = name.trim().length > 0 && name.length <= 200 && brief.length <= 4000;
  const fail = (e: unknown) => {
    if (e instanceof ApiError && (e.code === 'CONFLICT_VERSION' || e.code === 'CONFLICT_STATE')) setStale(true);
    setSaveError(e instanceof ApiError ? e.message : 'Something went wrong.');
  };

  const save = async () => {
    if (!project || !dirty || !nameOk || busy) return;
    setBusy(true); setSaveError(null); setStale(false);
    try {
      const next = await updateProjectLive_8(projectId, { name: name.trim(), brief: brief.trim() ? brief : null, version: project.version });
      setProject({ ...project, ...next });
      setName(next.name); setBrief(next.brief ?? '');
      toast('Project details saved.');
    } catch (e) { fail(e); } finally { setBusy(false); }
  };

  const archive = async () => {
    if (!project || busy || typed !== project.name) return;
    setBusy(true); setSaveError(null); setStale(false);
    try {
      await updateProjectLive_8(projectId, { status: 'ARCHIVED', version: project.version });
      toast('Project archived. It is now read-only.');
      router.push(r('Projects.dc.html'));
    } catch (e) { fail(e); setBusy(false); }
  };

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
                <div className="field">
                  <label htmlFor="sn">Name</label>
                  <input id="sn" className={`in${name.trim() ? '' : ' err'}`} value={name} maxLength={200} disabled={!project} onChange={(e) => setName(e.target.value)} />
                  {!name.trim() && project && <span className="err-t">Enter a project name.</span>}
                </div>
                <div className="field">
                  <label htmlFor="sb">Brief</label>
                  <textarea id="sb" className="in" rows={4} value={brief} maxLength={4000} disabled={!project} onChange={(e) => setBrief(e.target.value)} />
                  <span className="hint num" style={{ alignSelf: 'flex-end' }}>{brief.length} / 4000</span>
                </div>
                {saveError && (
                  <div className="banner b-warn" role="alert">
                    <svg className="ic" aria-hidden="true"><use href="#i-alert" /></svg>
                    <div>{stale ? 'Someone else changed this. Reload to see their version.' : saveError}{stale && <> <button className="btn sm" type="button" onClick={() => { void load(); }}>Reload</button></>}</div>
                  </div>
                )}
                <div className="dfoot">
                  <button className="btn" type="button" disabled={!dirty || busy} onClick={() => { if (project) { setName(project.name); setBrief(project.brief ?? ''); setSaveError(null); } }}>Discard</button>
                  <button className="btn p" type="button" disabled={!dirty || !nameOk || busy} onClick={() => { void save(); }}>Save changes</button>
                </div>
              </div>
            </section>
            <section className="card" style={{ borderColor: 'var(--b-bad-line)' }}>
              <h3 style={{ color: 'var(--danger)' }}>Archive</h3>
              <p className="muted" style={{ marginBottom: 12 }}>Archiving makes the project read-only for everyone. It cannot be undone from the app.</p>
              {!confirming ? (
                <button className="btn d" type="button" disabled={!project || busy} onClick={() => { setConfirming(true); setTyped(''); }}>
                  <svg className="ic" aria-hidden="true"><use href="#i-box" /></svg>Archive project
                </button>
              ) : (
                <div className="stack8">
                  <p>Type <b>{project?.name}</b> to confirm. Everyone will be able to read the project, and no one can change it.</p>
                  <input className="in" aria-label="Type the project name" value={typed} onChange={(e) => setTyped(e.target.value)} style={{ maxWidth: 360 }} autoFocus />
                  <div className="dfoot" style={{ justifyContent: 'flex-start' }}>
                    <button className="btn" type="button" disabled={busy} onClick={() => { setConfirming(false); setTyped(''); }}>Cancel</button>
                    <button className="btn d" type="button" disabled={busy || typed !== project?.name} onClick={() => { void archive(); }}>Archive project</button>
                  </div>
                </div>
              )}
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
