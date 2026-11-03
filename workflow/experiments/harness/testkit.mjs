// Test support (not a test): temp dirs, a scripted fake CLI launcher and a recorded-call reader.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const FAKE_CLAUDE = path.join(here, 'fixtures', 'fake-claude.mjs');

export const tmpDir = (prefix = 'exp-test-') => fs.mkdtempSync(path.join(os.tmpdir(), prefix));

/** Writes the script and returns a launcher object for runProcess/driver plus helpers to read the recorded calls. */
export function fakeCli(steps, dir = tmpDir('exp-fake-')) {
  const scriptFile = path.join(dir, 'script.json');
  fs.writeFileSync(scriptFile, JSON.stringify(Array.isArray(steps) ? { steps } : steps));
  return {
    dir,
    scriptFile,
    launcher: { command: process.execPath, prefix: [FAKE_CLAUDE] },
    env: { FAKE_CLAUDE_SCRIPT: scriptFile },
    calls: () => {
      const f = `${scriptFile}.calls.jsonl`;
      return fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
    },
    activity: () => {
      const f = `${scriptFile}.activity.jsonl`;
      return fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
    },
    pids: () => {
      const f = `${scriptFile}.pids`;
      return fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(Number) : [];
    },
  };
}

export function pidAlive(pid) {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

// ---- a committed experiment tree in a throwaway git repo ---------------------------------------------------

import { execFileSync } from 'node:child_process';

export const git = (cwd, ...args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'core.autocrlf=false', ...args], { cwd, encoding: 'utf8' }).trim();
export const put = (file, data) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, typeof data === 'string' ? data : `${JSON.stringify(data, null, 2)}\n`);
};

/**
 * Creates repo/workflow/experiments (config, pricing, one arm `arm-one`, task `task-one`, experiment `exp-one`),
 * a root AGENTS.md/CLAUDE.md and one project skill, then commits everything. Returns the paths and the base sha.
 * `tweak(ctx)` runs before the commit; pass `commit: false` to leave the tree untracked.
 */
export function makeExperimentRepo({ answerMode = 'sheet', plugin = false, tweak, commit = true, experiment = {}, arm = {} } = {}) {
  const repoRoot = tmpDir('exp-repo-');
  const expRoot = path.join(repoRoot, 'workflow', 'experiments');
  git(repoRoot, 'init', '-q');
  put(path.join(repoRoot, '.gitignore'), 'workflow/experiments/local/\n');
  put(path.join(repoRoot, 'AGENTS.md'), 'agents');
  put(path.join(repoRoot, 'CLAUDE.md'), 'claude');
  put(path.join(repoRoot, '.claude', 'skills', 's1', 'SKILL.md'), 's1');
  put(path.join(repoRoot, 'src', 'app.txt'), 'app');
  const worktreesRoot = tmpDir('exp-wt-');
  put(path.join(expRoot, 'config.json'), { worktrees_root: worktreesRoot, claude_bin: 'claude', auth_mode: 'login', isolation_ignore: [] });
  put(path.join(expRoot, 'pricing.json'), {
    schema_version: 1,
    models: { 'claude-sonnet-5-5': { input: 2, output: 10, cache_read: 0.1, cache_write_5m: 2.5, cache_write_1h: 4, source: 'test', checked: '2026-11-03' } },
  });
  put(path.join(expRoot, 'arms', 'arm-one.json'), {
    id: 'arm-one', stage: 'specplan', prompt: 'Write the spec. {{brief}} ({{task_id}})', plugins: plugin ? ['pl'] : [], skills: [], agents: [], mcp: [],
    allowed_tools: ['Read', 'Write'], disallowed_tools: ['WebFetch', 'WebSearch'], permission_mode: 'acceptEdits',
    model: { main: 'claude-sonnet-5-5' }, instruction_files: ['AGENTS.md', 'CLAUDE.md'],
    artifact_globs: { spec: ['docs/spec*.md'], plan: ['docs/plan*.md'] }, lint: false,
    review: { lenses: [], agent_types: [], max_rounds: 0 }, phase_map: {}, ...arm,
  });
  if (plugin) {
    put(path.join(expRoot, 'plugins', 'pl', '.claude-plugin', 'plugin.json'), { name: 'pl' });
    put(path.join(expRoot, 'plugins', 'pl', 'skills', 'alpha', 'SKILL.md'), 'alpha');
    put(path.join(expRoot, 'plugins', 'pl', 'hooks', 'hooks.json'), { hooks: { SessionStart: [{ hooks: [] }] } });
  }
  put(path.join(expRoot, 'tasks', 'task-one', 'task.json'), {
    id: 'task-one', base_commit: 'HEAD_PLACEHOLDER', brief_file: 'brief.md', sheet_file: answerMode === 'sheet' ? 'answer-sheet.md' : null, issues_file: null, stage: 'specplan',
  });
  put(path.join(expRoot, 'tasks', 'task-one', 'brief.md'), 'Add a note to an epic.\n');
  put(path.join(expRoot, 'tasks', 'task-one', 'answer-sheet.md'), 'Answers.\n');
  put(path.join(expRoot, 'experiments', 'exp-one.json'), {
    id: 'exp-one', task_ids: ['task-one'], arm_ids: ['arm-one'], replicates: 3, answer_mode: answerMode, max_parallel: 3,
    run_ceiling_usd: 5, batch_ceiling_usd: 25, turn_timeout_s: 1800, run_timeout_s: 5400, wait_timeout_s: 86400,
    hypotheses: ['h'], decision_rule: 'r', pruning_rule: 'dominance', ...experiment,
  });
  put(path.join(expRoot, 'rubric', 'rubric.md'), 'rubric');
  put(path.join(expRoot, 'harness', 'marker.txt'), 'harness');
  git(repoRoot, 'add', '-A');
  git(repoRoot, 'commit', '-q', '-m', 'base');
  const sha = git(repoRoot, 'rev-parse', 'HEAD');
  const taskFile = path.join(expRoot, 'tasks', 'task-one', 'task.json');
  put(taskFile, { ...JSON.parse(fs.readFileSync(taskFile, 'utf8')), base_commit: sha });
  const ctx = { repoRoot, expRoot, sha, worktreesRoot, home: tmpDir('exp-home-'), configDir: tmpDir('exp-cfg-') };
  tweak?.(ctx);
  if (commit) {
    git(repoRoot, 'add', '-A');
    git(repoRoot, 'commit', '-q', '-m', 'experiment');
  }
  return ctx;
}
