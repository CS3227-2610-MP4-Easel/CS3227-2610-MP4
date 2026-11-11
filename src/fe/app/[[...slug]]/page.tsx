import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import AuthGate from '../../components/auth-gate';
import Screen from '../../components/screen';
import { authMode } from '../../lib/auth/mode';
import { HOME, resolve, type Role } from '../../lib/screens';

const PUBLIC = ['/sign-in', '/register', '/styleguide', '/states'];

export default async function Page({ params, searchParams }: { params: Promise<{ slug?: string[] }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const pathname = '/' + (slug ?? []).join('/');
  if (pathname === '/') redirect('/sign-in');
  const view = typeof sp.task === 'string' ? 'task' : typeof sp.view === 'string' ? sp.view : undefined;
  if (authMode(process.env) !== 'prototype') return <AuthGate pathname={pathname} view={view} />;
  const stored = (await cookies()).get('role')?.value;
  const role: Role = stored === 'lead' || stored === 'dev' || stored === 'pm' ? stored : 'pm';
  const signedIn = Boolean(stored);
  if (!signedIn && !PUBLIC.includes(pathname)) redirect('/sign-in');
  const found = resolve(pathname, view, role);
  const projectId = pathname.match(/^\/projects\/([^/]+)/)?.[1];
  return <Screen found={found} role={role} home={HOME[role]} projectId={projectId} />;
}
