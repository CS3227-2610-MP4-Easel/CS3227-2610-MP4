// `exp snapshot` (F1): freeze the spec and plan files of a complete spec-and-plan run as the fixed input of the
// implementation stage. Plans are agent output, so every path is checked, every file is scanned, and the snapshot
// is written to a temp folder and renamed (nothing partial is ever visible).
import { createHash, randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { scan } from './secrets.mjs';
import { readJson, runPaths, writeAtomic } from './state.mjs';

const KINDS = ['spec', 'plan'];
const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
const SEGMENT = /^[A-Za-z0-9_][A-Za-z0-9_.-]*$/;
const REFUSED_FLAGS = ['missing_artifact', 'cost_mismatch'];

const sha256 = (data) => createHash('sha256').update(data).digest('hex');

/** Why a repo-relative snapshot path is refused (E5), or null. Forward slashes only; the check is purely textual. */
export function snapshotPathProblem(rel) {
  if (typeof rel !== 'string' || rel === '') return 'empty path';
  if (rel.includes('\0')) return 'NUL in path';
  if (rel.includes('\\')) return 'backslash in path';
  if (path.posix.isAbsolute(rel) || path.win32.isAbsolute(rel)) return 'absolute path';
  if (/^[A-Za-z]:/.test(rel)) return 'drive letter';
  if (rel.includes(':')) return 'colon in path';
  for (const seg of rel.split('/')) {
    if (seg === '..') return '.. segment';
    if (seg === '' || seg === '.') return 'empty or . segment';
    if (/[. ]$/.test(seg)) return 'segment ends with a dot or space';
    if (RESERVED.test(seg.split('.')[0])) return `reserved device name ${seg}`;
    if (!SEGMENT.test(seg)) return `segment ${JSON.stringify(seg)} has characters outside A-Z a-z 0-9 _ . -`;
  }
  return null;
}

/** The entry point of a snapshot: the first plan-kind file in `files` order (E7). */
export const planPathOf = (snapshot) => snapshot.files.find((f) => f.kind === 'plan')?.path ?? null;

/** Text patterns that make a plan an injection route (E6); each hit is {file, line, what}. */
const FINDINGS = [
  ['a URL', /https?:\/\//i],
  ['curl', /\bcurl\b/i],
  ['wget', /\bwget\b/i],
  ['Invoke-WebRequest', /Invoke-WebRequest/i],
  ['a home path (~/)', /~\//],
  ['%USERPROFILE%', /%USERPROFILE%/i],
  ['a ..\\ path', /\.\.\\/],
  ['a base64 blob of 200 characters or more', /[A-Za-z0-9+/]{200,}={0,2}/],
];

function findings(file, text) {
  const hits = [];
  text.split('\n').forEach((line, i) => {
    for (const [what, re] of FINDINGS) if (re.test(line)) hits.push({ file, line: i + 1, what });
  });
  return hits;
}

/** Regular files below `base`, sorted, found with lstat so that links are never followed. Problems are collected. */
function collect(base, kind, problems) {
  const files = [];
  const walk = (dir, rel) => {
    for (const name of fs.readdirSync(dir).sort()) {
      const full = path.join(dir, name);
      const relPath = rel ? `${rel}/${name}` : name;
      const st = fs.lstatSync(full);
      if (st.isSymbolicLink()) { problems.push(`${kind}/${relPath}: symlink refused`); continue; }
      if (st.isDirectory()) { walk(full, relPath); continue; }
      if (!st.isFile()) { problems.push(`${kind}/${relPath}: not a regular file`); continue; }
      const bad = snapshotPathProblem(relPath);
      if (bad) { problems.push(`${kind}/${relPath}: ${bad}`); continue; }
      files.push({ path: relPath, kind, full });
    }
  };
  if (fs.existsSync(base)) walk(base, '');
  return files;
}

/**
 * Returns {code, lines, planId, snapshotSha256, hits}. Exit 2 for a refused run, path, finding or changed target;
 * exit 9 for a credential pattern. Nothing is written unless the code is 0.
 */
export function snapshotRun({ expRoot, runId, acceptFindings = false }) {
  const lines = [];
  const refuse = (msg, code = 2) => { lines.push(msg); return { code, lines, hits: [] }; };
  const paths = runPaths(expRoot, runId);
  if (!fs.existsSync(paths.manifest)) return refuse(`run ${runId} does not exist`);
  const manifest = readJson(paths.manifest);
  const status = fs.existsSync(paths.state) ? readJson(paths.state).status : manifest.status;
  if (manifest.status !== 'complete' || status !== 'complete') return refuse(`run ${runId} is ${manifest.status === 'complete' ? status : manifest.status}; a snapshot needs a complete run`);
  const flags = new Set(manifest.flags ?? []);
  const gradesFile = path.join(paths.dir, 'grades.json');
  if (fs.existsSync(gradesFile)) for (const f of readJson(gradesFile).flags ?? []) flags.add(f);
  for (const f of REFUSED_FLAGS) if (flags.has(f)) return refuse(`run ${runId} has the flag ${f}; its plan is not a trusted input`);
  const usageFile = path.join(paths.dir, 'usage.json');
  const planCost = fs.existsSync(usageFile) ? readJson(usageFile).arm_cost_usd : null;
  if (typeof planCost !== 'number') return refuse(`run ${runId} has no arm_cost_usd in usage.json`);

  const problems = [];
  const files = KINDS.flatMap((kind) => collect(path.join(paths.artifacts, kind), kind, problems));
  for (const kind of KINDS) if (!files.some((f) => f.kind === kind)) problems.push(`run ${runId} has no ${kind} file`);
  if (problems.length) return refuse(problems.join('\n'));

  const records = [];
  const secretTypes = [];
  const hits = [];
  for (const f of files) {
    const bytes = fs.readFileSync(f.full);
    if (bytes.includes(0)) return refuse(`${f.path}: not a text file`);
    const text = bytes.toString('utf8');
    for (const h of scan(text)) secretTypes.push({ file: f.path, type: h.type });
    hits.push(...findings(f.path, text));
    records.push({ path: f.path, kind: f.kind, sha256: sha256(bytes), full: f.full });
  }
  if (secretTypes.length) {
    return refuse(secretTypes.map((s) => `${s.file}: credential pattern ${s.type}`).join('\n'), 9);
  }
  for (const h of hits) lines.push(`finding: ${h.file}:${h.line} contains ${h.what}`);
  if (hits.length && !acceptFindings) {
    lines.push('refused: review the findings above, then repeat with --accept-findings');
    return { code: 2, lines, hits };
  }

  const planId = `${manifest.arm_id}-r${manifest.rep}`;
  const snapshot = {
    plan_id: planId, source_run_id: runId, source_experiment_id: manifest.experiment_id, arm_id: manifest.arm_id, rep: manifest.rep,
    plan_cost_usd: planCost, files: records.map(({ path: p, kind, sha256: h }) => ({ path: p, kind, sha256: h })),
  };
  const text = `${JSON.stringify(snapshot, null, 2)}\n`;
  const dest = path.join(expRoot, 'local', 'plans', manifest.experiment_id, planId);
  const target = path.join(dest, 'snapshot.json');
  if (fs.existsSync(target)) {
    if (fs.readFileSync(target, 'utf8') !== text) return { code: 2, lines: [...lines, `snapshot ${planId} already exists with a different hash; it is left untouched`], hits };
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const tmp = `${dest}.tmp-${randomBytes(4).toString('hex')}`;
    try {
      for (const r of records) {
        const out = path.join(tmp, 'files', ...r.path.split('/'));
        fs.mkdirSync(path.dirname(out), { recursive: true });
        fs.copyFileSync(r.full, out);
      }
      writeAtomic(path.join(tmp, 'snapshot.json'), text);
      fs.renameSync(tmp, dest);
    } catch (e) {
      fs.rmSync(tmp, { recursive: true, force: true });
      throw e;
    }
  }
  const snapshotSha256 = sha256(Buffer.from(text));
  lines.push(`${planId} ${snapshotSha256}`);
  return { code: 0, lines, planId, snapshotSha256, hits, snapshot };
}
