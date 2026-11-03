import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateArm, validateConfig, validateTask, validateExperiment,
  validatePricing, validateSeededIssues,
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
  assert.equal(check({ stage: 'implementation' }).ok, true);
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
