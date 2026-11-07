// THROWAWAY (T2): runs the probes of the plan against the real Claude CLI and records raw output under
// workflow/experiments/local/spike/ (gitignored). Not part of the harness; deleted or left unused after T2.
// Usage: node run-spike.mjs [--limit 3] [--only a,b,...]
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EXP_ROOT, REPO_ROOT } from '../paths.mjs';

const arg = (name, dflt) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : dflt; };
const LIMIT = Number(arg('limit', '3'));
const ONLY = arg('only', '') ? arg('only').split(',') : null;
const MODEL = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'workflow', 'models.json'), 'utf8')).tiers.strong.claude;
const OUT = path.join(EXP_ROOT, 'local', 'spike');
const CLONE = path.resolve(REPO_ROOT, '..', 'exp-runs', 'spike-clone');
const BIN = 'claude'; // resolved by the OS to the native claude.exe
const SUPERPOWERS = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.claude', 'plugins', 'installed_plugins.json'), 'utf8'))
  .plugins['superpowers@superpowers-dev']?.[0]?.installPath;

fs.mkdirSync(OUT, { recursive: true });
let spent = 0;
const summary = {};

function prepareClone() {
  fs.rmSync(CLONE, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(CLONE), { recursive: true });
  execFileSync('git', ['clone', '-q', '--local', '--no-hardlinks', REPO_ROOT, CLONE]);
  execFileSync('git', ['remote', 'remove', 'origin'], { cwd: CLONE });
}

const BASE = ['-p', '--output-format', 'stream-json', '--verbose', '--setting-sources', 'project', '--strict-mcp-config', '--model', MODEL];

function probe(label, { prompt, cap, extra = [], env = {}, bin = BIN, shell = false }) {
  if (ONLY && !ONLY.includes(label[0])) return null;
  if (spent + cap > LIMIT) { summary[label] = { skipped: `would exceed the ${LIMIT} USD limit` }; return null; }
  const t0 = Date.now();
  const res = spawnSync(bin, [...BASE, '--max-budget-usd', String(cap), ...extra], {
    cwd: CLONE, input: prompt, encoding: 'utf8', env: { ...process.env, ...env }, timeout: 20 * 60 * 1000, shell,
    maxBuffer: 256 * 1024 * 1024,
  });
  fs.writeFileSync(path.join(OUT, `${label}.jsonl`), res.stdout ?? '');
  fs.writeFileSync(path.join(OUT, `${label}.err.txt`), `${res.stderr ?? ''}\n${res.error ?? ''}`);
  const events = (res.stdout ?? '').split('\n').filter(Boolean).flatMap((l) => { try { return [JSON.parse(l)]; } catch { return []; } });
  const init = events.find((e) => e.type === 'system' && e.subtype === 'init');
  const result = events.find((e) => e.type === 'result');
  const cost = result?.total_cost_usd ?? 0;
  spent += cost;
  summary[label] = {
    status: res.status, error: res.error ? String(res.error.code ?? res.error) : null, seconds: Math.round((Date.now() - t0) / 1000),
    event_types: events.reduce((m, e) => { const k = `${e.type}${e.subtype ? `/${e.subtype}` : ''}`; m[k] = (m[k] ?? 0) + 1; return m; }, {}),
    init_keys: init ? Object.keys(init) : null, session_id: init?.session_id ?? result?.session_id ?? null,
    result_keys: result ? Object.keys(result) : null, total_cost_usd: result?.total_cost_usd ?? null,
    result_subtype: result?.subtype ?? null, is_error: result?.is_error ?? null,
  };
  fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify({ model: MODEL, spent, limit: LIMIT, probes: summary }, null, 2));
  console.log(`${label}: exit ${res.status} cost ${cost} (total ${spent.toFixed(4)} of ${LIMIT})`);
  return { init, result, events };
}

prepareClone();
const ONE = 'Reply with exactly the word: ok';
const TOY = 'Do not ask the operator anything; state assumptions in the artifact. Task: add a `--shout` flag to a tiny hello-world CLI. Write the spec and the plan as files under docs/spike/. When done, end with a last line that is exactly EXP-DONE.';
const TOOLS = ['--allowedTools', 'Read,Write,Edit,Bash,Glob,Grep,Skill,Task,Agent', '--permission-mode', 'acceptEdits'];

const a = probe('a-isolation', { prompt: ONE, cap: 0.1 });
if (SUPERPOWERS) probe('b-plugin', { prompt: ONE, cap: 0.1, extra: ['--plugin-dir', SUPERPOWERS] });
if (a?.init?.session_id) probe('c-resume', { prompt: 'What word did you reply with before?', cap: 0.1, extra: ['--resume', a.init.session_id] });
probe('d-subagent', { prompt: 'Use the Agent tool to launch one general-purpose subagent that replies with the word ok. Then reply: done.', cap: 0.3, extra: TOOLS });
probe('g-otel', { prompt: ONE, cap: 0.1, env: { CLAUDE_CODE_ENABLE_TELEMETRY: '1', OTEL_METRICS_EXPORTER: 'console', OTEL_LOGS_EXPORTER: 'console', OTEL_METRIC_EXPORT_INTERVAL: '1000' } });
if (SUPERPOWERS) probe('e-superpowers', { prompt: `Use the superpowers brainstorming skill, then the writing-plans skill. ${TOY}`, cap: 0.6, extra: [...TOOLS, '--plugin-dir', SUPERPOWERS] });
probe('e-lite', { prompt: `Use the writing-specs-lite skill, then the writing-plans-lite skill, yourself. ${TOY}`, cap: 0.6, extra: TOOLS });
probe('e-full', { prompt: `Use the spec-writer agent for the spec, the reviewer agent (Implementer lens) once, then the planner agent for the plan. ${TOY}`, cap: 0.6, extra: TOOLS });

// (f) how Windows spawns an npm .cmd shim without a shell
const npmDir = process.env.APPDATA ? path.join(process.env.APPDATA, 'npm') : null;
const shim = npmDir && ['claude.cmd'].map((f) => path.join(npmDir, f)).find((f) => fs.existsSync(f));
if (!ONLY || ONLY.includes('f')) {
  if (shim) {
    const r = spawnSync(shim, ['--version'], { encoding: 'utf8' });
    summary['f-cmd-shim'] = { shim, status: r.status, error: r.error ? String(r.error.code ?? r.error) : null, stdout: (r.stdout ?? '').trim() };
  } else {
    summary['f-cmd-shim'] = { shim: null, note: 'no npm .cmd shim found' };
  }
  const native = spawnSync(BIN, ['--version'], { encoding: 'utf8' });
  summary['f-native'] = { status: native.status, stdout: (native.stdout ?? '').trim() };
}
fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify({ model: MODEL, spent, limit: LIMIT, probes: summary }, null, 2));
console.log(`done: spent ${spent.toFixed(4)} USD; raw output in ${OUT}`);
