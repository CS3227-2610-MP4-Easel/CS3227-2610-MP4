// Shared helpers of the impldriver*.test.mjs files (not a test): a toy implementation experiment with a real baseline.
// T6: the implementation driver, end to end with the fake CLI and a toy baseline. No test spends money.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { COMPLETION_BLOCK, runExperiment, PROBE_PROMPT } from './driver.mjs';
import { buildBaseline } from './implbaseline.mjs';
import { buildFeedback } from './implfeedback.mjs';
import { IMPL_ANSWER, implRunIdFor, outsideCloneAccess, toolActivity } from './impldriver.mjs';
import { plantCanary } from './canary.mjs';
import { approvalHash, approve, loadState, readJson, runPaths, writeJsonAtomic } from './state.mjs';
import { fakeCli, git, makeImplRepo, pidAlive, put } from './testkit.mjs';

export const NOW = () => new Date('2026-11-05T12:00:00Z');
export const rid = (s, plan = 'toy-plan') => implRunIdFor(NOW(), 'impl-task', plan, s);
export const PROBE = { text: 'ok' };
export const TEST_SRC = "import { test } from 'node:test'; test('feature works', () => {});\n";
export const BUILD = [{ op: 'write', path: 'src/feature.mjs', content: 'export const x = 1;\n' }, { op: 'write', path: 'src/feature.test.mjs', content: TEST_SRC }];
export const GOOD = { text: 'Built it.\nEXP-DONE', effects: BUILD };
export const RED = { text: 'Done.\nEXP-DONE' };
export const NOSWEEP = async () => ({ killed: [], survivors: [] });
export const cmd = (argv) => ({ argv, cwd: '.', timeout_s: 60 });
export const TASK = {
  checks: {
    typecheck: [cmd(['node', '-e', 'process.exit(0)'])], lint: null,
    tests: { own_argv: ['node', '--test', '--test-reporter=tap'], baseline_files: ['src/**/*.test.mjs'], timeout_s: 60 },
    shared: { argv: ['node', 'workflow/experiments/tasks/impl-task/acceptance/runner.mjs'], timeout_s: 60 },
  },
  protected_globs: ['src/app.txt'],
};
export const RUNNER = [
  "import fs from 'node:fs'; import path from 'node:path';",
  "const arg = (n) => process.argv[process.argv.indexOf('--' + n) + 1];",
  "const ok = fs.existsSync(path.join(arg('root'), 'src', 'feature.mjs'));",
  "console.log(JSON.stringify({ CHK1: { status: ok ? 'pass' : 'fail', message: ok ? '' : 'no feature' }, CHK2: { status: 'pass', message: '' } }));",
  '',
].join('\n');
export const PLAN_FILES = { 'docs/plan-1.md': 'plan', 'docs/spec-1.md': 'spec' };

/** A committed toy implementation experiment with its snapshot files and a real baseline built by an injected setup. */
export async function setup({ experiment = {}, task = {}, tweak, baseline = true } = {}) {
  const ctx = makeImplRepo({
    experiment: { max_parallel: 1, ...experiment }, task: { ...TASK, ...task },
    implTweak: (c) => {
      put(path.join(c.implTaskDir, 'acceptance', 'runner.mjs'), RUNNER);
      for (const [rel, text] of Object.entries(PLAN_FILES)) put(path.join(c.expRoot, 'local', 'plans', 'pilot-001', 'toy-plan', 'files', rel), text);
      tweak?.(c);
    },
  });
  if (baseline) {
    const taskJson = readJson(path.join(ctx.implTaskDir, 'task.json'));
    const res = await buildBaseline({
      expRoot: ctx.expRoot, repoRoot: ctx.repoRoot, task: taskJson,
      deps: { setup: async ({ dir }) => put(path.join(dir, 'node_modules', 'pkg', 'index.js'), 'pkg') },
    });
    assert.equal(res.code, 0, res.lines.join('\n'));
  }
  return ctx;
}

export function drive(ctx, cli, opts = {}) {
  if (!opts.unapproved) approve(ctx.configDir, 'implementer-one', approvalHash({ expRoot: ctx.expRoot, armId: 'implementer-one' }));
  return runExperiment({
    repoRoot: ctx.repoRoot, expRoot: ctx.expRoot, experimentId: 'impl-one', filters: opts.filters ?? {}, dry: opts.dry, continueRunId: opts.continueRunId,
    deps: {
      launcher: cli.launcher, extraEnv: cli.env, configDir: ctx.configDir, home: ctx.home, now: NOW, sweep: NOSWEEP, verify: { sweep: NOSWEEP },
      diskPollMs: 5000, cloneSizeMb: () => 1, freeDiskGb: () => 500, ...opts.deps,
    },
  });
}
export const stateOf = (ctx, s = 1) => loadState(runPaths(ctx.expRoot, rid(s)));
export const manifestOf = (ctx, s = 1) => readJson(runPaths(ctx.expRoot, rid(s)).manifest);
export const checkFile = (ctx, s, n) => path.join(runPaths(ctx.expRoot, rid(s)).dir, 'checks', `attempt-${n}.json`);
export const checkOf = (ctx, s, n) => readJson(checkFile(ctx, s, n));
export const cloneOf = (ctx, s = 1) => path.join(ctx.worktreesRoot, rid(s));
export const text = (res) => res.lines.join('\n');
export const noRunDirs = (ctx) => !fs.existsSync(path.join(ctx.expRoot, 'local', 'runs'));
export const one = { samples: 1 };

export const fsHash = (data) => createHash('sha256').update(data).digest('hex');
export const crashAt = (point) => ({ hook: (name) => { if (name === point) throw new Crash(point); } });
export class Crash extends Error {}
export const NOTES = (body) => ({ ...GOOD, effects: [...BUILD, { op: 'write', path: 'IMPLEMENTATION-NOTES.md', content: body }] });
export const QUESTION = { text: 'Which role may edit a note?' };
export const withCalls = (calls, results) => ({ ...GOOD, tool_calls: calls, ...(results ? { tool_results: results } : {}) });
