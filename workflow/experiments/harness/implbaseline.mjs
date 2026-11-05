// `exp baseline <task-id>` (F4): the pristine reference of an implementation task. A history-free tree of the base
// commit with its dependencies installed, the checks run twice, and what they say written down.
import fs from 'node:fs';
import path from 'node:path';
import { historyFreeTree } from './clone.mjs';
import { acceptanceHash, checkEnv, matchGlob, npmCi, runChecks, runCommand, taskHashes, toolchainManifest } from './implchecks.mjs';
import { walkClone } from './safefs.mjs';
import { writeJsonAtomic } from './state.mjs';

const unlimited = { maxFileBytes: Number.MAX_SAFE_INTEGER, maxFiles: Number.MAX_SAFE_INTEGER, maxMs: Number.MAX_SAFE_INTEGER };
const SETUP_TIMEOUT_MS = 15 * 60 * 1000;

/** The default setup: `npm ci --ignore-scripts`, then the optional `post_setup` argv, in the check environment. */
export async function defaultSetup({ dir, env, task }) {
  await npmCi({ dir, env, timeoutMs: SETUP_TIMEOUT_MS });
  if (task.post_setup?.length) {
    const r = await runCommand({ argv: task.post_setup, cwd: dir, env, timeoutMs: SETUP_TIMEOUT_MS });
    if (r.code !== 0) throw new Error(`exit ${r.code}${r.timedOut ? ' (timeout)' : ''}`);
  }
}

const quote = (argv) => argv.join(' ');

/** Returns {code, lines, baseline}: exit 3 when the base cannot be built, typechecked or tested. Nothing is written then. */
export async function buildBaseline({ expRoot, repoRoot, task, deps = {} }) {
  const fail = (...lines) => ({ code: 3, lines, baseline: null });
  const root = path.join(expRoot, 'local', 'baselines');
  const dest = path.join(root, task.id, 'tree');
  fs.rmSync(path.join(root, task.id), { recursive: true, force: true });
  historyFreeTree({ repoRoot, baseCommit: task.base_commit, dest });
  const env = checkEnv({ scratch: path.join(root, task.id, 'scratch'), cacheDir: path.join(expRoot, 'local', 'npm-cache') });

  try {
    await (deps.setup ?? defaultSetup)({ dir: dest, env, task });
  } catch (e) {
    return fail(`setup failed: ${quote(task.setup_command)}${task.post_setup?.length ? ` then ${quote(task.post_setup)}` : ''} (${e.message})`);
  }

  const testFiles = walkClone(dest, unlimited).files.map((f) => f.rel).filter((rel) => task.checks.tests.baseline_files.some((g) => matchGlob(g, rel))).sort();
  const runs = [];
  for (let i = 0; i < 2; i += 1) {
    runs.push(await runChecks({ task, dir: dest, env, baseline: { passing_tests: [], flaky_tests: [] }, changed: testFiles, collect: true }));
  }
  const [first] = runs;
  if (first.flags.includes('check_timeout')) return fail(`a check timed out: ${commandsOf(task).join('; ')}`);
  if (first.flags.includes('output_truncated')) return fail('a check printed more than the output cap');
  for (const step of ['typecheck', 'lint']) {
    const r = first[step];
    if (r.status !== 'ok' || r.errors > 0) {
      const cmds = quote((task.checks[step] ?? [])[0]?.argv ?? []);
      return fail(`${step} is ${r.status} with ${r.errors} errors in the base (${cmds}); first lines:`, ...r.lines.slice(0, 10));
    }
  }
  const broken = first.tests.filter((t) => t.id.endsWith('::load'));
  if (broken.length) return fail(...broken.map((t) => `tests cannot run: ${t.id.slice(0, -'::load'.length)}`));

  const byId = (run) => new Map(run.tests.map((t) => [t.id, t.result]));
  const [a, b] = runs.map(byId);
  const passing = [];
  const failing = [];
  const flaky = [];
  for (const id of [...new Set([...a.keys(), ...b.keys()])].sort()) {
    const x = a.get(id);
    const y = b.get(id);
    if (x === 'passed' && y === 'passed') passing.push(id);
    else if (x === 'failed' && y === 'failed') failing.push(id);
    else if ((x === 'passed' && y === 'failed') || (x === 'failed' && y === 'passed')) flaky.push(id);
  }

  const acceptanceDir = path.join(expRoot, 'tasks', task.id, task.acceptance.folder);
  const checksFile = path.join(expRoot, 'tasks', task.id, task.acceptance.checks_file);
  const baseline = {
    base_commit: task.base_commit, created: new Date().toISOString(), ...taskHashes(task, repoRoot),
    typecheck_errors: 0, lint_errors: 0, passing_tests: passing, failing_tests: failing, flaky_tests: flaky, test_files: testFiles,
    node_modules_sha256: toolchainManifest(path.join(dest, 'node_modules'), dest),
    acceptance_sha256: fs.existsSync(acceptanceDir) ? acceptanceHash(acceptanceDir) : '',
    checks_json_sha256: fs.existsSync(checksFile) ? acceptanceHash(checksFile) : '',
  };
  writeJsonAtomic(path.join(root, `${task.id}.json`), baseline);
  return { code: 0, lines: [`baseline of ${task.id}: ${passing.length} passing, ${failing.length} failing, ${flaky.length} flaky tests; typecheck 0 errors`], baseline };
}

const commandsOf = (task) => [...task.checks.typecheck, ...(task.checks.lint ?? [])].map((c) => quote(c.argv)).concat(quote(task.checks.tests.own_argv));
