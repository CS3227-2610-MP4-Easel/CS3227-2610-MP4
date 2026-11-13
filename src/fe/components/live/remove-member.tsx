'use client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { A, r, useModal, useRoute } from '../../lib/nav';
import { ApiError, listMembersLive_9, removeMemberLive_11, type LiveMember } from '../../lib/api';
import { useProjectRoute } from '../../lib/api/project-mode';
import { RemoveMemberDialog } from './flows';
import { toast } from './toast';

// Remove-member confirmation on a real project (endpoint 11). The backend decides: open tasks or a wrong role pair come back as errors.
function LiveRemoveMember({ projectId, userId }: { projectId: string; userId: string }) {
  const router = useRouter();
  const routeFor = useRoute();
  const [member, setMember] = useState<LiveMember | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    listMembersLive_9(projectId).then((all) => { if (active) setMember(all.find((m) => m.userId === userId) ?? null); }).catch((e) => { if (active) setErr(e instanceof ApiError ? e.message : 'Something went wrong.'); });
    return () => { active = false; };
  }, [projectId, userId]);
  const confirm = async () => {
    setBusy(true); setErr('');
    try {
      await removeMemberLive_11(projectId, userId);
      toast(`${member?.displayName ?? 'Member'} removed.`);
      window.dispatchEvent(new Event('easel-members-changed'));
      router.push(routeFor('Members.dc.html'));
    } catch (e) {
      setErr(e instanceof ApiError && e.code === 'CONFLICT_STATE' ? 'This person still has open tasks. Reassign them first.' : e instanceof ApiError ? e.message : 'Something went wrong.');
      setBusy(false);
    }
  };
  const first = member?.displayName.split(' ')[0] ?? 'They';
  return (
    <div className="dialog" role="alertdialog" style={{ width: 'min(520px, 100%)' }}>
      <h2>Remove {member?.displayName ?? 'member'}?</h2>
      <p>{first} loses access to this project. This does not delete their work.</p>
      {err && <div className="banner b-bad"><svg className="ic" aria-hidden="true"><use href="#i-alert" /></svg><span>{err}</span></div>}
      <div className="dfoot">
        <A className="btn" href={r('Members.dc.html')} style={{ outline: '2px solid var(--accent)', outlineOffset: 2 }}>Cancel</A>
        <button className="btn d" type="button" disabled={busy || !member} onClick={() => { void confirm(); }}>Remove member</button>
      </div>
    </div>
  );
}

function Inner() {
  const modal = useModal();
  const route = useProjectRoute();
  const param = useSearchParams().get('member');
  const id = modal.modal?.params?.member || param || '';
  if (route.mode === 'live' && route.projectId) return id ? <LiveRemoveMember projectId={route.projectId} userId={id} /> : null;
  return <RemoveMemberDialog memberId={id || 'u4'} />;
}

export default function RemoveMember() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}
