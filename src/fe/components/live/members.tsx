'use client';
import { useEffect, useState } from 'react';
import { A } from '../../lib/nav';
import { ApiError, addMember_10, addMemberLive_10, listMembersLive_9, useDb, type LiveMember, type Member } from '../../lib/api';
import { useProjectRoute } from '../../lib/api/project-mode';
import RoleBadge from '../canvas/RoleBadge';
import { toast } from './toast';

const ROLE = { PM: 'pm', DEV_LEAD: 'lead', DEVELOPER: 'dev' } as const;
const AV = ['a1', 'a2', 'a3', 'a4'];
const ini = (n: string) => n.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();

export function MemberTable({ canRemove, removeRole, wide = false }: { canRemove: boolean; removeRole: Member['role']; wide?: boolean }) {
  const route = useProjectRoute();
  const db = useDb();
  const [liveMembers, setLiveMembers] = useState<LiveMember[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    if (route.mode !== 'live' || !route.projectId) return;
    let current = true;
    const load = () => listMembersLive_9(route.projectId!).then((members) => current && setLiveMembers(members)).catch((e) => current && setError(e instanceof ApiError ? e.message : 'Something went wrong.'));
    load();
    window.addEventListener('easel-members-changed', load);
    return () => { current = false; window.removeEventListener('easel-members-changed', load); };
  }, [route.mode, route.projectId]);
  const live = route.mode === 'live' && !!route.projectId;
  const rows = live ? liveMembers : db.members;
  return <section className="card pad0" style={{ flex: wide ? '1 1 100%' : '2 1 460px', minWidth: 0 }}>
    <div className="ch"><h3 style={{ margin: 0 }}>Members</h3><span className="small muted">{rows.length} people</span></div>
    {error && <div className="banner b-bad"><span>{error}</span></div>}
    <table className="tbl"><thead><tr><th>Name</th><th>Role</th><th>Email</th><th className="r"><span style={{ position: 'absolute', left: '-9999px' }}>Actions</span></th></tr></thead><tbody>
      {live ? liveMembers.map((member, i) => <tr key={member.userId}><td><div className="row"><span className={`av ${AV[i % 4]}`}>{ini(member.displayName)}</span><b>{member.displayName}</b></div></td><td><RoleBadge role={ROLE[member.role]} /></td><td className="muted">{member.userId}</td><td className="r" /></tr>) : db.members.map((member, i) => <tr key={member.id}><td><div className="row"><span className={`av ${AV[i % 4]}`}>{ini(member.name)}</span><b>{member.name}</b></div></td><td><RoleBadge role={ROLE[member.role]} /></td><td className="muted">{member.email}</td><td className="r">{canRemove && member.role === removeRole && <A className="btn g sm" href={`/projects/p1/members?view=remove&member=${member.id}`} style={{ color: 'var(--danger)' }}>Remove</A>}</td></tr>)}
    </tbody></table>
  </section>;
}

export function AddMember({ role, label }: { role: Member['role']; label: string }) {
  const route = useProjectRoute();
  const db = useDb();
  const live = route.mode === 'live' && !!route.projectId;
  const [email, setEmail] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setErr('');
    if (!live && db.members.some((m) => m.email === email.trim().toLowerCase())) { toast('Already a member.', 'info'); return; }
    setBusy(true);
    try {
      const member = live ? await addMemberLive_10(route.projectId!, email.trim()) : await addMember_10(email.trim(), role);
      toast(live ? 'Member added.' : `${(member as Member).name} added as ${label}.`);
      setEmail('');
      window.dispatchEvent(new Event('easel-members-changed'));
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Something went wrong.');
    } finally { setBusy(false); }
  };
  return <><div className="field"><label htmlFor="ae">Email</label><input id="ae" className={`in${err ? ' err' : ''}`} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="sam.koh@example.edu" />{err && <span className="err-t"><svg className="ic" style={{ width: 14, height: 14 }} aria-hidden="true"><use href="#i-alert" /></svg>{err}</span>}</div><div style={{ marginTop: 12 }}><button className="btn p" disabled={busy || !email.trim()} onClick={submit}>Add {label}</button></div></>;
}
