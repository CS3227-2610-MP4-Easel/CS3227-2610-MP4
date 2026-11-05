// F3: one local clone per run, with no remotes and no foreign hooks, holding only the arm's skills, agents
// and instruction files in .claude/ and at the root.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ConfigError } from './spawn.mjs';
import { isHexSha } from './schema.mjs';

const INSTRUCTION_CANDIDATES = ['AGENTS.md', 'CLAUDE.md', 'GEMINI.md', 'CLAUDE.local.md'];
export const MAX_CLONE_PATH = 200;

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

export function clonePathFor(worktreesRoot, runId) {
  return path.join(worktreesRoot, runId);
}

/** E13: a clone path over 200 characters exceeds what Windows tools handle. */
export function assertClonePath(dest) {
  if (dest.length > MAX_CLONE_PATH) throw new ConfigError(`clone path would exceed ${MAX_CLONE_PATH} characters: ${dest}`);
}

function copyOne(from, to) {
  if (!fs.existsSync(from)) throw new ConfigError(`${from} does not exist in the main checkout`);
  fs.cpSync(from, to, { recursive: true });
}

/**
 * Clone `repoRoot` at `baseCommit` into `dest` and prepare it for `arm`.
 * Skills and agents are copied from the main checkout's working tree (the operator's current versions).
 */
export function prepareClone({ repoRoot, baseCommit, dest, arm }) {
  if (!isHexSha(baseCommit)) throw new ConfigError('base_commit must be a hex sha');
  assertClonePath(dest);
  if (fs.existsSync(dest)) throw new ConfigError(`clone path ${dest} already exists`);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  git(process.cwd(), 'clone', '--quiet', '--no-hardlinks', '--local', '--no-checkout', '--', repoRoot, dest);
  git(dest, 'remote', 'remove', 'origin');
  const hooks = path.join(dest, '.git', 'exp-empty-hooks');
  fs.mkdirSync(hooks, { recursive: true });
  git(dest, 'config', 'core.hooksPath', hooks);
  git(dest, '-c', 'advice.detachedHead=false', 'checkout', '--quiet', '--detach', baseCommit);

  fs.rmSync(path.join(dest, '.claude'), { recursive: true, force: true });
  fs.rmSync(path.join(dest, '.mcp.json'), { force: true });
  const keep = new Set(arm.instruction_files ?? ['AGENTS.md', 'CLAUDE.md']);
  for (const f of INSTRUCTION_CANDIDATES) if (!keep.has(f)) fs.rmSync(path.join(dest, f), { force: true });

  for (const s of arm.skills ?? []) copyOne(path.join(repoRoot, '.claude', 'skills', s), path.join(dest, '.claude', 'skills', s));
  for (const a of arm.agents ?? []) copyOne(path.join(repoRoot, '.claude', 'agents', `${a}.md`), path.join(dest, '.claude', 'agents', `${a}.md`));
  return { dest, usedNoHardlinks: true };
}

export function headOf(dir) {
  return git(dir, 'rev-parse', 'HEAD');
}

const GIT_AUTHOR = ['-c', 'user.name=harness', '-c', 'user.email=harness@localhost', '-c', 'core.autocrlf=false', '-c', 'commit.gpgsign=false'];

/**
 * SD12: a tree of `baseCommit` with no history: `git archive`, `git init`, one commit named `base`, no other ref.
 * `git archive` is extracted by a relative path from the parent folder because GNU tar reads `S:\...` as host:path.
 */
export function historyFreeTree({ repoRoot, baseCommit, dest }) {
  if (!isHexSha(baseCommit)) throw new ConfigError('base_commit must be a hex sha');
  if (fs.existsSync(dest)) throw new ConfigError(`tree path ${dest} already exists`);
  const parent = path.dirname(dest);
  fs.mkdirSync(parent, { recursive: true });
  const name = path.basename(dest);
  const tarName = `${name}.base.tar`;
  fs.mkdirSync(dest);
  try {
    execFileSync('git', ['archive', '--format=tar', '-o', path.join(parent, tarName), baseCommit], { cwd: repoRoot, stdio: ['ignore', 'pipe', 'pipe'] });
    execFileSync('tar', ['-xf', tarName, '-C', name], { cwd: parent, stdio: ['ignore', 'pipe', 'pipe'] });
  } finally {
    fs.rmSync(path.join(parent, tarName), { force: true });
  }
  git(dest, 'init', '-q');
  git(dest, ...GIT_AUTHOR, 'add', '-A', '-f');
  git(dest, ...GIT_AUTHOR, 'commit', '-q', '--allow-empty', '-m', 'base');
  return { dest, commit: git(dest, 'rev-parse', 'HEAD') };
}
