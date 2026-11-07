// E68: find the spec and plan of a run by the arm's artifact_globs among files changed since base_commit, and copy them.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const git = (cwd, args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

export function globToRegExp(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i += 1) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*') { re += '.*'; i += 1; if (glob[i + 1] === '/') i += 1; }
    else if (c === '*') re += '[^/]*';
    else if (c === '?') re += '[^/]';
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
}

/** Files created or changed in the clone since `baseCommit` (committed or not), as repo-relative POSIX paths. */
export function changedFiles(clone, baseCommit) {
  const tracked = git(clone, ['diff', '--name-only', baseCommit, '--']).split('\n');
  const untracked = git(clone, ['ls-files', '--others', '--exclude-standard']).split('\n');
  return [...new Set([...tracked, ...untracked].map((s) => s.trim()).filter(Boolean))].sort();
}

/** {spec: [paths], plan: [paths]}, existing files only. */
export function findArtifacts({ clone, baseCommit, globs }) {
  const changed = changedFiles(clone, baseCommit).filter((f) => fs.existsSync(path.join(clone, f)));
  const pick = (list) => changed.filter((f) => list.some((g) => globToRegExp(g).test(f)));
  return { spec: pick(globs.spec ?? []), plan: pick(globs.plan ?? []) };
}

/** Copy the found files under destDir/<kind>/<relative path>; returns the copied paths. */
export function copyArtifacts({ clone, found, destDir }) {
  fs.rmSync(destDir, { recursive: true, force: true });
  const out = { spec: [], plan: [] };
  for (const kind of ['spec', 'plan']) {
    for (const rel of found[kind]) {
      const dest = path.join(destDir, kind, rel);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(path.join(clone, rel), dest);
      out[kind].push(dest);
    }
  }
  return out;
}

/** One text per kind for the judge: every file under a header, in path order. */
export function artifactText(files, destDir) {
  return files.map((f) => `=== ${path.relative(destDir, f).split(path.sep).slice(1).join('/')} ===\n${fs.readFileSync(f, 'utf8')}`).join('\n\n');
}

/** The spec's index file: the shallowest copy (a package has an index beside its component folder). */
export function specIndex(files) {
  return [...files].sort((a, b) => a.split(path.sep).length - b.split(path.sep).length || a.localeCompare(b))[0] ?? null;
}
