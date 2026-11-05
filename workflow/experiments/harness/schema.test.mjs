import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateArm, validateConfig, validateTask, validateExperiment,
  validatePricing, validateSeededIssues, validateImplExperiment,
} from './schema.mjs';

const pricing = {
  schema_version: 1,
  models: {
    'claude-sonnet-5-5': {
      input: 3, output: 15, cache_read: 0.3, cache_write_5m: 3.75, cache_write_1h: 6,
      source: 'test', checked: '2026-11-03',
    },
  },
};

const arm = (over = {}) => ({
  id: 'lite',
  stage: 'specplan',
  prompt: 'Use the skills. {{brief}} ({{task_id}})',
  plugins: [],
  skills: ['writing-specs-lite'],
  agents: [],
  mcp: [],
  allowed_tools: ['Read', 'Write', 'Edit', 'Bash'],
  disallowed_tools: ['WebFetch', 'WebSearch'],
  permission_mode: 'acceptEdits',
  model: { main: 'claude-sonnet-5-5' },
  instruction_files: ['AGENTS.md', 'CLAUDE.md'],
  artifact_globs: { spec: ['workflow/specs/**/*.md'], plan: ['workflow/plans/*.md'] },
  lint: true,
  review: { lenses: [], agent_types: [], max_rounds: 0 },
  phase_map: {},
  ...over,
});

const check = (over, opts = {}) =>
  validateArm(arm(over), { fileName: 'lite.json', pricing, ...opts });

const mentions = (res, text) => res.errors.some((e) => e.includes(text));

test('a valid arm passes', () => {
  const res = check({});
  assert.deepEqual(res.errors, []);
  assert.equal(res.ok, true);
});

test('E1: arm id must equal its file name', () => {
  const res = check({ id: 'other' });
  assert.equal(res.ok, false);
  assert.ok(mentions(res, 'lite.json'));
});

test('arm id format [a-z0-9-]{3,24}', () => {
  for (const id of ['ab', 'UPPER', 'has_underscore', 'a'.repeat(25)]) {
    const res = validateArm(arm({ id }), { fileName: `${id}.json`, pricing });
    assert.equal(res.ok, false, id);
  }
});

test('E2: plugins must stay under plugins/', () => {
  for (const p of ['../x', 'C:\\evil', '/abs/path', 'a/../../b', '']) {
    const res = check({ plugins: [p] });
    assert.equal(res.ok, false, `plugin ${p}`);
  }
  assert.equal(check({ plugins: ['superpowers'] }).ok, true);
});

test('E3: bypass-all permission_mode is rejected', () => {
  assert.equal(check({ permission_mode: 'bypassPermissions' }).ok, false);
  assert.equal(check({ permission_mode: 'plan' }).ok, true);
  assert.equal(check({ permission_mode: undefined }).ok, false);
});

test('E8: arm stage must be a known stage', () => {
  assert.equal(check({ stage: 'nonsense' }).ok, false);
  assert.equal(check({ stage: 'implementation', prompt: 'Build {{plan_path}} ({{task_id}})' }).ok, true);
});

test('E9: review.max_rounds above 2 is rejected', () => {
  assert.equal(check({ review: { lenses: [], agent_types: [], max_rounds: 3 } }).ok, false);
  assert.equal(check({ review: { lenses: ['x'], agent_types: ['reviewer'], max_rounds: 2 } }).ok, true);
});

test('E10: every model id must be priced', () => {
  const res = check({ model: { main: 'claude-unknown-9' } });
  assert.equal(res.ok, false);
  assert.ok(mentions(res, 'claude-unknown-9'));
});

test('model map needs main and one entry per listed agent', () => {
  assert.equal(check({ agents: ['reviewer'], model: { main: 'claude-sonnet-5-5' } }).ok, false);
  assert.equal(
    check({ agents: ['reviewer'], model: { main: 'claude-sonnet-5-5', reviewer: 'claude-sonnet-5-5' } }).ok,
    true,
  );
});

test('prompt template allows only {{brief}} and {{task_id}}', () => {
  assert.equal(check({ prompt: 'hi {{secret}}' }).ok, false);
  assert.equal(check({ prompt: 'hi {{brief}}' }).ok, true);
});

test('instruction_files and artifact_globs are relative paths', () => {
  assert.equal(check({ instruction_files: ['../CLAUDE.md'] }).ok, false);
  assert.equal(check({ artifact_globs: { spec: ['/etc/**'], plan: [] } }).ok, false);
  assert.equal(check({ artifact_globs: { spec: ['a/*.md'] } }).ok, false);
});

test('F1: isolation_ignore may not name a plugin or hook', () => {
  const base = { worktrees_root: '../exp-runs', claude_bin: 'claude', auth_mode: 'login' };
  assert.equal(validateConfig({ ...base, isolation_ignore: ['some-skill'] }).ok, true);
  assert.equal(validateConfig({ ...base, isolation_ignore: ['plugin:superpowers'] }).ok, false);
  assert.equal(validateConfig({ ...base, isolation_ignore: ['hook:SessionStart'] }).ok, false);
  assert.equal(
    validateConfig({ ...base, isolation_ignore: ['superpowers'] }, { pluginNames: ['superpowers'] }).ok,
    false,
  );
});

test('config: auth_mode enum and required fields', () => {
  assert.equal(validateConfig({ worktrees_root: '../x', claude_bin: 'claude', auth_mode: 'oauth', isolation_ignore: [] }).ok, false);
  assert.equal(validateConfig({ claude_bin: 'claude', auth_mode: 'login', isolation_ignore: [] }).ok, false);
});

test('E6: task base_commit must be a hex sha of 7-40 characters', () => {
  const task = (base_commit) => ({
    id: 'pilot-task', base_commit, brief_file: 'brief.md', sheet_file: null, issues_file: null, stage: 'specplan',
  });
  for (const bad of ['--upload-pack=x', 'xyz1234', 'abc123', 'a'.repeat(41), undefined]) {
    assert.equal(validateTask(task(bad)).ok, false, String(bad));
  }
  assert.equal(validateTask(task('abc1234')).ok, true);
  assert.equal(validateTask(task('a'.repeat(40))).ok, true);
});

test('task file fields must be relative with no ..', () => {
  const t = { id: 'pilot-task', base_commit: 'abc1234', brief_file: '../brief.md', sheet_file: null, issues_file: null, stage: 'specplan' };
  assert.equal(validateTask(t).ok, false);
});

test('E7: duplicate seeded issue id is rejected', () => {
  const issue = (id) => ({ id, category: 'collision', text: 't', anchor: 'a', blocking: true });
  const res = validateSeededIssues([issue('i1'), issue('i1')]);
  assert.equal(res.ok, false);
  assert.ok(mentions(res, 'i1'));
  assert.equal(validateSeededIssues([issue('i1'), issue('i2')]).ok, true);
});

test('seeded issue category must be known', () => {
  assert.equal(validateSeededIssues([{ id: 'i1', category: 'weird', text: 't', anchor: 'a', blocking: false }]).ok, false);
});

const experiment = (over = {}) => ({
  id: 'pilot-001', task_ids: ['pilot-task'], arm_ids: ['lite', 'full'], replicates: 3,
  answer_mode: 'sheet', max_parallel: 3, run_ceiling_usd: 5, batch_ceiling_usd: 25,
  turn_timeout_s: 1800, run_timeout_s: 5400, wait_timeout_s: 86400,
  hypotheses: ['h'], decision_rule: 'r', pruning_rule: 'dominance', ...over,
});

test('experiment: ranges and required ceilings', () => {
  assert.equal(validateExperiment(experiment()).ok, true);
  assert.equal(validateExperiment(experiment({ replicates: 11 })).ok, false);
  assert.equal(validateExperiment(experiment({ max_parallel: 7 })).ok, false);
  assert.equal(validateExperiment(experiment({ run_ceiling_usd: 0 })).ok, false);
  assert.equal(validateExperiment(experiment({ batch_ceiling_usd: undefined })).ok, false);
  assert.equal(validateExperiment(experiment({ answer_mode: 'x' })).ok, false);
  assert.equal(validateExperiment(experiment({ pruning_rule: 'x' })).ok, false);
});

test('pricing: shape and numeric fields', () => {
  assert.equal(validatePricing(pricing).ok, true);
  assert.equal(validatePricing({ schema_version: 1, models: {} }).ok, true);
  assert.equal(validatePricing({ schema_version: 2, models: {} }).ok, false);
  const bad = { schema_version: 1, models: { m: { input: -1, output: 1, cache_read: 1, cache_write_5m: 1, cache_write_1h: 1, source: 's', checked: '2026-11-03' } } };
  assert.equal(validatePricing(bad).ok, false);
});

// ---- implementation stage (T2) ------------------------------------------------------------------------------

const implArm = (over = {}) => arm({
  id: 'lite', stage: 'implementation', prompt: 'Build {{plan_path}} with {{spec_paths}} ({{task_id}})', skills: [],
  artifact_globs: { spec: [], plan: [] }, lint: false, effort: 'low', ...over,
});
const implArmCheck = (over) => validateArm(implArm(over), { fileName: 'lite.json', pricing });
const cmd = (argv, over = {}) => ({ argv, cwd: '.', timeout_s: 120, ...over });
const implTask = (over = {}) => ({
  id: 'impl-task', stage: 'implementation', base_commit: 'abc1234', brief_file: 'brief.md',
  setup_command: ['npm', 'ci', '--ignore-scripts'],
  post_setup: ['node', 'node_modules/prisma/build/index.js', 'generate'],
  checks: {
    typecheck: [cmd(['node', 'node_modules/typescript/bin/tsc', '-b'])],
    lint: null,
    tests: { own_argv: ['node', '--import', 'tsx', '--test', '--test-reporter=tap'], baseline_files: ['tests/**/*.test.ts'], timeout_s: 300 },
    shared: { argv: ['node', 'workflow/experiments/tasks/impl-task/acceptance/runner.mjs'], timeout_s: 300 },
  },
  protected_globs: ['**/tsconfig*.json', 'tests/**'],
  acceptance: { folder: 'acceptance', checks_file: 'acceptance/checks.json', adapters: { 'lite-r2': 'acceptance/adapters/lite-r2.mjs' } },
  ...over,
});
const implExp = (over = {}) => ({
  id: 'impl-001', stage: 'implementation', task_id: 'impl-task', implementer_arm_id: 'lite',
  plans: [{ source_experiment_id: 'pilot-001', plan_id: 'lite-r2', snapshot_sha256: 'a'.repeat(64) }],
  run_ceiling_usd: 5, batch_ceiling_usd: 30, answer_mode: 'fixed', ...over,
});

test('F2/F3: a valid implementation arm, task and experiment pass', () => {
  assert.deepEqual(implArmCheck({}).errors, []);
  assert.deepEqual(validateTask(implTask()).errors, []);
  assert.deepEqual(validateImplExperiment(implExp()).errors, []);
});

test('implementation arm: placeholders are plan_path, spec_paths, task_id only; effort is low, medium or high', () => {
  assert.equal(implArmCheck({ prompt: 'x {{plan_path}}' }).ok, true);
  assert.equal(implArmCheck({ effort: 'high' }).ok, true);
  assert.equal(implArmCheck({ effort: undefined }).ok, true);
  assert.equal(implArmCheck({ effort: 'extreme' }).ok, false);
  assert.equal(check({ effort: 'low' }).ok, true); // allowed on any stage
});

test('E10: an implementation prompt with {{brief}} is rejected and names the placeholder', () => {
  const res = implArmCheck({ prompt: 'Build {{brief}}' });
  assert.equal(res.ok, false);
  assert.ok(mentions(res, '{{brief}}'));
});

test('E8: a checks entry with no argv, or a string argv, is rejected and names the field', () => {
  const noArgv = implTask(); noArgv.checks.typecheck = [{ cwd: '.', timeout_s: 60 }];
  const res = validateTask(noArgv);
  assert.equal(res.ok, false);
  assert.ok(mentions(res, 'checks.typecheck'));
  const str = implTask(); str.checks.typecheck = [cmd('node tsc -b')];
  assert.equal(validateTask(str).ok, false);
  const lintBad = implTask(); lintBad.checks.lint = [cmd('node x')];
  assert.equal(validateTask(lintBad).ok, false);
  const sharedBad = implTask(); sharedBad.checks.shared = { timeout_s: 60 };
  assert.ok(mentions(validateTask(sharedBad), 'checks.shared'));
});

test('E93: every check argv starts with node; shells and a string are rejected', () => {
  for (const argv of [['sh', '-c', 'x'], ['cmd', '/c', 'x'], ['powershell', 'x'], ['npm', 'test'], 'node x', []]) {
    const t = implTask(); t.checks.typecheck = [cmd(argv)];
    assert.equal(validateTask(t).ok, false, JSON.stringify(argv));
  }
  const own = implTask(); own.checks.tests.own_argv = ['sh', '-c', 'x'];
  assert.equal(validateTask(own).ok, false);
  const sh = implTask({ setup_command: ['sh', '-c', 'npm ci'] });
  assert.equal(validateTask(sh).ok, false);
  const post = implTask({ post_setup: ['npm', 'run', 'x'] });
  assert.equal(validateTask(post).ok, false);
  assert.equal(validateTask(implTask({ post_setup: undefined })).ok, true);
});

test('implementation task: fields, timeouts, cwd and protected globs are checked', () => {
  const t = implTask(); t.checks.typecheck = [cmd(['node', 'x'], { cwd: '../outside' })];
  assert.equal(validateTask(t).ok, false);
  const t2 = implTask(); t2.checks.typecheck = [cmd(['node', 'x'], { timeout_s: 0 })];
  assert.equal(validateTask(t2).ok, false);
  assert.equal(validateTask(implTask({ protected_globs: ['/abs/**'] })).ok, false);
  assert.equal(validateTask(implTask({ setup_command: undefined })).ok, false);
  assert.equal(validateTask(implTask({ acceptance: { folder: '../x', checks_file: 'c.json', adapters: {} } })).ok, false);
  assert.equal(validateTask(implTask({ acceptance: undefined })).ok, false);
});

test('E10: counts and ranges of an implementation experiment', () => {
  const bad = (over, field) => {
    const res = validateImplExperiment(implExp(over));
    assert.equal(res.ok, false, field);
    assert.ok(mentions(res, field), `${field}: ${res.errors}`);
  };
  bad({ samples: 0 }, 'samples'); bad({ samples: 6 }, 'samples');
  bad({ attempts: 3 }, 'attempts'); bad({ attempts: 0 }, 'attempts');
  bad({ max_questions: 11 }, 'max_questions'); bad({ max_parallel: 4 }, 'max_parallel');
  bad({ plans: [] }, 'plans');
  bad({ plans: Array.from({ length: 13 }, (_, i) => ({ source_experiment_id: 'p', plan_id: `p-r${i}`, snapshot_sha256: 'a'.repeat(64) })) }, 'plans');
  bad({ run_ceiling_usd: 0 }, 'run_ceiling_usd'); bad({ batch_ceiling_usd: undefined }, 'batch_ceiling_usd');
  bad({ stage: 'specplan' }, 'stage'); bad({ answer_mode: 'sheet' }, 'answer_mode');
  bad({ turn_timeout_s: 0 }, 'turn_timeout_s'); bad({ max_clone_mb: -1 }, 'max_clone_mb');
  assert.equal(validateImplExperiment(implExp({ samples: 5, attempts: 2, max_questions: 10, max_parallel: 3 })).ok, true);
});

test('E9: a duplicate plan id or a malformed snapshot hash is rejected', () => {
  const p = { source_experiment_id: 'pilot-001', plan_id: 'lite-r2', snapshot_sha256: 'a'.repeat(64) };
  const dup = validateImplExperiment(implExp({ plans: [p, p] }));
  assert.equal(dup.ok, false);
  assert.ok(mentions(dup, 'lite-r2'));
  assert.equal(validateImplExperiment(implExp({ plans: [{ ...p, snapshot_sha256: 'xyz' }] })).ok, false);
  assert.equal(validateImplExperiment(implExp({ plans: [{ ...p, plan_id: '' }] })).ok, false);
});
