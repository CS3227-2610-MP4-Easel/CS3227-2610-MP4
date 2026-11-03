// F12: lint counts for arms whose artifacts use the lite format. The lint code is always the main checkout's,
// run over artifact copies, never code from the run clone (an agent could have changed that).
import { spawnSync } from 'node:child_process';
import path from 'node:path';

export const defaultLintScript = (repoRoot) => path.join(repoRoot, '.claude', 'skills', 'writing-specs-lite', 'scripts', 'lint.mjs');

/** Number of output lines that start with ERROR. */
export function countErrors(output) {
  return output.split('\n').filter((l) => l.startsWith('ERROR')).length;
}

export function runLint({ lintScript, kind, file }) {
  const r = spawnSync(process.execPath, [lintScript, kind, file], { cwd: path.dirname(file), encoding: 'utf8', timeout: 60000 });
  return countErrors(`${r.stdout ?? ''}\n${r.stderr ?? ''}`);
}

/** spec: the index file; plan: every plan file. */
export function lintArtifacts({ lintScript, specFile, planFiles }) {
  return {
    lint_errors_spec: specFile ? runLint({ lintScript, kind: 'spec', file: specFile }) : null,
    lint_errors_plan: planFiles.length ? planFiles.reduce((n, f) => n + runLint({ lintScript, kind: 'plan', file: f }), 0) : null,
  };
}
