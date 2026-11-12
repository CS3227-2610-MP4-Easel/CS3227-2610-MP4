'use client';
import { useEffect, useState } from 'react';
import { ApiError } from '../../lib/api';
import { members_9, nextStandupDate, teamStandups_55, todaySgt, useProjectId, type LiveMember, type LiveStandup } from '../../lib/api/dev';
import { initialsOf } from '../../lib/auth/session';
import { toast } from './toast';

// S18 in `firebase` mode (spec 2026-11-12-w9-screen-wiring-design.md): one card per developer member
// (endpoint 9) with that developer's standup for the chosen day (endpoint 55). Read only; text nodes only.

const icon = (id: string) => <svg className="ic" aria-hidden="true"><use href={`#i-${id}`} /></svg>;
const NOT_FOUND = 'This project was not found or you are not a member.';
const DAY = 86400_000;
const dayLabel = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const minusDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) - n * DAY).toISOString().slice(0, 10);

type Choice = 'today' | 'next' | 'earlier';

function Lines({ label, lines, empty }: { label: string; lines: string[]; empty?: boolean }) {
  return (
    <div>
      <div className="small b muted">{label}</div>
      {lines.length ? <ul className="pl">{lines.map((l, i) => <li key={i}>{l}</li>)}</ul> : <p className="muted">{empty ? 'Nothing to report.' : 'None.'}</p>}
    </div>
  );
}

function Card({ member, s }: { member: LiveMember; s: LiveStandup | undefined }) {
  return (
    <article className="card stack8">
      <div className="row between">
        <div className="row"><span className="av a3">{initialsOf(member.displayName)}</span><b>{member.displayName}</b></div>
        {s && (
          <div className="row">
            {s.degraded && <span className="chip c-warn">{icon('info')}Built from task activity only</span>}
            {s.outcome === 'EDITED' && <span className="chip c-info">Edited</span>}
            {s.flagged && <span className="flagm">{icon('flag')}Flagged for review</span>}
          </div>
        )}
      </div>
      {s ? (
        <>
          <Lines label="YESTERDAY" lines={s.content.yesterday} />
          <Lines label="TODAY" lines={s.content.today} />
          <Lines label="BLOCKERS" lines={s.content.blockers} empty />
        </>
      ) : (
        <p className="muted">not generated</p>
      )}
    </article>
  );
}

export function LiveTeamStandups() {
  const projectId = useProjectId();
  const [days] = useState(() => { const now = new Date(); return { today: todaySgt(now), next: nextStandupDate(now) }; });
  const [choice, setChoice] = useState<Choice>('today');
  const [earlier, setEarlier] = useState(() => minusDays(days.today, 1));
  const [developer, setDeveloper] = useState('');
  const [members, setMembers] = useState<LiveMember[] | null>(null);
  const [loaded, setLoaded] = useState<{ date: string; items: LiveStandup[] } | null>(null);
  const [notFound, setNotFound] = useState(false);
  const date = choice === 'today' ? days.today : choice === 'next' ? days.next : earlier;

  const failed = (e: unknown) => {
    if (e instanceof ApiError && e.status === 404) setNotFound(true);
    else toast(e instanceof ApiError ? e.message : 'Something went wrong.', 'bad');
  };

  useEffect(() => {
    if (!projectId) return;
    let live = true;
    members_9(projectId).then((m) => { if (live) setMembers(m); }, (e) => { if (live) failed(e); });
    return () => { live = false; };
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    let live = true;
    teamStandups_55(projectId, date).then((items) => { if (live) setLoaded({ date, items }); }, (e) => { if (live) failed(e); });
    return () => { live = false; };
  }, [projectId, date]);

  if (!projectId || notFound) return <p className="muted">{NOT_FOUND}</p>;

  const developers = (members ?? []).filter((m) => m.role === 'DEVELOPER').sort((a, b) => a.displayName.localeCompare(b.displayName));
  const shown = developer ? developers.filter((m) => m.userId === developer) : developers;
  const items = loaded?.date === date ? loaded.items : null;
  const tab = (c: Choice, label: string) => (
    <button type="button" role="tab" aria-selected={c === choice} className={c === choice ? 'on' : undefined} onClick={() => setChoice(c)}>{label}</button>
  );

  return (
    <div className="wide stack" style={{ gap: '16px' }}>
      <div className="row wrap between">
        <div className="seg" role="tablist" aria-label="Standup day">
          {tab('today', `For today · ${dayLabel(days.today)}`)}
          {tab('next', `For the next standup · ${dayLabel(days.next)}`)}
          {tab('earlier', 'Earlier')}
        </div>
        <select className="sel" aria-label="Developer" value={developer} onChange={(e) => setDeveloper(e.target.value)}>
          <option value="">All developers</option>
          {developers.map((m) => <option key={m.userId} value={m.userId}>{m.displayName}</option>)}
        </select>
      </div>
      {choice === 'earlier' && (
        <select className="sel" aria-label="Earlier day" value={earlier} onChange={(e) => setEarlier(e.target.value)}>
          {Array.from({ length: 7 }, (_, i) => minusDays(days.today, i + 1)).map((d) => <option key={d} value={d}>{dayLabel(d)}</option>)}
        </select>
      )}
      {members === null || items === null ? (
        <p className="muted">Loading…</p>
      ) : developers.length === 0 ? (
        <article className="card row" style={{ borderStyle: 'dashed', boxShadow: 'none' }}><span className="muted">No developers have been added. Add them in Members.</span></article>
      ) : (
        <div className="g3" style={{ alignItems: 'start' }}>
          {shown.map((m) => <Card key={m.userId} member={m} s={items.find((s) => s.developerId === m.userId)} />)}
        </div>
      )}
    </div>
  );
}
