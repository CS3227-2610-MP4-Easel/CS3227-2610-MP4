// canary:f5e57190b6213c10583d34d0ca951067
// Acceptance adapter for plan full-r2 (pinned epic notes, endpoints 58-60).
// Layer: HTTP. Drives the plan's Hono app in-process (app.request) on top of the plan's REAL service.
// Relies on (paths as in the plan):
//   src/be/api/src/app.ts          createApiApp(deps?, services?)  -> services.epicNotes registers routes 58-60
//   src/be/core/src/epic-notes.ts  createEpicNoteService({ db, requireMember }) incl. epicNoteResolvers
// The plan has no in-memory storage: its service needs a Prisma-like db with withEpicLock(epicId, cb).
// ASSUMPTION: this adapter supplies a small in-memory Prisma-like fake (epic, project, epicNote tables:
// findFirst/findUnique/findMany/count/create/update/updateMany; timestamps from the harness clock).
// Auth uses AuthDependencies doubles (the plan's "W1 dependency doubles"): "Bearer pm" / "Bearer dev".
// Wire format per the plan's api.md: body field is `body` (adapter maps it to/from `text`), PATCH {version, pinned}.
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';

export const planFiles = [
  'src/be/contracts/src/schemas.ts', 'src/be/contracts/src/policy.ts', 'src/be/contracts/src/openapi-schemas.ts',
  'src/be/contracts/src/authorization.ts', 'src/be/contracts/src/routes.ts', 'src/be/contracts/src/index.ts',
  'src/be/contracts/src/epic-notes.ts', 'src/be/contracts/test/frozen-interfaces.test.ts',
  'src/be/contracts/test/policy.test.ts', 'src/be/contracts/test/epic-note-schemas.test.ts',
  'src/be/api/test/openapi-parity.test.ts', 'src/be/api/test/authorization-matrix.test.ts',
  'src/be/api/src/routes/epic-notes.ts', 'src/be/api/src/app.ts', 'src/be/api/src/errors.ts',
  'src/be/api/src/routes/register.ts', 'src/be/api/test/epic-notes-routes.test.ts',
  'src/be/api/test/epic-notes-security.test.ts', 'src/be/api/test/import-rules.test.ts',
  'src/be/api/test/authorization-project-scope.test.ts',
  'src/be/db/prisma/schema.prisma', 'src/be/db/prisma/migrations/20261104000000_epic_notes',
  'src/be/db/src/visibility.ts', 'src/be/db/src/locks.ts', 'src/be/db/src/index.ts', 'src/be/db/src/client.ts',
  'src/be/db/test/schema-parity.test.ts', 'src/be/db/test/raw-query-boundary.test.ts',
  'src/be/db/test/visibility-integration.test.ts', 'src/be/db/test/epic-notes-migration.test.ts',
  'src/be/core', 'tsconfig.json', 'package.json',
  'src/fe/lib/api/types.ts', 'src/fe/lib/api/store.ts', 'src/fe/lib/api/fixtures.ts', 'src/fe/lib/api/index.ts',
  'src/fe/lib/api/epic-notes.data.test.ts', 'src/fe/scripts/check-data-layer.mjs',
  'src/fe/components/live/epic-notes.tsx', 'src/fe/components/live/epic-notes.ui.test.tsx',
  'src/fe/components/live/backlog-list.tsx', 'src/fe/app/[[...slug]]/page.tsx', 'src/fe/lib/screens.ts',
  'src/fe/lib/epic-notes-access.ts', 'src/fe/scripts/linkcheck.mjs', 'src/fe/scripts/smoke.mjs',
  'workflow/plans/2026-11-04-pilot-pinned-note-plan.md', 'workflow/project-state/branch-states/pinned-notes.md',
];

const PM_ID = randomUUID();
const DEV_ID = randomUUID();
const PROJECT_ID = randomUUID();
const USERS = { pm: { userId: PM_ID, role: 'PM' }, dev: { userId: DEV_ID, role: 'DEVELOPER' } };

// ---- minimal in-memory Prisma-like db -------------------------------------------------------
function matches(row, where, db) {
  return Object.entries(where ?? {}).every(([k, v]) => {
    if (k === 'AND') return [].concat(v).every((w) => matches(row, w, db));
    if (k === 'OR') return v.some((w) => matches(row, w, db));
    if (k === 'NOT') return ![].concat(v).some((w) => matches(row, w, db));
    if (k === 'project') return matches(db.project.rows.find((p) => p.id === row.projectId) ?? {}, v, db);
    if (k === 'epic') return matches(db.epic.rows.find((e) => e.id === row.epicId) ?? {}, v, db);
    const x = row[k];
    if (v && typeof v === 'object' && !(v instanceof Date)) {
      if ('not' in v) return x !== v.not;
      if ('in' in v) return v.in.includes(x);
      if ('equals' in v) return x === v.equals;
      return true;
    }
    return x === v;
  });
}
function table(db, name, clock, softDelete) {
  const t = {
    rows: [],
    _vis: (w) => (r) => (!softDelete || r.deletedAt == null) && matches(r, w, db),
    _out(r) {
      if (!r) return null;
      const out = { ...r };
      if (name === 'epic') out.project = db.project.rows.find((p) => p.id === r.projectId);
      if (name === 'epicNote') out.epic = db.epic.rows.find((e) => e.id === r.epicId);
      return out;
    },
    async findFirst(a = {}) {
      const rows = t._sorted(t.rows.filter(t._vis(a.where)), a.orderBy);
      return t._out(rows[0]);
    },
    async findUnique(a) { return t.findFirst(a); },
    async findFirstOrThrow(a) { const r = await t.findFirst(a); if (!r) throw new Error('NOT_FOUND'); return r; },
    async findUniqueOrThrow(a) { return t.findFirstOrThrow(a); },
    async findMany(a = {}) {
      const rows = t._sorted(t.rows.filter(t._vis(a.where)), a.orderBy);
      return rows.slice(a.skip ?? 0, a.take == null ? undefined : (a.skip ?? 0) + a.take).map(t._out);
    },
    async count(a = {}) { return t.rows.filter(t._vis(a.where)).length; },
    async create(a) {
      const now = new Date(clock.tick());
      const row = { id: randomUUID(), pinned: false, version: 1, deletedAt: null, createdAt: now, updatedAt: now, ...a.data };
      t.rows.push(row);
      return t._out(row);
    },
    _apply(r, data) {
      for (const [k, v] of Object.entries(data)) r[k] = v && typeof v === 'object' && 'increment' in v ? r[k] + v.increment : v;
      if (!('updatedAt' in data)) r.updatedAt = new Date(clock.tick());
    },
    async update(a) {
      const r = t.rows.filter(t._vis(a.where))[0];
      if (!r) throw new Error('NOT_FOUND');
      t._apply(r, a.data);
      return t._out(r);
    },
    async updateMany(a) {
      const hit = t.rows.filter(t._vis(a.where));
      hit.forEach((r) => t._apply(r, a.data));
      return { count: hit.length };
    },
    _sorted(rows, orderBy) {
      const keys = [].concat(orderBy ?? []).flatMap((o) => Object.entries(o));
      return [...rows].sort((p, q) => {
        for (const [k, dir] of keys) {
          const [a, b] = [p[k] instanceof Date ? +p[k] : p[k], q[k] instanceof Date ? +q[k] : q[k]];
          if (a !== b) return (a > b ? 1 : -1) * (dir === 'desc' ? -1 : 1);
        }
        return 0;
      });
    },
  };
  return t;
}
function makeDb(clock) {
  const db = {};
  db.project = table(db, 'project', clock, false);
  db.epic = table(db, 'epic', clock, true);
  db.epicNote = table(db, 'epicNote', clock, true);
  let chain = Promise.resolve();
  db.withEpicLock = (epicId, cb) => {
    const run = chain.then(async () => {
      if (!db.epic.rows.some((e) => e.id === epicId && e.deletedAt == null)) throw new Error('NOT_FOUND');
      return cb(db);
    });
    chain = run.catch(() => undefined);
    return run;
  };
  return db;
}

// ---- harness --------------------------------------------------------------------------------
const load = (root, rel) => import(pathToFileURL(path.join(root, rel)).href);
const reasonOf = (status) => (status === 403 ? 'forbidden' : status === 404 ? 'not_found' : [400, 413, 422].includes(status) ? 'invalid' : 'other');

export async function createHarness(root, { clock }) {
  const { createApiApp } = await load(root, 'src/be/api/src/app.ts');
  const { createEpicNoteService } = await load(root, 'src/be/core/src/epic-notes.ts');
  const db = makeDb(clock);
  db.project.rows.push({ id: PROJECT_ID, status: 'ACTIVE', deletedAt: null });
  const members = new Set([PM_ID, DEV_ID]);
  const requireMember = async (userId, projectId) => {
    if (projectId !== PROJECT_ID || !members.has(userId)) throw new Error('NOT_FOUND');
  };
  const service = createEpicNoteService({ db, requireMember });
  const deps = {
    resolvePrincipal: async (h) => {
      const who = /^Bearer (pm|dev)$/.exec(h ?? '')?.[1];
      if (!who) throw new Error('UNAUTHENTICATED');
      return { firebaseUid: who, tokenClaims: {} };
    },
    lookupRegisteredUser: async (uid) => ({ firebaseUid: uid, ...USERS[uid] }),
    resolveResource: async (op, req, tx) => service.epicNoteResolvers[op](op, req, tx),
    requireMember,
    evaluatePredicate: async () => undefined,
  };
  const app = createApiApp(deps, { epicNotes: service });

  async function call(role, method, url, payload) {
    const headers = { authorization: role === 'PM' ? 'Bearer pm' : 'Bearer dev' };
    if (payload !== undefined) headers['content-type'] = 'application/json';
    const res = await app.request(url, { method, headers, ...(payload !== undefined ? { body: JSON.stringify(payload) } : {}) });
    let json = null;
    try { json = await res.json(); } catch { /* no body */ }
    if (res.status >= 400) return { ok: false, data: null, reason: reasonOf(res.status) };
    return { ok: true, data: json, reason: '' };
  }
  const toNote = (n) => ({ id: n.id, text: n.body, pinned: n.pinned });
  const listRaw = (role, epicId) => call(role, 'GET', `/api/epics/${epicId}/notes?page=0&size=100`);

  return {
    async createEpic() {
      const id = randomUUID();
      db.epic.rows.push({ id, projectId: PROJECT_ID, title: 'Epic', deletedAt: null, version: 1, createdAt: new Date(clock.tick()), updatedAt: new Date(clock.tick()) });
      return { ok: true, data: { id }, reason: '' };
    },
    async createNote({ role, epicId, text }) {
      const r = await call(role, 'POST', `/api/epics/${epicId}/notes`, { body: text });
      return r.ok ? { ...r, data: toNote(r.data) } : r;
    },
    async listNotes({ role, epicId }) {
      const r = await listRaw(role, epicId);
      return r.ok ? { ...r, data: r.data.items.map(toNote) } : r;
    },
    async pinNote({ role, epicId, noteId }) {
      // PATCH needs the current version: read it from the list (PM view) first.
      const cur = await listRaw('PM', epicId);
      const version = cur.ok ? (cur.data.items.find((n) => n.id === noteId)?.version ?? 1) : 1;
      const r = await call(role, 'PATCH', `/api/epic-notes/${noteId}`, { version, pinned: true });
      return r.ok ? { ...r, data: { id: r.data.id } } : r;
    },
  };
}
