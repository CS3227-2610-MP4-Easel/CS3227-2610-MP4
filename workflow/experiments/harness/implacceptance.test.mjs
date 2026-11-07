// T5: the shared runner (parent) and host (child). Toy adapters are written into each test's own temp folder;
// the tests run the real acceptance/runner.mjs by path.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { put, tmpDir } from './testkit.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const RUNNER = path.join(here, '..', 'tasks', 'pilot-pinned-note-impl', 'acceptance', 'runner.mjs');

const CHECKS = [
  { id: 'CHK1', required: true, requirement: 'create' }, { id: 'CHK2', required: true, requirement: 'newest first' },
  { id: 'CHK3', required: true, requirement: 'pinned first' }, { id: 'CHK4', required: true, requirement: 'one pin' },
  { id: 'CHK5', required: false, requirement: 'developer cannot' }, { id: 'CHK6', required: true, requirement: 'text unchanged' },
  { id: 'CHK7', required: false, requirement: 'not found' }, { id: 'CHK8', required: false, requirement: 'empty rejected' },
];

/** A correct in-memory adapter: PM only, newest first by clock.tick(), one pin per epic. `body` can tweak it. */
const adapter = (tweak = '') => `
export const planFiles = ['src/toy.mjs'];
export async function createHarness(root, { clock }) {
  const epics = new Map();
  let seq = 0;
  const fail = (reason) => ({ ok: false, data: null, reason });
  const ok = (data) => ({ ok: true, data, reason: '' });
  const h = {
    createEpic: async () => { const id = 'e' + (++seq); epics.set(id, []); return ok({ id }); },
    createNote: async ({ role, epicId, text }) => {
      if (role !== 'PM') return fail('forbidden');
      if (!epics.has(epicId)) return fail('not_found');
      if (typeof text !== 'string' || text.trim() === '') return fail('invalid');
      const note = { id: 'n' + (++seq), text, pinned: false, at: clock.tick() };
      epics.get(epicId).push(note);
      return ok({ id: note.id, text: note.text, pinned: false });
    },
    listNotes: async ({ epicId }) => {
      const notes = [...(epics.get(epicId) ?? [])].sort((a, b) => (b.pinned - a.pinned) || (b.at - a.at));
      return ok(notes.map(({ id, text, pinned }) => ({ id, text, pinned })));
    },
    pinNote: async ({ role, epicId, noteId }) => {
      if (role !== 'PM') return fail('forbidden');
      const notes = epics.get(epicId) ?? [];
      const target = notes.find((n) => n.id === noteId);
      if (!target) return fail('not_found');
      for (const n of notes) n.pinned = n === target;
      return ok({ id: target.id });
    },
  };
  ${tweak}
  return h;
}
`;

function run(source, { checks = CHECKS, root = tmpDir('exp-root-'), extra = [], timeoutMs = 60000 } = {}) {
  const dir = tmpDir('exp-acc-');
  put(path.join(dir, 'adapter.mjs'), source);
  put(path.join(dir, 'checks.json'), checks);
  const r = spawnSync(process.execPath, [RUNNER, '--adapter', path.join(dir, 'adapter.mjs'), '--checks', path.join(dir, 'checks.json'), '--root', root, '--call-timeout-ms', '4000', ...extra],
    { cwd: root, encoding: 'utf8', timeout: timeoutMs });
  const lines = r.stdout.trim().split(/\r?\n/);
  let verdicts = null;
  try { verdicts = JSON.parse(lines[lines.length - 1]); } catch { /* reported by the assertions */ }
  return { ...r, verdicts, dir };
}
const statuses = (v) => Object.fromEntries(Object.entries(v).map(([k, x]) => [k, x.status]));

test('F9: a correct adapter passes CHK1 to CHK8 and the output is one JSON object of {status, message}', () => {
  const r = run(adapter());
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(statuses(r.verdicts), Object.fromEntries(CHECKS.map((c) => [c.id, 'pass'])));
  for (const v of Object.values(r.verdicts)) assert.equal(typeof v.message, 'string');
});

test('E54: an adapter importing a module the build did not create gives error with "module missing"', () => {
  const r = run(adapter("await import('./does-not-exist.mjs');"));
  for (const id of ['CHK1', 'CHK2', 'CHK3', 'CHK4', 'CHK5', 'CHK6', 'CHK7', 'CHK8']) {
    assert.equal(r.verdicts[id].status, 'error', id);
    assert.equal(r.verdicts[id].message, 'module missing', id);
  }
  const top = run("import './nope.mjs'; export const planFiles = [];");
  assert.equal(top.verdicts.CHK1.message, 'module missing');
});

test('E55: a throwing method gives error with the error name only; an omitted id and a missing check logic are errors', () => {
  const r = run(adapter("h.listNotes = async () => { throw new TypeError('secret detail'); };"));
  assert.equal(r.verdicts.CHK1.status, 'error');
  assert.equal(r.verdicts.CHK1.message, 'TypeError');
  assert.ok(!r.stdout.includes('secret detail'));
  const extra = run(adapter(), { checks: [...CHECKS, { id: 'CHK9', required: true, requirement: 'x' }] });
  assert.equal(extra.verdicts.CHK9.status, 'error');
  assert.equal(extra.verdicts.CHK1.status, 'pass');
});

test('E55, E58: a host that exits at once, or prints verdict-shaped JSON, cannot decide anything', () => {
  const dead = run(adapter('process.exit(0);'));
  for (const c of CHECKS) assert.equal(dead.verdicts[c.id].status, 'error', c.id);
  const forged = run(adapter("console.log(JSON.stringify({ CHK1: { status: 'pass', message: '' }, CHK2: { status: 'pass', message: '' } })); h.createNote = async () => ({ ok: false, data: null, reason: 'invalid' });"));
  assert.equal(forged.verdicts.CHK1.status, 'fail', 'what the host prints is ignored; the values it returns decide');
  assert.equal(forged.verdicts.CHK2.status, 'fail');
});

test('E56: an informational failure is a fail with its own status; the required flag stays in checks.json, not in the verdict', () => {
  const r = run(adapter("const original = h.createNote; h.createNote = async (a) => (a.role === 'Developer' ? { ok: true, data: { id: 'x', text: a.text, pinned: false }, reason: '' } : original(a));"));
  assert.equal(r.verdicts.CHK5.status, 'fail');
  assert.equal(r.verdicts.CHK1.status, 'pass');
  assert.ok(!('required' in r.verdicts.CHK5));
});

test('E60: notes created in the same millisecond are ordered by clock.tick() (CHK2)', () => {
  const r = run(adapter());
  assert.equal(r.verdicts.CHK2.status, 'pass');
  const broken = run(adapter('h.createNote = ((orig) => async (a) => { const res = await orig(a); return res; })(h.createNote); h.listNotes = async ({ epicId }) => ({ ok: true, data: [], reason: "" });'));
  assert.equal(broken.verdicts.CHK2.status, 'fail');
});

test('E61: CHK4 fails when the second pin is rejected', () => {
  const r = run(adapter("const orig = h.pinNote; const pinned = new Set(); h.pinNote = async (a) => { if (pinned.has(a.epicId)) return { ok: false, data: null, reason: 'invalid' }; pinned.add(a.epicId); return orig(a); };"));
  assert.equal(r.verdicts.CHK4.status, 'fail');
  assert.match(r.verdicts.CHK4.message, /second pin/);
});

test('CHK3 fails when a newer note is listed before the pinned one; CHK6 fails when text is altered', () => {
  const r = run(adapter("h.pinNote = async () => ({ ok: true, data: {}, reason: '' });"));
  assert.equal(r.verdicts.CHK3.status, 'fail');
  const altered = run(adapter("const orig = h.createNote; h.createNote = async (a) => orig({ ...a, text: a.text.replace(/</g, '&lt;') });"));
  assert.equal(altered.verdicts.CHK6.status, 'fail');
});

test('E59: an adapter that tests a service layer for a plan with no route passes the same checks', () => {
  const service = `
export const planFiles = ['src/be/api/notes-service.ts'];
export async function createHarness() {
  const { makeService } = await import(${JSON.stringify('data:text/javascript,export const makeService=()=>({})')});
  const svc = makeService();
  const store = new Map(); let n = 0; let clockTick = 0;
  const ok = (data) => ({ ok: true, data, reason: '' });
  return {
    createEpic: async () => { const id = 'epic-' + (++n); store.set(id, []); return ok({ id }); },
    createNote: async ({ role, epicId, text }) => {
      if (role !== 'PM') return { ok: false, data: null, reason: 'forbidden' };
      if (!store.has(epicId)) return { ok: false, data: null, reason: 'not_found' };
      if (!text) return { ok: false, data: null, reason: 'invalid' };
      const note = { id: 'n' + (++n), text, pinned: false, t: ++clockTick }; store.get(epicId).push(note); return ok({ id: note.id, text, pinned: false });
    },
    listNotes: async ({ epicId }) => ok([...store.get(epicId)].sort((a, b) => (b.pinned - a.pinned) || (b.t - a.t))),
    pinNote: async ({ epicId, noteId }) => { const ns = store.get(epicId); for (const x of ns) x.pinned = x.id === noteId; return ok({}); },
  };
}
`;
  const r = run(service);
  assert.deepEqual(statuses(r.verdicts), Object.fromEntries(CHECKS.map((c) => [c.id, 'pass'])));
});

test('a host that hangs past the call timeout makes the check error without hanging the runner', () => {
  const r = run(adapter("h.createEpic = () => new Promise(() => {});"), { timeoutMs: 90000 });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.verdicts.CHK1.status, 'error');
});
