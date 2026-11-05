// canary:f5e57190b6213c10583d34d0ca951067
// The shared runner (F9): the PARENT. It lives outside the verify tree, starts host.mjs as a child in the verify tree,
// drives the adapter methods over IPC, and decides every verdict itself from the plain values it receives.
// Usage: node runner.mjs --adapter <abs> --checks <abs checks.json> --root <verify-tree root> [--call-timeout-ms n]
// Output: ONE line of JSON on stdout, {CHK<n>: {status: 'pass'|'fail'|'error', message}}.
import { execFile, fork } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const arg = (name, dflt) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : dflt; };
const adapter = arg('adapter');
const checksFile = arg('checks');
const root = arg('root');
const CALL_TIMEOUT_MS = Number(arg('call-timeout-ms', '20000'));
if (!adapter || !checksFile || !root) { console.error('usage: runner.mjs --adapter <path> --checks <path> --root <dir>'); process.exit(2); }

const checks = JSON.parse(fs.readFileSync(checksFile, 'utf8'));
const hostFile = path.join(path.dirname(fileURLToPath(import.meta.url)), 'host.mjs');
// The host needs the loader tsx for TypeScript; plain Node is enough for a .mjs adapter.
const execArgv = fs.existsSync(path.join(root, 'node_modules', 'tsx', 'package.json')) ? ['--import', 'tsx'] : [];

// ---- host process ---------------------------------------------------------------------------------------------

class HostError extends Error {}
const host = fork(hostFile, ['--adapter', adapter, '--root', root], { cwd: root, execArgv, stdio: ['ignore', 'ignore', 'ignore', 'ipc'], windowsHide: true });
let exited = false;
let nextId = 0;
const pending = new Map();
host.on('exit', () => {
  exited = true;
  for (const { reject } of pending.values()) reject(new HostError('host exited'));
  pending.clear();
});
host.on('error', () => { exited = true; });
host.on('message', (msg) => {
  if (!msg || typeof msg !== 'object' || !pending.has(msg.id)) return; // anything else the host sends is ignored
  const { resolve } = pending.get(msg.id);
  pending.delete(msg.id);
  resolve(msg);
});

function call(method, args) {
  if (exited) return Promise.reject(new HostError('host exited'));
  const id = (nextId += 1);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new HostError('timeout')); }, CALL_TIMEOUT_MS);
    pending.set(id, { resolve: (m) => { clearTimeout(timer); resolve(m); }, reject: (e) => { clearTimeout(timer); reject(e); } });
    try { host.send({ id, method, args }); } catch { pending.delete(id); clearTimeout(timer); reject(new HostError('host exited')); }
  });
}

/** A call that returns the plain {ok, data, reason} value, or throws a Verdict-ready Error. */
async function ask(method, args) {
  const msg = await call(method, args);
  if (msg.error) throw new Error(msg.error.moduleMissing ? 'module missing' : msg.error.name);
  const r = msg.result;
  if (r === null || typeof r !== 'object' || typeof r.ok !== 'boolean') throw new Error('malformed result');
  return r;
}

// ---- the checks (verdicts are decided here, from plain values) ----------------------------------------------------

const pass = (message = '') => ({ status: 'pass', message });
const fail = (message) => ({ status: 'fail', message: String(message).slice(0, 300) });
const text = (note) => (note && typeof note.text === 'string' ? note.text : null);

async function newEpic() {
  const e = await ask('createEpic', []);
  if (!e.ok || !e.data?.id) throw new Error('createEpic failed');
  return e.data.id;
}
const createNote = (epicId, body, role = 'PM') => ask('createNote', [{ role, epicId, text: body }]);
const list = async (epicId) => {
  const r = await ask('listNotes', [{ role: 'PM', epicId }]);
  if (!r.ok || !Array.isArray(r.data)) throw new Error('listNotes failed');
  return r.data;
};
const pin = (epicId, noteId) => ask('pinNote', [{ role: 'PM', epicId, noteId }]);

const LOGIC = {
  async CHK1() {
    const epic = await newEpic();
    const body = 'First note of the epic';
    const made = await createNote(epic, body);
    if (!made.ok) return fail(`the PM could not create a note (${made.reason})`);
    return (await list(epic)).some((n) => text(n) === body) ? pass() : fail('the created note is not in the epic list with the exact text');
  },
  async CHK2() {
    const epic = await newEpic();
    const a = await createNote(epic, 'Note A');
    const b = await createNote(epic, 'Note B');
    if (!a.ok || !b.ok) return fail('a note could not be created');
    const texts = (await list(epic)).map(text);
    return texts.indexOf('Note B') !== -1 && texts.indexOf('Note B') < texts.indexOf('Note A') ? pass() : fail(`the list order was ${JSON.stringify(texts)}, not B before A`);
  },
  async CHK3() {
    const epic = await newEpic();
    const a = await createNote(epic, 'Note A');
    const b = await createNote(epic, 'Note B');
    if (!a.ok || !b.ok || !a.data?.id) return fail('a note could not be created');
    const pinned = await pin(epic, a.data.id);
    if (!pinned.ok) return fail(`the PM could not pin note A (${pinned.reason})`);
    const first = (await list(epic))[0];
    return text(first) === 'Note A' ? pass() : fail(`the first note is ${JSON.stringify(text(first))}, not the pinned note A`);
  },
  async CHK4() {
    const epic = await newEpic();
    const a = await createNote(epic, 'Note A');
    const b = await createNote(epic, 'Note B');
    if (!a.ok || !b.ok || !a.data?.id || !b.data?.id) return fail('a note could not be created');
    const first = await pin(epic, a.data.id);
    if (!first.ok) return fail(`the first pin was rejected (${first.reason})`);
    const second = await pin(epic, b.data.id);
    if (!second.ok) return fail(`the second pin was rejected (${second.reason}); it must be accepted`);
    const pinnedCount = (await list(epic)).filter((n) => n?.pinned === true).length;
    return pinnedCount <= 1 ? pass() : fail(`${pinnedCount} notes are pinned`);
  },
  async CHK5() {
    const epic = await newEpic();
    const dev = await createNote(epic, 'A Developer note', 'Developer');
    return dev.ok ? fail('a Developer could create a note') : pass();
  },
  async CHK6() {
    const epic = await newEpic();
    const body = '<script>alert(1)</script>\nsecond line';
    const made = await createNote(epic, body);
    if (!made.ok) return fail(`the PM could not create the note (${made.reason})`);
    return (await list(epic)).some((n) => text(n) === body) ? pass() : fail('the text was not returned unchanged');
  },
  async CHK7() {
    const made = await createNote('no-such-epic-id', 'text');
    return !made.ok && made.reason === 'not_found' ? pass() : fail(made.ok ? 'a note was created on a missing epic' : `the reason was ${made.reason}, not not_found`);
  },
  async CHK8() {
    const epic = await newEpic();
    const made = await createNote(epic, '');
    return made.ok ? fail('a note with empty text was accepted') : pass();
  },
};

// ---- run ------------------------------------------------------------------------------------------------------------

const verdicts = {};
for (const c of checks) {
  try {
    verdicts[c.id] = LOGIC[c.id] ? await LOGIC[c.id]() : { status: 'error', message: 'no check logic' };
  } catch (e) {
    verdicts[c.id] = { status: 'error', message: String(e instanceof HostError || e instanceof Error ? e.message : 'error').slice(0, 300) };
  }
}
if (!exited) {
  if (process.platform === 'win32') execFile('taskkill', ['/PID', String(host.pid), '/T', '/F'], { windowsHide: true }, () => {});
  else host.kill('SIGKILL');
}
process.stdout.write(`${JSON.stringify(verdicts)}\n`);
setTimeout(() => process.exit(0), 300);
