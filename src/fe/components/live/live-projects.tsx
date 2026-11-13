'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { A, r, useRole } from '../../lib/nav';
import { ApiError, createProject_5, listLiveProjects_6, type LiveProject } from '../../lib/api';
import Top from '../canvas/Top';
import { toast } from './toast';
import ModalRoute from '../modal-route';

type Filter = 'ACTIVE' | 'ARCHIVED' | undefined;

// The Projects page on real data (endpoint 6). Opening a project goes to its backlog, which is live too.
export function LiveProjectsPage() {
  const role = useRole();
  const [filter, setFilter] = useState<Filter>('ACTIVE');
  const [all, setAll] = useState<LiveProject[] | null>(null);
  const [error, setError] = useState('');

  // Endpoint 6 takes no status filter yet, so the tabs filter the loaded list.
  useEffect(() => {
    let on = true;
    listLiveProjects_6()
      .then((p) => on && setAll(p.items))
      .catch((e) => on && setError(e instanceof ApiError ? e.message : 'Something went wrong.'));
    return () => {
      on = false;
    };
  }, []);
  const items = all && (filter ? all.filter((p) => p.status === filter) : all);

  const tab = (label: string, value: Filter) => (
    <button type="button" className={filter === value ? 'on' : ''} onClick={() => setFilter(value)}>{label}</button>
  );

  return (
    <div className="app">
      <Top role="pm" />
      <div className="body">
        <main className="main">
          <div className="wide stack" style={{ gap: 20 }}>
            <div className="row wrap between">
              <div className="stack8"><h1>Projects</h1><p className="muted">Projects you are a member of.</p></div>
              {role === 'pm' && <A className="btn p" href={r('NewProject.dc.html')}><svg className="ic" aria-hidden="true"><use href="#i-plus" /></svg>New project</A>}
            </div>
            <div className="row wrap between">
              <div className="seg" role="tablist" aria-label="Status filter">{tab('Active', 'ACTIVE')}{tab('Archived', 'ARCHIVED')}{tab('All', undefined)}</div>
              <span className="small muted">{items ? `${items.length} project${items.length === 1 ? '' : 's'}, newest first` : ''}</span>
            </div>
            {error && <div className="banner b-bad" role="alert"><div>{error}</div></div>}
            {!items && !error && <div className="card"><div className="sk" style={{ width: '40%', height: 16, marginBottom: 12 }}></div><div className="sk"></div></div>}
            {items && items.length === 0 && (
              <div className="card stack8">
                <b>{role === 'pm' ? 'No projects yet.' : 'Ask your PM to add you.'}</b>
                {role === 'pm' && <div className="row"><A className="btn p" href={r('NewProject.dc.html')}>New project</A></div>}
              </div>
            )}
            {items && items.length > 0 && (
              <div className="card pad0">
                {items.map((p, i) => {
                  const pct = Math.round(p.progress?.percent ?? 0);
                  return (
                    <A key={p.id} href={`/projects/${p.id}/backlog`} className="rowt" style={{ padding: 20, borderBottom: i === items.length - 1 ? undefined : '1px solid var(--line2)' }}>
                      <div style={{ flex: 1, minWidth: 0 }} className="stack8">
                        <div className="row wrap">
                          <h3 style={{ margin: 0 }}>{p.name}</h3>
                          {p.status === 'ARCHIVED'
                            ? <span className="chip c-line"><svg className="ic" aria-hidden="true"><use href="#i-lock" /></svg>Archived</span>
                            : <span className="chip c-ok"><svg className="ic" aria-hidden="true"><use href="#i-check" /></svg>Active</span>}
                        </div>
                        {p.brief && <p className="muted" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.brief}</p>}
                      </div>
                      <div style={{ width: 260 }} className="stack8">
                        <div className="row between small"><span className="muted">Points done</span><span className="b num">{p.progress ? `${p.progress.pointsDone} of ${p.progress.pointsTotal} · ${pct}%` : 'None yet'}</span></div>
                        <div className="bar big"><i style={{ width: `${pct}%` }}></i></div>
                      </div>
                      <svg className="ic lg muted" aria-hidden="true" style={{ alignSelf: 'center' }}><use href="#i-right" /></svg>
                    </A>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

// The New project page on real data (endpoint 5). Creating goes straight to Plan with AI for the new project.
export function LiveNewProject() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [brief, setBrief] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const create = async () => {
    setBusy(true);
    setError('');
    try {
      const p = await createProject_5(name.trim(), brief);
      toast(`Project "${p.name}" created.`);
      router.push(`/projects/${p.id}/plan`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong.');
      setBusy(false);
    }
  };

  return (
    <ModalRoute closeTo="Projects.dc.html">
      <form className="dialog" role="dialog" aria-modal="true" aria-labelledby="dt" style={{ width: 'min(560px, 100%)' }} onSubmit={(e) => { e.preventDefault(); if (!busy && name.trim()) void create(); }}>
        <div className="row between">
          <h2 id="dt">New project</h2>
          <A className="btn g sm ib" href={r('Projects.dc.html')} aria-label="Close"><svg className="ic" aria-hidden="true"><use href="#i-x" /></svg></A>
        </div>
        <div className="field">
          <label htmlFor="pn">Name <span style={{ color: 'var(--danger)' }}>*</span></label>
          <input id="pn" className="in" value={name} maxLength={200} autoFocus onChange={(e) => setName(e.target.value)} />
          <span className="hint">1 to 200 characters</span>
        </div>
        <div className="field">
          <label htmlFor="pb">Brief <span className="muted" style={{ fontWeight: 400 }}>(optional)</span></label>
          <textarea id="pb" className="in" rows={5} value={brief} maxLength={4000} onChange={(e) => setBrief(e.target.value)} />
          <div className="row between"><span className="hint">The assistant reads the brief when you plan with AI.</span><span className="hint num">{brief.length} / 4000</span></div>
        </div>
        <div className="banner b-info"><div>You become a member automatically. Next you plan the work with AI.</div></div>
        {error && <div className="banner b-bad" role="alert"><div>{error}</div></div>}
        <div className="dfoot">
          <A className="btn" href={r('Projects.dc.html')}>Cancel</A>
          <button type="submit" className="btn p" disabled={busy || !name.trim()}>{busy ? 'Creating…' : 'Create project'}</button>
        </div>
      </form>
    </ModalRoute>
  );
}
