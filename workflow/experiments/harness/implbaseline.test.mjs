import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { buildBaseline } from './implbaseline.mjs';
import { baselineProblem } from './implchecks.mjs';
import { git, put, tmpDir } from './testkit.mjs';

const PASS = "import { test } from 'node:test'; test('works', () => {}); test('also works', () => {});\n";
const TC_OK = 'process.exit(0);\n';

/** A toy repo with a base commit holding a typecheck script and test files, and a matching implementation task. */
function toy({ tc = TC_OK, tests = { 'tests/a.test.mjs': PASS }, lock = '{"lockfileVersion":3,"packages":{}}\n', task = {} } = {}) {
  const repoRoot = tmpDir('exp-toy-');
  const expRoot = tmpDir('exp-toyexp-');
  git(repoRoot, 'init', '-q');
  put(path.join(repoRoot, 'tc.js'), tc);
  put(path.join(repoRoot, 'package-lock.json'), lock);
  for (const [f, c] of Object.entries(tests)) put(path.join(repoRoot, f), c);
  git(repoRoot, 'add', '-A');
  git(repoRoot, 'commit', '-q', '-m', 'base');
  const sha = git(repoRoot, 'rev-parse', 'HEAD');
  const t = {
    id: 'toy-impl', stage: 'implementation', base_commit: sha, setup_command: ['npm', 'ci', '--ignore-scripts'],
    checks: {
      typecheck: [{ argv: ['node', 'tc.js'], cwd: '.', timeout_s: 30 }], lint: null,
      tests: { own_argv: ['node', '--test', '--test-reporter=tap'], baseline_files: ['tests/**/*.test.mjs'], timeout_s: 30 },
      shared: { argv: ['node', 'x'], timeout_s: 5 },
    },
    protected_globs: [], acceptance: { folder: 'acceptance', checks_file: 'acceptance/checks.json', adapters: {} }, ...task,
  };
  // The task's acceptance folder lives in the experiment tree.
  put(path.join(expRoot, 'tasks', t.id, 'acceptance', 'checks.json'), [{ id: 'CHK1', required: true, requirement: 'r' }]);
  const setupCalls = [];
  const setup = async ({ dir }) => { setupCalls.push(dir); put(path.join(dir, 'node_modules', 'pkg', 'index.js'), 'pkg'); };
  return { repoRoot, expRoot, task: t, sha, setup, setupCalls };
}
const baselineFile = (x) => path.join(x.expRoot, 'local', 'baselines', `${x.task.id}.json`);
const build = (x, deps = {}) => buildBaseline({ expRoot: x.expRoot, repoRoot: x.repoRoot, task: x.task, deps: { setup: x.setup, ...deps } });
const out = (r) => r.lines.join('\n');

test('F4: the baseline lists passing, failing and flaky tests, the hashes, and keeps a history-free tree', async () => {
  const x = toy({ tests: { 'tests/a.test.mjs': PASS, 'tests/b.test.mjs': "import { test } from 'node:test'; test('known bad', () => { throw new Error('x'); }); test('fine', () => {});\n" } });
  const res = await build(x);
  assert.equal(res.code, 0, out(res));
  const b = JSON.parse(fs.readFileSync(baselineFile(x), 'utf8'));
  assert.equal(b.base_commit, x.sha);
  assert.deepEqual(b.passing_tests, ['tests/a.test.mjs::also works', 'tests/a.test.mjs::works', 'tests/b.test.mjs::fine']);
  assert.deepEqual(b.failing_tests, ['tests/b.test.mjs::known bad']);
  assert.deepEqual(b.flaky_tests, []);
  assert.equal(b.typecheck_errors, 0);
  assert.equal(b.lint_errors, 0);
  for (const k of ['checks_sha256', 'setup_sha256', 'lockfile_sha256', 'node_modules_sha256', 'acceptance_sha256', 'checks_json_sha256']) assert.match(b[k], /^[0-9a-f]{64}$/, k);
  assert.ok(!Number.isNaN(Date.parse(b.created)));
  const tree = path.join(x.expRoot, 'local', 'baselines', x.task.id, 'tree');
  assert.deepEqual(execFileSync('git', ['log', '--all', '--format=%s'], { cwd: tree, encoding: 'utf8' }).trim().split('\n'), ['base']);
  assert.equal(x.setupCalls.length, 1);
  assert.equal(baselineProblem({ expRoot: x.expRoot, repoRoot: x.repoRoot, task: x.task }), null);
});

test('E14: typecheck errors in the base exit 3, print the first 10 lines and write no file', async () => {
  const lines = Array.from({ length: 14 }, (_, i) => `console.log('src/f${i}.ts(1,1): error TS2322: bad ${i}');`).join(' ');
  const x = toy({ tc: `${lines} process.exit(2);\n` });
  const res = await build(x);
  assert.equal(res.code, 3);
  assert.match(out(res), /typecheck/);
  assert.match(out(res), /src\/f9\.ts/);
  assert.ok(!out(res).includes('src/f10.ts'), 'only the first 10 lines are printed');
  assert.ok(!fs.existsSync(baselineFile(x)));
});

test('E15: a baseline test file that cannot run exits 3 and names the file', async () => {
  const x = toy({ tests: { 'tests/a.test.mjs': PASS, 'tests/broken.test.mjs': 'not javascript (\n' } });
  const res = await build(x);
  assert.equal(res.code, 3);
  assert.match(out(res), /tests\/broken\.test\.mjs/);
  assert.ok(!fs.existsSync(baselineFile(x)));
});

test('E16: a test that passes in the first run and fails in the second is flaky and excluded from the pass rule', async () => {
  const flip = "import { test } from 'node:test'; import fs from 'node:fs'; test('steady', () => {}); test('flips', () => { if (fs.existsSync('flip.marker')) throw new Error('second run'); fs.writeFileSync('flip.marker', '1'); });\n";
  const x = toy({ tests: { 'tests/flip.test.mjs': flip } });
  const res = await build(x);
  assert.equal(res.code, 0, out(res));
  const b = JSON.parse(fs.readFileSync(baselineFile(x), 'utf8'));
  assert.deepEqual(b.flaky_tests, ['tests/flip.test.mjs::flips']);
  assert.deepEqual(b.passing_tests, ['tests/flip.test.mjs::steady']);
  assert.deepEqual(b.failing_tests, []);
});

test('E17: baselineProblem names exp baseline for a missing file and each stale hash', async () => {
  const x = toy();
  assert.match(baselineProblem({ expRoot: x.expRoot, repoRoot: x.repoRoot, task: x.task }), /no baseline.*exp baseline toy-impl/);
  assert.equal((await build(x)).code, 0);
  const problem = (task) => baselineProblem({ expRoot: x.expRoot, repoRoot: x.repoRoot, task });
  assert.equal(problem(x.task), null);
  const checks = structuredClone(x.task); checks.checks.typecheck[0].argv = ['node', 'other.js'];
  assert.match(problem(checks), /checks_sha256.*exp baseline toy-impl/);
  assert.match(problem({ ...x.task, setup_command: ['npm', 'ci', '--ignore-scripts', '--x'] }), /setup_sha256/);
  assert.match(problem({ ...x.task, post_setup: ['node', 'gen.js'] }), /setup_sha256/);
  put(path.join(x.repoRoot, 'package-lock.json'), '{"lockfileVersion":3,"packages":{"x":{}}}\n');
  git(x.repoRoot, 'add', '-A'); git(x.repoRoot, 'commit', '-q', '-m', 'lock');
  assert.match(problem({ ...x.task, base_commit: git(x.repoRoot, 'rev-parse', 'HEAD') }), /lockfile_sha256/);
});

test('E18: a failing setup, or a check that times out, exits 3 and names the command', async () => {
  const bad = toy();
  const r1 = await build(bad, { setup: async () => { throw new Error('exit 1'); } });
  assert.equal(r1.code, 3);
  assert.match(out(r1), /npm ci --ignore-scripts/);
  assert.ok(!fs.existsSync(baselineFile(bad)));
  const slow = toy({ tc: 'setInterval(()=>{},1000)\n' });
  slow.task.checks.typecheck[0].timeout_s = 0.4;
  const r2 = await build(slow);
  assert.equal(r2.code, 3);
  assert.match(out(r2), /node tc\.js/);
  assert.ok(!fs.existsSync(baselineFile(slow)));
});
