'use client';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { A, r } from '../../lib/nav';
import { ApiError, archiveProject_8, closeSprint_31, removeMember_11, useDb } from '../../lib/api';
import { toast } from './toast';

// A button that runs a data-layer call, shows the result as a toast and then goes to another screen.
export function DoThen({ className, children, run, ok, then }: { className: string; children: ReactNode; run: () => Promise<unknown>; ok: (res: any) => string; then: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className={className}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const res = await run();
          toast(ok(res));
          router.push(r(then));
        } catch (e) {
          toast(e instanceof ApiError ? e.message : 'Something went wrong.', 'bad');
          setBusy(false);
        }
      }}
    >
      {children}
    </button>
  );
}

export function CloseSprintButton({ className, children }: { className: string; children: ReactNode }) {
  const db = useDb();
  const active = db.sprints.find((s) => s.status === 'ACTIVE');
  if (!active) return <A className={`${className} dis`} href={r('Sprints.dc.html')}>No active sprint</A>;
  return (
    <DoThen className={className} run={() => closeSprint_31(active.id)} ok={(x) => `${active.name} closed. ${x.carried} unfinished task${x.carried === 1 ? '' : 's'} moved to ${x.to}.`} then="Sprints.dc.html">
      {children}
    </DoThen>
  );
}

export function ArchiveButton({ className, children }: { className: string; children: ReactNode }) {
  return <DoThen className={className} run={archiveProject_8} ok={() => 'Project archived. It is now read-only.'} then="BoardArchived.dc.html">{children}</DoThen>;
}

// Remove-member confirmation: the member comes from ?member=, and a member with open tasks is refused (endpoint 11).
export function RemoveMemberDialog({ memberId }: { memberId: string }) {
  const db = useDb();
  const router = useRouter();
  const m = db.members.find((x) => x.id === memberId);
  const [err, setErr] = useState('');
  const open = m ? db.tasks.filter((t) => t.status !== 'done' && t.assignee && matches(t.assignee, m.name)).length : 0;
  if (!m) return null;
  const confirm = async () => {
    if (open > 0) {
      setErr('This person still has open tasks. Reassign them first.');
      return;
    }
    await removeMember_11(m.id);
    toast(`${m.name} removed.`);
    router.push(r('Members.dc.html'));
  };
  const first = m.name.split(' ')[0];
  return (
    <div className="dialog" role="alertdialog" style={{ width: 'min(520px, 100%)' }}>
      <h2>Remove {m.name}?</h2>
      <p>{first} loses access to {db.project.name}. This does not delete their work.</p>
      {err && <div className="banner b-bad"><svg className="ic" aria-hidden="true"><use href="#i-alert" /></svg><span>{err}</span></div>}
      <div className="dfoot">
        <A className="btn" href={r('Members.dc.html')} style={{ outline: '2px solid var(--accent)', outlineOffset: 2 }}>Cancel</A>
        <button className="btn d" onClick={confirm}>Remove member</button>
      </div>
    </div>
  );
}

const CODE: Record<string, string> = { pn: 'Priya', ml: 'Marcus', wo: 'Wei' };
const matches = (code: string, name: string) => name.startsWith(CODE[code] ?? '\0');
