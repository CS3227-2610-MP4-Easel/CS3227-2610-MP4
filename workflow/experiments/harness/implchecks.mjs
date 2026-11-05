// F8, F10, F12, F15, N3 (T4): the harness-owned verify tree and the checks that run in it. The agent has Bash in its
// clone, so nothing in the clone is trusted except the bytes of the files it changed, and those are only copied.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { cloneNameProblem, copyFileSafe, isSkippedName, walkClone, WALK_LIMITS } from './safefs.mjs';

const sha256 = (data) => createHash('sha256').update(data).digest('hex');
const LOCKFILES = new Set(['package-lock.json', 'npm-shrinkwrap.json', 'yarn.lock', 'pnpm-lock.yaml']);
const REGISTRY = 'https://registry.npmjs.org/';
const unlimited = { maxFileBytes: Number.MAX_SAFE_INTEGER, maxFiles: Number.MAX_SAFE_INTEGER, maxMs: Number.MAX_SAFE_INTEGER };

/** `**` crosses folders, `*` and `?` stay inside one; no other depth is implied. */
export function matchGlob(pattern, rel) {
  let re = '';
  for (let i = 0; i < pattern.length; i += 1) {
    const c = pattern[i];
    if (c === '*' && pattern[i + 1] === '*') {
      if (pattern[i + 2] === '/') { re += '(?:.*/)?'; i += 2; } else { re += '.*'; i += 1; }
    } else if (c === '*') re += '[^/]*';
    else if (c === '?') re += '[^/]';
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`).test(rel);
}

// ---- the pristine toolchain -----------------------------------------------------------------------------------

/** Hash of every file (path, size, bytes) and link (path, target relative to `root`) below `nmDir`. */
export function toolchainManifest(nmDir, root) {
  const lines = [];
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir).sort()) {
      const full = path.join(dir, name);
      const rel = path.relative(nmDir, full).split(path.sep).join('/');
      const st = fs.lstatSync(full);
      if (st.isSymbolicLink()) {
        const target = path.resolve(path.dirname(full), fs.readlinkSync(full));
        lines.push(`L ${rel} -> ${path.relative(root, target).split(path.sep).join('/')}`);
      } else if (st.isDirectory()) walk(full);
      else if (st.isFile()) lines.push(`F ${rel} ${st.size} ${sha256(fs.readFileSync(full))}`);
    }
  };
  if (fs.existsSync(nmDir)) walk(nmDir);
  return sha256(lines.sort().join('\n'));
}

/**
 * A copy of the pristine node_modules, never a link. npm workspaces install absolute junctions to the workspace
 * folders; those are recreated pointing into the same relative place of the new tree (never back at the baseline).
 */
export function copyToolchain(srcNm, destNm, srcRoot, destRoot) {
  const walk = (src, dest) => {
    fs.mkdirSync(dest, { recursive: true });
    for (const name of fs.readdirSync(src)) {
      const from = path.join(src, name);
      const to = path.join(dest, name);
      const st = fs.lstatSync(from);
      if (st.isSymbolicLink()) {
        const target = path.resolve(path.dirname(from), fs.readlinkSync(from));
        const inside = path.relative(srcRoot, target);
        if (inside.startsWith('..') || path.isAbsolute(inside)) throw new Error(`pristine node_modules link ${name} points outside the baseline tree`);
        fs.symlinkSync(path.join(destRoot, inside), to, 'junction');
      } else if (st.isDirectory()) walk(from, to);
      else if (st.isFile()) fs.copyFileSync(from, to);
    }
  };
  walk(srcNm, destNm);
}

// ---- lockfile validation (E97) ----------------------------------------------------------------------------------

/** The agent's lockfile may only resolve from registry.npmjs.org and may not alter any package the baseline has. */
export function validateLockfile(agentText, baseText) {
  const reasons = [];
  let agent;
  let base;
  try { agent = JSON.parse(agentText); } catch { return { ok: false, reasons: ['the lockfile is not valid JSON'] }; }
  try { base = JSON.parse(baseText); } catch { return { ok: false, reasons: ['the baseline lockfile is not valid JSON'] }; }
  if (!agent.packages || typeof agent.packages !== 'object') return { ok: false, reasons: ['the lockfile has no packages map (lockfileVersion 2 or 3 is required)'] };
  for (const [key, p] of Object.entries(agent.packages)) {
    if (key === '' || p?.link === true || p?.resolved === undefined) continue;
    if (typeof p.resolved !== 'string' || !p.resolved.startsWith(REGISTRY)) reasons.push(`${key} resolves outside ${REGISTRY}`);
  }
  for (const [key, b] of Object.entries(base.packages ?? {})) {
    if (key === '' || b?.link === true || b?.resolved === undefined) continue;
    const a = agent.packages[key];
    if (!a) reasons.push(`${key} was removed from the baseline lockfile`);
    else if (a.version !== b.version || a.integrity !== b.integrity) reasons.push(`${key} differs from the baseline lockfile in version or integrity`);
  }
  return { ok: reasons.length === 0, reasons };
}

function depsDiffer(baseText, agentText) {
  try {
    const pick = (t) => { const j = JSON.parse(t); return JSON.stringify([j.dependencies, j.devDependencies, j.peerDependencies, j.optionalDependencies, j.workspaces, j.overrides]); };
    return pick(baseText) !== pick(agentText);
  } catch { return true; }
}

// ---- the verify tree (F8) --------------------------------------------------------------------------------------

const sameBytes = (a, b) => a.length === b.length && a.equals(b);

/**
 * Build the verify tree in `scratch/verify` from harness-owned bytes. Returns
 * {dir, changed, deleted, plan_changed, protected_changed, flags, reasons, depsChanged}; `dir` is null and a flag is set
 * (`unsafe_path`, `unsafe_deps`) when the attempt is red before any check. Never runs git; never follows a link.
 * `planFiles` maps repo-relative path to the snapshot's bytes (the reference besides the baseline tree).
 */
export async function buildVerifyTree({ baselineTree, clone, planFiles, scratch, protectedGlobs = [], limits = WALK_LIMITS, install = defaultInstall, env }) {
  const out = { dir: null, changed: [], deleted: [], plan_changed: [], protected_changed: [], flags: [], reasons: [], depsChanged: false };
  const walked = walkClone(clone, limits);
  if (walked.unsafe.length) {
    out.flags.push('unsafe_path');
    out.reasons.push(...walked.unsafe.map((u) => `${u.path}: ${u.reason}`));
    return out;
  }
  const baseMap = new Map(walkClone(baselineTree, unlimited).files.map((f) => [f.rel, f.full]));
  const cloneMap = new Map(walked.files.map((f) => [f.rel, f.full]));
  for (const [rel, full] of cloneMap) {
    if (planFiles.has(rel)) {
      if (!sameBytes(fs.readFileSync(full), planFiles.get(rel))) out.plan_changed.push(rel);
    } else if (!baseMap.has(rel) || !sameBytes(fs.readFileSync(full), fs.readFileSync(baseMap.get(rel)))) {
      out.changed.push(rel);
    }
  }
  for (const rel of baseMap.keys()) if (!cloneMap.has(rel)) out.deleted.push(rel);
  for (const rel of planFiles.keys()) if (!cloneMap.has(rel)) out.plan_changed.push(rel);
  for (const rel of out.changed) {
    const bad = cloneNameProblem(rel);
    if (bad) out.reasons.push(`${rel}: ${bad}`);
  }
  if (out.reasons.length) { out.flags.push('unsafe_path'); return out; }
  for (const rel of [...out.changed.filter((r) => baseMap.has(r)), ...out.deleted]) {
    if (protectedGlobs.some((g) => matchGlob(g, rel))) out.protected_changed.push(rel);
  }

  out.depsChanged = [...out.changed, ...out.deleted].some((rel) => {
    const name = rel.split('/').pop();
    if (LOCKFILES.has(name)) return true;
    if (name !== 'package.json') return false;
    if (!cloneMap.has(rel) || !baseMap.has(rel)) return true;
    return depsDiffer(fs.readFileSync(baseMap.get(rel), 'utf8'), fs.readFileSync(cloneMap.get(rel), 'utf8'));
  });
  if (out.depsChanged) {
    out.flags.push('deps_changed');
    const agentLock = cloneMap.get('package-lock.json');
    const baseLock = baseMap.get('package-lock.json');
    if (!agentLock || !baseLock) {
      out.flags.push('unsafe_deps'); out.reasons.push('package-lock.json is missing'); return out;
    }
    const v = validateLockfile(fs.readFileSync(agentLock, 'utf8'), fs.readFileSync(baseLock, 'utf8'));
    if (!v.ok) { out.flags.push('unsafe_deps'); out.reasons.push(...v.reasons); return out; }
  }

  const dir = path.join(scratch, 'verify');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.cpSync(baselineTree, dir, {
    recursive: true,
    filter: (src) => {
      const name = path.basename(src);
      if (name === 'node_modules' || name === '.git' || name === 'dist') return false;
      return !isSkippedName(name, fs.lstatSync(src).isDirectory());
    },
  });
  const baseNm = path.join(baselineTree, 'node_modules');
  if (fs.existsSync(baseNm)) copyToolchain(baseNm, path.join(dir, 'node_modules'), baselineTree, dir);
  for (const rel of out.changed) copyFileSafe(cloneMap.get(rel), dir, rel);
  for (const rel of out.deleted) fs.rmSync(path.join(dir, ...rel.split('/')), { force: true });
  if (out.depsChanged) {
    fs.rmSync(path.join(dir, 'node_modules'), { recursive: true, force: true });
    await install({ dir, env });
  }
  out.dir = dir;
  return out;
}

// Replaced in the next step by the real npm ci call (it needs the command runner).
async function defaultInstall() {
  throw new Error('install is not wired yet');
}
