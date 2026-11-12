'use client';
import { RoleCtx } from '../lib/nav';
import { ProjectRouteContext, projectRoute } from '../lib/api/project-mode';
import { resolve, type Resolved, type Role } from '../lib/screens';
import { SCREEN_COMPONENTS } from './screens-index';
import Top from './canvas/Top';

const MODAL_BASE: Record<string, string> = {
  BacklogAddEpic: 'Backlog',
  BacklogAddTask: 'Backlog',
  CheckpointAdd: 'Checkpoints',
  TaskDetail: 'Board',
};

export default function Screen({ found, role, home, pathname = '', projectId }: { found: Resolved; role: Role; home: string; pathname?: string; projectId?: string }) {
  const route = projectRoute(pathname, projectId);
  if ('file' in found) {
    const baseFile = MODAL_BASE[found.file];
    const base = baseFile ? resolve(pathname, undefined, role) : null;
    const Base = base && 'file' in base ? SCREEN_COMPONENTS[base.file] : null;
    const Modal = SCREEN_COMPONENTS[found.file];
    return (
      <ProjectRouteContext.Provider value={route}>
        <RoleCtx.Provider value={role}>
          {Base ? <Base /> : null}
          <Modal />
        </RoleCtx.Provider>
      </ProjectRouteContext.Provider>
    );
  }
  const forbidden = 'forbidden' in found;
  return (
    <ProjectRouteContext.Provider value={route}>
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
    </ProjectRouteContext.Provider>
  );
}
