// `exp check [--secrets]`: validate every committed experiment file and the ignore rules. Read-only.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { EXP_ROOT, REPO_ROOT, isInside, resolveWorktreesRoot } from './paths.mjs';
import { scan } from './secrets.mjs';
import {
  validateArm, validateConfig, validateExperiment, validatePricing, validateSeededIssues, validateTask,
} from './schema.mjs';

export const HARNESS_VERSION = 1;
const REQUIRED_PILOT_CATEGORIES = ['collision', 'contradiction', 'missing_limit', 'vague_term', 'wrong_path', 'missing_error'];

const readJson = (file) => {
  try {
    return { value: JSON.parse(fs.readFileSync(file, 'utf8')) };
  } catch (e) {
    return { error: e.code === 'ENOENT' ? 'file is missing' : `invalid JSON (${e.message})` };
  }
};

const listDir = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir).sort() : []);
const isDir = (p) => fs.existsSync(p) && fs.statSync(p).isDirectory();

function gitIgnored(repoRoot, relPath) {
  try {
    execFileSync('git', ['check-ignore', '-q', '--', relPath], { cwd: repoRoot, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function commitExists(repoRoot, sha) {
  try {
    // sha is validated as hex by the schema before this runs, so it cannot be read as an option.
    execFileSync('git', ['cat-file', '-e', `${sha}^{commit}`], { cwd: repoRoot, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function walk(dir, skip, out = []) {
  for (const name of listDir(dir)) {
    const p = path.join(dir, name);
    if (skip(p)) continue;
    if (isDir(p)) walk(p, skip, out);
    else out.push(p);
  }
  return out;
}

export function runCheck({ expRoot = EXP_ROOT, repoRoot = REPO_ROOT, secrets = false } = {}) {
  const lines = [];
  let code = 0;
  const rel = (p) => path.relative(repoRoot, p).split(path.sep).join('/');
  const fail = (file, msg, exit = 3) => {
    lines.push(`${rel(file)}: ${msg}`);
    code = Math.max(code, exit);
  };
  const okLine = (file) => lines.push(`${rel(file)}: ok`);
  // Record every error of one file, or an ok line when there are none.
  const report = (file, errors) => (errors.length ? errors.forEach((e) => fail(file, e)) : okLine(file));

  lines.push(`node ${process.version}; harness v${HARNESS_VERSION}; cli: not checked here (the launcher arrives in T3)`);

  const pluginNames = listDir(path.join(expRoot, 'plugins')).filter((n) => isDir(path.join(expRoot, 'plugins', n)));

  const configFile = path.join(expRoot, 'config.json');
  const config = readJson(configFile);
  if (config.error) fail(configFile, config.error);
  else report(configFile, validateConfig(config.value, { pluginNames }).errors);

  const pricingFile = path.join(expRoot, 'pricing.json');
  const pricing = readJson(pricingFile);
  if (pricing.error) fail(pricingFile, pricing.error);
  else report(pricingFile, validatePricing(pricing.value).errors);

  const arms = new Map();
  for (const name of listDir(path.join(expRoot, 'arms')).filter((n) => n.endsWith('.json'))) {
    const file = path.join(expRoot, 'arms', name);
    const r = readJson(file);
    if (r.error) { fail(file, r.error); continue; }
    const errors = validateArm(r.value, { fileName: name, pricing: pricing.value }).errors;
    for (const p of r.value.plugins ?? []) {
      if (!pluginNames.includes(p)) errors.push(`plugin ${p} has no folder under plugins/`);
    }
    report(file, errors);
    arms.set(r.value.id ?? name, r.value);
  }

  const tasks = new Map();
  for (const id of listDir(path.join(expRoot, 'tasks')).filter((n) => isDir(path.join(expRoot, 'tasks', n)))) {
    const dir = path.join(expRoot, 'tasks', id);
    const file = path.join(dir, 'task.json');
    const r = readJson(file);
    if (r.error) { fail(file, r.error); continue; }
    const t = r.value;
    const errors = validateTask(t).errors;
    if (t.id !== id) errors.push(`id ${t.id} does not match folder ${id}`);
    if (errors.length === 0) {
      if (!commitExists(repoRoot, t.base_commit)) errors.push(`base_commit ${t.base_commit} is not a commit in this repo`);
      const brief = path.join(dir, t.brief_file);
      if (!fs.existsSync(brief)) errors.push(`${t.brief_file} is missing`);
      if (t.sheet_file && !fs.existsSync(path.join(dir, t.sheet_file))) errors.push(`${t.sheet_file} is missing`);
      const isPilot = id.startsWith('pilot-');
      if (isPilot && !t.issues_file) errors.push('a pilot task needs a seeded issues file (F16)');
      if (t.issues_file) {
        const issuesPath = path.join(dir, t.issues_file);
        const issues = readJson(issuesPath);
        if (issues.error) errors.push(`${t.issues_file}: ${issues.error}`);
        else {
          errors.push(...validateSeededIssues(issues.value).errors.map((e) => `${t.issues_file}: ${e}`));
          const haystack = [t.brief_file, t.sheet_file].filter(Boolean)
            .map((f) => (fs.existsSync(path.join(dir, f)) ? fs.readFileSync(path.join(dir, f), 'utf8') : '')).join('\n');
          for (const i of Array.isArray(issues.value) ? issues.value : []) {
            if (typeof i.anchor === 'string' && !haystack.includes(i.anchor)) {
              errors.push(`issue ${i.id}: anchor not found in the brief or sheet`);
            }
          }
          if (isPilot && Array.isArray(issues.value)) {
            if (issues.value.length < 6) errors.push('a pilot seeded set needs at least 6 issues (F16)');
            const have = new Set(issues.value.map((i) => i.category));
            for (const c of REQUIRED_PILOT_CATEGORIES) if (!have.has(c)) errors.push(`a pilot seeded set is missing category ${c} (F16)`);
          }
        }
      }
    }
    report(file, errors);
    tasks.set(id, t);
  }

  for (const name of listDir(path.join(expRoot, 'experiments')).filter((n) => n.endsWith('.json'))) {
    const file = path.join(expRoot, 'experiments', name);
    const r = readJson(file);
    if (r.error) { fail(file, r.error); continue; }
    const e = r.value;
    const errors = validateExperiment(e).errors;
    if (e.id !== name.replace(/\.json$/, '')) errors.push(`id ${e.id} does not match file name ${name}`);
    for (const a of e.arm_ids ?? []) if (!arms.has(a)) errors.push(`arm ${a} does not exist`);
    for (const tid of e.task_ids ?? []) {
      const t = tasks.get(tid);
      if (!t) { errors.push(`task ${tid} does not exist`); continue; }
      if (e.answer_mode === 'sheet') {
        const sheet = t.sheet_file && path.join(expRoot, 'tasks', tid, t.sheet_file);
        if (!sheet || !fs.existsSync(sheet)) errors.push(`task ${tid} has no answer-sheet.md but answer_mode is sheet`);
      }
      for (const a of e.arm_ids ?? []) {
        if (arms.has(a) && arms.get(a).stage !== t.stage) errors.push(`arm ${a} stage ${arms.get(a).stage} differs from task ${tid} stage ${t.stage}`);
      }
    }
    report(file, errors);
  }

  // Ignore rules: raw transcripts and bank text must never be committable.
  const localProbe = rel(path.join(expRoot, 'local', '.probe'));
  if (!gitIgnored(repoRoot, localProbe)) fail(path.join(expRoot, 'local'), 'local/ is not covered by git check-ignore');
  if (config.value && typeof config.value.worktrees_root === 'string') {
    const wt = resolveWorktreesRoot(config.value, repoRoot);
    if (isInside(repoRoot, wt) && !gitIgnored(repoRoot, rel(path.join(wt, '.probe')))) {
      fail(configFile, 'worktrees_root is inside the repo and not covered by git check-ignore');
    }
  }

  if (secrets) {
    const roots = [expRoot, path.join(repoRoot, 'docs', 'telemetry', 'experiments')];
    const skip = (p) => p === path.join(expRoot, 'local') || path.basename(p) === 'node_modules' || path.basename(p) === '.git';
    for (const root of roots) {
      for (const file of walk(root, skip)) {
        const buf = fs.readFileSync(file);
        if (buf.includes(0)) continue; // binary
        for (const hit of scan(buf.toString('utf8'))) fail(file, `credential pattern ${hit.type}`, 9);
      }
    }
  }

  return { code, lines };
}
