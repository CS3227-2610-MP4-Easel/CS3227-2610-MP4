import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

// Two levels above harness/exp.mjs: harness/ -> experiments/.
export const EXP_ROOT = path.resolve(here, '..');

export const REPO_ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], {
  cwd: here,
  encoding: 'utf8',
}).trim();

/** A relative worktrees_root resolves from the repo root, never from the cwd. */
export function resolveWorktreesRoot(config, repoRoot = REPO_ROOT) {
  return path.resolve(repoRoot, config.worktrees_root);
}

/** True when `target` resolves to `root` or a path inside it. */
export function isInside(root, target) {
  const rel = path.relative(path.resolve(root), path.resolve(target));
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}
