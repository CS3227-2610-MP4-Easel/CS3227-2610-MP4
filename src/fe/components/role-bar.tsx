'use client';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

const ROLES: [string, string][] = [['pm', 'Project Manager'], ['lead', 'Dev Lead'], ['dev', 'Developer']];

function Bar() {
  const path = usePathname();
  const sp = useSearchParams();
  const qs = sp.toString();
  const here = path + (qs ? '?' + qs : '');
  if (path === '/sign-in' || path === '/register' || path === '/styleguide' || path === '/states') return null;
  return (
    <div role="group" aria-label="Prototype role" style={{ position: 'fixed', right: 16, bottom: 16, zIndex: 50, display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px 6px 12px', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 10, boxShadow: 'var(--sh)' }}>
      <a className="btn sm g" href="/screens">All screens</a>
      <span className="small muted">View as</span>
      {ROLES.map(([k, label]) => (
        <a key={k} className="btn sm" href={`/api/as?role=${k}&to=${encodeURIComponent(here)}`}>{label}</a>
      ))}
    </div>
  );
}

export default function RoleBar() {
  return (
    <Suspense fallback={null}>
      <Bar />
    </Suspense>
  );
}
