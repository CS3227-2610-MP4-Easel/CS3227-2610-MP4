// F17: hash recording and comparison of the paths an agent must not change. Detection, not prevention.
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const sha = (data) => crypto.createHash('sha256').update(data).digest('hex');

/** sha256 of a file, or null when it does not exist. */
export function hashFile(p) {
  try { return sha(fs.readFileSync(p)); } catch (e) { if (e.code === 'ENOENT' || e.code === 'EISDIR') return null; throw e; }
}

/** sha256 over the sorted relative paths and file hashes of a directory tree; null when missing. */
export function hashTree(dir) {
  if (!fs.existsSync(dir)) return null;
  const parts = [];
  const walk = (d) => {
    for (const name of fs.readdirSync(d).sort()) {
      if (name === '.git' || name === 'node_modules') continue;
      const p = path.join(d, name);
      if (fs.statSync(p).isDirectory()) walk(p);
      else parts.push(`${path.relative(dir, p).split(path.sep).join('/')}:${hashFile(p)}`);
    }
  };
  walk(dir);
  return sha(parts.join('\n'));
}

export function hashPath(p) {
  return fs.existsSync(p) && fs.statSync(p).isDirectory() ? hashTree(p) : hashFile(p);
}

export function snapshot(paths) {
  return Object.fromEntries(paths.map((p) => [p, hashPath(p)]));
}

/** Paths whose hash differs between two snapshots (a path present in only one counts as different). */
export function diff(before, after) {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys].filter((k) => before[k] !== after[k]).sort();
}

/** The path set of F17 that is fixed for a batch (run state files are added per run by the driver). */
export function batchPaths({ repoRoot, expRoot, home = os.homedir(), implTaskId = null }) {
  const gitPath = (p) => path.resolve(repoRoot, execFileSync('git', ['rev-parse', '--git-path', p], { cwd: repoRoot, encoding: 'utf8' }).trim());
  return [
    gitPath('config'), gitPath('hooks'), path.join(home, '.claude', 'settings.json'),
    ...['arms', 'tasks', 'experiments', 'plugins', 'rubric', 'harness'].map((d) => path.join(expRoot, d)),
    path.join(expRoot, 'config.json'), path.join(expRoot, 'pricing.json'),
    ...(implTaskId ? [path.join(expRoot, 'local', 'plans'), path.join(expRoot, 'local', 'baselines', `${implTaskId}.json`)] : []),
  ];
}
