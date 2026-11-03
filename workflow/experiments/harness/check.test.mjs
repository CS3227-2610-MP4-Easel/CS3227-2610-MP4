import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runCheck } from './check.mjs';

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
const write = (file, data) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, typeof data === 'string' ? data : JSON.stringify(data, null, 2));
};

const ALL_CATEGORIES = ['collision', 'contradiction', 'missing_limit', 'vague_term', 'wrong_path', 'missing_error'];
const issue = (id, category, anchor) => ({ id, category, text: `issue ${id}`, anchor, blocking: false });
const pilotIssues = () => ALL_CATEGORIES.map((c, i) => issue(`i${i}`, c, `anchor${i}`));
const BRIEF = ALL_CATEGORIES.map((_, i) => `anchor${i}`).join(' ') + '\n';

/** A throwaway git repo holding a valid experiments tree. `tweak(ctx)` edits it before the commit. */
function makeRepo({ taskId = 'task-one', answerMode = 'sheet', tweak } = {}) {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'exp-check-'));
  const expRoot = path.join(repoRoot, 'workflow', 'experiments');
  git(repoRoot, 'init', '-q');
  write(path.join(repoRoot, '.gitignore'), 'workflow/experiments/local/\n');
  write(path.join(expRoot, 'config.json'), {
    worktrees_root: '../exp-runs', claude_bin: 'claude', auth_mode: 'login', isolation_ignore: [],
  });
  write(path.join(expRoot, 'pricing.json'), {
    schema_version: 1,
    models: { 'model-a': { input: 3, output: 15, cache_read: 0.3, cache_write_5m: 3.75, cache_write_1h: 6, source: 's', checked: '2026-11-03' } },
  });
  write(path.join(expRoot, 'arms', 'arm-one.json'), {
    id: 'arm-one', stage: 'specplan', prompt: '{{brief}} {{task_id}}', plugins: [], skills: [], agents: [],
    permission_mode: 'acceptEdits', model: { main: 'model-a' },
    artifact_globs: { spec: ['s/*.md'], plan: ['p/*.md'] }, lint: false,
  });
  write(path.join(expRoot, 'tasks', taskId, 'task.json'), {
    id: taskId, base_commit: 'HEAD_PLACEHOLDER', brief_file: 'brief.md',
    sheet_file: answerMode === 'sheet' ? 'answer-sheet.md' : null,
    issues_file: 'seeded-issues.json', stage: 'specplan',
  });
  write(path.join(expRoot, 'tasks', taskId, 'brief.md'), BRIEF);
  write(path.join(expRoot, 'tasks', taskId, 'answer-sheet.md'), 'answers\n');
  write(path.join(expRoot, 'tasks', taskId, 'seeded-issues.json'), pilotIssues());
  write(path.join(expRoot, 'experiments', 'exp-one.json'), {
    id: 'exp-one', task_ids: [taskId], arm_ids: ['arm-one'], replicates: 3, answer_mode: answerMode,
    max_parallel: 3, run_ceiling_usd: 5, batch_ceiling_usd: 25, turn_timeout_s: 1800, run_timeout_s: 5400,
    wait_timeout_s: 86400, hypotheses: ['h'], decision_rule: 'r', pruning_rule: 'dominance',
  });
  git(repoRoot, '-c', 'user.name=t', '-c', 'user.email=t@t', 'add', '-A');
  git(repoRoot, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'init');
  const sha = git(repoRoot, 'rev-parse', 'HEAD');
  const taskFile = path.join(expRoot, 'tasks', taskId, 'task.json');
  write(taskFile, { ...JSON.parse(fs.readFileSync(taskFile, 'utf8')), base_commit: sha });
  const ctx = { repoRoot, expRoot, taskId, sha };
  tweak?.(ctx);
  return ctx;
}

const text = (res) => res.lines.join('\n');

test('a valid tree is clean, with one line per file', () => {
  const res = runCheck(makeRepo());
  assert.equal(res.code, 0, text(res));
  assert.ok(res.lines.some((l) => l.includes('arm-one.json') && l.includes('ok')));
});

test('E5: sheet-mode experiment with a task lacking answer-sheet.md exits 3', () => {
  const ctx = makeRepo({ tweak: ({ expRoot, taskId }) => fs.rmSync(path.join(expRoot, 'tasks', taskId, 'answer-sheet.md')) });
  const res = runCheck(ctx);
  assert.equal(res.code, 3);
  assert.match(text(res), /answer-sheet\.md/);
});

test('F2: bank-mode experiment with no seeded file is clean', () => {
  const ctx = makeRepo({
    answerMode: 'bank',
    tweak: ({ expRoot, taskId }) => {
      const taskFile = path.join(expRoot, 'tasks', taskId, 'task.json');
      write(taskFile, { ...JSON.parse(fs.readFileSync(taskFile, 'utf8')), issues_file: null });
      fs.rmSync(path.join(expRoot, 'tasks', taskId, 'seeded-issues.json'));
      fs.rmSync(path.join(expRoot, 'tasks', taskId, 'answer-sheet.md'));
    },
  });
  const res = runCheck(ctx);
  assert.equal(res.code, 0, text(res));
});

test('E56/F16: a pilot task with fewer than 6 seeded issues exits 3', () => {
  const ctx = makeRepo({
    taskId: 'pilot-note',
    tweak: ({ expRoot }) => write(path.join(expRoot, 'tasks', 'pilot-note', 'seeded-issues.json'), pilotIssues().slice(0, 5)),
  });
  const res = runCheck(ctx);
  assert.equal(res.code, 3);
  assert.match(text(res), /at least 6/);
});

test('E56/F16: a pilot task missing a required category exits 3', () => {
  const ctx = makeRepo({
    taskId: 'pilot-note',
    tweak: ({ expRoot }) => {
      const issues = pilotIssues();
      issues[5] = issue('i5', 'tenancy', 'anchor5'); // 6 issues, but missing_error is gone
      write(path.join(expRoot, 'tasks', 'pilot-note', 'seeded-issues.json'), issues);
    },
  });
  const res = runCheck(ctx);
  assert.equal(res.code, 3);
  assert.match(text(res), /missing_error/);
});

test('F16: a pilot task with 6 issues covering all categories is clean', () => {
  assert.equal(runCheck(makeRepo({ taskId: 'pilot-note' })).code, 0);
});

test('E7: an anchor found in neither brief nor sheet exits 3 naming the issue', () => {
  const ctx = makeRepo({
    tweak: ({ expRoot, taskId }) => {
      const issues = pilotIssues();
      issues[2].anchor = 'not-in-brief-anywhere';
      write(path.join(expRoot, 'tasks', taskId, 'seeded-issues.json'), issues);
    },
  });
  const res = runCheck(ctx);
  assert.equal(res.code, 3);
  assert.match(text(res), /i2/);
});

test('E6: a well-formed base_commit that is not in the repo exits 3', () => {
  const ctx = makeRepo({
    tweak: ({ expRoot, taskId }) => {
      const taskFile = path.join(expRoot, 'tasks', taskId, 'task.json');
      write(taskFile, { ...JSON.parse(fs.readFileSync(taskFile, 'utf8')), base_commit: 'deadbeef' });
    },
  });
  const res = runCheck(ctx);
  assert.equal(res.code, 3);
  assert.match(text(res), /base_commit/);
});

test('E8: arm stage and task stage differ exits 3', () => {
  const ctx = makeRepo({
    tweak: ({ expRoot }) => {
      const armFile = path.join(expRoot, 'arms', 'arm-one.json');
      write(armFile, { ...JSON.parse(fs.readFileSync(armFile, 'utf8')), stage: 'ablation' });
    },
  });
  const res = runCheck(ctx);
  assert.equal(res.code, 3);
  assert.match(text(res), /stage/);
});

test('E10: an arm model missing from pricing.json exits 3', () => {
  const ctx = makeRepo({
    tweak: ({ expRoot }) => {
      const armFile = path.join(expRoot, 'arms', 'arm-one.json');
      write(armFile, { ...JSON.parse(fs.readFileSync(armFile, 'utf8')), model: { main: 'model-zzz' } });
    },
  });
  const res = runCheck(ctx);
  assert.equal(res.code, 3);
  assert.match(text(res), /model-zzz/);
});

test('E2: an arm plugin that does not exist under plugins/ exits 3', () => {
  const ctx = makeRepo({
    tweak: ({ expRoot }) => {
      const armFile = path.join(expRoot, 'arms', 'arm-one.json');
      write(armFile, { ...JSON.parse(fs.readFileSync(armFile, 'utf8')), plugins: ['ghost'] });
    },
  });
  assert.equal(runCheck(ctx).code, 3);
});

test('an experiment naming an unknown task or arm exits 3', () => {
  const ctx = makeRepo({
    tweak: ({ expRoot }) => {
      const f = path.join(expRoot, 'experiments', 'exp-one.json');
      write(f, { ...JSON.parse(fs.readFileSync(f, 'utf8')), arm_ids: ['arm-one', 'arm-ghost'] });
    },
  });
  const res = runCheck(ctx);
  assert.equal(res.code, 3);
  assert.match(text(res), /arm-ghost/);
});

test('--secrets with a planted key exits 9 and prints the type, not the value', () => {
  const planted = ['sk-ant-', 'api03-', 'abcdefghij0123456789ABCD'].join('');
  const ctx = makeRepo({
    tweak: ({ expRoot }) => write(path.join(expRoot, 'tasks', 'task-one', 'notes.md'), `key: ${planted}\n`),
  });
  assert.equal(runCheck(ctx).code, 0, 'without --secrets the scan does not run');
  const res = runCheck({ ...ctx, secrets: true });
  assert.equal(res.code, 9);
  assert.match(text(res), /anthropic-key/);
  assert.ok(!text(res).includes(planted));
});

test('--secrets also scans docs/telemetry/experiments', () => {
  const planted = ['ghp_', 'a'.repeat(30)].join('');
  const ctx = makeRepo({
    tweak: ({ repoRoot }) => write(path.join(repoRoot, 'docs', 'telemetry', 'experiments', 'runs.csv'), `${planted}\n`),
  });
  assert.equal(runCheck({ ...ctx, secrets: true }).code, 9);
});

test('--secrets ignores local/ and passes clean trees', () => {
  const planted = ['ghp_', 'a'.repeat(30)].join('');
  const ctx = makeRepo({
    tweak: ({ expRoot }) => write(path.join(expRoot, 'local', 'raw.txt'), planted),
  });
  assert.equal(runCheck({ ...ctx, secrets: true }).code, 0);
});

test('local/ not covered by git check-ignore is reported', () => {
  const ctx = makeRepo({ tweak: ({ repoRoot }) => fs.writeFileSync(path.join(repoRoot, '.gitignore'), '') });
  const res = runCheck(ctx);
  assert.equal(res.code, 3);
  assert.match(text(res), /local/);
});

test('a worktrees_root inside the repo must be ignored', () => {
  const ctx = makeRepo({
    tweak: ({ expRoot }) => write(path.join(expRoot, 'config.json'), {
      worktrees_root: 'runs-here', claude_bin: 'claude', auth_mode: 'login', isolation_ignore: [],
    }),
  });
  const res = runCheck(ctx);
  assert.equal(res.code, 3);
  assert.match(text(res), /worktrees_root/);
});
