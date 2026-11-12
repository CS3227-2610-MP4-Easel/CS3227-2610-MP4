// canary:f5e57190b6213c10583d34d0ca951067
// Adapter for plan lite-r2 (2026-11-03-pilot-pinned-note.md).
// The plan's backend (src/be/notes) needs real PostgreSQL, so the only in-memory layer with real note logic
// is the front-end data layer of T5. Drives:
//   - src/fe/lib/api/index.ts: createEpic_17 (existing), listEpicNotes_58(epicId, page),
//     createEpicNote_59(epicId, body, pinned), updateEpicNote_60(noteId, version, {pinned}) for PM calls.
//   - Developer writes: the data layer has no role argument, so the role gate is exercised through the
//     plan's route layer instead: createApiApp(deps, { epicNotes }) from src/be/api/src/app.ts with fake
//     auth dependencies and a stub EpicNotes service; the real policy map entries 59/60 (roles ["PM"])
//     decide 403 vs. pass-through.
// Assumptions: the FE note has `body` (or `text`), `pinned`, `version`; list returns an array or { items }.
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const planFiles = [
  'src/be/db/prisma/schema.prisma', 'src/be/db/prisma/migrations/20261103000000_epic_notes',
  'src/be/db/src/visibility.ts', 'src/be/db/test/schema-parity.test.ts', 'src/be/db/test/epic-notes-schema.test.ts',
  'src/be/contracts/src/schemas.ts', 'src/be/contracts/src/epic-notes.ts', 'src/be/contracts/src/index.ts',
  'src/be/contracts/src/authorization.ts', 'src/be/contracts/src/policy.ts', 'src/be/contracts/src/openapi-schemas.ts',
  'docs/architecture/contracts.md', 'src/be/contracts/test/policy.test.ts', 'src/be/contracts/test/epic-notes.test.ts',
  'src/be/notes', 'tsconfig.json',
  'src/be/api/src/routes/epic-notes.ts', 'src/be/api/src/app.ts', 'src/be/api/src/routes/index.ts',
  'src/be/api/test/epic-notes-routes.test.ts', 'src/be/api/test/log-redaction.test.ts',
  'src/be/api/test/authorization-matrix.test.ts', 'src/be/api/test/openapi-parity.test.ts',
  'src/fe/lib/api/types.ts', 'src/fe/lib/api/store.ts', 'src/fe/lib/api/fixtures.ts', 'src/fe/lib/api/index.ts',
  'tests/fe-epic-notes-api.test.ts',
  'src/fe/components/canvas/EpicDetail.tsx', 'src/fe/components/canvas/EpicDetailPM.tsx',
  'src/fe/components/screens-index.ts', 'src/fe/lib/screens.ts', 'src/fe/components/canvas/Backlog.tsx',
  'src/fe/components/canvas/BacklogPM.tsx', 'src/fe/components/canvas/BacklogDev.tsx', 'src/fe/scripts/smoke.mjs',
  'workflow/project-state/branch-states/pilot-pinned-note.md', 'workflow/plans/2026-11-03-pilot-pinned-note.md',
];

const EPIC_UUID = '00000000-0000-4000-8000-000000000001';
const fail = (reason) => ({ ok: false, data: null, reason });
const good = (data) => ({ ok: true, data, reason: '' });

function reasonOf(e) {
  const code = String(e?.code ?? e?.name ?? '');
  if (/FORBIDDEN/i.test(code)) return 'forbidden';
  if (/NOT_FOUND/i.test(code)) return 'not_found';
  if (/VALIDATION|INVALID|BAD_REQUEST/i.test(code)) return 'invalid';
  return 'other';
}
const view = (n) => ({ id: n.id, text: n.body ?? n.text, pinned: Boolean(n.pinned) });

export async function createHarness(root, { clock }) {
  const load = (p) => import(pathToFileURL(path.join(root, p)).href);
  const fe = await load('src/fe/lib/api/index.ts');
  let seq = 0;

  // Run fn with Date driven by the injected clock so same-millisecond notes order deterministically.
  async function timed(fn) {
    const Real = globalThis.Date;
    globalThis.Date = class extends Real {
      constructor(...a) { a.length ? super(...a) : super(clock.tick()); }
      static now() { return clock.tick(); }
    };
    try { return good(await fn()); } catch (e) { return fail(reasonOf(e)); } finally { globalThis.Date = Real; }
  }

  // Developer writes go through the plan's route layer so the real policy map decides.
  async function gate(role, method, urlPath, body) {
    const { createApiApp } = await load('src/be/api/src/app.ts');
    const stubNote = { id: EPIC_UUID, epicId: EPIC_UUID, projectId: EPIC_UUID, body: 'x', pinned: false, authorId: EPIC_UUID, authorName: 'x', createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString(), version: 1 };
    const deps = {
      resolvePrincipal: async (a) => { if (!a) throw new Error('UNAUTHENTICATED'); return { firebaseUid: a, tokenClaims: {} }; },
      lookupRegisteredUser: async (uid) => ({ firebaseUid: uid, userId: EPIC_UUID, role: uid === 'pm' ? 'PM' : 'DEVELOPER' }),
      resolveResource: async (op) => ({ kind: op === 'EPIC_NOTE_UPDATE' ? 'EPIC_NOTE' : 'EPIC', projectId: EPIC_UUID, state: 'ACTIVE' }),
      requireMember: async () => undefined,
      evaluatePredicate: async () => undefined,
    };
    const epicNotes = { list: async () => ({ items: [], page: 0, size: 20, total: 0 }), create: async () => stubNote, update: async () => stubNote };
    const app = createApiApp(deps, { epicNotes });
    const res = await app.request(`http://localhost${urlPath}`, { method, headers: { authorization: role === 'PM' ? 'pm' : 'dev', 'content-type': 'application/json' }, body: JSON.stringify(body) });
    if (res.status === 403) return fail('forbidden');
    if (res.status === 404) return fail('not_found');
    if (res.status === 400 || res.status === 422) return fail('invalid');
    return res.status < 300 ? good(null) : fail('other');
  }

  const list = async (epicId) => {
    const r = await fe.listEpicNotes_58(epicId, 0);
    return (Array.isArray(r) ? r : r.items).map((n) => ({ ...view(n), version: n.version }));
  };

  return {
    async createEpic() {
      return timed(async () => ({ id: (await fe.createEpic_17(`Epic ${++seq} ${Date.now()}`, '', null)).id }));
    },
    async createNote({ role, epicId, text }) {
      if (role !== 'PM') {
        const g = await gate(role, 'POST', `/api/epics/${EPIC_UUID}/notes`, { body: text });
        return g.ok ? good({ id: '', text, pinned: false }) : g;
      }
      return timed(async () => view(await fe.createEpicNote_59(epicId, text, false)));
    },
    async listNotes({ role, epicId }) {
      return timed(async () => (await list(epicId)).map(({ id, text, pinned }) => ({ id, text, pinned })));
    },
    async pinNote({ role, epicId, noteId }) {
      if (role !== 'PM') {
        const g = await gate(role, 'PATCH', `/api/epic-notes/${EPIC_UUID}`, { version: 1, pinned: true });
        return g.ok ? good({ id: noteId }) : g;
      }
      return timed(async () => {
        const note = (await list(epicId)).find((n) => n.id === noteId);
        if (!note) { const e = new Error('Note not found.'); e.code = 'NOT_FOUND'; throw e; }
        const out = await fe.updateEpicNote_60(noteId, note.version, { pinned: true });
        return { id: out.id };
      });
    },
  };
}
