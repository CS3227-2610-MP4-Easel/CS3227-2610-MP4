// F8, F10, F12, F15, N3 (T4): the harness-owned verify tree and the checks that run in it. The agent has Bash in its
// clone, so nothing in the clone is trusted except the bytes of the files it changed, and those are only copied.
import { spawn, execFile, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { scan } from './secrets.mjs';
import { cloneNameProblem, copyFileSafe, isSkippedName, walkClone, WALK_LIMITS } from './safefs.mjs';
import { killTree } from './spawn.mjs';
import { countTsErrors, parseTap } from './testparse.mjs';

const sha256 = (data) => createHash('sha256').update(data).digest('hex');
const LOCKFILES = new Set(['package-lock.json', 'npm-shrinkwrap.json', 'yarn.lock', 'pnpm-lock.yaml']);
const REGISTRY = 'https://registry.npmjs.org/';
const unlimited = { maxFileBytes: Number.MAX_SAFE_INTEGER, maxFiles: Number.MAX_SAFE_INTEGER, maxMs: Number.MAX_SAFE_INTEGER };

/** `**` crosses folders, `*` and `?` stay inside one; no other depth is implied. */
export function matchGlob(pattern, rel) {
  let re = '';
  for (let i = 0; i < pattern.length; i += 1) {
    const c = pattern[i];
    if (c === '*' && pattern[i + 1] === '*') {
      if (pattern[i + 2] === '/') { re += '(?:.*/)?'; i += 2; } else { re += '.*'; i += 1; }
    } else if (c === '*') re += '[^/]*';
    else if (c === '?') re += '[^/]';
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`).test(rel);
}

// ---- the pristine toolchain -----------------------------------------------------------------------------------

/** Hash of every file (path, size, bytes) and link (path, target relative to `root`) below `nmDir`. */
export function toolchainManifest(nmDir, root) {
  const lines = [];
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir).sort()) {
      const full = path.join(dir, name);
      const rel = path.relative(nmDir, full).split(path.sep).join('/');
      const st = fs.lstatSync(full);
      if (st.isSymbolicLink()) {
        const target = path.resolve(path.dirname(full), fs.readlinkSync(full));
        lines.push(`L ${rel} -> ${path.relative(root, target).split(path.sep).join('/')}`);
      } else if (st.isDirectory()) walk(full);
      else if (st.isFile()) lines.push(`F ${rel} ${st.size} ${sha256(fs.readFileSync(full))}`);
    }
  };
  if (fs.existsSync(nmDir)) walk(nmDir);
  return sha256(lines.sort().join('\n'));
}

/**
 * A copy of the pristine node_modules, never a link. npm workspaces install absolute junctions to the workspace
 * folders; those are recreated pointing into the same relative place of the new tree (never back at the baseline).
 */
export function copyToolchain(srcNm, destNm, srcRoot, destRoot) {
  const walk = (src, dest) => {
    fs.mkdirSync(dest, { recursive: true });
    for (const name of fs.readdirSync(src)) {
      const from = path.join(src, name);
      const to = path.join(dest, name);
      const st = fs.lstatSync(from);
      if (st.isSymbolicLink()) {
        const target = path.resolve(path.dirname(from), fs.readlinkSync(from));
        const inside = path.relative(srcRoot, target);
        if (inside.startsWith('..') || path.isAbsolute(inside)) throw new Error(`pristine node_modules link ${name} points outside the baseline tree`);
        fs.symlinkSync(path.join(destRoot, inside), to, 'junction');
      } else if (st.isDirectory()) walk(from, to);
      else if (st.isFile()) fs.copyFileSync(from, to);
    }
  };
  walk(srcNm, destNm);
}

// ---- lockfile validation (E97) ----------------------------------------------------------------------------------

/** The agent's lockfile may only resolve from registry.npmjs.org and may not alter any package the baseline has. */
export function validateLockfile(agentText, baseText) {
  const reasons = [];
  let agent;
  let base;
  try { agent = JSON.parse(agentText); } catch { return { ok: false, reasons: ['the lockfile is not valid JSON'] }; }
  try { base = JSON.parse(baseText); } catch { return { ok: false, reasons: ['the baseline lockfile is not valid JSON'] }; }
  if (!agent.packages || typeof agent.packages !== 'object') return { ok: false, reasons: ['the lockfile has no packages map (lockfileVersion 2 or 3 is required)'] };
  for (const [key, p] of Object.entries(agent.packages)) {
    if (key === '' || p?.link === true || p?.resolved === undefined) continue;
    if (typeof p.resolved !== 'string' || !p.resolved.startsWith(REGISTRY)) reasons.push(`${key} resolves outside ${REGISTRY}`);
  }
  for (const [key, b] of Object.entries(base.packages ?? {})) {
    if (key === '' || b?.link === true || b?.resolved === undefined) continue;
    const a = agent.packages[key];
    if (!a) reasons.push(`${key} was removed from the baseline lockfile`);
    else if (a.version !== b.version || a.integrity !== b.integrity) reasons.push(`${key} differs from the baseline lockfile in version or integrity`);
  }
  return { ok: reasons.length === 0, reasons };
}

function depsDiffer(baseText, agentText) {
  try {
    const pick = (t) => { const j = JSON.parse(t); return JSON.stringify([j.dependencies, j.devDependencies, j.peerDependencies, j.optionalDependencies, j.workspaces, j.overrides]); };
    return pick(baseText) !== pick(agentText);
  } catch { return true; }
}

// ---- the verify tree (F8) --------------------------------------------------------------------------------------

const sameBytes = (a, b) => a.length === b.length && a.equals(b);

/**
 * Build the verify tree in `scratch/verify` from harness-owned bytes. Returns
 * {dir, changed, deleted, plan_changed, protected_changed, flags, reasons, depsChanged}; `dir` is null and a flag is set
 * (`unsafe_path`, `unsafe_deps`) when the attempt is red before any check. Never runs git; never follows a link.
 * `planFiles` maps repo-relative path to the snapshot's bytes (the reference besides the baseline tree).
 */
export async function buildVerifyTree({ baselineTree, clone, planFiles, scratch, protectedGlobs = [], limits = WALK_LIMITS, install = defaultInstall, env }) {
  const out = { dir: null, changed: [], deleted: [], plan_changed: [], protected_changed: [], flags: [], reasons: [], depsChanged: false };
  const walked = walkClone(clone, limits);
  if (walked.unsafe.length) {
    out.flags.push('unsafe_path');
    out.reasons.push(...walked.unsafe.map((u) => `${u.path}: ${u.reason}`));
    return out;
  }
  const baseMap = new Map(walkClone(baselineTree, unlimited).files.map((f) => [f.rel, f.full]));
  const cloneMap = new Map(walked.files.map((f) => [f.rel, f.full]));
  for (const [rel, full] of cloneMap) {
    if (planFiles.has(rel)) {
      if (!sameBytes(fs.readFileSync(full), planFiles.get(rel))) out.plan_changed.push(rel);
    } else if (!baseMap.has(rel) || !sameBytes(fs.readFileSync(full), fs.readFileSync(baseMap.get(rel)))) {
      out.changed.push(rel);
    }
  }
  for (const rel of baseMap.keys()) if (!cloneMap.has(rel)) out.deleted.push(rel);
  for (const rel of planFiles.keys()) if (!cloneMap.has(rel)) out.plan_changed.push(rel);
  for (const rel of out.changed) {
    const bad = cloneNameProblem(rel);
    if (bad) out.reasons.push(`${rel}: ${bad}`);
  }
  if (out.reasons.length) { out.flags.push('unsafe_path'); return out; }
  for (const rel of [...out.changed.filter((r) => baseMap.has(r)), ...out.deleted]) {
    if (protectedGlobs.some((g) => matchGlob(g, rel))) out.protected_changed.push(rel);
  }

  out.depsChanged = [...out.changed, ...out.deleted].some((rel) => {
    const name = rel.split('/').pop();
    if (LOCKFILES.has(name)) return true;
    if (name !== 'package.json') return false;
    if (!cloneMap.has(rel) || !baseMap.has(rel)) return true;
    return depsDiffer(fs.readFileSync(baseMap.get(rel), 'utf8'), fs.readFileSync(cloneMap.get(rel), 'utf8'));
  });
  if (out.depsChanged) {
    out.flags.push('deps_changed');
    const agentLock = cloneMap.get('package-lock.json');
    const baseLock = baseMap.get('package-lock.json');
    if (!agentLock || !baseLock) {
      out.flags.push('unsafe_deps'); out.reasons.push('package-lock.json is missing'); return out;
    }
    const v = validateLockfile(fs.readFileSync(agentLock, 'utf8'), fs.readFileSync(baseLock, 'utf8'));
    if (!v.ok) { out.flags.push('unsafe_deps'); out.reasons.push(...v.reasons); return out; }
  }

  const dir = path.join(scratch, 'verify');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.cpSync(baselineTree, dir, {
    recursive: true,
    filter: (src) => {
      const name = path.basename(src);
      if (name === 'node_modules' || name === '.git' || name === 'dist') return false;
      return !isSkippedName(name, fs.lstatSync(src).isDirectory());
    },
  });
  const baseNm = path.join(baselineTree, 'node_modules');
  if (fs.existsSync(baseNm)) copyToolchain(baseNm, path.join(dir, 'node_modules'), baselineTree, dir);
  for (const rel of out.changed) copyFileSafe(cloneMap.get(rel), dir, rel);
  for (const rel of out.deleted) fs.rmSync(path.join(dir, ...rel.split('/')), { force: true });
  if (out.depsChanged) {
    fs.rmSync(path.join(dir, 'node_modules'), { recursive: true, force: true });
    try {
      await install({ dir, env });
    } catch (e) {
      out.flags.push('unsafe_deps');
      out.reasons.push(`npm ci from the agent lockfile failed: ${e.message}`);
      return out;
    }
  }
  out.dir = dir;
  return out;
}

// ---- running a command (N3, F15) ---------------------------------------------------------------------------------

const KEEP_BYTES = 1024 * 1024;
const KILL_BYTES = 10 * 1024 * 1024;

/** The environment of every harness-run command (N3): an allowlist, with five folders empty and per run. */
export function checkEnv({ parentEnv = process.env, scratch, cacheDir }) {
  const env = {};
  for (const k of ['PATH', 'PATHEXT', 'ComSpec', 'SystemRoot']) if (parentEnv[k] !== undefined) env[k] = parentEnv[k];
  for (const k of ['TEMP', 'TMP', 'HOME', 'USERPROFILE', 'APPDATA']) {
    env[k] = path.join(scratch, 'env', k);
    fs.mkdirSync(env[k], { recursive: true });
  }
  fs.mkdirSync(cacheDir, { recursive: true });
  env.npm_config_cache = cacheDir;
  return env;
}

/**
 * Run `argv` (first element `node`, replaced by this Node binary) without a shell. Output is kept up to 1 MB per stream
 * (`truncated`), the process tree is killed at 10 MB (`killed`) or at the timeout (`timedOut`).
 */
export function runCommand({ argv, cwd, env, timeoutMs, nodePath = process.execPath }) {
  if (!Array.isArray(argv) || argv.length === 0 || !argv.every((a) => typeof a === 'string')) return Promise.reject(new Error('argv must be a non-empty array of strings'));
  if (argv[0] !== 'node') return Promise.reject(new Error(`argv must start with node, not ${argv[0]}`));
  return new Promise((resolve) => {
    const res = { code: null, stdout: '', stderr: '', timedOut: false, truncated: false, killed: false, error: null };
    let child;
    try {
      child = spawn(nodePath, argv.slice(1), { cwd, env, shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) { res.error = e.code ?? String(e); resolve(res); return; }
    const seen = { stdout: 0, stderr: 0 };
    const take = (stream) => (d) => {
      seen[stream] += d.length;
      if (res[stream].length < KEEP_BYTES) res[stream] += d.toString('utf8').slice(0, KEEP_BYTES - res[stream].length);
      if (seen[stream] > KEEP_BYTES) res.truncated = true;
      if (seen[stream] > KILL_BYTES && !res.killed) { res.killed = true; killTree(child.pid); }
    };
    child.stdout.on('data', take('stdout'));
    child.stderr.on('data', take('stderr'));
    child.on('error', (e) => { res.error = e.code ?? String(e); });
    const timer = timeoutMs ? setTimeout(() => { res.timedOut = true; killTree(child.pid); }, timeoutMs) : null;
    child.on('close', (code) => { if (timer) clearTimeout(timer); res.code = code; resolve(res); });
  });
}

// ---- npm ci from the agent's validated lockfile (F8 step 5) --------------------------------------------------------

function npmCli() {
  const candidates = [path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js'), path.join(path.dirname(process.execPath), '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js')];
  const found = candidates.find((c) => fs.existsSync(c));
  if (!found) throw new Error('npm-cli.js was not found next to the Node binary');
  return found;
}

/** `npm ci --ignore-scripts` from the lockfile, registry fixed, user and global npm config empty. */
export async function npmCi({ dir, env, timeoutMs = 15 * 60 * 1000 }) {
  const empty = path.join(env.TEMP, 'empty.npmrc');
  fs.writeFileSync(empty, '');
  const r = await runCommand({
    argv: ['node', npmCli(), 'ci', '--ignore-scripts', '--registry', REGISTRY], cwd: dir, timeoutMs,
    env: { ...env, npm_config_userconfig: empty, npm_config_globalconfig: empty },
  });
  if (r.code !== 0) throw new Error(`exit ${r.code}${r.timedOut ? ' (timeout)' : ''}`);
}

async function defaultInstall({ dir, env }) {
  if (!env) throw new Error('the check environment is required for npm ci');
  await npmCi({ dir, env });
}

// ---- process sweep (E98) -----------------------------------------------------------------------------------------

const pause = (ms) => new Promise((r) => setTimeout(r, ms));

/** [{pid, commandLine}] of every process. Windows asks WMI through an encoded command so that this call never matches itself. */
export function listProcesses() {
  return new Promise((resolve, reject) => {
    const done = (err, out) => {
      if (err) { reject(err); return; }
      resolve(out.split(/\r?\n/).filter(Boolean).map((l) => { const m = /^\s*(\d+)\s(.*)$/.exec(l); return m ? { pid: Number(m[1]), commandLine: m[2] } : null; }).filter(Boolean));
    };
    const opts = { windowsHide: true, maxBuffer: 64 * 1024 * 1024 };
    if (process.platform === 'win32') {
      const ps = 'Get-CimInstance Win32_Process | ForEach-Object { "$($_.ProcessId) $($_.CommandLine)" }';
      execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(ps, 'utf16le').toString('base64')], opts, done);
    } else {
      execFile('ps', ['-eo', 'pid=,args='], opts, done);
    }
  });
}

/**
 * Kill every process whose command line is inside `root` (the verify tree) and report who is still running a moment
 * later. A survivor makes the attempt red with `containment` and keeps the adapter out of the tree.
 */
export async function sweepProcesses({ root, list = listProcesses, kill = killTree }) {
  const norm = (p) => (process.platform === 'win32' ? p.toLowerCase() : p);
  const needle = norm(path.resolve(root));
  const inside = (p) => p.pid !== process.pid && p.pid !== process.ppid && norm(p.commandLine ?? '').includes(needle);
  const first = (await list()).filter(inside);
  const killed = [];
  for (const p of first) { await kill(p.pid); killed.push(p.pid); }
  if (killed.length) await pause(400);
  const survivors = killed.length ? (await list()).filter(inside).map((p) => p.pid) : [];
  return { killed, survivors };
}

/** Copy the plan's adapter into the verify tree, but only after a clean sweep (E98). Returns whether it was copied. */
export function stageAcceptance({ dir, acceptanceSrc, adapterRel, adapterDest, sweep }) {
  if (sweep.survivors.length > 0) return false;
  copyFileSafe(path.join(acceptanceSrc, ...adapterRel.split('/')), dir, adapterDest);
  return true;
}

// ---- the checks (F10 parsing rules) -----------------------------------------------------------------------------

const MAX_LINES = 40;
const MAX_LINE = 300;
const MAX_FAILING = 50;
const cut = (lines) => lines.slice(0, MAX_LINES).map((l) => l.slice(0, MAX_LINE));
const tail = (text) => text.split(/\r?\n/).filter((l) => l.trim() !== '').slice(-MAX_LINES);

/**
 * Typecheck, lint, the changed or added test files (`changed` filtered by `baseline_files`), then the baseline test set.
 * All steps run even when one fails. Returns the check result without the shared checks, the sweep or the green rule.
 */
export async function runChecks({ task, dir, env, baseline, changed, defaultTimeoutS = 600, totalS = 1800, run = runCommand, collect = false }) {
  const started = Date.now();
  const flags = new Set();
  let secret = false;
  const remaining = () => totalS * 1000 - (Date.now() - started);
  const exec = async (argv, cwdRel, timeoutS) => {
    if (remaining() <= 0) { flags.add('check_timeout'); return { skipped: true, timedOut: true, code: null, text: '' }; }
    const r = await run({ argv, cwd: path.join(dir, ...(cwdRel ?? '.').split('/')), env, timeoutMs: Math.min((timeoutS ?? defaultTimeoutS) * 1000, remaining()) });
    if (r.timedOut) flags.add('check_timeout');
    if (r.truncated || r.killed) flags.add('output_truncated');
    const text = `${r.stdout}\n${r.stderr}`;
    if (scan(text).length) secret = true;
    return { ...r, text };
  };

  const lintLike = async (steps) => {
    if (!steps) return { errors: 0, status: 'ok', lines: [] };
    let errors = 0;
    let broken = false;
    let failed = false;
    const lines = [];
    for (const c of steps) {
      const r = await exec(c.argv, c.cwd, c.timeout_s);
      const n = countTsErrors(r.text);
      errors += n;
      if (r.skipped || r.timedOut || r.killed || r.truncated || r.error || (r.code !== 0 && n === 0)) broken = true;
      else if (n > 0 || r.code !== 0) failed = true;
      lines.push(...(n > 0 ? r.text.split(/\r?\n/).filter((l) => /error TS[0-9]+/.test(l)) : r.code !== 0 || r.timedOut ? tail(r.text) : []));
    }
    return { errors, status: broken ? 'error' : failed || errors > 0 ? 'fail' : 'ok', lines: cut(lines) };
  };
  const typecheck = await lintLike(task.checks.typecheck);
  const lint = await lintLike(task.checks.lint);

  const results = new Map();
  const runFile = async (file) => {
    const r = await exec([...task.checks.tests.own_argv, '--', file], '.', task.checks.tests.timeout_s);
    if (r.skipped) return [];
    const parsed = parseTap(r.stdout, file, { exitCode: r.code ?? 1 });
    for (const t of parsed) results.set(t.id, t);
    return parsed;
  };
  const isTest = (rel) => task.checks.tests.baseline_files.some((g) => matchGlob(g, rel));
  const ownFiles = [...new Set(changed.filter((rel) => isTest(rel) && fs.existsSync(path.join(dir, ...rel.split('/')))))].sort();
  const own = { files: ownFiles, passed: 0, failed: 0, skipped: 0, failing: [] };
  for (const file of ownFiles) {
    for (const t of await runFile(file)) {
      if (t.result === 'passed') own.passed += 1;
      else if (t.result === 'skipped') own.skipped += 1;
      else { own.failed += 1; own.failing.push({ id: t.id, lines: t.lines }); }
    }
  }
  own.failing = own.failing.slice(0, MAX_FAILING);
  const flaky = new Set(baseline.flaky_tests ?? []);
  const passing = (baseline.passing_tests ?? []).filter((id) => !flaky.has(id));
  const baselineFiles = [...new Set(passing.map((id) => id.split('::')[0]))].filter((f) => !ownFiles.includes(f) && fs.existsSync(path.join(dir, ...f.split('/')))).sort();
  for (const file of baselineFiles) await runFile(file);
  const baselineTests = { newly_failing: [], missing: [] };
  for (const id of passing) {
    const r = results.get(id)?.result;
    if (r === 'failed') baselineTests.newly_failing.push(id);
    else if (r !== 'passed') baselineTests.missing.push(id);
  }

  if (secret) {
    flags.add('secret_in_check_output');
    typecheck.lines = [];
    lint.lines = [];
    for (const f of own.failing) f.lines = [];
  }
  return {
    typecheck, lint, own_tests: own, baseline_tests: baselineTests, flags: [...flags], secret_in_check_output: secret,
    ...(collect ? { tests: [...results.values()].map(({ id, result }) => ({ id, result })) } : {}),
  };
}

// ---- the green rule (F10) and the detectors ---------------------------------------------------------------------

const RED_FLAGS = ['outside_clone_access', 'result_tampering_suspected', 'unsafe_path', 'unsafe_deps', 'check_timeout', 'output_truncated',
  'secret_in_check_output', 'containment', 'protected_modified', 'plan_modified'];

/** The F10 rule. `checks` is the acceptance `checks.json` list ({id, required, requirement}). Returns {green, reasons}. */
export function isGreen(result, checks) {
  const reasons = [];
  if (result.typecheck.status !== 'ok' || result.typecheck.errors > 0) reasons.push(`typecheck is ${result.typecheck.status} with ${result.typecheck.errors} errors`);
  if (result.lint.status !== 'ok' || result.lint.errors > 0) reasons.push(`lint is ${result.lint.status} with ${result.lint.errors} errors`);
  const own = result.own_tests;
  if (own.passed < 1) reasons.push('no test in the changed or added test files ran and passed');
  if (own.failed > 0) reasons.push(`${own.failed} failing own test(s)`);
  if (result.baseline_tests.newly_failing.length) reasons.push(`newly failing baseline tests: ${result.baseline_tests.newly_failing.join(', ')}`);
  if (result.baseline_tests.missing.length) reasons.push(`baseline tests missing: ${result.baseline_tests.missing.join(', ')}`);
  for (const c of checks) {
    if (c.required && result.shared?.[c.id]?.status !== 'pass') reasons.push(`required check ${c.id} is ${result.shared?.[c.id]?.status ?? 'absent'}`);
  }
  if (result.protected_changed.length) reasons.push(`protected files changed: ${result.protected_changed.join(', ')}`);
  if (result.plan_changed.length) reasons.push(`plan files changed: ${result.plan_changed.join(', ')}`);
  for (const f of RED_FLAGS) if (result.flags.includes(f)) reasons.push(`flag ${f}`);
  return { green: reasons.length === 0, reasons };
}

const TAMPER = /process\.(exit|stdout|stderr|argv)\b|\bchild_process\b|\beval\b/;

/** E57: lines the agent added (not present in the reference text) that touch the process, child processes or eval. Not a barrier. */
export function detectTampering(files) {
  for (const f of files) {
    const before = new Set(f.before == null ? [] : String(f.before).split(/\r?\n/));
    for (const line of String(f.text).split(/\r?\n/)) if (!before.has(line) && TAMPER.test(line)) return true;
  }
  return false;
}

const GIT_DIRS = ['.git/hooks', '.git/exp-empty-hooks'];

/** Hash of every file the agent must not touch in its clone: `.git/config`, `.gitattributes` and the hook folders. Reads bytes only; no git. */
export function gitProtectedSnapshot(clone) {
  const out = {};
  const add = (rel) => {
    const full = path.join(clone, ...rel.split('/'));
    if (!fs.existsSync(full) && !isLink(full)) return;
    out[rel] = isLink(full) ? 'link' : sha256(fs.readFileSync(full));
  };
  const walk = (rel) => {
    const full = path.join(clone, ...rel.split('/'));
    if (!fs.existsSync(full)) return;
    for (const name of fs.readdirSync(full).sort()) {
      const r = `${rel}/${name}`;
      if (!isLink(path.join(clone, ...r.split('/'))) && fs.statSync(path.join(clone, ...r.split('/'))).isDirectory()) walk(r);
      else add(r);
    }
  };
  add('.git/config');
  add('.gitattributes');
  for (const d of GIT_DIRS) walk(d);
  return out;
}

function isLink(full) {
  try { return fs.lstatSync(full).isSymbolicLink(); } catch { return false; }
}

/** Paths whose bytes differ from `snapshot`, or that are new or gone. */
export function gitProtectedChanged(clone, snapshot) {
  const now = gitProtectedSnapshot(clone);
  const names = new Set([...Object.keys(snapshot), ...Object.keys(now)]);
  return [...names].filter((n) => snapshot[n] !== now[n]).sort();
}

// ---- plan adherence (F12) ------------------------------------------------------------------------------------------

const NOTES_MAX = 20000;
const SKIPPED_MAX = 50;

/**
 * F12 metrics. `changed` are the files that differ from the reference (plan files already excluded), `cloneFiles` every
 * file of the clone, `planFiles` the adapter's list (a folder entry matches everything under it), `notesText` the notes
 * file or null, `planTexts` the texts of the plan-kind files.
 */
export function adherence({ changed, cloneFiles, planFiles, notesText, planTexts }) {
  const covers = (entry, rel) => rel === entry || rel.startsWith(`${entry.replace(/\/$/, '')}/`);
  const expected = (rel) => rel === 'IMPLEMENTATION-NOTES.md' || LOCKFILES.has(rel.split('/').pop());
  const files_off_plan = changed.filter((rel) => !expected(rel) && !planFiles.some((e) => covers(e, rel))).length;
  const plan_files_missing = planFiles.filter((e) => !cloneFiles.some((rel) => covers(e, rel))).length;
  const gates_in_plan = planTexts.flatMap((t) => t.split(/\r?\n/)).filter((l) => /\bGATE\b/.test(l)).length;
  let gates_skipped = 0;
  const notes_truncated = notesText != null && notesText.length > NOTES_MAX;
  if (notesText != null) {
    let inSkipped = false;
    for (const line of notesText.slice(0, NOTES_MAX).split(/\r?\n/)) {
      if (/^##\s/.test(line)) inSkipped = /^##\s+Skipped\s*$/i.test(line);
      else if (inSkipped && /^- /.test(line)) gates_skipped += 1;
    }
  }
  return { files_off_plan, plan_files_missing, gates_skipped: Math.min(gates_skipped, SKIPPED_MAX), gates_in_plan, notes_truncated };
}

// ---- the pristine toolchain and acceptance files (E103) ------------------------------------------------------------

/** Hash of a file, or of every file below a folder (relative paths and bytes). */
export function acceptanceHash(target) {
  const lines = [];
  const walk = (dir, rel) => {
    for (const name of fs.readdirSync(dir).sort()) {
      const full = path.join(dir, name);
      const r = rel ? `${rel}/${name}` : name;
      if (fs.statSync(full).isDirectory()) walk(full, r);
      else lines.push(`${r} ${sha256(fs.readFileSync(full))}`);
    }
  };
  if (fs.statSync(target).isFile()) return sha256(fs.readFileSync(target));
  walk(target, '');
  return sha256(lines.join('\n'));
}

/** E103: why the pristine tree, checks.json or the acceptance folder cannot be trusted (exit 7), or null. */
export function pristineProblem({ baselineTree, baseline, acceptanceDir }) {
  if (toolchainManifest(path.join(baselineTree, 'node_modules'), baselineTree) !== baseline.node_modules_sha256) {
    return `the pristine node_modules of the baseline (${path.join(baselineTree, 'node_modules')}) changed since the baseline was built`;
  }
  const checks = path.join(acceptanceDir, 'checks.json');
  if (!fs.existsSync(checks) || acceptanceHash(checks) !== baseline.checks_json_sha256) return `${checks} changed since the baseline was built`;
  if (acceptanceHash(acceptanceDir) !== baseline.acceptance_sha256) return `the acceptance folder ${acceptanceDir} changed since the baseline was built`;
  return null;
}

// ---- baseline hashes (F4, E17) -----------------------------------------------------------------------------------

/** What a baseline must still match: the check commands, the setup commands and the lockfile of the base commit. */
export function taskHashes(task, repoRoot) {
  let lock = '';
  try {
    lock = execFileSync('git', ['show', `${task.base_commit}:package-lock.json`], { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 256 * 1024 * 1024 });
  } catch { /* no lockfile at the base commit */ }
  return {
    checks_sha256: sha256(JSON.stringify(task.checks)),
    setup_sha256: sha256(JSON.stringify([task.setup_command, task.post_setup ?? []])),
    lockfile_sha256: sha256(lock),
  };
}

/** E17: why the stored baseline cannot be used for `task` (names `exp baseline`), or null. */
export function baselineProblem({ expRoot, repoRoot, task }) {
  const file = path.join(expRoot, 'local', 'baselines', `${task.id}.json`);
  if (!fs.existsSync(file)) return `no baseline for task ${task.id}; run exp baseline ${task.id}`;
  let baseline;
  try { baseline = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return `the baseline of task ${task.id} is not valid JSON; run exp baseline ${task.id}`; }
  const now = taskHashes(task, repoRoot);
  for (const k of Object.keys(now)) if (baseline[k] !== now[k]) return `the baseline of task ${task.id} is stale (${k} differs); run exp baseline ${task.id}`;
  if (baseline.base_commit !== task.base_commit) return `the baseline of task ${task.id} is for another base commit; run exp baseline ${task.id}`;
  return null;
}
