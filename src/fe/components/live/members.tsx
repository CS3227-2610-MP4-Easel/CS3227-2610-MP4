'use client';
import { useState } from 'react';
import { A } from '../../lib/nav';
import { ApiError, addMember_10, useDb, type Member } from '../../lib/api';
import RoleBadge from '../canvas/RoleBadge';
import { toast } from './toast';

const ROLE = { PM: 'pm', DEV_LEAD: 'lead', DEVELOPER: 'dev' } as const;
const AV = ['a1', 'a2', 'a3', 'a4'];
const ini = (n: string) => n.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();

// The members table (endpoint 9). `canRemove` is true for the role that may remove people.
export function MemberTable({ canRemove, removeRole, wide = false }: { canRemove: boolean; removeRole: Member['role']; wide?: boolean }) {
  const db = useDb();
  return (
    <section className="card pad0" style={{ flex: wide ? '1 1 100%' : '2 1 460px', minWidth: 0 }}>
      <div className="ch"><h3 style={{ margin: 0 }}>Members</h3><span className="small muted">{db.members.length} people</span></div>
      <table className="tbl">
        <thead><tr><th>Name</th><th>Role</th><th>Email</th><th className="r"><span style={{ position: 'absolute', left: '-9999px' }}>Actions</span></th></tr></thead>
        <tbody>
          {db.members.map((m, i) => (
            <tr key={m.id}>
              <td><div className="row"><span className={`av ${AV[i % 4]}`}>{ini(m.name)}</span><b>{m.name}</b></div></td>
              <td><RoleBadge role={ROLE[m.role]} /></td>
              <td className="muted">{m.email}</td>
              <td className="r">
                {canRemove && m.role === removeRole && (
                  <A className="btn g sm" href={`/projects/p1/members?view=remove&member=${m.id}`} style={{ color: 'var(--danger)' }}>Remove</A>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

// Add a member by email (endpoint 10).
export function AddMember({ role, label }: { role: Member['role']; label: string }) {
  const db = useDb();
  const [email, setEmail] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setErr('');
    if (db.members.some((m) => m.email === email.trim().toLowerCase())) {
      toast('Already a member.', 'info');
      return;
    }
    setBusy(true);
    try {
      const m = await addMember_10(email.trim(), role);
      toast(`${m.name} added as ${label}.`);
      setEmail('');
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="field">
        <label htmlFor="ae">Email</label>
        <input id="ae" className={`in${err ? ' err' : ''}`} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="sam.koh@example.edu" />
        {err && <span className="err-t"><svg className="ic" style={{ width: 14, height: 14 }} aria-hidden="true"><use href="#i-alert" /></svg>{err}</span>}
      </div>
      <div style={{ marginTop: 12 }}>
        <button className="btn p" disabled={busy || !email.trim()} onClick={submit}>Add {label}</button>
      </div>
    </>
  );
}
