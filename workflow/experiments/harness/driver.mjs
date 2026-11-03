// The run loop (F5, F6, F14, F15, F17): preflight, clone, probe, prompt, classify, answer, resume, parallelism,
// timeouts, containment. Everything that spawns goes through spawn.mjs; the answerer and extraction are seams.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { FIXED_ASSUMPTION, answerSheet } from './answerer.mjs';
import { runCheck } from './check.mjs';
import { classifyTurn, hasQuestionBeforeDone } from './classify.mjs';
import { assertClonePath, clonePathFor, prepareClone } from './clone.mjs';
import { batchPaths, diff, hashFile, snapshot } from './containment.mjs';
import { batchReached, costFromModelUsage, evaluateRun, exitForReason, invocationCap, reasonFromResult, round4, summarize, totalOf } from './budget.mjs';
import { checkProbe, describePlugin, describeProblems, probeParts } from './isolation.mjs';
import { activeEntries, findExact, loadBank } from './bank.mjs';
import { appendQuestion } from './questions.mjs';
import { enqueue, getItem, logAuto, suggestDuplicate } from './queue.mjs';
import { sanitizeText } from './sanitize.mjs';
import { resolveWorktreesRoot } from './paths.mjs';
import { ConfigError, buildEnv, claudeArgs, isUuid, parseStream, resolveLauncher, runProcess } from './spawn.mjs';
import {
  HARNESS_VERSION, approvalHash, approve, buildManifest, changedHashes, computeHashes, configDir as defaultConfigDir, isApproved,
  isTerminal, loadState, newRunState, readJson, runPaths, saveState, writeJsonAtomic,
} from './state.mjs';

export const COMPLETION_BLOCK = 'When the artifact is complete, end your final message with a last line that is exactly EXP-DONE. Ask the operator in plain text if you need a decision; your turn ends when you ask.';
export const RETRY_PROMPT = 'Continue, ask a question, or finish with EXP-DONE';
export const CONTINUE_PROMPT = 'Continue from where you stopped.';
export const PROBE_PROMPT = 'Reply with exactly the word: ok';
export { FIXED_ASSUMPTION };
export const MAX_QUESTIONS = 40;
const SUPPORTED_STAGE = 'specplan';

class Exit extends Error {
  constructor(code, message) { super(message); this.exit = code; }
}

const pad = (n) => String(n).padStart(2, '0');
export function runIdFor(date, taskId, armId, rep) {
  const d = date;
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}-${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}-${taskId}-${armId}-r${rep}`;
}

const git = (cwd, args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

/** F15: the experiment file must be tracked, in HEAD and unmodified. Returns a reason or null. */
export function experimentFileProblem(repoRoot, file) {
  const rel = path.relative(repoRoot, file).split(path.sep).join('/');
  try { git(repoRoot, ['ls-files', '--error-unmatch', '--', rel]); } catch { return 'untracked'; }
  try { git(repoRoot, ['cat-file', '-e', `HEAD:${rel}`]); } catch { return 'staged but not committed'; }
  try { git(repoRoot, ['diff', '--quiet', 'HEAD', '--', rel]); } catch { return 'modified since HEAD'; }
  return null;
}

const renderPrompt = (arm, brief, taskId) => `${arm.prompt.replaceAll('{{brief}}', brief).replaceAll('{{task_id}}', taskId)}\n\n${COMPLETION_BLOCK}`;

// ---- the batch --------------------------------------------------------------------------------------------------

export async function runExperiment({ repoRoot, expRoot, experimentId, filters = {}, dry = false, yes = {}, continueRunId = null, deps = {} }) {
  const lines = [];
  const log = (l) => { lines.push(l); deps.log?.(l); };
  try {
    return await runBatch({ repoRoot, expRoot, experimentId, filters, dry, yes, continueRunId, deps, log, lines });
  } catch (e) {
    if (e instanceof Exit || e instanceof ConfigError) {
      log(e.message);
      return { exit: e.exit, lines, table: [], runs: [] };
    }
    throw e;
  }
}

async function runBatch({ repoRoot, expRoot, experimentId, filters, dry, yes, continueRunId, deps, log, lines }) {
  const now = deps.now ?? (() => new Date());
  const cfgDir = deps.configDir ?? defaultConfigDir();
  const home = deps.home;

  // --continue reads the experiment id from the run's manifest.
  let resumeRun = null;
  if (continueRunId) {
    const paths = runPaths(expRoot, continueRunId);
    if (!fs.existsSync(paths.manifest)) throw new Exit(2, `run ${continueRunId} does not exist`);
    const manifest = readJson(paths.manifest);
    const state = loadState(paths);
    if (isTerminal(state.status)) throw new Exit(2, `run ${continueRunId} is ${state.status}; nothing to continue`);
    if (!['running', 'waiting_operator'].includes(state.status)) throw new Exit(2, `run ${continueRunId} is ${state.status}; only running or waiting runs continue`);
    experimentId = manifest.experiment_id;
    if (!isUuid(state.session_id)) throw new Exit(3, `stored session id of run ${continueRunId} is not a UUID`);
    const changed = changedHashes(manifest.hashes, computeHashes({ expRoot, armId: manifest.arm_id, taskId: manifest.task_id, experimentId }));
    if (changed.length) throw new Exit(7, `inputs changed since run ${continueRunId} started: ${changed.join(', ')}`);
    resumeRun = { paths, manifest, state };
  }

  // 1. F15: the experiment file is committed and unmodified.
  const expFile = path.join(expRoot, 'experiments', `${experimentId}.json`);
  if (!fs.existsSync(expFile)) throw new Exit(3, `experiment ${experimentId} does not exist`);
  const problem = experimentFileProblem(repoRoot, expFile);
  if (problem) throw new Exit(7, `experiment file ${path.relative(repoRoot, expFile)} is ${problem}; commit it before running`);
  const experiment = readJson(expFile);

  // 2. unsupported stages exit 8 before anything is created.
  const armFiles = Object.fromEntries(experiment.arm_ids.map((a) => [a, readJson(path.join(expRoot, 'arms', `${a}.json`))]));
  const tasks = Object.fromEntries(experiment.task_ids.map((t) => [t, readJson(path.join(expRoot, 'tasks', t, 'task.json'))]));
  for (const a of Object.values(armFiles)) if (a.stage !== SUPPORTED_STAGE) throw new Exit(8, `stage ${a.stage} (arm ${a.id}) is not supported in this version`);

  // 3. configuration.
  const check = runCheck({ expRoot, repoRoot });
  if (check.code !== 0) throw new Exit(3, `exp check failed:\n${check.lines.filter((l) => !l.endsWith(': ok')).join('\n')}`);
  const config = readJson(path.join(expRoot, 'config.json'));
  const pricing = readJson(path.join(expRoot, 'pricing.json'));
  const worktreesRoot = resolveWorktreesRoot(config, repoRoot);
  const launcher = deps.launcher ?? resolveLauncher(config.claude_bin);
  for (const [model] of Object.entries(pricing.models)) {
    const checked = Date.parse(pricing.models[model].checked);
    if (Number.isFinite(checked) && now().getTime() - checked > 30 * 86400e3) log(`warning: price for ${model} was checked more than 30 days ago`);
  }

  // 4. approvals (E4).
  for (const a of experiment.arm_ids) {
    const hash = approvalHash({ expRoot, armId: a });
    const arm = armFiles[a];
    log(`arm ${a}: plugins [${(arm.plugins ?? []).join(', ')}] allowed tools [${(arm.allowed_tools ?? []).join(', ')}] approval hash ${hash}`);
    if (!isApproved(cfgDir, a, hash)) {
      if (yes[a] === hash) approve(cfgDir, a, hash);
      else throw new Exit(2, `arm ${a} is not approved at hash ${hash}; rerun with --yes ${a}=${hash} after reviewing the plugin list and tools above`);
    }
  }

  // 5. plan the runs.
  const planned = [];
  const existing = scanRuns(expRoot, experimentId);
  if (resumeRun) {
    planned.push({ resume: resumeRun, run_id: resumeRun.manifest.run_id, task: resumeRun.manifest.task_id, arm: resumeRun.manifest.arm_id, rep: resumeRun.manifest.rep });
  } else {
    const taskIds = filters.task ? [filters.task] : experiment.task_ids;
    const armIds = filters.arm ? [filters.arm] : experiment.arm_ids;
    for (const t of taskIds) {
      for (const a of armIds) {
        if (!tasks[t] || !armFiles[a]) throw new Exit(2, `unknown task ${t} or arm ${a}`);
        const taken = new Set(existing.filter((r) => r.task_id === t && r.arm_id === a).map((r) => r.rep));
        if (filters.rep !== undefined) {
          if (taken.has(filters.rep)) throw new Exit(2, `run for ${t} ${a} rep ${filters.rep} already exists`);
          planned.push({ task: t, arm: a, rep: filters.rep });
        } else {
          for (let rep = 1; rep <= experiment.replicates; rep += 1) if (!taken.has(rep)) planned.push({ task: t, arm: a, rep });
        }
      }
    }
    if (planned.length === 0) {
      log(`all ${experiment.replicates} replicates already exist; nothing to run`);
      return { exit: 0, lines, table: [], runs: [] };
    }
    const stamp = now();
    for (const p of planned) {
      p.run_id = runIdFor(stamp, p.task, p.arm, p.rep);
      assertClonePath(clonePathFor(worktreesRoot, p.run_id));
    }
  }

  if (dry) {
    for (const p of planned) log(`planned run ${p.run_id}`);
    return { exit: 0, lines, table: [], runs: [] };
  }

  // 6. shared batch context: containment snapshot, kill registry, spend.
  const expState = loadExperimentState(expRoot, experimentId, experiment);
  const batch = {
    snapshot: snapshot(batchPaths({ repoRoot, expRoot, home })),
    recorded: new Map(), kills: new Set(), violation: null,
    spend: { ...expState.batch_spend_usd },
  };
  const ctx = { repoRoot, expRoot, experiment, armFiles, tasks, pricing, config, worktreesRoot, launcher, deps, log, batch, now, home };

  const runs = [];
  for (const p of planned) runs.push(p.resume ? { ...p.resume, ...p, resumed: true } : createRun(ctx, p));

  const queue = [...runs];
  let batchStopped = false;
  const worker = async () => {
    while (queue.length) {
      if (batchReached({ batchSpent: totalOf(batch.spend), batchCeiling: experiment.batch_ceiling_usd })) { batchStopped = true; return; }
      const run = queue.shift();
      try {
        await executeRun(ctx, run);
      } catch (e) {
        if (e instanceof ConfigError) abort(ctx, run, 'crash', e.message);
        else throw e;
      }
      if (deps.afterRun) {
        await deps.afterRun(run, ctx);
        // the hook may rewrite the run files (extraction does): record the new hashes so containment stays quiet
        run.state = loadState(run.paths);
        batch.recorded.set(run.paths.state, hashFile(run.paths.state));
        batch.recorded.set(run.paths.manifest, hashFile(run.paths.manifest));
      }
    }
  };
  await Promise.all(Array.from({ length: experiment.max_parallel }, worker));

  expState.batch_spend_usd = Object.fromEntries(Object.entries(batch.spend).map(([k, v]) => [k, round4(v)]));
  writeJsonAtomic(path.join(expRoot, 'local', 'experiments', experimentId, 'state.json'), expState);

  const summary = summarize(runs.map((r) => ({ run_id: r.run_id, status: r.state.status, abort_reason: r.state.abort_reason })));
  summary.table.forEach(log);
  if (batchStopped) summary.exit = Math.max(summary.exit, 5);
  return { exit: summary.exit, lines, table: summary.table, runs: runs.map((r) => ({ run_id: r.run_id, status: r.state.status, abort_reason: r.state.abort_reason })) };
}

function scanRuns(expRoot, experimentId) {
  const dir = path.join(expRoot, 'local', 'runs');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).flatMap((id) => {
    try {
      const m = readJson(path.join(dir, id, 'manifest.json'));
      return m.experiment_id === experimentId ? [m] : [];
    } catch { return []; }
  });
}

function loadExperimentState(expRoot, experimentId, experiment) {
  const file = path.join(expRoot, 'local', 'experiments', experimentId, 'state.json');
  let s;
  try { s = readJson(file); } catch { s = null; }
  if (!s) {
    s = { arm_codes: Object.fromEntries(experiment.arm_ids.map((a, i) => [a, String.fromCharCode(65 + i)])), batch_spend_usd: { arm: 0, answerer: 0, matcher: 0, judge: 0, probe: 0 } };
  }
  return s;
}

function createRun(ctx, p) {
  const paths = runPaths(ctx.expRoot, p.run_id);
  const task = ctx.tasks[p.task];
  const manifest = buildManifest({
    expRoot: ctx.expRoot, repoRoot: ctx.repoRoot, runId: p.run_id, experimentId: ctx.experiment.id, taskId: p.task, armId: p.arm, rep: p.rep, baseCommit: task.base_commit,
  });
  const state = newRunState();
  const run = { ...p, paths, manifest, state, clone: clonePathFor(ctx.worktreesRoot, p.run_id) };
  persist(ctx, run);
  return run;
}

/** Save state and manifest and record their hashes, which containment compares at the next turn boundary. */
function persist(ctx, run) {
  run.manifest.status = run.state.status;
  run.manifest.abort_reason = run.state.abort_reason;
  run.manifest.clone_path = run.clone;
  ctx.batch.recorded.set(run.paths.state, saveState(run.paths, run.state));
  ctx.batch.recorded.set(run.paths.manifest, writeJsonAtomic(run.paths.manifest, run.manifest));
}

function abort(ctx, run, reason, detail) {
  run.state.status = 'aborted';
  run.state.abort_reason = reason;
  run.state.abort_detail = detail ?? null;
  run.state.exit_code = exitForReason(reason);
  run.state.turn_state = 'idle';
  run.state.ended_at = ctx.now().toISOString();
  persist(ctx, run);
  ctx.log(`run ${run.run_id} aborted: ${reason}${detail ? ` (${detail})` : ''}`);
}

/** Paths whose hash no longer matches what the batch or the harness recorded (F17). */
function containmentDiff(ctx) {
  const current = snapshot(batchPaths({ repoRoot: ctx.repoRoot, expRoot: ctx.expRoot, home: ctx.home }));
  const changed = diff(ctx.batch.snapshot, current);
  for (const [file, hash] of ctx.batch.recorded) if (hashFile(file) !== hash) changed.push(file);
  return changed;
}

async function invoke(ctx, run, { args, prompt, timeoutMs }) {
  const env = buildEnv(ctx.deps.parentEnv ?? process.env, { authMode: ctx.config.auth_mode, extra: ctx.deps.extraEnv ?? {} });
  let kill;
  const res = await runProcess({
    launcher: ctx.launcher, args, cwd: run.clone, env, input: prompt, timeoutMs,
    onSpawn: (k) => { kill = k; ctx.batch.kills.add(k); },
  });
  ctx.batch.kills.delete(kill);
  const events = parseStream(res.stdout);
  return { res, events, result: events.find((e) => e.type === 'result'), ...probeParts(events) };
}

async function executeRun(ctx, run) {
  const { experiment, armFiles, tasks, batch } = ctx;
  const arm = armFiles[run.arm];
  const task = tasks[run.task];
  const state = run.state;
  const runCeiling = experiment.run_ceiling_usd;
  const pluginDirs = (arm.plugins ?? []).map((p) => path.join(ctx.expRoot, 'plugins', p));
  const pluginInfo = pluginDirs.map(describePlugin);
  const startedAt = Date.now();
  const flags = (resume, cap) => claudeArgs({
    model: arm.model.main, maxBudgetUsd: cap, pluginDirs, mcp: arm.mcp ?? [], allowedTools: arm.allowed_tools ?? [],
    disallowedTools: arm.disallowed_tools ?? ['WebFetch', 'WebSearch'], permissionMode: arm.permission_mode, resume,
  });

  if (run.resumed) {
    run.clone = run.manifest.clone_path;
  } else {
    state.status = 'running';
    state.started_at = ctx.now().toISOString();
    persist(ctx, run);
    prepareClone({ repoRoot: ctx.repoRoot, baseCommit: task.base_commit, dest: run.clone, arm });
  }
  persist(ctx, run);

  // probe: same isolation flags, before any task prompt
  const probe = await invoke(ctx, run, { args: flags(undefined, invocationCap(runCeiling, 0)), prompt: PROBE_PROMPT, timeoutMs: experiment.turn_timeout_s * 1000 });
  const probeCost = probe.result ? costFromModelUsage(probe.result.modelUsage, ctx.pricing) ?? 0 : 0;
  state.spend.probe = round4((state.spend.probe ?? 0) + probeCost);
  batch.spend.probe += probeCost;
  const verdict = probe.record
    ? checkProbe({ record: probe.record, hookEvents: probe.hookEvents, arm, plugins: pluginInfo, ignore: ctx.config.isolation_ignore })
    : { ok: false, problems: [{ kind: 'gap', set: 'init record' }] };
  if (!verdict.ok) return abort(ctx, run, 'isolation_mismatch', describeProblems(verdict.problems).join('; '));
  run.manifest.versions.cli = probe.record.claude_code_version;

  let prompt;
  if (run.resumed && state.waiting_qid) {
    const item = getItem(ctx.expRoot, state.waiting_qid);
    const a = await waitForAnswer(ctx, run, item);
    if (a.abort) return abort(ctx, run, a.abort, a.detail);
    appendQuestion(run.paths, { run_id: run.run_id, turn: state.turn_count, text: item.text, source: a.source, bank_id: a.bank_id });
    prompt = a.text;
  } else if (run.resumed) {
    prompt = state.turn_state === 'in_turn' ? CONTINUE_PROMPT : (state.next_prompt ?? CONTINUE_PROMPT);
  } else {
    prompt = renderPrompt(arm, fs.readFileSync(path.join(ctx.expRoot, 'tasks', run.task, task.brief_file), 'utf8'), run.task);
  }

  for (;;) {
    if (batch.violation) return abort(ctx, run, 'containment', batch.violation.join(', '));
    const elapsed = Date.now() - startedAt;
    if (elapsed >= experiment.run_timeout_s * 1000) return abort(ctx, run, 'timeout', 'run_timeout_s');
    const cap = invocationCap(runCeiling, state.spend.arm);
    if (cap <= 0) return abort(ctx, run, 'budget', 'run ceiling reached before launch');

    state.first_prompt_at = state.first_prompt_at ?? ctx.now().toISOString();
    state.turn_state = 'in_turn';
    state.next_prompt = prompt;
    persist(ctx, run);
    const out = await invoke(ctx, run, {
      args: flags(state.session_id ?? undefined, cap), prompt,
      timeoutMs: Math.min(experiment.turn_timeout_s * 1000, experiment.run_timeout_s * 1000 - elapsed),
    });

    // turn boundary: containment first (F17)
    const bad = containmentDiff(ctx);
    if (bad.length || batch.violation) {
      batch.violation = batch.violation ?? bad;
      for (const kill of batch.kills) kill();
      return abort(ctx, run, 'containment', batch.violation.join(', '));
    }
    if (out.res.timedOut) return abort(ctx, run, 'timeout', 'turn_timeout_s');

    if (out.record && !state.session_id) {
      if (!isUuid(out.record.session_id)) throw new ConfigError('the CLI returned a session id that is not a UUID');
      state.session_id = out.record.session_id;
    }
    const spent = out.result ? costFromModelUsage(out.result.modelUsage, ctx.pricing) : state.spend.arm;
    if (spent === null) return abort(ctx, run, 'crash', 'a model in the result is not in pricing.json');
    if (out.result?.total_cost_usd !== undefined) state.cli_total_usd = out.result.total_cost_usd;
    batch.spend.arm += Math.max(0, spent - state.spend.arm);
    state.spend.arm = spent;
    state.turn_count += 1;
    state.turn_state = 'idle';

    const reason = reasonFromResult(out.result, out.res.code);
    const { exceeded, overshoot } = evaluateRun({ armSpent: spent, runCeiling });
    if (reason === 'budget' || exceeded) {
      state.overshoot_usd = overshoot;
      return abort(ctx, run, 'budget', `spend ${round4(spent)} of ${runCeiling}`);
    }
    if (reason) return abort(ctx, run, reason, out.result?.subtype ?? `exit ${out.res.code}`);

    const text = out.result.result;
    const kind = classifyTurn(text);
    if (kind === 'done') {
      if (hasQuestionBeforeDone(text)) appendQuestion(run.paths, { run_id: run.run_id, turn: state.turn_count, text: String(text).slice(0, 2000), source: 'assumption', note: 'ignored_after_done' });
      state.status = 'done';
      state.ended_at = ctx.now().toISOString();
      state.next_prompt = null;
      persist(ctx, run);
      ctx.log(`run ${run.run_id} done`);
      return undefined;
    }
    if (kind === 'empty') {
      state.empty_streak += 1;
      if (state.empty_streak >= 2) return abort(ctx, run, 'turn_cap', 'two empty replies');
      prompt = RETRY_PROMPT;
      state.next_prompt = prompt;
      persist(ctx, run);
      continue;
    }
    state.empty_streak = 0;
    state.question_count += 1;
    if (state.question_count > (ctx.deps.maxQuestions ?? MAX_QUESTIONS)) return abort(ctx, run, 'turn_cap', `question ${state.question_count}`);
    const answer = await (ctx.deps.answer ?? answerFor)({ run, question: String(text), state, arm, task, ctx });
    if (answer.abort) return abort(ctx, run, answer.abort, answer.detail);
    appendQuestion(run.paths, { run_id: run.run_id, turn: state.turn_count, text: String(text).slice(0, 2000), source: answer.source, bank_id: answer.bank_id ?? null, note: answer.note ?? null });
    prompt = answer.text;
    state.next_prompt = prompt;
    persist(ctx, run);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Account a model call made outside the arm: its cost class and the time it blocked a running run. */
function account(ctx, state, cls, r) {
  state.spend[cls] = round4((state.spend[cls] ?? 0) + r.cost);
  ctx.batch.spend[cls] += r.cost;
  state.timeline.answerer.push({ start: new Date(r.start).toISOString(), end: new Date(r.end).toISOString() });
}

const toolEnv = (ctx) => buildEnv(ctx.deps.parentEnv ?? process.env, { authMode: ctx.config.auth_mode, extra: ctx.deps.extraEnv ?? {} });

/** Bank mode: an exact match answers at once; otherwise the question waits in the queue for `exp answer` (F8). */
async function bankAnswer({ run, question, state, arm, ctx }) {
  const text = sanitizeText(question);
  const bank = loadBank(ctx.expRoot);
  const hit = findExact(bank, text);
  if (hit) {
    logAuto(ctx.expRoot, { run_id: run.run_id, run_code: run.arm, question: text, bank_id: hit.id, bank_question: hit.question });
    return { text: hit.answer, source: 'bank', bank_id: hit.id };
  }
  let suggested = null;
  if (activeEntries(bank).length) {
    const start = Date.now();
    const s = await suggestDuplicate({ question: text, bank, launcher: ctx.launcher, env: toolEnv(ctx), model: arm.model.main });
    account(ctx, state, 'matcher', { cost: s.cost, start, end: Date.now() });
    suggested = s.bank_id;
  }
  const item = enqueue({ expRoot: ctx.expRoot, experimentId: ctx.experiment.id, runId: run.run_id, text, suggestedBankId: suggested });
  return waitForAnswer(ctx, run, item);
}

/** waiting_operator until the item has a bank_id; the time is recorded as a wait and excluded from agent_s. */
async function waitForAnswer(ctx, run, item) {
  const { state } = run;
  state.status = 'waiting_operator';
  state.wait_started = new Date().toISOString();
  state.waiting_qid = item.qid;
  persist(ctx, run);
  const deadline = Date.now() + ctx.experiment.wait_timeout_s * 1000;
  for (;;) {
    const cur = getItem(ctx.expRoot, item.qid);
    if (cur?.bank_id) {
      const entry = loadBank(ctx.expRoot).find((e) => e.id === cur.bank_id);
      state.timeline.waits.push({ start: state.wait_started, end: new Date().toISOString() });
      state.status = 'running';
      state.wait_started = null;
      state.waiting_qid = null;
      persist(ctx, run);
      return { text: entry.answer, source: cur.run_ids[0] === run.run_id ? 'operator' : 'bank', bank_id: entry.id };
    }
    if (ctx.batch.violation) return { abort: 'containment', detail: ctx.batch.violation.join(', ') };
    if (Date.now() >= deadline) return { abort: 'timeout', detail: 'wait_timeout_s' };
    await sleep(ctx.deps.pollMs ?? 5000);
  }
}

/** Sheet mode asks the answerer model; bank mode matches or waits for the operator. */
async function answerFor(args) {
  if (args.ctx.experiment.answer_mode === 'bank') return bankAnswer(args);
  return sheetAnswer(args);
}

async function sheetAnswer({ run, question, state, arm, task, ctx }) {
  const sheet = fs.readFileSync(path.join(ctx.expRoot, 'tasks', run.task, task.sheet_file), 'utf8');
  const env = toolEnv(ctx);
  const r = await answerSheet({ question: sanitizeText(question), sheet, launcher: ctx.launcher, env, model: arm.model.main });
  account(ctx, state, 'answerer', r);
  if (r.error && !run.manifest.flags.includes(r.error)) run.manifest.flags.push(r.error);
  return { text: r.text, source: r.source };
}

export { HARNESS_VERSION };
