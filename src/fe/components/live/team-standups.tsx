'use client';
import { useEffect, useState } from 'react';
import { listTeamStandups_55, useDb, type TeamStandup } from '../../lib/api';
import { WHO } from './people';

const FULL = { pn: 'Priya Nair', ml: 'Marcus Lim', wo: 'Wei Ling Ong' } as const;
const CHIP = { GENERATED: null, EDITED: 'Edited', ACCEPTED: null } as const;

function Lines({ label, lines, empty }: { label: string; lines: string[]; empty?: boolean }) {
  return (
    <div>
      <div className="small b muted">{label}</div>
      {lines.length ? <ul className="pl">{lines.map((l) => <li key={l}>{l}</li>)}</ul> : <p className="muted">{empty ? 'Nothing to report.' : 'None.'}</p>}
    </div>
  );
}

function Card({ s }: { s: TeamStandup }) {
  const w = WHO[s.person];
  return (
    <article className="card stack8">
      <div className="row between">
        <div className="row"><span className={`av ${w.av}`}>{w.ini}</span><b>{FULL[s.person]}</b></div>
        <div className="row">
          {s.activityOnly && <span className="chip c-warn"><svg className="ic" aria-hidden="true"><use href="#i-info" /></svg>Built from task activity only</span>}
          {CHIP[s.outcome] && <span className="chip c-info">{CHIP[s.outcome]}</span>}
          {s.flagged && <span className="flagm"><svg className="ic" aria-hidden="true"><use href="#i-flag" /></svg>Flagged for review</span>}
        </div>
      </div>
      <Lines label="YESTERDAY" lines={s.yesterday} />
      <Lines label="TODAY" lines={s.today} />
      <Lines label="BLOCKERS" lines={s.blockers} empty />
    </article>
  );
}

function useDay(date: string) {
  const db = useDb();
  const [rows, setRows] = useState<TeamStandup[] | null>(null);
  useEffect(() => {
    let live = true;
    listTeamStandups_55(date).then((r) => live && setRows(r));
    return () => { live = false; };
  }, [date, db.teamStandups]);
  return rows;
}

// The team's standups for one day (endpoint 55), read only.
export function TeamStandupCards({ date }: { date: string }) {
  const rows = useDay(date);
  if (!rows) return null;
  if (rows.length === 0) {
    return <article className="card row" style={{ borderStyle: 'dashed', boxShadow: 'none' }}><span className="muted">No standup for the selected day: </span><b>Not generated</b></article>;
  }
  return <div className="g3" style={{ alignItems: 'start' }}>{rows.map((s) => <Card key={s.person} s={s} />)}</div>;
}

const DAYS = ['2026-11-01', '2026-10-31', '2026-10-30', '2026-10-29', '2026-10-28', '2026-10-27', '2026-10-26'];
const label = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

// The last seven days with the chosen day's standups (endpoint 55).
export function EarlierStandups() {
  const db = useDb();
  const [day, setDay] = useState('2026-10-30');
  const rows = useDay(day);
  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
        <section className="card pad0" style={{ flex: '0 0 260px' }}>
          <div className="ch"><b>Last 7 days</b></div>
          {DAYS.map((d) => {
            const n = db.teamStandups.filter((s) => s.date === d).length;
            return (
              <button key={d} className="trow" style={{ width: '100%', textAlign: 'left', background: d === day ? 'var(--accent-s)' : undefined }} onClick={() => setDay(d)} aria-pressed={d === day}>
                <span className="t">{label(d)}</span>
                <span className="small muted">{n ? `${n} standups` : 'not generated'}</span>
              </button>
            );
          })}
        </section>
        <div style={{ flex: '1 1 560px', minWidth: 0 }} className="stack">
          <h3 style={{ margin: 0 }}>{label(day)}</h3>
          {rows && rows.length ? <div className="g3" style={{ alignItems: 'start' }}>{rows.map((s) => <Card key={s.person} s={s} />)}</div> : <p className="muted">No standups were generated on this day.</p>}
        </div>
      </div>
    </>
  );
}
