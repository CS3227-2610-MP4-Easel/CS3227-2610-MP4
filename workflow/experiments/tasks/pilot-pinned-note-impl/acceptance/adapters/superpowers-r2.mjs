// canary:f5e57190b6213c10583d34d0ca951067
// Adapter for plan superpowers-r2 (docs/plans/2026-11-03-epic-notes.md).
// Layer driven: the HTTP routes of Task 4, in process through Hono `app.request`, with the plan's own
// shape of test: registerRoute (existing, src/be/api/src/routes/register.ts) + a fake auth `deps()` + an
// in-memory fake of the plan's `NoteRepo` { list, create, patch } defined here.
// Relies on src/be/api/src/routes/notes.ts exporting a factory that takes the NoteRepo and returns the three
// RouteDefinitions (the plan does not name it; any exported function that does so is used).
// Routes: GET/POST /api/epics/{id}/notes, PATCH /api/notes/{id}. Body field is `body`, list is `{ items }`.
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

export const planFiles = [
  'src/be/contracts/src/notes.ts', 'src/be/contracts/src/index.ts', 'src/be/contracts/test/notes.test.ts',
  'src/be/contracts/src/policy.ts', 'src/be/contracts/src/routes.ts',
  'src/be/db/prisma/schema.prisma', 'src/be/db/prisma/migrations', 'src/be/db/src/notes.ts', 'src/be/db/test/notes.test.ts',
  'src/be/api/src/routes/notes.ts', 'src/be/api/src/routes/index.ts', 'src/be/api/test/notes-route.test.ts',
  'src/fe/lib/api/types.ts', 'src/fe/lib/api/index.ts', 'src/fe/lib/api/store.ts', 'src/fe/lib/api/fixtures.ts',
  'src/fe/components/live/epic-notes.tsx', 'src/fe/components/live/epic-notes.test.tsx',
  'docs/architecture/contracts.md',
];

const load = (root, rel) => import(pathToFileURL(path.join(root, rel)).href);
const REASONS = { 403: 'forbidden', 404: 'not_found', 400: 'invalid', 422: 'invalid' };
const isRoute = (r) => r && typeof r === 'object' && typeof r.method === 'string' && typeof r.path === 'string' && typeof r.handler === 'function';
const asRoutes = (v) => {
  const list = Array.isArray(v) ? v : v && typeof v === 'object' ? Object.values(v) : [];
  return list.length > 0 && list.every(isRoute) ? list : null;
};

// In-memory NoteRepo following the plan's interface (pinned first, then createdAt desc; one pin per epic).
function fakeRepo(clock) {
  const notes = new Map();
  const unpinOthers = (epicId, keep) => { for (const n of notes.values()) if (n.epicId === epicId && n.id !== keep) n.pinned = false; };
  let seq = 0;
  return {
    notes,
    async list(epicId) {
      return [...notes.values()].filter((n) => n.epicId === epicId)
        .sort((a, b) => Number(b.pinned) - Number(a.pinned) || (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
        .map((n) => ({ ...n }));
    },
    async create(epicId, authorId, body, pinned) {
      const at = new Date(clock.tick()).toISOString();
      const note = { id: `n${++seq}`, epicId, projectId: 'p1', authorId, body, pinned: !!pinned, createdAt: at, updatedAt: at, version: 0 };
      if (note.pinned) unpinOthers(epicId, note.id);
      notes.set(note.id, note);
      return { ...note };
    },
    async patch(id, input) {
      const n = notes.get(id);
      if (!n) throw new Error('NOT_FOUND');
      if (n.version !== input.version) return 'STALE';
      if (input.body !== undefined) n.body = input.body;
      if (input.pinned !== undefined) { n.pinned = input.pinned; if (input.pinned) unpinOthers(n.epicId, id); }
      n.version += 1;
      n.updatedAt = new Date(clock.tick()).toISOString();
      return { ...n };
    },
  };
}

export async function createHarness(root, { clock }) {
  const register = await load(root, 'src/be/api/src/routes/register.ts');
  const errors = await load(root, 'src/be/api/src/errors.ts');
  const notesMod = await load(root, 'src/be/api/src/routes/notes.ts');
  const hono = await import(pathToFileURL(createRequire(path.join(root, 'src/be/api/package.json')).resolve('hono')).href);
  const Hono = hono.Hono ?? hono.default?.Hono ?? hono.default;

  const repo = fakeRepo(clock);
  const epics = new Set();
  const roleOf = { 'Bearer pm': 'PM', 'Bearer dev': 'DEVELOPER' };
  const tx = { commit: async () => undefined, rollback: async () => undefined };
  const deps = {
    resolvePrincipal: async (auth) => { if (!roleOf[auth]) throw new Error('UNAUTHENTICATED'); return { firebaseUid: auth, tokenClaims: {} }; },
    lookupRegisteredUser: async (uid) => ({ firebaseUid: uid, userId: uid === 'Bearer pm' ? 'pm1' : 'dev1', role: roleOf[uid] }),
    beginTransaction: async () => tx,
    resolveResource: async (_op, req) => {
      if (req.path.startsWith('/api/notes/')) {
        const n = repo.notes.get(req.params.id);
        if (!n) throw new Error('NOT_FOUND');
        return { kind: 'NOTE', projectId: 'p1', state: 'ACTIVE' };
      }
      if (!epics.has(req.params.id)) throw new Error('NOT_FOUND');
      return { kind: 'EPIC', projectId: 'p1', state: 'ACTIVE' };
    },
    requireMember: async () => undefined,
    evaluatePredicate: async () => undefined,
  };

  // Find the exported factory that turns a NoteRepo into the route definitions.
  const repoArg = Object.assign(Object.create(repo), { repo, noteRepo: repo });
  let routes = null;
  for (const fn of Object.values(notesMod).filter((v) => typeof v === 'function')) {
    try { routes = asRoutes(await fn(repoArg)); } catch { routes = null; }
    if (routes) break;
  }
  if (!routes) throw new Error('module missing: no export of routes/notes.ts builds the note routes from a repo');

  const app = new Hono();
  app.use('*', async (c, next) => { c.set('requestId', 'rid'); await next(); });
  app.onError((error, c) => errors.errorResponse(error, c.get('requestId')));
  for (const route of routes) register.registerRoute(app, route, deps);

  const call = async (role, method, url, body) => {
    const res = await app.request(`http://localhost${url}`, {
      method,
      headers: { authorization: role === 'PM' ? 'Bearer pm' : 'Bearer dev', 'content-type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const json = await res.json().catch(() => null);
    if (res.status < 400) return { ok: true, data: json, reason: '' };
    return { ok: false, data: json, reason: REASONS[res.status] ?? 'other' };
  };
  const view = (n) => ({ id: n.id, text: n.body, pinned: n.pinned });
  const wrap = (r, f) => (r.ok ? { ok: true, data: f(r.data), reason: '' } : r);

  return {
    async createEpic() { const id = `e${epics.size + 1}`; epics.add(id); return { ok: true, data: { id }, reason: '' }; },
    async createNote({ role, epicId, text }) {
      return wrap(await call(role, 'POST', `/api/epics/${epicId}/notes`, { body: text }), view);
    },
    async listNotes({ role, epicId }) {
      return wrap(await call(role, 'GET', `/api/epics/${epicId}/notes`), (d) => (Array.isArray(d) ? d : d.items).map(view));
    },
    async pinNote({ role, epicId, noteId }) {
      const note = repo.notes.get(noteId);
      if (!note || note.epicId !== epicId) return { ok: false, data: null, reason: 'not_found' };
      return wrap(await call(role, 'PATCH', `/api/notes/${noteId}`, { pinned: true, version: note.version }), (d) => ({ id: d.id }));
    },
  };
}
