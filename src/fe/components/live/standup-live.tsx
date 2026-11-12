'use client';
import { useEffect, useRef, useState } from 'react';
import { ApiError } from '../../lib/api';
import { myStandup_52, nextStandupDate, standup_51, summaries_50, todaySgt, upload_49, useProjectId, type LiveStandup, type UploadResult } from '../../lib/api/dev';
import { DownloadExample } from './standup-block';
import { toast } from './toast';

// S20 in `firebase` mode (spec 2026-11-12-w9-screen-wiring-design.md): upload (49), summaries (50) and
// the standup (51, 52). Untrusted text is rendered only as text nodes; list keys are indexes.
// Edit, Use as is and thumbs (53, 54) are hidden until W16 (branch decision C~2).

const icon = (id: string) => <svg className="ic" aria-hidden="true"><use href={`#i-${id}`} /></svg>;
const MAX_BYTES = 1_048_576;
const MAX_ITEMS = 100;
const BATCH = 10;
const NOT_FOUND = 'This project was not found or you are not a member.';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const wait = (e: ApiError) => e.retryAfterSeconds ?? 10;

/** Shared screen state: a 404 replaces the screen, a 409 turns the write controls off. */
type Screen = { projectId: string; archived: boolean; fail: (e: unknown) => boolean };

export function LiveStandupScreen() {
  const projectId = useProjectId();
  const [notFound, setNotFound] = useState(false);
  const [archived, setArchived] = useState(false);
  const [run, setRun] = useState<{ n: number; ids: string[] }>({ n: 0, ids: [] });
  if (!projectId || notFound) return <p className="muted">{NOT_FOUND}</p>;
  // Returns true when the error was a screen-level one (404 or 409) and is now shown.
  const fail = (e: unknown) => {
    if (!(e instanceof ApiError)) return false;
    if (e.status === 404) { setNotFound(true); return true; }
    if (e.status === 409 && e.code === 'CONFLICT_STATE') { setArchived(true); return true; }
    return false;
  };
  const screen: Screen = { projectId, archived, fail };
  return (
    <div className="stack" style={{ width: '100%', gap: '20px' }}>
      {archived && <div className="banner b-bad">{icon('alert')}<span>This project is archived. Upload and generate are off.</span></div>}
      <UploadPanel screen={screen} onNeeds={(ids) => setRun((r) => ({ n: r.n + 1, ids }))} />
      {run.ids.length > 0 && <SummariesPanel key={run.n} screen={screen} ids={run.ids} />}
      <StandupPanel screen={screen} />
    </div>
  );
}

// FileReader, not Blob.text(): the jsdom test environment lacks the latter.
const readText = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = () => reject(reader.error);
  reader.readAsText(file);
});

/** Checks a chosen file and returns its items, or the message to show instead of sending it. */
async function readItems(file: File): Promise<{ items: unknown[] } | { error: string }> {
  if (file.size > MAX_BYTES) return { error: 'That file is larger than 1 MB.' };
  let parsed: unknown;
  try { parsed = JSON.parse(await readText(file)); } catch { return { error: 'That file is not valid JSON.' }; }
  const items = (parsed as { items?: unknown } | null)?.items;
  if (!Array.isArray(items)) return { error: 'That file has no items list.' };
  if (items.length > MAX_ITEMS) return { error: 'A file can hold at most 100 items.' };
  return { items };
}

function UploadPanel({ screen, onNeeds }: { screen: Screen; onNeeds: (ids: string[]) => void }) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [result, setResult] = useState<{ name: string; res: UploadResult } | null>(null);

  const send = async (file: File | undefined) => {
    if (!file || busy || screen.archived) return;
    setProblem(null);
    const read = await readItems(file);
    if ('error' in read) { setProblem(read.error); return; }
    setBusy(true);
    try {
      const res = await upload_49(screen.projectId, read.items);
      setResult({ name: file.name, res });
      if (res.needsSummary.length) onNeeds(res.needsSummary);
    } catch (e) {
      if (screen.fail(e)) return;
      if (e instanceof ApiError && e.status === 413) setProblem('That file is larger than 1 MB.');
      else if (e instanceof ApiError && e.status === 422) setProblem(e.message);
      else toast(e instanceof ApiError ? e.message : 'Something went wrong.', 'bad');
    } finally {
      setBusy(false);
    }
  };

  const off = busy || screen.archived;
  return (
    <section className="card stack">
      <div className="row"><span className="chip c-acc">1</span><h2>Upload activity</h2></div>
      <p className="muted">Upload a JSON file of your commits and pull requests. Only titles, short bodies and file names are used. Diffs are never read.</p>
      <label className="dash" style={{ cursor: off ? 'default' : 'pointer' }} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); void send(e.dataTransfer.files[0]); }}>
        <svg className="ic lg muted" aria-hidden="true"><use href="#i-upload" /></svg>
        <div className="b" style={{ marginTop: '6px' }}>{busy ? 'Uploading…' : result ? result.name : 'Choose or drop a .json file'}</div>
        <input type="file" accept=".json,application/json" aria-label="Activity file" disabled={off} style={{ display: 'none' }} onChange={(e) => { void send(e.target.files?.[0]); e.target.value = ''; }} />
      </label>
      <div className="row wrap between">
        <span className="small muted">At most 1 MB and 100 items. Links must be https.</span>
        <DownloadExample className="btn sm">{icon('file')}Download an example file</DownloadExample>
      </div>
      {problem && <div className="banner b-bad" role="alert">{icon('alert')}<span>{problem}</span></div>}
      {result && (
        <>
          <div className="banner b-ok">{icon('check')}<span><b className="num">{`${result.res.created} new, ${result.res.updated} changed, ${result.res.unchanged} unchanged, ${result.res.rejected.length} rejected`}</b></span></div>
          {result.res.rejected.length > 0 && (
            <ul className="pl">{result.res.rejected.map((r, i) => <li key={i}>{`Item ${r.index + 1}: ${r.reason.slice(0, 200)}`}</li>)}</ul>
          )}
        </>
      )}
    </section>
  );
}

function SummariesPanel({ screen, ids }: { screen: Screen; ids: string[] }) {
  const [lines, setLines] = useState<string[]>([]);
  const [failed, setFailed] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const alive = useRef(true);
  const screenRef = useRef(screen);
  screenRef.current = screen;

  const runAll = async (list: string[]) => {
    setRunning(true);
    setFailed((f) => f.filter((id) => !list.includes(id)));
    const lost = (rest: string[]) => setFailed((f) => [...f, ...rest]);
    for (let i = 0; i < list.length && alive.current; i += BATCH) {
      const batch = list.slice(i, i + BATCH);
      for (;;) {
        try {
          const res = await summaries_50(screenRef.current.projectId, batch);
          if (!alive.current) return;
          setLines((l) => [...l, ...res.summaries.map((s) => s.oneLiner)]);
          if (res.failed.length) lost(res.failed);
          break;
        } catch (e) {
          if (!alive.current) return;
          if (e instanceof ApiError && e.code === 'AI_BUSY') {
            for (let s = wait(e); s > 0 && alive.current; s--) { setNote(`AI is busy. Resuming in ${s} s.`); await sleep(1000); }
            setNote(null);
            continue;
          }
          if (e instanceof ApiError && e.code === 'RATE_LIMITED') {
            setNote(`Too many AI requests. Try again in ${wait(e)} s.`);
            lost(list.slice(i));
            setRunning(false);
            return;
          }
          if (screenRef.current.fail(e)) { lost(list.slice(i)); setRunning(false); return; }
          if (!(e instanceof ApiError) || !['AI_UNAVAILABLE', 'AI_DISABLED', 'NETWORK'].includes(e.code)) toast(e instanceof ApiError ? e.message : 'Something went wrong.', 'bad');
          lost(batch);
          break;
        }
      }
    }
    if (alive.current) setRunning(false);
  };

  useEffect(() => {
    alive.current = true;
    void runAll(ids);
    return () => { alive.current = false; };
    // Runs once per upload; the parent remounts this panel (new key) for the next one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const total = ids.length;
  return (
    <section className="card stack">
      <div className="row between">
        <div className="row"><span className="chip c-acc">2</span><h2>Summaries</h2></div>
        <span className="b num small">{`Summarised ${lines.length} of ${total}`}</span>
      </div>
      <div className="bar big"><i style={{ width: `${Math.round((lines.length / total) * 100)}%` }}></i></div>
      {note && <div className="banner b-warn" role="status">{icon('alert')}<span>{note}</span></div>}
      <div className="stack8" style={{ gap: '0' }}>
        {lines.map((l, i) => <div className="trow" key={`s${i}`}><div className="t small">{l}</div></div>)}
        {failed.map((_, i) => <div className="trow" key={`f${i}`}><div className="t small muted" style={{ fontStyle: 'italic' }}>No summary yet</div></div>)}
      </div>
      <div className="row between">
        <span className="small muted">The standup can still be generated without the missing summaries.</span>
        {failed.length > 0 && (
          <button className="btn sm" disabled={running || screen.archived} onClick={() => void runAll(failed)}>{icon('refresh')}{`Retry failed (${failed.length})`}</button>
        )}
      </div>
    </section>
  );
}

const dayLabel = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const asText = (c: LiveStandup['content']) => {
  const list = (xs: string[]) => xs.map((x) => `- ${x}`).join('\n');
  return `Yesterday\n${list(c.yesterday)}\nToday\n${list(c.today)}\nBlockers\n${c.blockers.length ? list(c.blockers) : 'Nothing to report.'}`;
};

function Lines({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3>{title}</h3>
      {items.length ? <ul className="pl">{items.map((x, i) => <li key={i}>{x}</li>)}</ul> : <p className="muted">Nothing to report.</p>}
    </div>
  );
}

function StandupPanel({ screen }: { screen: Screen }) {
  const [days] = useState(() => { const now = new Date(); return { next: nextStandupDate(now), today: todaySgt(now) }; });
  const [date, setDate] = useState(days.next);
  const [loaded, setLoaded] = useState<{ date: string; s: LiveStandup | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [holdUntil, setHoldUntil] = useState(0);
  const current = useRef(date);
  current.current = date;
  const screenRef = useRef(screen);
  screenRef.current = screen;

  useEffect(() => {
    let live = true;
    setNote(null);
    setProblem(null);
    myStandup_52(screen.projectId, date).then(
      (s) => { if (live) setLoaded({ date, s }); },
      (e) => { if (live && !screenRef.current.fail(e)) toast(e instanceof ApiError ? e.message : 'Something went wrong.', 'bad'); },
    );
    return () => { live = false; };
  }, [screen.projectId, date]);

  useEffect(() => {
    if (!holdUntil) return;
    const t = setTimeout(() => setHoldUntil(0), Math.max(0, holdUntil - Date.now()));
    return () => clearTimeout(t);
  }, [holdUntil]);

  const generate = async () => {
    const asked = date;
    setBusy(true);
    setNote(null);
    setProblem(null);
    try {
      const s = await standup_51(screen.projectId, asked);
      if (current.current !== asked) return;
      setLoaded({ date: asked, s });
      if (s.cached) setNote('Nothing has changed since this was generated. Upload new activity to refresh it.');
    } catch (e) {
      if (current.current !== asked || screen.fail(e)) return;
      if (e instanceof ApiError && (e.code === 'AI_BUSY' || e.code === 'RATE_LIMITED')) {
        setProblem(`AI is busy. Try again in ${wait(e)} s.`);
        setHoldUntil(Date.now() + wait(e) * 1000);
      } else if (e instanceof ApiError && e.status === 422) setProblem('That date cannot be used for a standup.');
      else if (e instanceof ApiError && e.code === 'AI_DISABLED') setProblem('AI features are off for this deployment.');
      else toast(e instanceof ApiError ? e.message : 'Something went wrong.', 'bad');
    } finally {
      setBusy(false);
    }
  };

  const copy = async (s: LiveStandup) => {
    try {
      await navigator.clipboard.writeText(asText(s.content));
      toast('Standup copied to the clipboard.');
    } catch {
      toast('Copy is blocked in this browser. Select the text and copy it.', 'bad');
    }
  };

  const s = loaded?.date === date ? loaded.s : undefined;
  const off = busy || screen.archived || holdUntil > 0;
  const choice = (d: string, label: string) => (
    <button type="button" role="tab" aria-selected={d === date} className={d === date ? 'on' : undefined} onClick={() => setDate(d)}>{label}</button>
  );
  return (
    <section className="card stack">
      <div className="row wrap between">
        <div className="row"><span className="chip c-acc">3</span><h2>Standup</h2></div>
        <div className="seg" role="tablist" aria-label="Standup day">
          {choice(days.next, `For the next standup · ${dayLabel(days.next)}`)}
          {choice(days.today, `For today · ${dayLabel(days.today)}`)}
        </div>
      </div>
      {problem && <div className="banner b-warn" role="alert">{icon('alert')}<span>{problem}</span></div>}
      {s === undefined && <p className="muted">Loading…</p>}
      {s === null && (
        <div className="row between">
          <span className="muted">{`No standup for ${dayLabel(date)} yet.`}</span>
          <button className="btn p" disabled={off} onClick={() => void generate()}>{busy ? 'Generating…' : 'Generate standup'}</button>
        </div>
      )}
      {s && (
        <>
          <div className="row wrap">
            {s.outcome === 'EDITED' && <span className="chip c-info">Edited</span>}
            {s.degraded && <span className="chip c-warn">{icon('info')}Built from your task activity only</span>}
            {s.flagged && <span className="flagm">{icon('flag')}Flagged for review</span>}
          </div>
          <div className="g3" style={{ alignItems: 'start' }}>
            <Lines title="Yesterday" items={s.content.yesterday} />
            <Lines title="Today" items={s.content.today} />
            <Lines title="Blockers" items={s.content.blockers} />
          </div>
          {s.outcome === 'ACCEPTED' && <div className="banner b-ok">{icon('check')}<span>You accepted this standup as written.</span></div>}
          {note && <p className="hint">{note}</p>}
          <div className="row">
            <button className="btn" disabled={off} onClick={() => void generate()}>{icon('refresh')}{busy ? 'Regenerating…' : 'Regenerate'}</button>
            <button className="btn" onClick={() => void copy(s)}>{icon('copy')}Copy</button>
          </div>
        </>
      )}
      <p className="hint">Only you see your own standup.</p>
    </section>
  );
}
