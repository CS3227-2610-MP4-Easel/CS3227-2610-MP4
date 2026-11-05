import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { batchPaths, diff, hashFile, hashPath, hashTree, snapshot } from './containment.mjs';
import { tmpDir } from './testkit.mjs';

function setup() {
  const repoRoot = tmpDir('exp-contain-');
  execFileSync('git', ['init', '-q'], { cwd: repoRoot });
  const expRoot = path.join(repoRoot, 'workflow', 'experiments');
  for (const d of ['arms', 'tasks', 'experiments', 'plugins', 'rubric', 'harness']) fs.mkdirSync(path.join(expRoot, d), { recursive: true });
  fs.writeFileSync(path.join(expRoot, 'config.json'), '{}');
  fs.writeFileSync(path.join(expRoot, 'pricing.json'), '{}');
  const home = tmpDir('exp-home-');
  fs.mkdirSync(path.join(home, '.claude'));
  fs.writeFileSync(path.join(home, '.claude', 'settings.json'), '{}');
  return { repoRoot, expRoot, home };
}

test('hashFile: stable for equal content, null for a missing file', () => {
  const d = tmpDir();
  fs.writeFileSync(path.join(d, 'a'), 'x');
  fs.writeFileSync(path.join(d, 'b'), 'x');
  assert.equal(hashFile(path.join(d, 'a')), hashFile(path.join(d, 'b')));
  assert.equal(hashFile(path.join(d, 'none')), null);
});

test('hashTree changes when a nested file changes or is added', () => {
  const d = tmpDir();
  fs.mkdirSync(path.join(d, 'sub'));
  fs.writeFileSync(path.join(d, 'sub', 'f'), '1');
  const h1 = hashTree(d);
  fs.writeFileSync(path.join(d, 'sub', 'f'), '2');
  const h2 = hashTree(d);
  fs.writeFileSync(path.join(d, 'g'), '');
  assert.notEqual(h1, h2);
  assert.notEqual(hashTree(d), h2);
});

test('the F17 path set covers .git/config, .git/hooks, user settings and the batch config files', () => {
  const ctx = setup();
  const paths = batchPaths(ctx).map((p) => path.relative(ctx.repoRoot, p).split(path.sep).join('/'));
  assert.ok(paths.includes('.git/config') && paths.includes('.git/hooks'));
  assert.ok(paths.some((p) => p.startsWith('..') && p.endsWith('.claude/settings.json')));
  for (const d of ['arms', 'tasks', 'experiments', 'plugins', 'rubric', 'harness']) assert.ok(paths.includes(`workflow/experiments/${d}`), d);
  assert.ok(paths.includes('workflow/experiments/config.json') && paths.includes('workflow/experiments/pricing.json'));
});

test('E26 (unit part): an append to the main .git/config is reported with its path', () => {
  const ctx = setup();
  const paths = batchPaths(ctx);
  const before = snapshot(paths);
  assert.deepEqual(diff(before, snapshot(paths)), []);
  fs.appendFileSync(path.join(ctx.repoRoot, '.git', 'config'), '\n[core]\n\thooksPath = /evil\n');
  assert.deepEqual(diff(before, snapshot(paths)), [path.join(ctx.repoRoot, '.git', 'config')]);
});

test('E27 (unit part): a write to the temp-home ~/.claude/settings.json is reported', () => {
  const ctx = setup();
  const paths = batchPaths(ctx);
  const before = snapshot(paths);
  fs.writeFileSync(path.join(ctx.home, '.claude', 'settings.json'), '{"hooks":{}}');
  assert.deepEqual(diff(before, snapshot(paths)), [path.join(ctx.home, '.claude', 'settings.json')]);
});

test('a new file in .git/hooks or in arms/ is reported', () => {
  const ctx = setup();
  const paths = batchPaths(ctx);
  const before = snapshot(paths);
  fs.writeFileSync(path.join(ctx.repoRoot, '.git', 'hooks', 'pre-commit'), '#!/bin/sh');
  fs.writeFileSync(path.join(ctx.expRoot, 'arms', 'evil.json'), '{}');
  assert.deepEqual(diff(before, snapshot(paths)).map((p) => path.basename(p)).sort(), ['arms', 'hooks']);
});

test('E64 (unit part): a changed run state file is reported; a harness rewrite that is re-recorded is not', () => {
  const d = tmpDir();
  const state = path.join(d, 'state.json');
  fs.writeFileSync(state, '{"status":"running"}');
  const recorded = snapshot([state]);
  fs.writeFileSync(state, '{"status":"done"}'); // an agent edit
  assert.deepEqual(diff(recorded, snapshot([state])), [state]);
  const rerecorded = snapshot([state]); // the harness writes, then records the hash again
  assert.deepEqual(diff(rerecorded, snapshot([state])), []);
});

test('hashPath handles files, directories and missing paths', () => {
  const d = tmpDir();
  fs.writeFileSync(path.join(d, 'f'), 'x');
  assert.ok(hashPath(path.join(d, 'f')));
  assert.ok(hashPath(d));
  assert.equal(hashPath(path.join(d, 'nope')), null);
});

test('T6: an implementation batch also records local/plans and the baseline file of its task', () => {
  const repoRoot = tmpDir('exp-c-');
  execFileSync('git', ['init', '-q'], { cwd: repoRoot });
  const expRoot = path.join(repoRoot, 'workflow', 'experiments');
  const plain = batchPaths({ repoRoot, expRoot, home: repoRoot });
  const impl = batchPaths({ repoRoot, expRoot, home: repoRoot, implTaskId: 'impl-task' });
  const added = impl.filter((p) => !plain.includes(p)).map((p) => path.relative(expRoot, p).split(path.sep).join('/')).sort();
  assert.deepEqual(added, ['local/baselines/impl-task.json', 'local/plans']);
  assert.ok(!impl.some((p) => p.endsWith(path.join('impl-task', 'tree'))), 'the baseline tree is re-hashed by F8, not here');
});
