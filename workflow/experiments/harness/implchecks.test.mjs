import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { buildVerifyTree, matchGlob, toolchainManifest, validateLockfile } from './implchecks.mjs';
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
