// Run state, manifest, approvals: everything the harness persists, written atomically (N2, N8, F6, E4).
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { hashFile, hashTree } from './containment.mjs';

export const HARNESS_VERSION = 1;
export const TERMINAL = ['done', 'aborted', 'extracted', 'complete'];
export const isTerminal = (status) => TERMINAL.includes(status);

/** Fault-injection seam (N8): called after the temp file is complete and before the rename. */
export const faults = { beforeRename: null };

const sha = (data) => crypto.createHash('sha256').update(data).digest('hex');

/** Write via a temp file and a rename, so a kill at any point leaves the previous file whole. Returns the content hash. */
export function writeAtomic(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, text);
  faults.beforeRename?.(file, tmp);
  fs.renameSync(tmp, file);
  return sha(text);
}

export const writeJsonAtomic = (file, obj) => writeAtomic(file, `${JSON.stringify(obj, null, 2)}\n`);

export function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

// ---- paths and state -----------------------------------------------------------------------------------------

export function runPaths(expRoot, runId) {
  const dir = path.join(expRoot, 'local', 'runs', runId);
  return {
    dir, manifest: path.join(dir, 'manifest.json'), state: path.join(dir, 'state.json'),
    questions: path.join(dir, 'questions.jsonl'), artifacts: path.join(dir, 'artifacts'), transcript: path.join(dir, 'transcript'),
  };
}

export const newRunState = () => ({
  status: 'queued', session_id: null, turn_state: 'idle', turn_count: 0, question_count: 0, empty_streak: 0,
  last_prompt_hash: null, pending_reply: null, wait_started: null, started_at: null, ended_at: null,
  spend: { arm: 0, answerer: 0, matcher: 0, judge: 0, probe: 0 }, overshoot_usd: 0, abort_reason: null, abort_detail: null, exit_code: 0,
});

export function loadState(paths) {
  return readJson(paths.state);
}

/** Save the run state and return its hash, which containment records and compares at turn boundaries. */
export function saveState(paths, state) {
  return writeJsonAtomic(paths.state, state);
}

// ---- manifest (N2) ----------------------------------------------------------------------------------------------

const blobHash = (repoRoot, file) => execFileSync('git', ['hash-object', '--', file], { cwd: repoRoot, encoding: 'utf8' }).trim();

/** Hashes that fix a run's inputs. `bank_hash` is the only one allowed to change after the run starts. */
export function computeHashes({ expRoot, armId, taskId, experimentId }) {
  const arm = readJson(path.join(expRoot, 'arms', `${armId}.json`));
  const taskDir = path.join(expRoot, 'tasks', taskId);
  const task = readJson(path.join(taskDir, 'task.json'));
  const plugins = Object.fromEntries((arm.plugins ?? []).map((p) => [p, hashTree(path.join(expRoot, 'plugins', p))]));
  return {
    arm: hashFile(path.join(expRoot, 'arms', `${armId}.json`)),
    plugins,
    task: hashTree(taskDir),
    experiment: hashFile(path.join(expRoot, 'experiments', `${experimentId}.json`)),
    answer_sheet: task.sheet_file ? hashFile(path.join(taskDir, task.sheet_file)) : null,
    rubric: hashTree(path.join(expRoot, 'rubric')),
    pricing: hashFile(path.join(expRoot, 'pricing.json')),
    config: hashFile(path.join(expRoot, 'config.json')),
    prompts: sha(arm.prompt),
    harness: hashTree(path.join(expRoot, 'harness')),
  };
}

export function buildManifest({ expRoot, repoRoot, runId, experimentId, taskId, armId, rep, baseCommit, cliVersion }) {
  const arm = readJson(path.join(expRoot, 'arms', `${armId}.json`));
  return {
    schema_version: 1, run_id: runId, experiment_id: experimentId, task_id: taskId, arm_id: armId, rep,
    status: 'queued', abort_reason: null, flags: [], base_commit: baseCommit,
    experiment_blob: blobHash(repoRoot, path.join(expRoot, 'experiments', `${experimentId}.json`)),
    hashes: computeHashes({ expRoot, armId, taskId, experimentId }),
    versions: { harness: HARNESS_VERSION, cli: cliVersion ?? null, node: process.version },
    models: arm.model,
    bank_hash: hashTree(path.join(expRoot, 'local', 'bank')) ?? 'none',
  };
}

/** Names of manifest hashes that differ from the current files (bank_hash is not compared). */
export function changedHashes(stored, current) {
  const flat = (h) => ({ ...Object.fromEntries(Object.entries(h).filter(([k]) => k !== 'plugins')), ...Object.fromEntries(Object.entries(h.plugins ?? {}).map(([k, v]) => [`plugin:${k}`, v])) });
  const a = flat(stored);
  const b = flat(current);
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => a[k] !== b[k]).sort();
}

// ---- approvals (E4) ---------------------------------------------------------------------------------------------

export function configDir(env = process.env) {
  if (env.EXP_CONFIG_DIR) return env.EXP_CONFIG_DIR;
  const base = process.platform === 'win32' ? (env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming')) : (env.XDG_CONFIG_HOME ?? path.join(os.homedir(), '.config'));
  return path.join(base, 'exp-harness');
}

/** Hash over the arm file, the contents of each of its plugin directories and config.json. */
export function approvalHash({ expRoot, armId }) {
  const arm = readJson(path.join(expRoot, 'arms', `${armId}.json`));
  const parts = [
    hashFile(path.join(expRoot, 'arms', `${armId}.json`)),
    ...(arm.plugins ?? []).map((p) => `${p}:${hashTree(path.join(expRoot, 'plugins', p))}`),
    hashFile(path.join(expRoot, 'config.json')),
  ];
  return sha(parts.join('\n')).slice(0, 16);
}

const approvalsFile = (dir) => path.join(dir, 'approvals.json');

export function loadApprovals(dir) {
  try { return readJson(approvalsFile(dir)); } catch { return {}; }
}

export function isApproved(dir, armId, hash) {
  return loadApprovals(dir)[armId]?.includes(hash) ?? false;
}

export function approve(dir, armId, hash) {
  const all = loadApprovals(dir);
  all[armId] = [...new Set([...(all[armId] ?? []), hash])];
  writeJsonAtomic(approvalsFile(dir), all);
}
