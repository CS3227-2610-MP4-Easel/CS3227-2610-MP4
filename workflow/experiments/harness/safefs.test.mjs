import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { cloneNameProblem, copyFileSafe, walkClone } from './safefs.mjs';
import { put, tmpDir } from './testkit.mjs';

const rels = (res) => res.files.map((f) => f.rel).sort();
const reasons = (res) => res.unsafe.map((u) => `${u.path}: ${u.reason}`).join('\n');

test('E35, E104: names outside ^[A-Za-z0-9_][A-Za-z0-9_./-]*$, device names and trailing dots are refused', () => {
  const bad = ['a&calc.test.ts', '-x.ts', 'a^b.ts', 'a%b.ts', 'a b.ts', 'dir/a b.ts', 'x.ts.', 'dir./x.ts', 'aux', 'docs/NUL.txt', 'com1.ts', 'a.ts:stream', '.hidden.ts', '', 'a\\b.ts', 'dir/x.ts '];
  for (const name of bad) assert.ok(cloneNameProblem(name), `should refuse ${JSON.stringify(name)}`);
  for (const name of ['src/be/api/x.test.ts', '_x.ts', 'a/b-c_d.1.ts', 'tests/pinned-note.test.ts', 'src/.keep', 'docs/console.md']) {
    assert.equal(cloneNameProblem(name), null, name);
  }
});

test('walkClone lists regular files and skips .git, node_modules, dist, .next, .turbo and *.tsbuildinfo at any depth (E96)', () => {
  const root = tmpDir('exp-walk-');
  for (const f of ['src/a.ts', 'tests/b.test.ts', '.gitignore', 'package.json',
    '.git/config', 'node_modules/typescript/index.js', 'src/be/api/node_modules/typescript/index.js',
    'dist/out.js', 'src/be/api/dist/x.js', 'tsconfig.tsbuildinfo', 'src/be/api/tsconfig.tsbuildinfo', 'src/fe/.next/static/main.js', '.turbo/log.txt']) put(path.join(root, f), 'x');
  const res = walkClone(root);
  assert.deepEqual(rels(res), ['.gitignore', 'package.json', 'src/a.ts', 'tests/b.test.ts']);
  assert.deepEqual(res.unsafe, []);
  assert.ok(res.files.every((f) => path.isAbsolute(f.full) && typeof f.size === 'number'));
});

test('E96: a .npmrc anywhere makes the walk unsafe and is not listed', () => {
  const root = tmpDir('exp-walk-');
  put(path.join(root, 'src', 'a.ts'), 'x');
  put(path.join(root, 'src', 'be', '.npmrc'), 'registry=http://evil');
  const res = walkClone(root);
  assert.match(reasons(res), /src\/be\/\.npmrc.*\.npmrc/);
  assert.ok(!rels(res).includes('src/be/.npmrc'));
});

test('E95: a file above the size limit, too many files, or a walk over the time limit are unsafe', () => {
  const root = tmpDir('exp-walk-');
  put(path.join(root, 'big.bin'), 'x'.repeat(2000));
  put(path.join(root, 'a.ts'), 'x');
  assert.match(reasons(walkClone(root, { maxFileBytes: 1000, maxFiles: 100, maxMs: 1000 })), /big\.bin.*larger than 1000 bytes/);
  assert.match(reasons(walkClone(root, { maxFileBytes: 1e6, maxFiles: 1, maxMs: 1000 })), /more than 1 files/);
  let t = 0;
  const slow = walkClone(root, { maxFileBytes: 1e6, maxFiles: 100, maxMs: 50 }, () => (t += 100));
  assert.match(reasons(slow), /longer than 50 ms/);
});

test('E104: a symlink or junction is unsafe and never followed or listed', (t) => {
  const root = tmpDir('exp-walk-');
  const outside = tmpDir('exp-outside-');
  put(path.join(outside, 'secret.txt'), 'secret');
  put(path.join(root, 'a.ts'), 'x');
  try {
    fs.symlinkSync(path.join(outside, 'secret.txt'), path.join(root, 'link.txt'), 'file');
    fs.symlinkSync(outside, path.join(root, 'linkdir'), 'junction');
  } catch (e) {
    t.skip(`this machine cannot create links here (${e.code})`);
    return;
  }
  const res = walkClone(root);
  assert.match(reasons(res), /link\.txt.*symlink/);
  assert.match(reasons(res), /linkdir.*symlink/);
  assert.deepEqual(rels(res), ['a.ts']);
});

test('E104: a hardlink with link count above 1 is unsafe', (t) => {
  const root = tmpDir('exp-walk-');
  put(path.join(root, 'a.ts'), 'x');
  try {
    fs.linkSync(path.join(root, 'a.ts'), path.join(root, 'b.ts'));
  } catch (e) {
    t.skip(`this machine cannot create hardlinks here (${e.code})`);
    return;
  }
  assert.match(reasons(walkClone(root)), /link count/);
});

test('copyFileSafe copies one regular file below the root, creating folders; it refuses links and escapes', (t) => {
  const src = tmpDir('exp-src-');
  const dest = tmpDir('exp-dest-');
  put(path.join(src, 'a.ts'), 'hello');
  copyFileSafe(path.join(src, 'a.ts'), dest, 'x/y/a.ts');
  assert.equal(fs.readFileSync(path.join(dest, 'x', 'y', 'a.ts'), 'utf8'), 'hello');
  assert.throws(() => copyFileSafe(path.join(src, 'a.ts'), dest, '../escape.ts'), /outside/);
  assert.throws(() => copyFileSafe(path.join(src, 'missing.ts'), dest, 'm.ts'));
  try {
    fs.symlinkSync(path.join(src, 'a.ts'), path.join(src, 'l.ts'), 'file');
  } catch (e) {
    t.diagnostic(`symlink part skipped: ${e.code}`);
    return;
  }
  assert.throws(() => copyFileSafe(path.join(src, 'l.ts'), dest, 'l.ts'), /not a regular file/);
});
