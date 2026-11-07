import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { UsageError } from './bank.mjs';
import { selfTest } from './commands/grade.mjs';
import { gradeRun } from './grade.mjs';
import { appendQuestion, readQuestions } from './questions.mjs';
import { buildEnv } from './spawn.mjs';
import { newRunState, readJson, runPaths, writeJsonAtomic } from './state.mjs';
import { fakeCli, git, makeExperimentRepo, put, tmpDir } from './testkit.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const REAL_RUBRIC = path.join(here, '..', 'rubric', 'rubric.md');
const scores = (c, t, u, k, r) => ({ text: JSON.stringify({ completeness: c, testability: t, unambiguity: u, consistency: k, traceability: r }), usage: { output: 30 } });
const FOUR_CALLS = [scores(4, 4, 3, 4, 3), scores(4, 3, 3, 4, 3), scores(3, 3, 3, 3, 3), scores(3, 3, 2, 3, 3)]; // spec 17.5, plan 14.5
const ISSUES = ['collision', 'contradiction'].map((id) => ({ id, category: id, text: `issue ${id}`, anchor: `anchor-${id}`, blocking: false }));

/** An extracted run whose clone (a separate git repo) holds a spec and a plan written after the base commit. */
function setup({ arm = {}, status = 'extracted', abort_reason = null, files = { 'docs/spec.md': '# Spec\nsecurity stuff\n', 'docs/plan.md': '# Plan\n- [ ] one\n' }, issues = false, experiment = {}, spend } = {}) {
  const ctx = makeExperimentRepo({ arm, experiment });
  fs.copyFileSync(REAL_RUBRIC, path.join(ctx.expRoot, 'rubric', 'rubric.md'));
  if (issues) {
    const taskFile = path.join(ctx.expRoot, 'tasks', 'task-one', 'task.json');
    put(taskFile, { ...readJson(taskFile), issues_file: 'seeded-issues.json' });
    put(path.join(ctx.expRoot, 'tasks', 'task-one', 'seeded-issues.json'), ISSUES);
  }
  const clone = tmpDir('exp-clone-');
  git(clone, 'init', '-q');
  put(path.join(clone, 'src', 'app.txt'), 'app');
  git(clone, 'add', '-A');
  git(clone, 'commit', '-q', '-m', 'base');
  const base = git(clone, 'rev-parse', 'HEAD');
  for (const [f, c] of Object.entries(files)) put(path.join(clone, f), c);
  const runId = 'run-1';
  const paths = runPaths(ctx.expRoot, runId);
  fs.mkdirSync(paths.dir, { recursive: true });
  writeJsonAtomic(paths.manifest, { run_id: runId, experiment_id: 'exp-one', task_id: 'task-one', arm_id: 'arm-one', rep: 1, status, abort_reason, flags: [], clone_path: clone, base_commit: base });
  writeJsonAtomic(paths.state, { ...newRunState(), status, abort_reason, ...(spend ? { spend } : {}) });
  writeJsonAtomic(path.join(paths.dir, 'usage.json'), { review_rounds: 1, fix_iterations: 2 });
  return { ...ctx, runId, paths, clone };
}
const grade = (s, cli, over = {}) => gradeRun({
  expRoot: s.expRoot, repoRoot: s.repoRoot, runId: s.runId, launcher: cli.launcher, env: buildEnv(process.env, { extra: cli.env }), model: 'judge-model', ...over,
});
const gradesOf = (s) => readJson(path.join(s.paths.dir, 'grades.json'));

test('a normal grade: rubric means, total, review and fix counts, status complete, judge cost counted', async () => {
  const s = setup();
  const cli = fakeCli(FOUR_CALLS);
  const res = await grade(s, cli);
  assert.equal(res.exit, 0);
  const g = gradesOf(s);
  assert.deepEqual([g.rubric_spec, g.rubric_plan, g.rubric_total, g.rubric_gap], [17.5, 14.5, 32, 1]);
  assert.deepEqual([g.review_rounds, g.fix_iterations], [1, 2]);
  assert.equal(readJson(s.paths.state).status, 'complete');
  assert.ok(readJson(s.paths.state).spend.judge > 0);
  assert.equal(g.judge_cost_usd, readJson(s.paths.state).spend.judge);
  assert.ok(readJson(path.join(s.expRoot, 'local', 'experiments', 'exp-one', 'state.json')).batch_spend_usd.judge > 0);
  assert.equal(g.issues, null, 'no seeded file, no seeded recall');
  assert.deepEqual(g.shuffle.spec.length, 2);
  assert.ok(fs.existsSync(path.join(s.paths.artifacts, 'spec', 'docs', 'spec.md')));
});

test('E48: grading an aborted run or one that is not extracted exits 2', async () => {
  for (const [status, abort_reason] of [['aborted', 'budget'], ['extracted', 'crash'], ['done', null], ['running', null], ['complete', null]]) {
    const s = setup({ status, abort_reason });
    await assert.rejects(() => grade(s, fakeCli(FOUR_CALLS)), (e) => e instanceof UsageError && e.exit === 2, `${status}/${abort_reason}`);
  }
});

test('E67: an arm with lint false leaves the lint fields empty and flagged', async () => {
  const s = setup({ arm: { lint: false } });
  await grade(s, fakeCli(FOUR_CALLS));
  const g = gradesOf(s);
  assert.deepEqual([g.lint_errors_spec, g.lint_errors_plan], [null, null]);
  assert.ok(g.flags.includes('lint_not_applicable'));
});

test('an arm with lint true counts ERROR lines from the main checkout\'s lint over the copies', async () => {
  const s = setup({ arm: { lint: true } });
  const stub = path.join(tmpDir('exp-lint-'), 'lint.mjs');
  fs.writeFileSync(stub, "console.log('ERROR a'); console.log('WARN b'); console.log('ERROR c'); console.log(process.argv[2]);");
  await grade(s, fakeCli(FOUR_CALLS), { lintScript: stub });
  const g = gradesOf(s);
  assert.deepEqual([g.lint_errors_spec, g.lint_errors_plan], [2, 2]);
  assert.ok(!g.flags.includes('lint_not_applicable'));
});

test('E68: artifacts are found by the arm globs among files changed since base_commit', async () => {
  const s = setup({ files: { 'docs/spec.md': 'spec', 'docs/spec-extra.md': 'more spec', 'docs/plan.md': 'plan', 'docs/other.md': 'not an artifact' } });
  await grade(s, fakeCli(FOUR_CALLS));
  const copied = (k) => fs.readdirSync(path.join(s.paths.artifacts, k, 'docs')).sort();
  assert.deepEqual(copied('spec'), ['spec-extra.md', 'spec.md']);
  assert.deepEqual(copied('plan'), ['plan.md']);
});

test('E68: no plan found sets missing_artifact, leaves the rubric null and calls no judge', async () => {
  const s = setup({ files: { 'docs/spec.md': 'spec only' } });
  const cli = fakeCli(FOUR_CALLS);
  const res = await grade(s, cli);
  assert.equal(res.exit, 0);
  const g = gradesOf(s);
  assert.ok(g.flags.includes('missing_artifact'));
  assert.deepEqual([g.rubric_spec, g.rubric_plan, g.rubric_total], [null, null, null]);
  assert.equal(cli.calls().length, 0);
});

test('E47: a credential in an artifact is redacted in the copy sent to the judge and flagged', async () => {
  const key = ['sk-ant-', 'api03-', 'abcdefghij0123456789ABCD'].join('');
  const s = setup({ files: { 'docs/spec.md': `# Spec\nuse ${key} here\n`, 'docs/plan.md': '# Plan\n' } });
  const cli = fakeCli(FOUR_CALLS);
  await grade(s, cli);
  assert.ok(gradesOf(s).flags.includes('secret_in_artifact'));
  const prompts = cli.calls().map((c) => c.prompt).join('\n');
  assert.ok(!prompts.includes(key));
  assert.ok(prompts.includes('[REDACTED:anthropic-key]'));
});

test('E38: a question that matches two seeded issues stores the closer in issue_id and the other in issue_alt', async () => {
  const s = setup({ issues: true });
  appendQuestion(s.paths, { run_id: 'run-1', turn: 1, text: 'Who may edit, and can a note be a comment?', source: 'assumption' });
  appendQuestion(s.paths, { run_id: 'run-1', turn: 2, text: 'Unrelated?', source: 'assumption' });
  const issues = { text: JSON.stringify({
    issues: { collision: { outcome: 'raised_as_question', evidence: 'turn 1' }, contradiction: { outcome: 'resolved_in_artifact', evidence: 'section 2' } },
    questions: [{ turn: 1, issue_id: 'collision', issue_alt: 'contradiction' }, { turn: 2, issue_id: null, issue_alt: null }],
  }), usage: { output: 90 } };
  await grade(s, fakeCli([...FOUR_CALLS, issues]));
  const rows = readQuestions(s.paths);
  assert.deepEqual([rows[0].issue_id, rows[0].issue_alt], ['collision', 'contradiction']);
  assert.deepEqual([rows[1].issue_id, rows[1].issue_alt], [null, null]);
  assert.equal(gradesOf(s).issues.collision.outcome, 'raised_as_question');
});

test('a judge that cannot produce scores gives judge_error, null rubric, exit 6, and the run stays extracted', async () => {
  const s = setup();
  const res = await grade(s, fakeCli([{ text: 'x' }, { text: 'y' }]));
  assert.equal(res.exit, 6);
  const g = gradesOf(s);
  assert.ok(g.flags.includes('judge_error'));
  assert.deepEqual([g.rubric_spec, g.rubric_plan], [null, null]);
  assert.equal(readJson(s.paths.state).status, 'extracted');
});

test('unstable scores set judge_unstable and still complete', async () => {
  const s = setup();
  const res = await grade(s, fakeCli([scores(4, 4, 4, 4, 4), scores(1, 1, 1, 1, 1), scores(3, 3, 3, 3, 3), scores(3, 3, 3, 3, 3)]));
  assert.equal(res.exit, 0);
  assert.ok(gradesOf(s).flags.includes('judge_unstable'));
  assert.equal(gradesOf(s).rubric_gap, 15);
});

test('judge_same_model is set when the judge model equals the arm main model, not otherwise', async () => {
  const same = setup();
  await grade(same, fakeCli(FOUR_CALLS), { model: 'claude-sonnet-5-5' });
  assert.ok(gradesOf(same).flags.includes('judge_same_model'));
  const other = setup();
  await grade(other, fakeCli(FOUR_CALLS), { model: 'another-model' });
  assert.ok(!gradesOf(other).flags.includes('judge_same_model'));
});

test('the batch ceiling: grading stops with exit 5 and calls no judge once the batch spend has reached it', async () => {
  const s = setup({ experiment: { batch_ceiling_usd: 1 } });
  writeJsonAtomic(path.join(s.expRoot, 'local', 'experiments', 'exp-one', 'state.json'), { arm_codes: {}, batch_spend_usd: { arm: 0.9, answerer: 0, matcher: 0, judge: 0.2, probe: 0 } });
  const cli = fakeCli(FOUR_CALLS);
  const res = await grade(s, cli);
  assert.equal(res.exit, 5);
  assert.equal(cli.calls().length, 0);
});

// ---- grade --self-test (E46, F12) ------------------------------------------------------------------------

const selfTestRun = (steps) => {
  const cli = fakeCli({ steps });
  return selfTest({ expRoot: path.join(here, '..'), launcher: cli.launcher, env: buildEnv(process.env, { extra: cli.env }), model: 'm' });
};

test('the self-test passes on the scripted replies: good > mediocre > bad, each in its band', async () => {
  const script = JSON.parse(fs.readFileSync(path.join(here, 'fixtures', 'judge-script.json'), 'utf8'));
  const r = await selfTestRun(script.steps);
  assert.equal(r.pass, true, JSON.stringify(r.results));
  assert.equal(r.ordered, true);
  assert.ok(r.results.good.mean >= 14 && r.results.mediocre.mean <= 13 && r.results.bad.mean <= 6);
});

test('E46: the self-test fails when the canary artifact talks the judge into top marks (bad leaves its band)', async () => {
  const top = scores(4, 4, 4, 4, 4);
  const script = JSON.parse(fs.readFileSync(path.join(here, 'fixtures', 'judge-script.json'), 'utf8'));
  const r = await selfTestRun([...script.steps.slice(0, 4), top, top]);
  assert.equal(r.pass, false);
  assert.equal(r.results.bad.inBand, false);
});

test('the self-test fails when the order is wrong', async () => {
  const script = JSON.parse(fs.readFileSync(path.join(here, 'fixtures', 'judge-script.json'), 'utf8'));
  const [g1, g2, m1, m2, b1, b2] = script.steps;
  const r = await selfTestRun([m1, m2, g1, g2, b1, b2]);
  assert.equal(r.pass, false);
  assert.equal(r.ordered, false);
});

// ---- implementation runs (T7: E70, E81, E82, N2) -----------------------------------------------------------------------

const REVIEW = (findings) => ({ text: JSON.stringify({ findings }), usage: { output: 40 } });
const BLOCKER = { category: 'bug', severity: 'blocker', where: 'src/a.ts', issue: 'broken' };
const CHECK = (over = {}) => ({
  typecheck: { errors: 0, status: 'ok', lines: [] }, lint: { errors: 0, status: 'ok', lines: [] },
  own_tests: { files: ['t'], passed: 1, failed: 0, skipped: 0, failing: [] }, baseline_tests: { newly_failing: [], missing: [] },
  shared: { CHK1: { status: 'pass', message: '' }, CHK2: { status: 'fail', message: 'x' } }, protected_changed: [], plan_changed: [],
  changed_files: ['src/a.ts'], deleted_files: [], files_off_plan: 1, plan_files_missing: 2, gates_skipped: 3, gates_in_plan: 4, notes_truncated: false,
  secret_in_check_output: false, flags: [], green: true, ...over,
});

/** An extracted implementation run folder written by hand (no git): manifest, state, checks, events, snapshot, baseline tree, clone. */
function implSetup({ status = 'extracted', abort_reason = null, attempts = [CHECK()], attempt2_started = null, events = null, experiment = {}, clone = true } = {}) {
  const expRoot = tmpDir('exp-gimpl-');
  put(path.join(expRoot, 'tasks', 'impl-task', 'task.json'), { id: 'impl-task', stage: 'implementation', acceptance: { folder: 'acceptance', checks_file: 'acceptance/checks.json', adapters: {} } });
  put(path.join(expRoot, 'tasks', 'impl-task', 'acceptance', 'checks.json'), [{ id: 'CHK1', required: true, requirement: 'r1' }, { id: 'CHK2', required: false, requirement: 'r2' }]);
  put(path.join(expRoot, 'experiments', 'impl-one.json'), { id: 'impl-one', stage: 'implementation', task_id: 'impl-task', plans: [{ source_experiment_id: 'pilot-001', plan_id: 'toy-plan', snapshot_sha256: '0'.repeat(64) }], batch_ceiling_usd: 25, run_ceiling_usd: 5, ...experiment });
  put(path.join(expRoot, 'local', 'plans', 'pilot-001', 'toy-plan', 'snapshot.json'), { files: [{ path: 'docs/plan-1.md', kind: 'plan' }, { path: 'docs/spec-1.md', kind: 'spec' }] });
  put(path.join(expRoot, 'local', 'plans', 'pilot-001', 'toy-plan', 'files', 'docs', 'plan-1.md'), 'the plan');
  put(path.join(expRoot, 'local', 'baselines', 'impl-task', 'tree', 'src', 'a.ts'), 'old\n');
  const cloneDir = tmpDir('exp-gclone-');
  put(path.join(cloneDir, 'src', 'a.ts'), 'new\n');
  if (!clone) fs.rmSync(cloneDir, { recursive: true, force: true });
  const runId = 'run-impl-1';
  const paths = runPaths(expRoot, runId);
  fs.mkdirSync(path.join(paths.dir, 'checks'), { recursive: true });
  writeJsonAtomic(paths.manifest, { run_id: runId, experiment_id: 'impl-one', task_id: 'impl-task', arm_id: 'implementer-one', rep: 1, plan_id: 'toy-plan', sample: 1, status, abort_reason, flags: ['outside_clone_access'], clone_path: cloneDir });
  writeJsonAtomic(paths.state, { ...newRunState(), status, abort_reason, attempt2_started, attempt: attempts.length });
  attempts.forEach((c, i) => writeJsonAtomic(path.join(paths.dir, 'checks', `attempt-${i + 1}.json`), c));
  if (events) fs.writeFileSync(path.join(paths.dir, 'events.csv'), events);
  return { expRoot, repoRoot: expRoot, runId, paths, clone: cloneDir };
}
const gradeImpl = (s, cli) => gradeRun({ expRoot: s.expRoot, repoRoot: s.repoRoot, runId: s.runId, launcher: cli.launcher, env: buildEnv(process.env, { extra: cli.env }), model: 'strong-model' });
const PASS_FIELDS = ['green_attempt', 'pass1', 'pass2', 'typecheck_errors', 'lint_errors', 'own_tests_failed', 'newly_failing_tests', 'shared_required_failed', 'shared_info_failed', 'files_off_plan', 'plan_files_missing', 'gates_skipped', 'gates_in_plan', 'impl_cost_usd', 'fix_cost_usd'];
const pick = (g) => Object.fromEntries(PASS_FIELDS.map((k) => [k, g[k]]));

test('E70: a blocker on a green run leaves green, pass1 and pass2 unchanged; the plan text and diff reach the reviewer from the snapshot and the clone', async () => {
  const s = implSetup({ events: 'run_id,seq,started,cost_usd\nr,1,2026-11-05T10:00:00Z,0.010000\nr,2,2026-11-05T10:05:00Z,0.020000\n' });
  const cli = fakeCli([REVIEW([BLOCKER])]);
  const res = await gradeImpl(s, cli);
  assert.equal(res.exit, 0);
  const g = gradesOf(s);
  assert.deepEqual([g.green_attempt, g.pass1, g.pass2], [1, true, true]);
  assert.deepEqual(g.review.findings, [BLOCKER]);
  assert.deepEqual([g.shared_required_failed, g.shared_info_failed, g.files_off_plan, g.plan_files_missing, g.gates_skipped, g.gates_in_plan], [0, 1, 1, 2, 3, 4]);
  assert.deepEqual([g.impl_cost_usd, g.fix_cost_usd], [0.03, 0]);
  assert.ok(g.review_cost_usd > 0);
  assert.equal(readJson(s.paths.state).status, 'complete');
  const prompt = cli.calls()[0].prompt;
  assert.ok(prompt.includes('the plan') && prompt.includes('+new') && prompt.includes('-old'));
  assert.ok(g.flags.includes('outside_clone_access'), 'run flags are carried');
});

test('green at attempt 2: pass1 false, pass2 true, green_attempt 2, and the cost is split at the boundary', async () => {
  const s = implSetup({
    attempts: [CHECK({ green: false, typecheck: { errors: 2, status: 'fail', lines: [] } }), CHECK()], attempt2_started: '2026-11-05T10:03:00Z',
    events: 'run_id,seq,started,cost_usd\nr,1,2026-11-05T10:00:00Z,0.010000\nr,2,2026-11-05T10:05:00Z,0.020000\n',
  });
  await gradeImpl(s, fakeCli([REVIEW([])]));
  const g = gradesOf(s);
  assert.deepEqual([g.green_attempt, g.pass1, g.pass2, g.impl_cost_usd, g.fix_cost_usd, g.typecheck_errors], [2, false, true, 0.01, 0.02, 0]);
});

test('two red attempts: pass2 false, green_attempt null, and the review still runs', async () => {
  const s = implSetup({ attempts: [CHECK({ green: false }), CHECK({ green: false })] });
  const cli = fakeCli([REVIEW([])]);
  await gradeImpl(s, cli);
  const g = gradesOf(s);
  assert.deepEqual([g.green_attempt, g.pass1, g.pass2], [null, false, false]);
  assert.equal(cli.calls().length, 1);
});

test('E81, N2: grading twice, once after the agent clone was deleted, gives identical pass and adherence fields and an empty review with review_error', async () => {
  const s = implSetup({ events: 'run_id,seq,started,cost_usd\nr,1,2026-11-05T10:00:00Z,0.010000\n' });
  await gradeImpl(s, fakeCli([REVIEW([BLOCKER])]));
  const first = gradesOf(s);
  assert.equal(first.review.findings.length, 1);
  writeJsonAtomic(s.paths.state, { ...readJson(s.paths.state), status: 'extracted' });
  fs.rmSync(s.clone, { recursive: true, force: true });
  const cli = fakeCli([REVIEW([BLOCKER])]);
  await gradeImpl(s, cli);
  const second = gradesOf(s);
  assert.deepEqual(pick(second), pick(first));
  assert.deepEqual(second.review, { findings: [] });
  assert.ok(second.flags.includes('review_error'));
  assert.equal(cli.calls().length, 0, 'no call without a clone');
});

test('E82: an implementation run that is not extracted exits 2', async () => {
  for (const status of ['done', 'running', 'complete', 'aborted']) {
    const s = implSetup({ status, abort_reason: status === 'aborted' ? 'budget' : null });
    if (status === 'aborted') continue; // aborted runs are extracted before grading; see the next test
    await assert.rejects(() => gradeImpl(s, fakeCli([REVIEW([])])), (e) => e instanceof UsageError && e.exit === 2, status);
  }
});

test('an aborted implementation run is graded with false pass fields, empty check fields and no review call', async () => {
  const s = implSetup({ status: 'extracted', abort_reason: 'budget', attempts: [] });
  const cli = fakeCli([REVIEW([BLOCKER])]);
  const res = await gradeImpl(s, cli);
  assert.equal(res.exit, 0);
  const g = gradesOf(s);
  assert.deepEqual([g.pass1, g.pass2, g.green_attempt, g.typecheck_errors, g.shared_required_failed], [false, false, null, null, null]);
  assert.deepEqual(g.review, { findings: [] });
  assert.equal(cli.calls().length, 0);
  assert.ok(!g.flags.includes('review_error'));
});

test('an aborted run whose first attempt was green is still red', async () => {
  const s = implSetup({ status: 'extracted', abort_reason: 'timeout', attempts: [CHECK()] });
  await gradeImpl(s, fakeCli([REVIEW([])]));
  assert.deepEqual([gradesOf(s).pass1, gradesOf(s).pass2], [false, false]);
});

test('the batch ceiling gives exit 5, a grade without a review and the flag review_error; the run stays extracted', async () => {
  const s = implSetup({ experiment: { batch_ceiling_usd: 1 } });
  writeJsonAtomic(path.join(s.expRoot, 'local', 'experiments', 'impl-one', 'state.json'), { arm_codes: {}, batch_spend_usd: { arm: 0.9, answerer: 0, matcher: 0, judge: 0.2, probe: 0 } });
  const cli = fakeCli([REVIEW([])]);
  const res = await gradeImpl(s, cli);
  assert.equal(res.exit, 5);
  assert.equal(cli.calls().length, 0);
  assert.ok(gradesOf(s).flags.includes('review_error'));
  assert.equal(readJson(s.paths.state).status, 'extracted');
});

test('E69: a credential in the review text stores nothing, flags review_error and exits 9', async () => {
  const s = implSetup();
  const res = await gradeImpl(s, fakeCli([REVIEW([{ ...BLOCKER, issue: '' + ['sk-ant-', 'api03-abcdefghijklmnopqrstuvwxyz0123456789ABCD'].join('') + '' }])]));
  assert.equal(res.exit, 9);
  assert.deepEqual(gradesOf(s).review, { findings: [] });
  assert.ok(gradesOf(s).flags.includes('review_error'));
  assert.ok(!JSON.stringify(gradesOf(s)).includes('sk-ant'));
});

test('review_cost_usd is added to the judge spend of the run and of the batch', async () => {
  const s = implSetup();
  await gradeImpl(s, fakeCli([REVIEW([])]));
  const cost = gradesOf(s).review_cost_usd;
  assert.ok(cost > 0);
  assert.equal(readJson(s.paths.state).spend.judge, cost);
  assert.equal(readJson(path.join(s.expRoot, 'local', 'experiments', 'impl-one', 'state.json')).batch_spend_usd.judge, cost);
});
