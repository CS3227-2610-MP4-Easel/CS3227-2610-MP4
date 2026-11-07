// F3, F5, F6, F7, F11, F14 (T6): the implementation run. One sample = one history-free agent clone, up to two attempts,
// each followed by checks in a harness-owned verify tree. The shared helpers of the framework driver (persist, abort,
// invoke, containmentDiff, Exit) are passed in by driver.mjs, which this module never imports (that would be a cycle).
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { classifyTurn } from './classify.mjs';
import { findCanary } from './canary.mjs';
import { costFromModelUsage, invocationCap, evaluateRun, reasonFromResult, round4 } from './budget.mjs';
import { planCollision, prepareImplClone } from './clone.mjs';
import { baselineProblem, matchGlob, copyToolchains, pristineProblem, sweepProcesses } from './implchecks.mjs';
import { buildFeedback, restoreFiles } from './implfeedback.mjs';
import { loadAdapterPlanFiles, runVerification } from './implverify.mjs';
import { checkProbe, describePlugin, describeProblems } from './isolation.mjs';
import { appendQuestion } from './questions.mjs';
import { sanitizeText } from './sanitize.mjs';
import { walkClone } from './safefs.mjs';
import { ConfigError, claudeArgs, isUuid } from './spawn.mjs';
import { changedHashes, computeHashes, computeImplHashes, readJson } from './state.mjs';

/** The answer to every implementer question (data-model.md, fixed texts). */
export const IMPL_ANSWER = "The plan is the specification. If it is silent, make the smallest change that satisfies the plan's task, record the assumption in IMPLEMENTATION-NOTES.md under Assumptions, and continue.";
export const DEFAULTS = {
  samples: 2, attempts: 2, max_questions: 5, turn_timeout_s: 1800, run_timeout_s: 5400, check_timeout_s: 600, check_total_s: 1800,
  max_clone_mb: 2048, max_parallel: 2, answer_mode: 'fixed',
};
export const MIN_FREE_GB = 2;
const MAX_STATUS_TURNS = 10;
const sha256 = (data) => crypto.createHash('sha256').update(data).digest('hex');

export const withImplDefaults = (experiment) => ({ ...DEFAULTS, ...experiment });

// ---- run id and planning ------------------------------------------------------------------------------------------

const pad = (n) => String(n).padStart(2, '0');
/** `<ts>-<task>-<plan-id>-s<sample>` with the same timestamp form as the framework's run ids. */
export function implRunIdFor(date, taskId, planId, sample) {
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}-${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}-${taskId}-${planId}-s${sample}`;
}

/** Names of the manifest hashes of an implementation run that differ from the files now (E12, exit 7). */
export function implHashChanges({ expRoot, manifest }) {
  const now = computeImplHashes({ expRoot, taskId: manifest.task_id, planId: manifest.plan_id, armId: manifest.arm_id });
  return Object.keys(now).filter((k) => manifest[k] !== now[k]);
}

// ---- preflight (F3, E11, E12, E17, E20, E103) -------------------------------------------------------------------------

/**
 * Everything an implementation batch needs before any run exists: the frozen plans (hashes checked), the committed and
 * unmodified adapters, `checks.json` and arm file, a current baseline and a pristine toolchain. Throws h.Exit.
 */
export async function implPreflight({ repoRoot, expRoot, experiment, task, arm }, h) {
  const plans = new Map();
  for (const p of experiment.plans) {
    const dir = path.join(expRoot, 'local', 'plans', p.source_experiment_id, p.plan_id);
    const snapFile = path.join(dir, 'snapshot.json');
    if (!fs.existsSync(snapFile)) throw new h.Exit(3, `plan ${p.plan_id} has no snapshot; run exp snapshot`);
    if (sha256(fs.readFileSync(snapFile)) !== p.snapshot_sha256) throw new h.Exit(7, `plan ${p.plan_id}: snapshot.json changed since the experiment file was committed`);
    const snapshot = readJson(snapFile);
    const planFiles = new Map();
    for (const f of snapshot.files) {
      const file = path.join(dir, 'files', ...f.path.split('/'));
      const bytes = fs.existsSync(file) ? fs.readFileSync(file) : null;
      if (bytes === null || sha256(bytes) !== f.sha256) throw new h.Exit(7, `plan ${p.plan_id}: file ${f.path} changed since the snapshot`);
      planFiles.set(f.path, bytes);
    }
    const planKinds = snapshot.files.filter((f) => f.kind === 'plan');
    const collision = planCollision({ repoRoot, baseCommit: task.base_commit, paths: [...planFiles.keys()] });
    if (collision) throw new h.Exit(3, `plan ${p.plan_id}: ${collision}`);
    const adapterRel = task.acceptance.adapters[p.plan_id];
    if (!adapterRel) throw new h.Exit(3, `plan ${p.plan_id} has no adapter in task ${task.id}`);
    const adapterPath = path.join(expRoot, 'tasks', task.id, adapterRel);
    plans.set(p.plan_id, {
      id: p.plan_id, snapshot, planFiles, planPath: planKinds[0]?.path, adapterPath,
      specPaths: snapshot.files.filter((f) => f.kind === 'spec').map((f) => f.path),
      planTexts: planKinds.map((f) => planFiles.get(f.path).toString('utf8')),
    });
  }
  const taskDir = path.join(expRoot, 'tasks', task.id);
  const acceptanceDir = path.join(taskDir, task.acceptance.folder);
  const checksPath = path.join(taskDir, task.acceptance.checks_file);
  const guarded = [...plans.values()].map((p) => p.adapterPath).concat(checksPath, path.join(expRoot, 'arms', `${arm.id}.json`));
  for (const file of guarded) {
    const problem = h.experimentFileProblem(repoRoot, file);
    if (problem) throw new h.Exit(7, `${path.relative(repoRoot, file)} is ${problem}; commit it before running`);
  }
  const stale = baselineProblem({ expRoot, repoRoot, task });
  if (stale) throw new h.Exit(3, stale);
  const baseline = readJson(path.join(expRoot, 'local', 'baselines', `${task.id}.json`));
  const baselineTree = path.join(expRoot, 'local', 'baselines', task.id, 'tree');
  const pristine = pristineProblem({ baselineTree, baseline, acceptanceDir });
  if (pristine) throw new h.Exit(7, pristine);
  for (const p of plans.values()) p.adapterPlanFiles = await loadAdapterPlanFiles(p.adapterPath);
  const acceptanceFiles = fs.readdirSync(acceptanceDir, { recursive: true }).map((r) => path.join(acceptanceDir, r)).filter((f) => fs.statSync(f).isFile() && /\.(mjs|json)$/.test(f));
  return {
    plans, baseline, baselineTree, acceptanceDir, checksPath, checksList: readJson(checksPath), cacheDir: path.join(expRoot, 'local', 'npm-cache'),
    canary: findCanary(acceptanceFiles),
  };
}

// ---- end-of-turn controls (F6, E22, E99, E100) -----------------------------------------------------------------------

/** Lower case, forward slashes, no doubled slashes: JSON-escaped and native Windows paths compare equal. */
const norm = (s) => String(s).replace(/\\+/g, '/').replace(/\/+/g, '/').toLowerCase();
const EXEC_TOOLS = new Set(['Bash', 'PowerShell']);
const EXEC_PATTERN = /\bclaude(?:\.cmd|\.exe)?\s+(?:-p|--print)\b|(?<![\w-])curl(?:\.exe)?(?![\w-])|(?<![\w-])wget(?![\w-])|\binvoke-webrequest\b/i;

/** Tool calls and tool results of one turn's stream: [{name, text, command}] and [string]. */
export function toolActivity(events) {
  const calls = [];
  const results = [];
  for (const e of events) {
    const blocks = Array.isArray(e.message?.content) ? e.message.content : [];
    for (const b of blocks) {
      if (e.type === 'assistant' && b.type === 'tool_use') calls.push({ name: b.name, text: JSON.stringify(b.input ?? {}), command: String(b.input?.command ?? '') });
      else if (e.type === 'user' && b.type === 'tool_result') results.push(typeof b.content === 'string' ? b.content : JSON.stringify(b.content));
    }
  }
  return { calls, results };
}

/**
 * F6: does this turn's activity reach outside the clone? True when a tool call names another run's clone, the repository
 * root, EXP_ROOT, `local/` or the user's .claude folder, or a Bash/PowerShell call runs claude -p, curl, wget or
 * Invoke-WebRequest; or when the canary token shows up in a tool result. Detection only (Known Gap).
 */
export function outsideCloneAccess({ events, clone, worktreesRoot, repoRoot, expRoot, home, canary }) {
  const { calls, results } = toolActivity(events);
  const self = norm(clone);
  const wt = norm(worktreesRoot);
  let siblings = [];
  try { siblings = fs.readdirSync(worktreesRoot).filter((n) => n !== path.basename(clone) && n.length >= 8).map(norm); } catch { /* no siblings */ }
  const forbidden = [norm(repoRoot), norm(expRoot), 'exp_root', 'experiments/local/', '~/.claude', '%userprofile%/.claude', norm(path.join(home, '.claude'))];
  for (const c of calls) {
    const text = norm(c.text).split(self).join('');
    if (text.includes(`${wt}/`) || siblings.some((s) => text.includes(s)) || forbidden.some((f) => text.includes(f))) return 'path';
    if (EXEC_TOOLS.has(c.name) && EXEC_PATTERN.test(c.command)) return 'command';
  }
  if (canary && results.some((r) => r.includes(canary))) return 'canary';
  return null;
}

/** E99: the canary token in a file of the clone (node_modules, .git and dist are skipped by the walk). */
export function canaryInClone(clone, canary) {
  if (!canary) return false;
  const { files } = walkClone(clone);
  return files.some((f) => f.size <= 1024 * 1024 && fs.readFileSync(f.full).includes(canary));
}

// ---- disk poll (F6, F15, E38, E101) ----------------------------------------------------------------------------------

/** Megabytes below `dir`, links counted as links and never followed. */
export function dirSizeMb(dir) {
  let total = 0;
  const walk = (d) => {
    for (const name of fs.readdirSync(d)) {
      const full = path.join(d, name);
      const st = fs.lstatSync(full);
      if (st.isDirectory() && !st.isSymbolicLink()) walk(full);
      else total += st.size;
    }
  };
  walk(dir);
  return total / (1024 * 1024);
}

export function freeDiskGb(dir) {
  const s = fs.statfsSync(dir);
  return (s.bavail * s.bsize) / 1e9;
}

function startPoll({ ctx, clone, maxMb }) {
  const sizeMb = ctx.deps.cloneSizeMb ?? dirSizeMb;
  const freeGb = ctx.deps.freeDiskGb ?? freeDiskGb;
  let reason = null;
  let kill = null;
  let busy = false;
  const check = async () => {
    if (busy || reason) return reason;
    busy = true;
    try {
      const mb = await sizeMb(clone);
      const gb = await freeGb(clone);
      if (mb > maxMb) reason = `clone is ${Math.round(mb)} MB, above ${maxMb}`;
      else if (gb < MIN_FREE_GB) reason = `${gb.toFixed(1)} GB free, below ${MIN_FREE_GB}`;
      if (reason && kill) kill();
    } catch { /* an unreadable clone is found by the end-of-turn check */ } finally { busy = false; }
    return reason;
  };
  const timer = setInterval(check, ctx.deps.diskPollMs ?? 30000);
  return { check, setKill: (k) => { kill = k; }, stop: () => clearInterval(timer), get reason() { return reason; } };
}

// ---- the run ------------------------------------------------------------------------------------------------------

// flags that belong to the whole run and so make every attempt red; the others are recomputed per attempt
const RUN_LEVEL_FLAGS = ['outside_clone_access'];
const addFlag = (run, flag) => { if (!run.manifest.flags.includes(flag)) run.manifest.flags.push(flag); };
const checksFileOf = (run, n) => path.join(run.paths.dir, 'checks', `attempt-${n}.json`);

function overlayMissing(baselineTree, clone) {
  const inClone = new Set(walkClone(clone).files.map((f) => f.rel));
  return walkClone(baselineTree, { maxFileBytes: Number.MAX_SAFE_INTEGER, maxFiles: Number.MAX_SAFE_INTEGER, maxMs: Number.MAX_SAFE_INTEGER }).files
    .map((f) => f.rel).filter((rel) => !inClone.has(rel));
}

/** N1, E73: the sum of the final per-session totals against the CLI's own totals; a gap above 2% sets `cost_mismatch`. */
function checkCostMismatch(run) {
  const sessions = Object.values(run.state.sessions ?? {});
  const cli = sessions.reduce((s, x) => s + x.cli, 0);
  const own = sessions.reduce((s, x) => s + x.computed, 0);
  if (cli > 0 && Math.abs(own - cli) / cli > 0.02) addFlag(run, 'cost_mismatch');
}

export async function executeImplRun(ctx, run, h) {
  try {
    return await runImpl(ctx, run, h);
  } finally {
    checkCostMismatch(run);
    h.persist(ctx, run);
  }
}

async function runImpl(ctx, run, h) {
  const { experiment, armFiles, tasks, batch, impl } = ctx;
  const arm = armFiles[run.arm];
  const task = tasks[run.task];
  const plan = impl.plans.get(run.plan_id);
  const { state } = run;
  const runCeiling = experiment.run_ceiling_usd;
  const pluginDirs = (arm.plugins ?? []).map((p) => path.join(ctx.expRoot, 'plugins', p));
  const pluginInfo = pluginDirs.map(describePlugin);
  const hook = (name) => ctx.deps.hook?.(name, { run });
  let agentMs = 0;
  const flagsFor = (resume, cap) => claudeArgs({
    model: arm.model.main, maxBudgetUsd: cap, pluginDirs, mcp: arm.mcp ?? [], allowedTools: arm.allowed_tools ?? [],
    disallowedTools: arm.disallowed_tools ?? ['WebFetch', 'WebSearch'], permissionMode: arm.permission_mode, resume, effort: arm.effort,
  });

  if (run.resumed) {
    run.clone = run.manifest.clone_path;
  } else {
    state.status = 'running';
    state.started_at = ctx.now().toISOString();
    h.persist(ctx, run);
    const info = prepareImplClone({ repoRoot: ctx.repoRoot, baseCommit: task.base_commit, dest: run.clone, arm, planFiles: plan.planFiles });
    // the pristine toolchain is copied, not installed again (no network per sample); links are recreated inside the clone
    copyToolchains(impl.baselineTree, run.clone);
    state.git_protected = info.gitProtected;
    state.overlay_missing = overlayMissing(impl.baselineTree, run.clone);
    run.manifest.plan_files = Object.fromEntries([...plan.planFiles].map(([rel, bytes]) => [rel, sha256(bytes)]));
  }
  h.persist(ctx, run);

  let prompt;
  if (run.resumed) prompt = state.turn_state === 'in_turn' ? h.prompts.CONTINUE_PROMPT : (state.next_prompt ?? h.prompts.CONTINUE_PROMPT);
  else prompt = renderPrompt(arm, plan, run.task, h);
  let probed = false;

  for (;;) {
    if (state.attempt_state === 'agent') {
      if (!probed) {
        const aborted = await probe();
        if (aborted) return undefined;
        probed = true;
      }
      if (await agentTurns()) return undefined;
      state.attempt_state = 'checking';
      h.persist(ctx, run);
    }

    // checking: a result file that already exists is never computed twice (E39, E53); otherwise the checks run again
    // from scratch, with no agent turn and no new charge (E33)
    hook('checking_start');
    const file = checksFileOf(run, state.attempt);
    let result = fs.existsSync(file) ? readJson(file) : null;
    if (!result) {
      const pristine = pristineProblem({ baselineTree: impl.baselineTree, baseline: impl.baseline, acceptanceDir: impl.acceptanceDir });
      if (pristine) throw new h.Exit(7, pristine);
      result = await runVerification({
        task, checksList: impl.checksList, baseline: impl.baseline, baselineTree: impl.baselineTree, clone: run.clone, planFiles: plan.planFiles,
        planTexts: plan.planTexts, adapterPlanFiles: plan.adapterPlanFiles, adapterPath: plan.adapterPath, acceptanceDir: impl.acceptanceDir,
        checksPath: impl.checksPath, repoRoot: ctx.repoRoot, scratch: path.join(ctx.expRoot, 'local', 'scratch', `${run.run_id}-a${state.attempt}`),
        cacheDir: impl.cacheDir, outFile: file, runFlags: run.manifest.flags.filter((f) => RUN_LEVEL_FLAGS.includes(f)), gitProtected: state.git_protected,
        overlayMissing: new Set(state.overlay_missing ?? []), defaultTimeoutS: experiment.check_timeout_s, totalS: experiment.check_total_s,
        deps: ctx.deps.verify ?? {},
      });
    }
    hook('after_checks_file');
    for (const f of result.flags) addFlag(run, f);
    if (result.notes_truncated) addFlag(run, 'output_truncated');
    ctx.log(`run ${run.run_id} attempt ${state.attempt}: ${result.green ? 'green' : 'not green'}, cost ${round4(state.spend.arm)}`);

    if (result.green || state.attempt >= experiment.attempts) {
      state.attempt_state = 'done';
      state.status = 'done';
      state.ended_at = ctx.now().toISOString();
      state.next_prompt = null;
      h.persist(ctx, run);
      return undefined;
    }

    // attempt 2: the manifest hashes still match, the harness's bytes are written back, then the same session resumes
    const changed = [...changedHashes(run.manifest.hashes, computeHashes({ expRoot: ctx.expRoot, armId: run.arm, taskId: run.task, experimentId: experiment.id })), ...implHashChanges({ expRoot: ctx.expRoot, manifest: run.manifest })];
    if (changed.length) throw new h.Exit(7, `inputs changed since run ${run.run_id} started: ${changed.join(', ')}`);
    const paths = [...result.protected_changed.filter((p) => !p.startsWith('.git/') && p !== '.gitattributes'), ...result.plan_changed];
    // an unsafe clone was not compared: write back every plan file and protected file, so that a link in their way is found (E102)
    if (result.flags.includes('unsafe_path')) paths.push(...plan.planFiles.keys(), ...protectedBaseFiles(impl.baselineTree, task.protected_globs ?? []));
    const { restored, refused } = restoreFiles({ paths, clone: run.clone, baselineTree: impl.baselineTree, planFiles: plan.planFiles });
    const link = refused.find((r) => r.reason.startsWith('containment'));
    if (link) { h.abort(ctx, run, 'containment', `${link.path}: ${link.reason}`); return undefined; }
    prompt = buildFeedback({ result, restored, checks: impl.checksList });
    state.attempt = 2;
    state.attempt2_started ??= ctx.now().toISOString();
    state.cli_total_at_boundary ??= state.cli_total_usd;
    state.attempt_state = 'agent';
    state.empty_streak = 0;
    state.next_prompt = prompt;
    h.persist(ctx, run);
    hook('before_attempt2_prompt');
  }

  async function probe() {
    const out = await h.invoke(ctx, run, { args: flagsFor(undefined, invocationCap(runCeiling, 0)), prompt: h.prompts.PROBE_PROMPT, timeoutMs: experiment.turn_timeout_s * 1000 });
    const cost = out.result ? costFromModelUsage(out.result.modelUsage, ctx.pricing) ?? 0 : 0;
    state.spend.probe = round4((state.spend.probe ?? 0) + cost);
    batch.spend.probe += cost;
    const verdict = out.record
      ? checkProbe({ record: out.record, hookEvents: out.hookEvents, arm, plugins: pluginInfo, ignore: ctx.config.isolation_ignore })
      : { ok: false, problems: [{ kind: 'gap', set: 'init record' }] };
    if (!verdict.ok) { h.abort(ctx, run, 'isolation_mismatch', describeProblems(verdict.problems).join('; ')); return true; }
    run.manifest.versions.cli = out.record.claude_code_version;
    return false;
  }

  /** The turn loop of one attempt. Returns true when the run was aborted, false at `EXP-DONE`. */
  async function agentTurns() {
    for (;;) {
      if (batch.violation) { h.abort(ctx, run, 'containment', batch.violation.join(', ')); return true; }
      if (agentMs >= experiment.run_timeout_s * 1000) { h.abort(ctx, run, 'timeout', 'run_timeout_s'); return true; }
      const cap = invocationCap(runCeiling, state.spend.arm);
      if (cap <= 0) { h.abort(ctx, run, 'budget', 'run ceiling reached before launch'); return true; }

      state.first_prompt_at ??= ctx.now().toISOString();
      state.turn_state = 'in_turn';
      state.next_prompt = prompt;
      h.persist(ctx, run);
      const poll = startPoll({ ctx, clone: run.clone, maxMb: experiment.max_clone_mb });
      const t0 = Date.now();
      let out;
      try {
        out = await h.invoke(ctx, run, {
          args: flagsFor(state.session_id ?? undefined, cap), prompt, onSpawn: poll.setKill,
          timeoutMs: Math.min(experiment.turn_timeout_s * 1000, experiment.run_timeout_s * 1000 - agentMs),
        });
      } finally {
        poll.stop();
      }
      agentMs += Date.now() - t0;

      const bad = h.containmentDiff(ctx);
      if (bad.length || batch.violation) {
        batch.violation = batch.violation ?? bad;
        for (const kill of batch.kills) kill();
        h.abort(ctx, run, 'containment', batch.violation.join(', '));
        return true;
      }
      const diskReason = poll.reason ?? await poll.check();
      if (diskReason) { h.abort(ctx, run, 'disk', diskReason); return true; }
      if (out.res.timedOut) { h.abort(ctx, run, 'timeout', 'turn_timeout_s'); return true; }

      if (out.record && !state.session_id) {
        if (!isUuid(out.record.session_id)) throw new ConfigError('the CLI returned a session id that is not a UUID');
        state.session_id = out.record.session_id;
      }
      // cost: cumulative per session; the run ceiling basis is the sum over sessions (N1, E73)
      state.sessions ??= {};
      if (out.result) {
        const computed = costFromModelUsage(out.result.modelUsage, ctx.pricing);
        if (computed === null) { h.abort(ctx, run, 'crash', 'a model in the result is not in pricing.json'); return true; }
        const sid = out.result.session_id ?? state.session_id ?? 'unknown';
        const sess = (state.sessions[sid] ??= { computed: 0, cli: 0 });
        sess.computed = computed;
        if (typeof out.result.total_cost_usd === 'number') sess.cli = out.result.total_cost_usd;
        state.cli_total_usd = Object.values(state.sessions).reduce((s, x) => s + x.cli, 0);
      }
      const spent = Object.values(state.sessions).reduce((s, x) => s + x.computed, 0);
      batch.spend.arm += Math.max(0, spent - state.spend.arm);
      state.spend.arm = spent;
      state.turn_count += 1;
      state.turn_state = 'idle';

      const reason = reasonFromResult(out.result, out.res.code);
      const { exceeded, overshoot } = evaluateRun({ armSpent: spent, runCeiling });
      if (reason === 'budget' || exceeded) {
        state.overshoot_usd = overshoot;
        h.abort(ctx, run, 'budget', `spend ${round4(spent)} of ${runCeiling}`);
        return true;
      }
      if (reason) {
        const said = typeof out.result?.result === 'string' ? sanitizeText(out.result.result, { max: 200 }) : '';
        h.abort(ctx, run, reason, `${out.result?.subtype ?? `exit ${out.res.code}`}${said ? `: ${said}` : ''}`);
        return true;
      }

      // end-of-turn controls (F6): sweep the clone, then look for reads and calls outside it
      const swept = await (ctx.deps.sweep ?? sweepProcesses)({ root: run.clone });
      if (swept.survivors.length) { h.abort(ctx, run, 'containment', `process ${swept.survivors.join(', ')} survived the sweep of the clone`); return true; }
      const outside = outsideCloneAccess({
        events: out.events, clone: run.clone, worktreesRoot: ctx.worktreesRoot, repoRoot: ctx.repoRoot, expRoot: ctx.expRoot, home: ctx.home ?? os.homedir(), canary: impl.canary,
      });
      if (outside || canaryInClone(run.clone, impl.canary)) addFlag(run, 'outside_clone_access');
      h.persist(ctx, run);

      const text = out.result.result;
      const kind = classifyTurn(text);
      if (kind === 'done') {
        state.empty_streak = 0;
        return false;
      }
      if (kind === 'empty') {
        state.empty_streak += 1;
        state.status_streak = 0;
        if (state.empty_streak >= 2) { h.abort(ctx, run, 'turn_cap', 'two empty replies'); return true; }
        prompt = h.prompts.RETRY_PROMPT;
      } else if (kind === 'status') {
        // a status update asks nothing: continue without counting a question
        state.empty_streak = 0;
        state.status_streak = (state.status_streak ?? 0) + 1;
        if (state.status_streak > (ctx.deps.maxStatusTurns ?? MAX_STATUS_TURNS)) { h.abort(ctx, run, 'turn_cap', `${state.status_streak} status updates in a row`); return true; }
        prompt = h.prompts.CONTINUE_PROMPT;
      } else {
        state.empty_streak = 0;
        state.status_streak = 0;
        // the question after the last allowed one aborts and is not counted (F7)
        if (state.plan_gap_questions >= experiment.max_questions) { h.abort(ctx, run, 'turn_cap', `question ${state.plan_gap_questions + 1} above max_questions ${experiment.max_questions}`); return true; }
        state.plan_gap_questions += 1;
        state.question_count += 1;
        appendQuestion(run.paths, { run_id: run.run_id, turn: state.turn_count, text: String(text).slice(0, 2000), source: 'assumption', bank_id: null, note: null });
        prompt = IMPL_ANSWER;
      }
      state.next_prompt = prompt;
      h.persist(ctx, run);
    }
  }
}

function protectedBaseFiles(baselineTree, globs) {
  const unlimited = { maxFileBytes: Number.MAX_SAFE_INTEGER, maxFiles: Number.MAX_SAFE_INTEGER, maxMs: Number.MAX_SAFE_INTEGER };
  return walkClone(baselineTree, unlimited).files.map((f) => f.rel).filter((rel) => globs.some((g) => matchGlob(g, rel)));
}

function renderPrompt(arm, plan, taskId, h) {
  return `${arm.prompt.replaceAll('{{plan_path}}', plan.planPath).replaceAll('{{spec_paths}}', plan.specPaths.join(' ')).replaceAll('{{task_id}}', taskId)}\n\n${h.prompts.COMPLETION_BLOCK}`;
}
