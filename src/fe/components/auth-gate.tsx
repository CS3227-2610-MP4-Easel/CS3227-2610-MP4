'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { toRole, useSession } from '../lib/auth/session';
import { HOME, resolve } from '../lib/screens';
import Register from './live/register';
import SignIn from './live/sign-in';
import Screen from './screen';

const OPEN = ['/styleguide', '/states'];

function Loading() {
  return (
    <main className="app" style={{ alignItems: 'center', justifyContent: 'center' }}>
      <p>Loading…</p>
    </main>
  );
}

export default function AuthGate({ pathname, view }: { pathname: string; view?: string }) {
  const session = useSession();
  const router = useRouter();
  const status = session?.status ?? 'loading';
  const isOpen = OPEN.includes(pathname);
  const isSignIn = pathname === '/sign-in';
  const isRegister = pathname === '/register';

  let target: string | null = null;
  if (!isOpen) {
    if (status === 'ready' && (isSignIn || isRegister)) target = '/projects';
    else if (status === 'unregistered' && !isRegister) target = '/register';
    else if (status === 'signed-out' && !isSignIn && !isRegister) target = '/sign-in';
  }

  useEffect(() => {
    if (target) router.replace(target);
  }, [target, router]);

  if (!session) return <Loading />;
  if (isOpen) return <Screen found={resolve(pathname, view, 'pm')} role="pm" home={HOME.pm} />;
  if (status === 'error') {
    const id = session.error?.requestId;
    return (
      <main className="app" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <p>Something went wrong.</p>
        <button className="btn p" type="button" onClick={() => session.retry()}>Retry</button>
        {id ? <p className="small muted">Request ID: {id}</p> : null}
      </main>
    );
  }
  if (target) return <Loading />;
  if (isSignIn) return <SignIn />;
  if (isRegister) return <Register />;
  if (status === 'ready' && session.user) {
    const role = toRole(session.user.role);
    return <Screen found={resolve(pathname, view, role)} role={role} home={HOME[role]} />;
  }
  return <Loading />;
}
