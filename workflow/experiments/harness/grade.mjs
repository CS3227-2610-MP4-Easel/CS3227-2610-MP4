// F12: `exp grade`. Lint (arms that use the lite format), seeded-issue outcomes, two-call rubric scores for the spec and
// the plan, review rounds and fix iterations; writes grades.json and moves the run to `complete`.
import fs from 'node:fs';
import path from 'node:path';
import { artifactText, copyArtifacts, findArtifacts, specIndex } from './artifacts.mjs';
import { UsageError } from './bank.mjs';
import { batchReached, round4, totalOf } from './budget.mjs';
import { judgeIssues, scoreArtifact, seedFor } from './judge.mjs';
import { defaultLintScript, lintArtifacts } from './lintrun.mjs';
import { readQuestions, setIssueIds } from './questions.mjs';
import { redact, scan } from './secrets.mjs';
import { buildDiff, buildReviewPrompt, reviewRun } from './implreview.mjs';
import { splitCosts } from './implcost.mjs';
import { readJson, runPaths, writeJsonAtomic } from './state.mjs';

const round2 = (x) => Math.round(x * 100) / 100;

export async function gradeRun({ expRoot, repoRoot, runId, launcher, env, model, lintScript = defaultLintScript(repoRoot) }) {
  const paths = runPaths(expRoot, runId);
  if (!fs.existsSync(paths.manifest)) throw new UsageError(`run ${runId} does not exist`);
  const manifest = readJson(paths.manifest);
  const state = readJson(paths.state);
  if (manifest.plan_id) return gradeImplRun({ expRoot, runId, paths, manifest, state, launcher, env, model });
  if (state.status !== 'extracted' || state.abort_reason) throw new UsageError(`run ${runId} is ${state.abort_reason ? 'aborted' : state.status}; grading needs an extracted run that did not abort`);
  const arm = readJson(path.join(expRoot, 'arms', `${manifest.arm_id}.json`));
  const task = readJson(path.join(expRoot, 'tasks', manifest.task_id, 'task.json'));
  const experiment = readJson(path.join(expRoot, 'experiments', `${manifest.experiment_id}.json`));
  const expStatePath = path.join(expRoot, 'local', 'experiments', manifest.experiment_id, 'state.json');
  const expState = fs.existsSync(expStatePath) ? readJson(expStatePath) : { batch_spend_usd: { arm: 0, answerer: 0, matcher: 0, judge: 0, probe: 0 } };
  if (batchReached({ batchSpent: totalOf(expState.batch_spend_usd), batchCeiling: experiment.batch_ceiling_usd })) {
    return { exit: 5, reason: 'batch ceiling reached before grading' };
  }

  const flags = new Set((manifest.flags ?? []).filter((f) => f !== 'judge_error' && f !== 'judge_unstable')); // a regrade starts the judge flags afresh
  const grades = { lint_errors_spec: null, lint_errors_plan: null, issues: null, rubric_spec: null, rubric_plan: null, rubric_gap: null, rubric_total: null };

  // artifacts
  const found = findArtifacts({ clone: manifest.clone_path, baseCommit: manifest.base_commit, globs: arm.artifact_globs });
  const copies = copyArtifacts({ clone: manifest.clone_path, found, destDir: paths.artifacts });
  const missing = !copies.spec.length || !copies.plan.length;
  if (missing) flags.add('missing_artifact');
  const texts = { spec: artifactText(copies.spec, paths.artifacts), plan: artifactText(copies.plan, paths.artifacts) };

  // credentials never reach the judge (E47)
  const hits = scan(`${texts.spec}\n${texts.plan}`);
  if (hits.length) flags.add('secret_in_artifact');
  const clean = { spec: redact(texts.spec), plan: redact(texts.plan) };

  // lint
  if (arm.lint) Object.assign(grades, lintArtifacts({ lintScript, specFile: specIndex(copies.spec), planFiles: copies.plan }));
  else flags.add('lint_not_applicable');

  // judge
  let judgeCost = 0;
  let exit = 0;
  if (model === arm.model.main) flags.add('judge_same_model');
  grades.shuffle = {};
  if (!missing) {
    const rubric = fs.readFileSync(path.join(expRoot, 'rubric', 'rubric.md'), 'utf8');
    const scored = {};
    for (const kind of ['spec', 'plan']) {
      const seeds = [0, 1].map((i) => seedFor(runId, kind, i));
      grades.shuffle[kind] = seeds;
      scored[kind] = await scoreArtifact({ rubric, artifact: clean[kind], launcher, env, model, seeds });
      judgeCost += scored[kind].cost;
    }
    if (scored.spec.error || scored.plan.error) {
      flags.add('judge_error');
      exit = 6;
    } else {
      grades.rubric_spec = round2(scored.spec.mean);
      grades.rubric_plan = round2(scored.plan.mean);
      grades.rubric_gap = Math.max(scored.spec.gap, scored.plan.gap);
      grades.rubric_total = round2(scored.spec.mean + scored.plan.mean);
      grades.rubric_calls = { spec: scored.spec.calls.map((c) => c.scores), plan: scored.plan.calls.map((c) => c.scores) };
      if (scored.spec.unstable || scored.plan.unstable) flags.add('judge_unstable');
    }
  }

  // seeded issues
  if (task.issues_file && !missing) {
    const issues = readJson(path.join(expRoot, 'tasks', manifest.task_id, task.issues_file));
    const questions = readQuestions(paths);
    const j = await judgeIssues({ issues, questions, spec: clean.spec, plan: clean.plan, launcher, env, model });
    judgeCost += j.cost;
    if (j.error) {
      flags.add('judge_error');
      exit = 6;
    } else {
      grades.issues = j.issues;
      const mapped = j.questions.filter((q) => q.issue_id !== null);
      if (mapped.length) setIssueIds(paths, mapped, issues.map((i) => i.id));
    }
  }

  const usage = fs.existsSync(path.join(paths.dir, 'usage.json')) ? readJson(path.join(paths.dir, 'usage.json')) : {};
  grades.review_rounds = usage.review_rounds ?? 0;
  grades.fix_iterations = usage.fix_iterations ?? 0;
  grades.judge_cost_usd = round4(judgeCost);
  grades.flags = [...flags].sort();
  writeJsonAtomic(path.join(paths.dir, 'grades.json'), grades);

  state.spend.judge = round4((state.spend.judge ?? 0) + judgeCost);
  expState.batch_spend_usd.judge = round4((expState.batch_spend_usd.judge ?? 0) + judgeCost);
  if (exit === 0) {
    state.status = 'complete';
    manifest.status = 'complete';
  }
  manifest.flags = grades.flags;
  writeJsonAtomic(paths.state, state);
  writeJsonAtomic(paths.manifest, manifest);
  fs.mkdirSync(path.dirname(expStatePath), { recursive: true });
  writeJsonAtomic(expStatePath, expState);
  return { exit, grades };
}

// ---- implementation runs (F13, N2) --------------------------------------------------------------------------------------

/** Minimal CSV line reader for events.csv (quoted cells may hold commas and doubled quotes). */
function csvRows(text) {
  const rows = [];
  for (const line of text.split(/\r?\n/).filter(Boolean)) {
    const cells = [];
    let cur = '';
    let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const c = line[i];
      if (quoted) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i += 1; } else if (c === '"') quoted = false; else cur += c; }
      else if (c === '"') quoted = true;
      else if (c === ',') { cells.push(cur); cur = ''; } else cur += c;
    }
    cells.push(cur);
    rows.push(cells);
  }
  const [head, ...rest] = rows;
  return (head ? rest : []).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}

const lastChecks = (dir) => {
  const found = [1, 2].map((n) => path.join(dir, 'checks', `attempt-${n}.json`)).filter((f) => fs.existsSync(f)).map((f) => readJson(f));
  return found;
};

/**
 * The grade of an implementation run: a pure function of checks/, state.json, events.csv and the manifest (N2) except the
 * review block. An aborted run is red (no check result for the cut attempt, no review). The review is advisory.
 */
async function gradeImplRun({ expRoot, runId, paths, manifest, state, launcher, env, model }) {
  if (state.status !== 'extracted') throw new UsageError(`run ${runId} is ${state.status}; grading needs an extracted run`);
  const task = readJson(path.join(expRoot, 'tasks', manifest.task_id, 'task.json'));
  const experiment = readJson(path.join(expRoot, 'experiments', `${manifest.experiment_id}.json`));
  const expStatePath = path.join(expRoot, 'local', 'experiments', manifest.experiment_id, 'state.json');
  const expState = fs.existsSync(expStatePath) ? readJson(expStatePath) : { batch_spend_usd: { arm: 0, answerer: 0, matcher: 0, judge: 0, probe: 0 } };
  const aborted = Boolean(state.abort_reason);
  const attempts = lastChecks(paths.dir);
  const last = attempts.at(-1) ?? null;
  const flags = new Set((manifest.flags ?? []).filter((f) => f !== 'review_error' && f !== 'diff_truncated'));

  const green1 = !aborted && attempts[0]?.green === true;
  const green2 = !aborted && (green1 || attempts[1]?.green === true);
  const checksList = readJson(path.join(expRoot, 'tasks', manifest.task_id, task.acceptance.checks_file));
  const shared = last?.shared ?? {};
  const grades = {
    green_attempt: green1 ? 1 : green2 ? 2 : null, pass1: green1, pass2: green2,
    typecheck_errors: last?.typecheck.errors ?? null, lint_errors: last?.lint.errors ?? null, own_tests_failed: last?.own_tests.failed ?? null,
    newly_failing_tests: last ? last.baseline_tests.newly_failing.length + last.baseline_tests.missing.length : null,
    shared_required_failed: last ? checksList.filter((c) => c.required && shared[c.id]?.status !== 'pass').length : null,
    shared_info_failed: last ? checksList.filter((c) => !c.required && shared[c.id]?.status !== 'pass').length : null,
    files_off_plan: last?.files_off_plan ?? 0, plan_files_missing: last?.plan_files_missing ?? 0, gates_skipped: last?.gates_skipped ?? 0, gates_in_plan: last?.gates_in_plan ?? 0,
    review: { findings: [] }, review_cost_usd: 0,
  };
  const eventsFile = path.join(paths.dir, 'events.csv');
  const split = fs.existsSync(eventsFile)
    ? splitCosts(csvRows(fs.readFileSync(eventsFile, 'utf8')).map((r) => ({ started: r.started, cost_usd: r.cost_usd === '' || r.cost_usd === undefined ? null : Number(r.cost_usd) })), state.attempt2_started)
    : { impl_cost_usd: null, fix_cost_usd: null };
  Object.assign(grades, split);

  // the review: advisory, one call; every way it can fail leaves the grade in place with review_error
  let exit = 0;
  let reviewCost = 0;
  if (!aborted && last) {
    const baselineTree = path.join(expRoot, 'local', 'baselines', manifest.task_id, 'tree');
    if (batchReached({ batchSpent: totalOf(expState.batch_spend_usd), batchCeiling: experiment.batch_ceiling_usd })) {
      flags.add('review_error');
      exit = 5;
    } else if (!manifest.clone_path || !fs.existsSync(manifest.clone_path) || !fs.existsSync(baselineTree)) {
      flags.add('review_error');
    } else {
      // the plan text comes from the frozen snapshot, never from the clone the agent could have edited
      const entry = experiment.plans.find((p) => p.plan_id === manifest.plan_id);
      const snapDir = path.join(expRoot, 'local', 'plans', entry.source_experiment_id, manifest.plan_id);
      const plans = readJson(path.join(snapDir, 'snapshot.json')).files.filter((f) => f.kind === 'plan').map((f) => {
        try { return fs.readFileSync(path.join(snapDir, 'files', ...f.path.split('/')), 'utf8'); } catch { return ''; }
      });
      let notes = null;
      try {
        // a link or hardlink here could point at a local secret that the review call would then read
        const notesPath = path.join(manifest.clone_path, 'IMPLEMENTATION-NOTES.md');
        const st = fs.lstatSync(notesPath);
        if (st.isFile() && st.nlink === 1) notes = fs.readFileSync(notesPath, 'utf8');
      } catch { /* none */ }
      const diff = buildDiff({ clone: manifest.clone_path, baselineTree, changed: last.changed_files, deleted: last.deleted_files });
      const { prompt, diffTruncated } = buildReviewPrompt({ plans, notes, diff, paths: [...last.changed_files, ...last.deleted_files] });
      if (diffTruncated) flags.add('diff_truncated');
      const r = await reviewRun({ launcher, env, model, prompt });
      reviewCost = r.cost;
      if (r.error) {
        flags.add('review_error');
        if (r.error === 'secret') exit = 9;
      } else {
        grades.review = { findings: r.findings };
      }
    }
  }
  grades.review_cost_usd = round4(reviewCost);
  grades.flags = [...flags].sort();
  writeJsonAtomic(path.join(paths.dir, 'grades.json'), grades);

  state.spend.judge = round4((state.spend.judge ?? 0) + reviewCost);
  expState.batch_spend_usd.judge = round4((expState.batch_spend_usd.judge ?? 0) + reviewCost);
  if (exit !== 5) { state.status = 'complete'; manifest.status = 'complete'; }
  manifest.flags = grades.flags;
  writeJsonAtomic(paths.state, state);
  writeJsonAtomic(paths.manifest, manifest);
  fs.mkdirSync(path.dirname(expStatePath), { recursive: true });
  writeJsonAtomic(expStatePath, expState);
  return { exit, grades };
}
