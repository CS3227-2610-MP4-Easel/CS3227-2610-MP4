import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { buildVerifyTree, matchGlob, toolchainDirs, toolchainManifest, treeToolchainManifest, validateLockfile } from './implchecks.mjs';
import { put, tmpDir } from './testkit.mjs';

const read = (...p) => fs.readFileSync(path.join(...p), 'utf8');
const exists = (...p) => fs.existsSync(path.join(...p));

const PKG = (extra = {}) => JSON.stringify({ name: 'app', scripts: { test: 'x' }, dependencies: { a: '1' }, devDependencies: { typescript: '5' }, ...extra }, null, 2);
const lock = (packages) => JSON.stringify({ lockfileVersion: 3, packages: { '': { name: 'app' }, ...packages } }, null, 2);
const REG = 'https://registry.npmjs.org/';
const BASE_LOCK = lock({
  'node_modules/typescript': { version: '5.0.0', resolved: `${REG}typescript/-/typescript-5.0.0.tgz`, integrity: 'sha512-AAA' },
  'node_modules/a': { version: '1.0.0', resolved: `${REG}a/-/a-1.0.0.tgz`, integrity: 'sha512-BBB' },
});

/** A pristine baseline tree and an agent clone that starts as a copy of it (plus plan files). */
function fixture({ junction = false } = {}) {
  const baseline = tmpDir('exp-base-');
  const files = {
    'package.json': PKG(), 'package-lock.json': BASE_LOCK, 'src/a.ts': 'export const a = 1;\n', 'src/dep.ts': 'export const dep = 1;\n',
    'src/b.ts': 'export const b = 1;\n', 'tests/old.test.ts': 'old\n', 'tsconfig.json': '{}\n', 'src/be/api/tsconfig.json': '{}\n',
    'node_modules/typescript/lib/tsc.js': 'PRISTINE\n', 'node_modules/a/index.js': 'a\n',
  };
  for (const [f, c] of Object.entries(files)) put(path.join(baseline, f), c);
  let linked = false;
  if (junction) {
    try {
      fs.mkdirSync(path.join(baseline, 'node_modules', '@scope'), { recursive: true });
      fs.symlinkSync(path.join(baseline, 'src'), path.join(baseline, 'node_modules', '@scope', 'ws'), 'junction');
      linked = true;
    } catch { /* no links on this machine */ }
  }
  const clone = tmpDir('exp-clone-');
  for (const [f, c] of Object.entries(files)) if (!f.startsWith('node_modules/')) put(path.join(clone, f), c);
  put(path.join(clone, 'node_modules', 'typescript', 'lib', 'tsc.js'), 'PATCHED\n');
  put(path.join(clone, 'docs', 'plan.md'), '# plan\n');
  const planFiles = new Map([['docs/plan.md', Buffer.from('# plan\n')]]);
  return { baseline, clone, planFiles, scratch: tmpDir('exp-scratch-'), linked, install: async () => { fixtureCalls.push('install'); } };
}
let fixtureCalls = [];
const build = (fx, over = {}) => buildVerifyTree({ baselineTree: fx.baseline, clone: fx.clone, planFiles: fx.planFiles, scratch: fx.scratch, protectedGlobs: [], install: fx.install, ...over });

test('matchGlob: ** crosses folders, * stays inside one', () => {
  assert.ok(matchGlob('tests/**', 'tests/a/b.test.ts'));
  assert.ok(matchGlob('**/tsconfig*.json', 'tsconfig.json'));
  assert.ok(matchGlob('**/tsconfig*.json', 'src/be/api/tsconfig.base.json'));
  assert.ok(matchGlob('**/*.test.ts', 'a/b/c.test.ts'));
  assert.ok(!matchGlob('*.ts', 'src/a.ts'));
  assert.ok(!matchGlob('tests/**', 'src/tests/a.ts'));
  assert.ok(!matchGlob('**/tsconfig*.json', 'src/tsconfig.json.bak'));
});

test('E31: a patched node_modules in the clone has no effect; the verify tree holds the pristine toolchain', async () => {
  const fx = fixture();
  const res = await build(fx);
  assert.deepEqual(res.flags, []);
  assert.equal(read(res.dir, 'node_modules', 'typescript', 'lib', 'tsc.js'), 'PRISTINE\n');
  assert.deepEqual(res.changed, []);
});

test('changed and added files are copied, unchanged files are not listed, and package scripts are not a dependency change (E43)', async () => {
  const fx = fixture();
  put(path.join(fx.clone, 'src', 'a.ts'), 'export const a = 2;\n');
  put(path.join(fx.clone, 'tests', 'pinned-note.test.ts'), 'new test\n');
  put(path.join(fx.clone, 'package.json'), PKG({ scripts: { test: 'rm -rf /' } }));
  const res = await build(fx);
  assert.deepEqual(res.changed.sort(), ['package.json', 'src/a.ts', 'tests/pinned-note.test.ts']);
  assert.equal(read(res.dir, 'src', 'a.ts'), 'export const a = 2;\n');
  assert.equal(read(res.dir, 'tests', 'pinned-note.test.ts'), 'new test\n');
  assert.equal(res.depsChanged, false, 'only scripts changed');
  assert.deepEqual(fixtureCalls, []);
});

test('E94: a source file deleted in the clone is deleted in the verify tree and listed', async () => {
  const fx = fixture();
  fs.rmSync(path.join(fx.clone, 'src', 'dep.ts'));
  const res = await build(fx);
  assert.deepEqual(res.deleted, ['src/dep.ts']);
  assert.ok(!exists(res.dir, 'src', 'dep.ts'));
  assert.ok(exists(res.dir, 'src', 'b.ts'));
});

test('expectedMissing: base files the clone overlay removed on purpose are not the agent\'s deletions (T6)', async () => {
  const fx = fixture();
  fs.rmSync(path.join(fx.clone, 'src', 'dep.ts'));
  fs.rmSync(path.join(fx.clone, 'src', 'b.ts'));
  const res = await build(fx, { expectedMissing: new Set(['src/dep.ts']) });
  assert.deepEqual(res.deleted, ['src/b.ts']);
});

test('plan files are neither copied nor counted as changes; an edited or deleted one is plan_changed (E47 detection)', async () => {
  const same = fixture();
  const r1 = await build(same);
  assert.deepEqual(r1.plan_changed, []);
  assert.ok(!exists(r1.dir, 'docs', 'plan.md'));
  assert.ok(!r1.changed.includes('docs/plan.md'));
  const edited = fixture();
  put(path.join(edited.clone, 'docs', 'plan.md'), '# plan, edited\n');
  const r2 = await build(edited);
  assert.deepEqual(r2.plan_changed, ['docs/plan.md']);
  assert.ok(!exists(r2.dir, 'docs', 'plan.md'));
  const gone = fixture();
  fs.rmSync(path.join(gone.clone, 'docs', 'plan.md'));
  assert.deepEqual((await build(gone)).plan_changed, ['docs/plan.md']);
});

test('E41, E42: protected_changed lists modified or deleted base files under a protected glob; a new file there is allowed', async () => {
  const fx = fixture();
  put(path.join(fx.clone, 'src/be/api/tsconfig.json'), '{"strict":false}\n');
  fs.rmSync(path.join(fx.clone, 'tests', 'old.test.ts'));
  put(path.join(fx.clone, 'tests', 'new.test.ts'), 'new\n');
  const res = await build(fx, { protectedGlobs: ['**/tsconfig*.json', 'tests/**'] });
  assert.deepEqual(res.protected_changed.sort(), ['src/be/api/tsconfig.json', 'tests/old.test.ts']);
});

test('E35, E104: an unsafe name or a link among the changed files makes the attempt unsafe_path and builds nothing', async (t) => {
  const bad = fixture();
  put(path.join(bad.clone, 'src', 'a&calc.test.ts'), 'x');
  const r = await build(bad);
  assert.ok(r.flags.includes('unsafe_path'));
  assert.match(r.reasons.join('\n'), /a&calc\.test\.ts/);
  assert.equal(r.dir, null);
  assert.deepEqual(fs.readdirSync(bad.scratch), []);
  const link = fixture();
  try { fs.symlinkSync(path.join(link.baseline, 'src', 'a.ts'), path.join(link.clone, 'src', 'l.ts'), 'file'); } catch (e) { t.diagnostic(`symlink part skipped: ${e.code}`); return; }
  assert.ok((await build(link)).flags.includes('unsafe_path'));
});

test('an unchanged file with an unusual name (.gitignore) does not make the attempt unsafe', async () => {
  const fx = fixture();
  put(path.join(fx.baseline, '.gitignore'), 'x\n');
  put(path.join(fx.clone, '.gitignore'), 'x\n');
  assert.deepEqual((await build(fx)).flags, []);
});

test('node_modules is a copy; a workspace junction is recreated inside the verify tree, never pointing at the baseline', async (t) => {
  const fx = fixture({ junction: true });
  if (!fx.linked) { t.skip('this machine cannot create junctions here'); return; }
  const res = await build(fx);
  const link = path.join(res.dir, 'node_modules', '@scope', 'ws');
  assert.ok(fs.lstatSync(link).isSymbolicLink());
  assert.equal(path.resolve(path.dirname(link), fs.readlinkSync(link)), path.join(res.dir, 'src'));
  assert.ok(!fs.lstatSync(path.join(res.dir, 'node_modules', 'a', 'index.js')).isSymbolicLink());
});

test('E103: the toolchain manifest hash changes when a pristine file changes, and is the same for a retargeted copy', async (t) => {
  const fx = fixture({ junction: true });
  const h1 = toolchainManifest(path.join(fx.baseline, 'node_modules'), fx.baseline);
  assert.match(h1, /^[0-9a-f]{64}$/);
  assert.equal(toolchainManifest(path.join(fx.baseline, 'node_modules'), fx.baseline), h1);
  if (fx.linked) {
    const res = await build(fx);
    assert.equal(toolchainManifest(path.join(res.dir, 'node_modules'), res.dir), h1, 'a faithful copy has the same manifest');
  }
  fs.writeFileSync(path.join(fx.baseline, 'node_modules', 'typescript', 'lib', 'tsc.js'), 'CHANGED\n');
  assert.notEqual(toolchainManifest(path.join(fx.baseline, 'node_modules'), fx.baseline), h1);
});

test('E32: a changed dependency or lockfile sets deps_changed, validates the lockfile, then installs from it', async () => {
  fixtureCalls = [];
  const fx = fixture();
  put(path.join(fx.clone, 'package.json'), PKG({ dependencies: { a: '1', extra: '2' } }));
  put(path.join(fx.clone, 'package-lock.json'), lock({
    'node_modules/typescript': { version: '5.0.0', resolved: `${REG}typescript/-/typescript-5.0.0.tgz`, integrity: 'sha512-AAA' },
    'node_modules/a': { version: '1.0.0', resolved: `${REG}a/-/a-1.0.0.tgz`, integrity: 'sha512-BBB' },
    'node_modules/extra': { version: '2.0.0', resolved: `${REG}extra/-/extra-2.0.0.tgz`, integrity: 'sha512-CCC' },
  }));
  const res = await build(fx, { install: async ({ dir }) => { fixtureCalls.push(dir); } });
  assert.equal(res.depsChanged, true);
  assert.deepEqual(res.flags, ['deps_changed']);
  assert.deepEqual(fixtureCalls, [res.dir], 'npm ci ran once, in the verify tree');
});

test('a reinstall after a dependency change receives the task post_setup (for example prisma generate)', async () => {
  fixtureCalls = [];
  const fx = fixture();
  put(path.join(fx.clone, 'package.json'), PKG({ dependencies: { a: '1', extra: '2' } }));
  put(path.join(fx.clone, 'package-lock.json'), lock({
    'node_modules/typescript': { version: '5.0.0', resolved: `${REG}typescript/-/typescript-5.0.0.tgz`, integrity: 'sha512-AAA' },
    'node_modules/a': { version: '1.0.0', resolved: `${REG}a/-/a-1.0.0.tgz`, integrity: 'sha512-BBB' },
    'node_modules/extra': { version: '2.0.0', resolved: `${REG}extra/-/extra-2.0.0.tgz`, integrity: 'sha512-CCC' },
  }));
  let seen = null;
  await build(fx, { install: async ({ postSetup }) => { seen = postSetup; }, postSetup: ['npx', 'prisma', 'generate'] });
  assert.deepEqual(seen, ['npx', 'prisma', 'generate']);
});

test('E97: a lockfile resolving to file:, git or another registry, or altering a baseline package, is unsafe_deps and no install runs', async () => {
  const cases = {
    'file: tarball': lock({ 'node_modules/typescript': { version: '5.0.0', resolved: 'file:../evil.tgz', integrity: 'sha512-AAA' }, 'node_modules/a': { version: '1.0.0', resolved: `${REG}a/-/a-1.0.0.tgz`, integrity: 'sha512-BBB' } }),
    'git url': lock({ 'node_modules/x': { version: '1.0.0', resolved: 'git+ssh://git@github.com/x/x.git#abc', integrity: 'sha512-X' } }),
    'other registry': lock({ 'node_modules/x': { version: '1.0.0', resolved: 'https://registry.evil.example/x/-/x-1.0.0.tgz', integrity: 'sha512-X' } }),
    'http registry': lock({ 'node_modules/x': { version: '1.0.0', resolved: 'http://registry.npmjs.org/x/-/x-1.0.0.tgz', integrity: 'sha512-X' } }),
    'changed version': lock({ 'node_modules/typescript': { version: '5.9.9', resolved: `${REG}typescript/-/typescript-5.9.9.tgz`, integrity: 'sha512-AAA' }, 'node_modules/a': { version: '1.0.0', resolved: `${REG}a/-/a-1.0.0.tgz`, integrity: 'sha512-BBB' } }),
    'changed integrity': lock({ 'node_modules/typescript': { version: '5.0.0', resolved: `${REG}typescript/-/typescript-5.0.0.tgz`, integrity: 'sha512-ZZZ' }, 'node_modules/a': { version: '1.0.0', resolved: `${REG}a/-/a-1.0.0.tgz`, integrity: 'sha512-BBB' } }),
    'baseline package removed': lock({ 'node_modules/a': { version: '1.0.0', resolved: `${REG}a/-/a-1.0.0.tgz`, integrity: 'sha512-BBB' } }),
  };
  for (const [name, text] of Object.entries(cases)) {
    fixtureCalls = [];
    const fx = fixture();
    put(path.join(fx.clone, 'package-lock.json'), text);
    const res = await build(fx);
    assert.ok(res.flags.includes('unsafe_deps'), name);
    assert.equal(res.dir, null, name);
    assert.deepEqual(fixtureCalls, [], `${name}: no install`);
  }
});

test('validateLockfile: workspace link entries and bundled packages without resolved are allowed; broken JSON is refused', () => {
  const ok = lock({
    'node_modules/typescript': { version: '5.0.0', resolved: `${REG}typescript/-/typescript-5.0.0.tgz`, integrity: 'sha512-AAA' },
    'node_modules/a': { version: '1.0.0', resolved: `${REG}a/-/a-1.0.0.tgz`, integrity: 'sha512-BBB' },
    'node_modules/@agile/api': { resolved: 'src/be/api', link: true },
    'src/be/api': { name: '@agile/api', version: '0.0.0' },
  });
  assert.deepEqual(validateLockfile(ok, BASE_LOCK), { ok: true, reasons: [] });
  assert.equal(validateLockfile('{ nope', BASE_LOCK).ok, false);
  assert.equal(validateLockfile(JSON.stringify({ lockfileVersion: 1, dependencies: {} }), BASE_LOCK).ok, false);
});

// ---- running the checks (T4 step 4) ---------------------------------------------------------------------------------

import { checkEnv, runChecks, runCommand, stageAcceptance, sweepProcesses } from './implchecks.mjs';
import { pidAlive } from './testkit.mjs';

const script = (dir, name, code) => { put(path.join(dir, name), code); return name; };
const ENV = () => ({ PATH: process.env.PATH, SystemRoot: process.env.SystemRoot ?? '', ComSpec: process.env.ComSpec ?? '' });
const TSERR = "console.log('src/a.ts(1,1): error TS2322: bad'); console.log('src/b.ts(2,2): error TS2304: worse'); process.exit(2);";

test('N3: the check environment holds exactly the allowlist, the four folders are empty ones inside the scratch folder', () => {
  const scratch = tmpDir('exp-env-');
  const cache = tmpDir('exp-cache-');
  const parent = { PATH: 'p', PATHEXT: '.EXE', ComSpec: 'c', SystemRoot: 's', ANTHROPIC_API_KEY: 'k', GITHUB_TOKEN: 'g', NODE_OPTIONS: '--require x', npm_config_registry: 'http://evil', HOME: 'real' };
  const env = checkEnv({ parentEnv: parent, scratch, cacheDir: cache });
  assert.deepEqual(Object.keys(env).sort(), ['APPDATA', 'ComSpec', 'HOME', 'PATH', 'PATHEXT', 'SystemRoot', 'TEMP', 'TMP', 'USERPROFILE', 'npm_config_cache']);
  for (const k of ['TEMP', 'TMP', 'HOME', 'USERPROFILE', 'APPDATA']) {
    assert.ok(path.resolve(env[k]).startsWith(path.resolve(scratch)), k);
    assert.ok(fs.existsSync(env[k]) && fs.readdirSync(env[k]).length === 0, `${k} is an empty folder`);
  }
  assert.equal(env.npm_config_cache, cache);
  assert.equal(env.PATH, 'p');
});

test('N3, E93: argv[0] must be node and is replaced by the Node binary; arguments are never interpreted by a shell', async () => {
  const dir = tmpDir('exp-run-');
  await assert.rejects(() => runCommand({ argv: ['sh', '-c', 'echo hi'], cwd: dir, env: ENV(), timeoutMs: 5000 }), /node/);
  await assert.rejects(() => runCommand({ argv: 'node -e 1', cwd: dir, env: ENV(), timeoutMs: 5000 }), /argv/);
  const r = await runCommand({ argv: ['node', '-e', 'console.log(process.argv[1]); console.log(Object.keys(process.env).sort().join())', 'a&echo pwned|x'], cwd: dir, env: { ...ENV(), ONLY: '1' }, timeoutMs: 20000 });
  const [arg, keys] = r.stdout.trim().split(/\r?\n/);
  assert.equal(arg, 'a&echo pwned|x');
  assert.match(keys, /ONLY/);
  assert.ok(!/ANTHROPIC|GITHUB|NODE_OPTIONS/.test(keys), 'the parent environment is not inherited');
});

test('E36: a command over its timeout is killed and reported; E37: 20 MB of output is killed at 10 MB with the output cut at 1 MB', async () => {
  const dir = tmpDir('exp-run-');
  const t = await runCommand({ argv: ['node', '-e', 'setInterval(()=>{},1000)'], cwd: dir, env: ENV(), timeoutMs: 400 });
  assert.equal(t.timedOut, true);
  const big = await runCommand({ argv: ['node', '-e', "for (let i=0;i<20;i++) process.stdout.write('x'.repeat(1e6)); setInterval(()=>{},1000)"], cwd: dir, env: ENV(), timeoutMs: 60000 });
  assert.equal(big.killed, true);
  assert.equal(big.truncated, true);
  assert.ok(big.stdout.length <= 1024 * 1024, `kept ${big.stdout.length}`);
  assert.equal(big.timedOut, false);
});

const toyTask = (over = {}) => ({
  checks: {
    typecheck: [{ argv: ['node', 'tc.js'], cwd: '.', timeout_s: 20 }],
    lint: null,
    tests: { own_argv: ['node', '--test', '--test-reporter=tap'], baseline_files: ['tests/**/*.test.mjs'], timeout_s: 30 },
    shared: { argv: ['node', 'x'], timeout_s: 10 },
  },
  ...over,
});
const BASELINE = { passing_tests: [], failing_tests: [], flaky_tests: [] };
const checksIn = (dir, task, extra = {}) => runChecks({ task, dir, env: ENV(), baseline: BASELINE, changed: [], ...extra });
const PASS_TEST = "import { test } from 'node:test'; test('works', () => {});\n";

test('F10 parsing: typecheck errors are the lines that match error TS<digits>; a failure with none is status error', async () => {
  const dir = tmpDir('exp-chk-');
  script(dir, 'tc.js', TSERR);
  const r1 = await checksIn(dir, toyTask());
  assert.equal(r1.typecheck.errors, 2);
  assert.equal(r1.typecheck.status, 'fail');
  assert.match(r1.typecheck.lines.join('\n'), /src\/a\.ts\(1,1\): error TS2322/);
  script(dir, 'tc.js', "console.log('boom'); process.exit(1);");
  const r2 = await checksIn(dir, toyTask());
  assert.equal(r2.typecheck.errors, 0);
  assert.equal(r2.typecheck.status, 'error');
  script(dir, 'tc.js', 'process.exit(0);');
  const r3 = await checksIn(dir, toyTask());
  assert.deepEqual([r3.typecheck.status, r3.typecheck.errors], ['ok', 0]);
});

test('E34: every step runs after a typecheck failure and the order is typecheck, lint, own tests, baseline tests', async () => {
  const dir = tmpDir('exp-chk-');
  script(dir, 'tc.js', "console.log('src/a.ts(1,1): error TS2322: bad'); require('fs').appendFileSync('order.txt','tc,'); process.exit(2);");
  script(dir, 'lint.js', "require('fs').appendFileSync('order.txt','lint,'); process.exit(0);");
  put(path.join(dir, 'tests', 'own.test.mjs'), PASS_TEST);
  put(path.join(dir, 'tests', 'old.test.mjs'), PASS_TEST);
  const task = toyTask({});
  task.checks.lint = [{ argv: ['node', 'lint.js'], cwd: '.', timeout_s: 20 }];
  const baseline = { passing_tests: ['tests/old.test.mjs::works'], failing_tests: [], flaky_tests: [] };
  const r = await checksIn(dir, task, { baseline, changed: ['tests/own.test.mjs'] });
  assert.equal(fs.readFileSync(path.join(dir, 'order.txt'), 'utf8'), 'tc,lint,');
  assert.equal(r.typecheck.status, 'fail');
  assert.equal(r.lint.status, 'ok');
  assert.deepEqual(r.own_tests.files, ['tests/own.test.mjs']);
  assert.equal(r.own_tests.passed, 1);
  assert.deepEqual(r.baseline_tests, { newly_failing: [], missing: [] });
});

test('E40: failing lines are cut to 40 lines of 300 characters, and a 100-error output still counts all 100', async () => {
  const dir = tmpDir('exp-chk-');
  script(dir, 'tc.js', "for (let i=0;i<100;i++) console.log('f'+i+'.ts(1,1): error TS2322: ' + 'y'.repeat(400)); process.exit(2);");
  const r = await checksIn(dir, toyTask());
  assert.equal(r.typecheck.errors, 100);
  assert.equal(r.typecheck.lines.length, 40);
  assert.ok(r.typecheck.lines.every((l) => l.length <= 300));
});

test('E36: a check over its timeout is check_timeout, status error; later steps still run', async () => {
  const dir = tmpDir('exp-chk-');
  script(dir, 'tc.js', 'setInterval(()=>{},1000)');
  put(path.join(dir, 'tests', 'own.test.mjs'), PASS_TEST);
  const task = toyTask();
  task.checks.typecheck[0].timeout_s = 0.4;
  const r = await checksIn(dir, task, { changed: ['tests/own.test.mjs'] });
  assert.equal(r.typecheck.status, 'error');
  assert.ok(r.flags.includes('check_timeout'));
  assert.equal(r.own_tests.passed, 1);
});

test('E36: the attempt total check_total_s bounds all steps; steps left over are not run and the flag is set', async () => {
  const dir = tmpDir('exp-chk-');
  script(dir, 'tc.js', 'setInterval(()=>{},1000)');
  put(path.join(dir, 'tests', 'own.test.mjs'), PASS_TEST);
  const r = await checksIn(dir, toyTask(), { changed: ['tests/own.test.mjs'], totalS: 0.5 });
  assert.ok(r.flags.includes('check_timeout'));
  assert.equal(r.own_tests.passed, 0, 'no time was left for the tests');
});

test('E37: output over the cap sets output_truncated', async () => {
  const dir = tmpDir('exp-chk-');
  script(dir, 'tc.js', "for (let i=0;i<20;i++) process.stdout.write('x'.repeat(1e6)); setInterval(()=>{},1000)");
  const r = await checksIn(dir, toyTask());
  assert.ok(r.flags.includes('output_truncated'));
  assert.equal(r.typecheck.status, 'error');
});

test('E39: a key pattern in check output sets secret_in_check_output, empties every lines field and stores no output', async () => {
  const dir = tmpDir('exp-chk-');
  const key = `sk-ant-${'a1B2c3D4e5'.repeat(3)}`;
  script(dir, 'tc.js', `console.log('a.ts(1,1): error TS2322: ${key}'); process.exit(2);`);
  const r = await checksIn(dir, toyTask());
  assert.equal(r.secret_in_check_output, true);
  assert.ok(r.flags.includes('secret_in_check_output'));
  assert.deepEqual(r.typecheck.lines, []);
  assert.equal(r.typecheck.errors, 1, 'the count is still recorded');
  assert.ok(!JSON.stringify(r).includes(key));
});

test('own tests: pass, fail and skip are counted separately and a failing test carries its lines (E44, E48)', async () => {
  const dir = tmpDir('exp-chk-');
  script(dir, 'tc.js', 'process.exit(0);');
  put(path.join(dir, 'tests', 'own.test.mjs'), "import { test } from 'node:test'; test('ok one', () => {}); test('bad one', () => { throw new Error('nope'); }); test.skip('skip one', () => {});\n");
  put(path.join(dir, 'tests', 'broken.test.mjs'), 'this is not javascript (\n');
  const r = await checksIn(dir, toyTask(), { changed: ['tests/own.test.mjs', 'tests/broken.test.mjs', 'src/not-a-test.ts'] });
  assert.deepEqual(r.own_tests.files, ['tests/broken.test.mjs', 'tests/own.test.mjs']);
  assert.equal(r.own_tests.passed, 1);
  assert.equal(r.own_tests.skipped, 1);
  assert.equal(r.own_tests.failed, 2);
  const ids = r.own_tests.failing.map((f) => f.id).sort();
  assert.deepEqual(ids, ['tests/broken.test.mjs::load', 'tests/own.test.mjs::bad one']);
  assert.ok(r.own_tests.failing.find((f) => f.id.endsWith('bad one')).lines.length > 0);
});

test('E98: the sweep kills a grandchild started through an intermediate that exited; a survivor is reported', async () => {
  const root = tmpDir('exp-sweep-');
  script(root, 'gc.js', 'setInterval(()=>{},1000)');
  script(root, 'mid.js', "const {spawn}=require('child_process');const c=spawn(process.execPath,[require('path').join(__dirname,'gc.js')],{detached:true,stdio:'ignore',windowsHide:true,cwd:__dirname});c.unref();console.log(c.pid);");
  const m = await runCommand({ argv: ['node', 'mid.js'], cwd: root, env: ENV(), timeoutMs: 20000 });
  const pid = Number(m.stdout.trim());
  await new Promise((r) => setTimeout(r, 1200));
  assert.ok(pidAlive(pid), 'the orphan is running');
  const res = await sweepProcesses({ root });
  assert.ok(res.killed.includes(pid), `killed ${res.killed}`);
  assert.deepEqual(res.survivors, []);
  await new Promise((r) => setTimeout(r, 500));
  assert.ok(!pidAlive(pid));
  const survivor = await sweepProcesses({ root, list: async () => [{ pid: 424242, commandLine: `node ${root}/x.js` }], kill: async () => {} });
  assert.deepEqual(survivor.survivors, [424242]);
});

test('E98: the acceptance files are copied into the verify tree only after a clean sweep', () => {
  const src = tmpDir('exp-acc-');
  put(path.join(src, 'adapters', 'plan-a.mjs'), 'a');
  put(path.join(src, 'adapters', 'plan-b.mjs'), 'b');
  put(path.join(src, 'runner.mjs'), 'r');
  const dir = tmpDir('exp-verify-');
  assert.equal(stageAcceptance({ dir, acceptanceSrc: src, adapterRel: 'adapters/plan-a.mjs', adapterDest: 'acceptance/plan-a.mjs', sweep: { survivors: [424242] } }), false);
  assert.deepEqual(fs.readdirSync(dir), []);
  assert.equal(stageAcceptance({ dir, acceptanceSrc: src, adapterRel: 'adapters/plan-a.mjs', adapterDest: 'acceptance/plan-a.mjs', sweep: { survivors: [] } }), true);
  assert.equal(read(dir, 'acceptance', 'plan-a.mjs'), 'a');
  assert.ok(!exists(dir, 'acceptance', 'plan-b.mjs'), 'only the adapter of this plan is added');
});

// ---- the green rule (T4 step 5) -------------------------------------------------------------------------------------

import { detectTampering, gitProtectedChanged, gitProtectedSnapshot, isGreen } from './implchecks.mjs';

const CHECKS = [{ id: 'CHK1', required: true, requirement: 'A note can be created.' }, { id: 'CHK2', required: false, requirement: 'Listed newest first.' }];
const greenResult = (over = {}) => ({
  typecheck: { errors: 0, status: 'ok', lines: [] }, lint: { errors: 0, status: 'ok', lines: [] },
  own_tests: { files: ['tests/new.test.ts'], passed: 2, failed: 0, skipped: 0, failing: [] },
  baseline_tests: { newly_failing: [], missing: [] },
  shared: { CHK1: { status: 'pass', message: '' }, CHK2: { status: 'fail', message: 'order' } },
  protected_changed: [], plan_changed: [], flags: [], ...over,
});
const verdict = (over) => isGreen(greenResult(over), CHECKS);

test('F10: a result with every condition met is green; an informational shared failure does not matter', () => {
  const v = verdict({});
  assert.deepEqual(v, { green: true, reasons: [] });
});

test('F10 rows: each failed condition makes the sample red and names why', () => {
  const red = (over, text) => {
    const v = verdict(over);
    assert.equal(v.green, false, text);
    assert.match(v.reasons.join('\n'), new RegExp(text), text);
  };
  red({ typecheck: { errors: 1, status: 'fail', lines: [] } }, 'typecheck');
  red({ typecheck: { errors: 0, status: 'error', lines: [] } }, 'typecheck');
  red({ lint: { errors: 2, status: 'fail', lines: [] } }, 'lint');
  red({ own_tests: { files: [], passed: 0, failed: 0, skipped: 0, failing: [] } }, 'no test'); // E44: no test file
  red({ own_tests: { files: ['t'], passed: 0, failed: 0, skipped: 3, failing: [] } }, 'no test'); // E44: only skipped
  red({ own_tests: { files: ['t'], passed: 3, failed: 1, skipped: 0, failing: [{ id: 'x', lines: [] }] } }, 'failing own test');
  red({ baseline_tests: { newly_failing: ['tests/old.test.ts::a'], missing: [] } }, 'newly failing'); // E45
  red({ baseline_tests: { newly_failing: [], missing: ['tests/old.test.ts::b'] } }, 'missing');
  red({ shared: { CHK1: { status: 'fail', message: '' }, CHK2: { status: 'pass', message: '' } } }, 'required check CHK1');
  red({ shared: { CHK1: { status: 'error', message: '' } } }, 'required check CHK1');
  red({ shared: {} }, 'required check CHK1');
  red({ protected_changed: ['src/be/api/tsconfig.json'] }, 'protected'); // E42
  red({ plan_changed: ['docs/plan.md'] }, 'plan'); // E47
  for (const flag of ['outside_clone_access', 'result_tampering_suspected', 'unsafe_path', 'unsafe_deps', 'check_timeout', 'output_truncated', 'secret_in_check_output', 'containment', 'protected_modified', 'plan_modified']) {
    red({ flags: [flag] }, flag);
  }
});

test('deps_changed and review-only flags do not make a sample red by themselves', () => {
  assert.equal(verdict({ flags: ['deps_changed'] }).green, true);
});

test('E46: a test that already failed at baseline, or a flaky one, is not counted as newly failing', async () => {
  const dir = tmpDir('exp-chk-');
  script(dir, 'tc.js', 'process.exit(0);');
  put(path.join(dir, 'tests', 'known.test.mjs'), "import { test } from 'node:test'; test('known bad', () => { throw new Error('x'); }); test('flaky one', () => { throw new Error('y'); }); test('stable', () => {});\n");
  const baseline = { passing_tests: ['tests/known.test.mjs::stable', 'tests/known.test.mjs::flaky one'], failing_tests: ['tests/known.test.mjs::known bad'], flaky_tests: ['tests/known.test.mjs::flaky one'] };
  const r = await checksIn(dir, toyTask(), { baseline, changed: [] });
  assert.deepEqual(r.baseline_tests, { newly_failing: [], missing: [] });
});

test('E45: a baseline test that now fails is newly_failing; one that is gone is missing', async () => {
  const dir = tmpDir('exp-chk-');
  script(dir, 'tc.js', 'process.exit(0);');
  put(path.join(dir, 'tests', 'old.test.mjs'), "import { test } from 'node:test'; test('now bad', () => { throw new Error('x'); }); test('renamed', () => {});\n");
  const baseline = { passing_tests: ['tests/old.test.mjs::now bad', 'tests/old.test.mjs::was renamed', 'tests/deleted.test.mjs::gone'], failing_tests: [], flaky_tests: [] };
  const r = await checksIn(dir, toyTask(), { baseline, changed: [] });
  assert.deepEqual(r.baseline_tests.newly_failing, ['tests/old.test.mjs::now bad']);
  assert.deepEqual(r.baseline_tests.missing.sort(), ['tests/deleted.test.mjs::gone', 'tests/old.test.mjs::was renamed']);
});

test('E57: a diff containing process.exit, process.stdout, process.stderr, process.argv, child_process or eval is suspected', () => {
  for (const line of ['process.exit(0)', 'process.stdout.write("x")', 'process.stderr.write("x")', 'const a = process.argv[2]', "import cp from 'node:child_process'", 'eval("1")']) {
    assert.equal(detectTampering([{ rel: 'src/a.ts', text: `const x = 1;\n${line}\n`, before: 'const x = 1;\n' }]), true, line);
  }
  assert.equal(detectTampering([{ rel: 'src/a.ts', text: 'process.exit(1)\nconst y = 2;\n', before: 'process.exit(1)\n' }]), false, 'a line that was already there is not part of the diff');
  assert.equal(detectTampering([{ rel: 'src/a.ts', text: 'const evaluate = 1; // retrieval\n', before: '' }]), false, 'eval inside another word is not eval');
  assert.equal(detectTampering([{ rel: 'src/new.ts', text: 'process.exit(2)\n', before: null }]), true, 'a new file has no before text');
});

test('F10: the bytes of .git/config, .git/hooks and .gitattributes must equal their values at creation', () => {
  const clone = tmpDir('exp-gitclone-');
  put(path.join(clone, '.git', 'config'), '[core]\n');
  put(path.join(clone, '.git', 'hooks', 'pre-commit.sample'), 'sample');
  put(path.join(clone, '.gitattributes'), '* text=auto\n');
  const snap = gitProtectedSnapshot(clone);
  assert.deepEqual(gitProtectedChanged(clone, snap), []);
  put(path.join(clone, '.git', 'config'), '[core]\n\thooksPath = /evil\n');
  put(path.join(clone, '.git', 'hooks', 'post-commit'), 'evil');
  fs.rmSync(path.join(clone, '.gitattributes'));
  assert.deepEqual(gitProtectedChanged(clone, snap).sort(), ['.git/config', '.git/hooks/post-commit', '.gitattributes']);
});

// ---- plan adherence and the pristine toolchain (T4 step 6) ------------------------------------------------------------

import { acceptanceHash, adherence, pristineProblem } from './implchecks.mjs';

const adh = (over = {}) => adherence({
  changed: [], cloneFiles: [], planFiles: [], notesText: null, planTexts: [], ...over,
});

test('E62: one file outside planFiles and one planned file missing', () => {
  const r = adh({
    planFiles: ['src/a.ts', 'src/missing.ts'], changed: ['src/a.ts', 'src/extra.ts'], cloneFiles: ['src/a.ts', 'src/extra.ts', 'src/other.ts'],
  });
  assert.equal(r.files_off_plan, 1);
  assert.equal(r.plan_files_missing, 1);
});

test('F12: a folder entry of planFiles matches every file under it and counts as present', () => {
  const r = adh({ planFiles: ['src/be/notes'], changed: ['src/be/notes/a.ts', 'src/be/notes/deep/b.ts', 'src/be/notesx/c.ts'], cloneFiles: ['src/be/notes/a.ts'] });
  assert.equal(r.files_off_plan, 1, 'only notesx is off plan');
  assert.equal(r.plan_files_missing, 0);
});

test('E63: the notes file and lockfiles are not off plan', () => {
  const r = adh({
    planFiles: ['src/a.ts'], changed: ['src/a.ts', 'IMPLEMENTATION-NOTES.md', 'package-lock.json', 'src/fe/package-lock.json', 'npm-shrinkwrap.json'],
    cloneFiles: ['src/a.ts'],
  });
  assert.equal(r.files_off_plan, 0);
});

test('E64: gates_in_plan counts lines with the word GATE; gates_skipped counts bullets under ## Skipped only', () => {
  const notes = ['# Notes', '## Skipped', '- step 4 (GATE: ask the owner)', '', '## Assumptions', '- used a Map', '- another', ''].join('\n');
  const r = adh({ notesText: notes, planTexts: ['a\nGATE one\nb GATE two\nnot a gate\nGATE three\nGATEWAY is a different word'] });
  assert.equal(r.gates_in_plan, 3);
  assert.equal(r.gates_skipped, 1);
  assert.equal(r.notes_truncated, false);
});

test('F12: a missing notes file or heading gives 0; the bullets are capped at 50 and the file at 20000 characters', () => {
  assert.equal(adh({ notesText: null }).gates_skipped, 0);
  assert.equal(adh({ notesText: '## Assumptions\n- x\n' }).gates_skipped, 0);
  const many = `## Skipped\n${Array.from({ length: 80 }, (_, i) => `- item ${i}`).join('\n')}\n`;
  assert.equal(adh({ notesText: many }).gates_skipped, 50);
  const long = `## Skipped\n- first\n${'x'.repeat(25000)}\n- after the cut\n`;
  const r = adh({ notesText: long });
  assert.equal(r.notes_truncated, true);
  assert.equal(r.gates_skipped, 1, 'the bullet beyond 20000 characters is not read');
});

test('E103: a changed pristine toolchain, checks.json or acceptance folder is reported with its path', () => {
  const baselineTree = tmpDir('exp-pristine-');
  put(path.join(baselineTree, 'node_modules', 'typescript', 'lib', 'tsc.js'), 'PRISTINE');
  const acc = tmpDir('exp-acceptance-');
  put(path.join(acc, 'checks.json'), '[{"id":"CHK1"}]');
  put(path.join(acc, 'runner.mjs'), 'runner');
  const baseline = {
    node_modules_sha256: toolchainManifest(path.join(baselineTree, 'node_modules'), baselineTree),
    acceptance_sha256: acceptanceHash(acc),
    checks_json_sha256: acceptanceHash(path.join(acc, 'checks.json')),
  };
  assert.equal(pristineProblem({ baselineTree, baseline, acceptanceDir: acc }), null);
  put(path.join(acc, 'runner.mjs'), 'changed runner');
  assert.match(pristineProblem({ baselineTree, baseline, acceptanceDir: acc }), /acceptance folder/);
  put(path.join(acc, 'runner.mjs'), 'runner');
  put(path.join(acc, 'checks.json'), '[]');
  assert.match(pristineProblem({ baselineTree, baseline, acceptanceDir: acc }), /checks\.json/);
  put(path.join(acc, 'checks.json'), '[{"id":"CHK1"}]');
  put(path.join(baselineTree, 'node_modules', 'typescript', 'lib', 'tsc.js'), 'POISONED');
  assert.match(pristineProblem({ baselineTree, baseline, acceptanceDir: acc }), /node_modules/);
});

test('a nested node_modules of the baseline (a workspace toolchain) is copied into the verify tree and is part of the pristine manifest', async () => {
  const fx = fixture();
  put(path.join(fx.baseline, 'src', 'fe', 'node_modules', 'typescript', 'bin', 'tsc'), 'FE-TSC\n');
  const root = treeToolchainManifest(fx.baseline);
  assert.notEqual(root, toolchainManifest(path.join(fx.baseline, 'node_modules'), fx.baseline), 'the nested folder changes the manifest');
  const res = await build(fx);
  assert.equal(read(res.dir, 'src', 'fe', 'node_modules', 'typescript', 'bin', 'tsc'), 'FE-TSC\n');
  fs.appendFileSync(path.join(fx.baseline, 'src', 'fe', 'node_modules', 'typescript', 'bin', 'tsc'), 'x');
  assert.notEqual(treeToolchainManifest(fx.baseline), root, 'a patched nested toolchain is detected');
  assert.deepEqual(toolchainDirs(fx.baseline), ['node_modules', 'src/fe/node_modules']);
});

test('a tree with only a root node_modules keeps the plain manifest', () => {
  const fx = fixture();
  assert.equal(treeToolchainManifest(fx.baseline), toolchainManifest(path.join(fx.baseline, 'node_modules'), fx.baseline));
});
