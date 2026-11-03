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
