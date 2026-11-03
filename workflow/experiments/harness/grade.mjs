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
import { readJson, runPaths, writeJsonAtomic } from './state.mjs';

const round2 = (x) => Math.round(x * 100) / 100;

export async function gradeRun({ expRoot, repoRoot, runId, launcher, env, model, lintScript = defaultLintScript(repoRoot) }) {
  const paths = runPaths(expRoot, runId);
  if (!fs.existsSync(paths.manifest)) throw new UsageError(`run ${runId} does not exist`);
  const manifest = readJson(paths.manifest);
  const state = readJson(paths.state);
  if (state.status !== 'extracted' || state.abort_reason) throw new UsageError(`run ${runId} is ${state.abort_reason ? 'aborted' : state.status}; grading needs an extracted run that did not abort`);
  const arm = readJson(path.join(expRoot, 'arms', `${manifest.arm_id}.json`));
  const task = readJson(path.join(expRoot, 'tasks', manifest.task_id, 'task.json'));
  const experiment = readJson(path.join(expRoot, 'experiments', `${manifest.experiment_id}.json`));
  const expStatePath = path.join(expRoot, 'local', 'experiments', manifest.experiment_id, 'state.json');
  const expState = fs.existsSync(expStatePath) ? readJson(expStatePath) : { batch_spend_usd: { arm: 0, answerer: 0, matcher: 0, judge: 0, probe: 0 } };
  if (batchReached({ batchSpent: totalOf(expState.batch_spend_usd), batchCeiling: experiment.batch_ceiling_usd })) {
    return { exit: 5, reason: 'batch ceiling reached before grading' };
  }

  const flags = new Set(manifest.flags ?? []);
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
