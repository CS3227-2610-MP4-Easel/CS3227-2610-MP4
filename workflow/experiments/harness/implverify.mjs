// F8, F9, F10, F12 (T6): one attempt's verification, composed from the T4 and T5 parts. The checks run in a harness-owned
// verify tree built from bytes; the agent clone is only read (never with git) and the scratch folder is deleted at the end.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  adherence, buildVerifyTree, checkEnv, detectTampering, gitProtectedChanged, isGreen, runChecks, runCommand, stageAcceptance, sweepProcesses,
} from './implchecks.mjs';
import { scan } from './secrets.mjs';
import { walkClone } from './safefs.mjs';
import { writeJsonAtomic } from './state.mjs';

const NOTES = 'IMPLEMENTATION-NOTES.md';
const LIST_MAX = 200;
const MESSAGE_MAX = 300;
const STAGED_ADAPTER = '.exp-adapter/adapter.mjs';

const errorMap = (ids, message) => Object.fromEntries(ids.map((id) => [id, { status: 'error', message }]));

/**
 * F9: run the task's shared runner (a harness-owned script, resolved against the repository root) as a parent process on
 * the verify tree. Its last stdout line is a JSON object {CHK: {status, message}}; anything else makes every id `error`.
 * Returns {shared, flags, text} where `text` is what the runner printed (for the credential scan only).
 */
export async function runShared({ task, repoRoot, dir, adapterPath, checksPath, ids, env, run = runCommand }) {
  const spec = task.checks.shared;
  const argv = [spec.argv[0], path.resolve(repoRoot, spec.argv[1]), ...spec.argv.slice(2), '--adapter', adapterPath, '--checks', checksPath, '--root', dir];
  const r = await run({ argv, cwd: dir, env, timeoutMs: (spec.timeout_s ?? 300) * 1000 });
  const flags = new Set();
  const text = `${r.stdout ?? ''}\n${r.stderr ?? ''}`;
  if (r.timedOut) flags.add('check_timeout');
  if (r.truncated || r.killed) flags.add('output_truncated');
  const broken = (message) => { flags.add('adapter_error'); return { shared: errorMap(ids, message), flags: [...flags], text }; };
  if (r.error || r.timedOut || r.killed) return broken('the shared runner did not finish');
  const last = (r.stdout ?? '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean).pop();
  let parsed;
  try { parsed = JSON.parse(last ?? ''); } catch { return broken('the shared runner printed no result'); }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return broken('the shared runner printed no result');
  const shared = {};
  for (const id of ids) {
    const v = parsed[id];
    if (v && typeof v === 'object' && ['pass', 'fail', 'error'].includes(v.status)) {
      shared[id] = { status: v.status, message: String(v.message ?? '').slice(0, MESSAGE_MAX) };
      if (v.status === 'error' && shared[id].message !== 'module missing') flags.add('adapter_error');
    } else {
      shared[id] = { status: 'error', message: 'no verdict for this check' };
      flags.add('adapter_error');
    }
  }
  return { shared, flags: [...flags], text };
}

const readText = (file) => { try { return fs.readFileSync(file, 'utf8'); } catch { return null; } };

/** The notes file of the clone as text, or null when it is missing or not a regular file (never through a link). */
function readNotes(clone) {
  const file = path.join(clone, NOTES);
  try {
    const st = fs.lstatSync(file);
    if (!st.isFile() || st.size > 5 * 1024 * 1024) return null;
    return fs.readFileSync(file, 'utf8');
  } catch { return null; }
}

/**
 * Verify one attempt. Writes `outFile` (checks/attempt-<n>.json) atomically, also when a credential pattern was found, and
 * deletes the scratch folder (verify tree, environment folders, acceptance copy) in every case. Returns the check result.
 *
 * `planFiles` maps repo-relative path to the snapshot's bytes; `adapterPlanFiles` is the adapter's `planFiles` export;
 * `runFlags` are the run's flags so far (`outside_clone_access` makes every attempt red); `gitProtected` is the byte hash
 * map taken when the clone was created; `overlayMissing` the base files the clone overlay removed on purpose.
 */
export async function runVerification(o) {
  const {
    task, checksList, baseline, baselineTree, clone, planFiles, planTexts, adapterPlanFiles, adapterPath, acceptanceDir, checksPath,
    repoRoot, scratch, cacheDir, outFile, runFlags = [], gitProtected, overlayMissing = new Set(), defaultTimeoutS = 600, totalS = 1800,
    deps = {},
  } = o;
  fs.rmSync(scratch, { recursive: true, force: true });
  fs.mkdirSync(scratch, { recursive: true });
  try {
    const env = checkEnv({ parentEnv: deps.parentEnv ?? process.env, scratch, cacheDir });
    const sweep = deps.sweep ?? sweepProcesses;
    const flags = new Set(runFlags);
    const ids = checksList.map((c) => c.id);
    const build = await buildVerifyTree({
      baselineTree, clone, planFiles, scratch, protectedGlobs: task.protected_globs ?? [], env, expectedMissing: overlayMissing,
      ...(deps.install ? { install: deps.install } : {}),
    });
    for (const f of build.flags) flags.add(f);

    let result = {
      typecheck: { errors: 0, status: 'error', lines: [] }, lint: { errors: 0, status: task.checks.lint ? 'error' : 'ok', lines: [] },
      own_tests: { files: [], passed: 0, failed: 0, skipped: 0, failing: [] }, baseline_tests: { newly_failing: [], missing: [] },
    };
    let shared = errorMap(ids, 'not run');
    let secret = false;
    if (build.dir) {
      const checked = await runChecks({ task, dir: build.dir, env, baseline, changed: build.changed, defaultTimeoutS, totalS, run: deps.run });
      result = { typecheck: checked.typecheck, lint: checked.lint, own_tests: checked.own_tests, baseline_tests: checked.baseline_tests };
      for (const f of checked.flags) flags.add(f);
      secret = checked.secret_in_check_output;
      const first = await sweep({ root: build.dir });
      let survivors = first.survivors.length;
      if (!survivors) {
        stageAcceptance({ dir: build.dir, acceptanceSrc: acceptanceDir, adapterRel: path.relative(acceptanceDir, adapterPath).split(path.sep).join('/'), adapterDest: STAGED_ADAPTER, sweep: first });
        const s = await runShared({ task, repoRoot, dir: build.dir, adapterPath: path.join(build.dir, ...STAGED_ADAPTER.split('/')), checksPath, ids, env, run: deps.run });
        shared = s.shared;
        for (const f of s.flags) flags.add(f);
        if (scan(s.text).length) secret = true;
        survivors += (await sweep({ root: build.dir })).survivors.length;
      } else {
        shared = errorMap(ids, 'not run: a process survived the sweep');
      }
      if (survivors) flags.add('containment');
    }

    // detectors and metrics (E47, E57, E84, F12): bytes of the clone and the reference only, never git
    const protectedChanged = [...build.protected_changed, ...gitProtectedChanged(clone, gitProtected ?? {})];
    if (protectedChanged.length) flags.add('protected_modified');
    if (build.plan_changed.length) flags.add('plan_modified');
    const diffFiles = build.changed.map((rel) => ({
      text: readText(path.join(clone, ...rel.split('/'))) ?? '', before: readText(path.join(baselineTree, ...rel.split('/'))),
    }));
    if (detectTampering(diffFiles)) flags.add('result_tampering_suspected');
    const walked = walkClone(clone);
    const notes = readNotes(clone);
    const metrics = adherence({
      changed: build.changed, cloneFiles: walked.files.map((f) => f.rel), planFiles: adapterPlanFiles, notesText: notes, planTexts,
    });

    if (secret) {
      flags.add('secret_in_check_output');
      result.typecheck.lines = [];
      result.lint.lines = [];
      for (const f of result.own_tests.failing) f.lines = [];
      for (const v of Object.values(shared)) v.message = '';
    }
    result = {
      ...result, shared, protected_changed: [...new Set(protectedChanged)].sort().slice(0, LIST_MAX), plan_changed: [...new Set(build.plan_changed)].sort().slice(0, LIST_MAX),
      changed_files: build.changed.slice(0, LIST_MAX), deleted_files: build.deleted.slice(0, LIST_MAX), ...metrics,
      secret_in_check_output: secret, flags: [...flags].sort(), unsafe_reasons: secret ? [] : build.reasons.slice(0, 20),
    };
    result.green = isGreen(result, checksList).green;
    writeJsonAtomic(outFile, result);
    return result;
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}

/** Import the adapter's `planFiles` (committed, human-authored, hash-recorded; the module runs in the harness process). */
export async function loadAdapterPlanFiles(adapterPath) {
  const mod = await import(`${pathToFileURL(adapterPath).href}?t=${Date.now()}`);
  if (!Array.isArray(mod.planFiles)) throw new Error(`adapter ${adapterPath} does not export planFiles`);
  return mod.planFiles;
}
