'use client';
import { RoleCtx } from '../lib/nav';
import type { Resolved, Role } from '../lib/screens';
import { SCREEN_COMPONENTS } from './screens-index';
import Top from './canvas/Top';

export default function Screen({ found, role, home }: { found: Resolved; role: Role; home: string }) {
  if ('file' in found) {
    const C = SCREEN_COMPONENTS[found.file];
    return (
      <RoleCtx.Provider value={role}>
        <C />
      </RoleCtx.Provider>
    );
  }
  const forbidden = 'forbidden' in found;
  return (
    <RoleCtx.Provider value={role}>
      <div className="app">
        <Top role={role} />
        <main className="main" style={{ alignItems: 'center', paddingTop: 80 }}>
          <div className="card" style={{ maxWidth: 520, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h1>{forbidden ? 'You cannot open this page' : 'Page not found'}</h1>
            <p className="muted">{forbidden ? 'Your role does not have access to this screen.' : 'There is no screen at this address.'}</p>
            <div className="row" style={{ justifyContent: 'center' }}>
              <a className="btn p" href={home}>Go to your home</a>
            </div>
          </div>
        </main>
      </div>
    </RoleCtx.Provider>
  );
}
