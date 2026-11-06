// canary:f5e57190b6213c10583d34d0ca951067
// The host child of the shared runner (F9). It runs in the verify tree, loads the plan's adapter (and through it the
// agent's modules) and answers calls from the parent over the IPC channel. It decides nothing: whatever it returns is
// a plain value, and anything else it prints or writes is ignored by the parent. It never reads checks.json.
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const arg = (name) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : undefined; };
const adapterPath = arg('adapter');
const root = arg('root');

const clock = (() => {
  let now = Date.UTC(2026, 0, 1);
  return { now: () => now, tick: () => { now += 1; return now; } };
})();

const MISSING = new Set(['ERR_MODULE_NOT_FOUND', 'MODULE_NOT_FOUND']);
const describe = (e) => ({ name: String(e?.name ?? 'Error'), moduleMissing: MISSING.has(e?.code) });

let harness = null;
let initError = null;
try {
  const mod = await import(pathToFileURL(path.resolve(adapterPath)).href);
  if (typeof mod.createHarness !== 'function') throw new TypeError('createHarness is not exported');
  harness = await mod.createHarness(root, { clock });
} catch (e) {
  initError = describe(e);
}

process.on('message', async (msg) => {
  const { id, method, args } = msg ?? {};
  const reply = (body) => process.send({ id, ...body });
  if (initError) { reply({ error: initError }); return; }
  try {
    if (typeof harness?.[method] !== 'function') throw new TypeError(`no method ${method}`);
    reply({ result: await harness[method](...(Array.isArray(args) ? args : [])) });
  } catch (e) {
    reply({ error: describe(e) });
  }
});
process.send({ ready: true });
