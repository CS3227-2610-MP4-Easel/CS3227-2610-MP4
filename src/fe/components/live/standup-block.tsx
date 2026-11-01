'use client';
import { useRef, useState } from 'react';
import { acceptStandup_54, generateStandup_51, retrySummaries_50, saveStandup_53, useDb, exampleActivityFile_49 } from '../../lib/api';
import { Act } from './act';
import { toast } from './toast';

const icon = (id: string) => <svg className="ic" aria-hidden="true"><use href={`#i-${id}`} /></svg>;

// The standup body and its actions (endpoints 51, 53, 54). `degraded` is the AI-unavailable Friday state:
// the text is built from task activity only, so it cannot be edited or accepted.
export function StandupBlock({ degraded = false }: { degraded?: boolean }) {
  const db = useDb();
  const s = db.standup;
  const [editing, setEditing] = useState(false);
  const refs = { y: useRef<HTMLUListElement>(null), t: useRef<HTMLUListElement>(null), b: useRef<HTMLUListElement>(null) };

  const fallback = {
    yesterday: ['Moved Menu item detail page to In progress'],
    today: ['Menu item detail page (In progress)', 'Order status notifications (To do)'],
    blockers: [] as string[],
  };
  const view = degraded ? fallback : { yesterday: s.yesterday, today: s.today, blockers: s.blockers };
  const lines = (ul: HTMLUListElement | null) => Array.from(ul?.querySelectorAll('li') ?? []).map((li) => (li.textContent || '').trim()).filter(Boolean);

  const copy = async () => {
    const text = `Yesterday\n${view.yesterday.map((x) => '- ' + x).join('\n')}\nToday\n${view.today.map((x) => '- ' + x).join('\n')}\nBlockers\n${view.blockers.length ? view.blockers.map((x) => '- ' + x).join('\n') : 'Nothing to report.'}`;
    try {
      await navigator.clipboard.writeText(text);
      toast('Standup copied to the clipboard.');
    } catch {
      toast('Copy is blocked in this browser. Select the text and copy it.', 'bad');
    }
  };

  const list = (key: 'y' | 't' | 'b', items: string[]) =>
    items.length === 0 && !editing ? (
      <p className="muted">Nothing to report.</p>
    ) : (
      <ul className="pl" ref={refs[key]} contentEditable={editing} suppressContentEditableWarning style={editing ? { outline: '2px solid var(--accent)', outlineOffset: 4, borderRadius: 4 } : undefined}>
        {(items.length ? items : ['']).map((x, i) => <li key={i}>{x}</li>)}
      </ul>
    );

  return (
    <>
      <div className="g3" style={{ alignItems: 'start' }}>
        <div><h3>Yesterday</h3>{list('y', view.yesterday)}</div>
        <div><h3>Today</h3>{list('t', view.today)}</div>
        <div><h3>Blockers</h3>{list('b', view.blockers)}</div>
      </div>
      {!degraded && s.outcome === 'ACCEPTED' && (
        <div className="banner b-ok"><svg className="ic" aria-hidden="true"><use href="#i-check" /></svg><span>You accepted this standup as written.</span></div>
      )}
      <div className="row wrap between">
        <div className="row">
          <Act className="btn" run={generateStandup_51} ok={() => 'Standup regenerated from your latest activity.'} busyText="Regenerating…">{icon('refresh')}Regenerate</Act>
          <button className="btn" onClick={copy}>{icon('copy')}Copy</button>
          {!degraded && !editing && <button className="btn" onClick={() => setEditing(true)}>{icon('edit')}Edit</button>}
          {!degraded && editing && (
            <button
              className="btn p"
              onClick={async () => {
                await saveStandup_53({ yesterday: lines(refs.y.current), today: lines(refs.t.current), blockers: lines(refs.b.current) });
                setEditing(false);
                toast('Your edits are saved.');
              }}
            >
              {icon('check')}Save edits
            </button>
          )}
          {!degraded && !editing && <Act className="btn" run={acceptStandup_54} ok={() => 'Standup accepted as written.'}>{icon('check')}Use as is</Act>}
        </div>
        {!degraded && (
          <div className="row">
            <span className="small muted">Helpful?</span>
            <button className="btn ib" aria-label="Thumbs up" onClick={() => toast('Thanks, your feedback is saved.', 'info')}>{icon('up')}</button>
            <button className="btn ib" aria-label="Thumbs down" onClick={() => toast('Thanks, your feedback is saved.', 'info')}>{icon('down2')}</button>
          </div>
        )}
      </div>
    </>
  );
}

export function RetryFailed({ count }: { count?: number }) {
  const db = useDb();
  const n = count ?? db.summariesMissing;
  if (n === 0) return <span className="chip c-ok">{icon('check')}All summaries ready</span>;
  return (
    <Act className="btn sm" run={retrySummaries_50} ok={() => 'Summaries regenerated.'} busyText="Retrying…">{icon('refresh')}Retry failed ({n})</Act>
  );
}

export function DownloadExample({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <button
      className={className}
      onClick={() => {
        const url = URL.createObjectURL(new Blob([exampleActivityFile_49()], { type: 'application/json' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = 'activity-example.json';
        a.click();
        URL.revokeObjectURL(url);
        toast('Example file downloaded.', 'info');
      }}
    >
      {children}
    </button>
  );
}
