import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ConfigError } from './spawn.mjs';
import { assertClonePath, clonePathFor, headOf, prepareClone } from './clone.mjs';
import { tmpDir } from './testkit.mjs';

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
const write = (f, c = 'x') => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, c); };

function makeMain() {
  const repo = tmpDir('exp-main-');
  git(repo, 'init', '-q');
  for (const [f, c] of Object.entries({
    'AGENTS.md': 'agents', 'CLAUDE.md': 'claude', 'GEMINI.md': 'gemini', 'src/app.txt': 'app',
    '.claude/settings.json': '{"hooks":{"x":1}}', '.claude/settings.local.json': '{}',
    '.claude/skills/s1/SKILL.md': 's1', '.claude/skills/s2/SKILL.md': 's2',
    '.claude/agents/a1.md': 'a1', '.claude/agents/a2.md': 'a2', '.claude/commands/c.md': 'c', '.mcp.json': '{}',
  })) write(path.join(repo, f), c);
  git(repo, '-c', 'user.name=t', '-c', 'user.email=t@t', 'add', '-A');
  git(repo, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'one');
  const base = git(repo, 'rev-parse', 'HEAD');
  write(path.join(repo, 'src', 'later.txt'), 'later');
  git(repo, '-c', 'user.name=t', '-c', 'user.email=t@t', 'add', '-A');
  git(repo, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'two');
  return { repo, base };
}

const arm = { skills: ['s1'], agents: ['a1'], instruction_files: ['AGENTS.md', 'CLAUDE.md'] };

test('E60: the clone has no remotes, an empty hooks path, objects not hardlinked, and sits at the base commit', () => {
  const { repo, base } = makeMain();
  const dest = clonePathFor(tmpDir('exp-wt-'), 'run-a');
  const res = prepareClone({ repoRoot: repo, baseCommit: base, dest, arm });
  assert.equal(res.usedNoHardlinks, true);
  assert.equal(git(dest, 'remote'), '');
  assert.equal(headOf(dest), base);
  assert.ok(!fs.existsSync(path.join(dest, 'src', 'later.txt')), 'files after the base commit are absent');
  const hooksPath = git(dest, 'config', 'core.hooksPath');
  assert.deepEqual(fs.readdirSync(hooksPath), []);
  const objects = path.join(dest, '.git', 'objects');
  const pack = fs.readdirSync(objects).flatMap((d) => (d.length === 2 ? fs.readdirSync(path.join(objects, d)).map((f) => path.join(objects, d, f)) : []));
  assert.ok(pack.length > 0);
  for (const f of pack) assert.equal(fs.statSync(f).nlink, 1, `${f} is hardlinked to the source`);
});

test('E60: .claude holds only the arm skills and agents; settings and commands are gone', () => {
  const { repo, base } = makeMain();
  const dest = clonePathFor(tmpDir('exp-wt-'), 'run-a');
  prepareClone({ repoRoot: repo, baseCommit: base, dest, arm });
  const listing = (d) => fs.readdirSync(path.join(dest, '.claude', d)).sort();
  assert.deepEqual(fs.readdirSync(path.join(dest, '.claude')).sort(), ['agents', 'skills']);
  assert.deepEqual(listing('skills'), ['s1']);
  assert.deepEqual(listing('agents'), ['a1.md']);
  assert.ok(!fs.existsSync(path.join(dest, '.mcp.json')));
});

test('instruction files outside the arm list are removed, the listed ones kept', () => {
  const { repo, base } = makeMain();
  const dest = clonePathFor(tmpDir('exp-wt-'), 'run-a');
  prepareClone({ repoRoot: repo, baseCommit: base, dest, arm });
  assert.ok(fs.existsSync(path.join(dest, 'AGENTS.md')) && fs.existsSync(path.join(dest, 'CLAUDE.md')));
  assert.ok(!fs.existsSync(path.join(dest, 'GEMINI.md')));
  const dest2 = clonePathFor(tmpDir('exp-wt-'), 'run-b');
  prepareClone({ repoRoot: repo, baseCommit: base, dest: dest2, arm: { ...arm, instruction_files: [] } });
  assert.ok(!fs.existsSync(path.join(dest2, 'AGENTS.md')));
});

test('E29: two runs get different clone paths and cannot see each other\'s files', () => {
  const { repo, base } = makeMain();
  const root = tmpDir('exp-wt-');
  const a = clonePathFor(root, 'run-a');
  const b = clonePathFor(root, 'run-b');
  assert.notEqual(a, b);
  prepareClone({ repoRoot: repo, baseCommit: base, dest: a, arm });
  prepareClone({ repoRoot: repo, baseCommit: base, dest: b, arm });
  write(path.join(a, 'docs', 'only-in-a.md'), 'a');
  assert.ok(!fs.existsSync(path.join(b, 'docs', 'only-in-a.md')));
});

test('E13: a clone path over 200 characters is refused before anything is created', () => {
  const { repo, base } = makeMain();
  const long = path.join(tmpDir('exp-wt-'), 'x'.repeat(210));
  assert.throws(() => assertClonePath(long), (e) => e instanceof ConfigError && e.exit === 3);
  assert.throws(() => prepareClone({ repoRoot: repo, baseCommit: base, dest: long, arm }), ConfigError);
  assert.ok(!fs.existsSync(long));
});

test('a skill that does not exist in the main checkout is a configuration error', () => {
  const { repo, base } = makeMain();
  const dest = clonePathFor(tmpDir('exp-wt-'), 'run-a');
  assert.throws(() => prepareClone({ repoRoot: repo, baseCommit: base, dest, arm: { ...arm, skills: ['ghost'] } }), /ghost/);
});

test('a base_commit that is not a hex sha is refused', () => {
  const { repo } = makeMain();
  assert.throws(() => prepareClone({ repoRoot: repo, baseCommit: '--upload-pack=x', dest: path.join(tmpDir(), 'c'), arm }), ConfigError);
});

// ---- implementation stage (T4): the history-free tree ------------------------------------------------------------

import { historyFreeTree } from './clone.mjs';

test('historyFreeTree: the base tree with one commit named base, no other commit, ref, tag or remote', () => {
  const { repo, base } = makeMain();
  const dest = path.join(tmpDir('exp-hf-'), 'tree');
  const res = historyFreeTree({ repoRoot: repo, baseCommit: base, dest });
  assert.match(res.commit, /^[0-9a-f]{40}$/);
  assert.notEqual(res.commit, base, 'a new commit, not the original');
  assert.deepEqual(git(dest, 'log', '--all', '--format=%s').split('\n'), ['base']);
  assert.equal(git(dest, 'for-each-ref', '--format=%(refname)').split('\n').length, 1);
  assert.equal(git(dest, 'tag'), '');
  assert.equal(git(dest, 'remote'), '');
  assert.equal(fs.readFileSync(path.join(dest, 'src', 'app.txt'), 'utf8'), 'app');
  assert.ok(!fs.existsSync(path.join(dest, 'src', 'later.txt')), 'files added after the base commit are not in the tree');
  assert.equal(git(dest, 'status', '--porcelain'), '');
});

test('historyFreeTree: refuses an existing destination and a non-hex commit', () => {
  const { repo, base } = makeMain();
  const dest = tmpDir('exp-hf-');
  assert.throws(() => historyFreeTree({ repoRoot: repo, baseCommit: base, dest }), ConfigError);
  assert.throws(() => historyFreeTree({ repoRoot: repo, baseCommit: '--upload-pack=x', dest: path.join(dest, 'sub') }), ConfigError);
});
