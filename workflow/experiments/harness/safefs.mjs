// F8, E35, E94 to E96, E104: walking and copying an agent clone without ever following a link. The agent has
// Bash in its clone, so every name, size and link in it is untrusted.
import fs from 'node:fs';
import path from 'node:path';

export const WALK_LIMITS = { maxFileBytes: 5 * 1024 * 1024, maxFiles: 20000, maxMs: 120000 };
const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist']);
const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
const NAME_RE = /^[A-Za-z0-9_][A-Za-z0-9_./-]*$/;

export const isSkippedName = (name, isDir) => (isDir ? SKIP_DIRS.has(name) : name.endsWith('.tsbuildinfo'));

/** Why a repo-relative name in a clone is refused (E35, E104), or null. */
export function cloneNameProblem(rel) {
  if (typeof rel !== 'string' || rel === '') return 'empty path';
  if (!NAME_RE.test(rel)) return 'name outside A-Z a-z 0-9 _ . / - (or a leading character other than a letter, digit or _)';
  for (const seg of rel.split('/')) {
    if (seg === '' || seg === '.' || seg === '..') return 'empty, . or .. segment';
    if (/[. ]$/.test(seg)) return 'segment ends with a dot or space';
    if (RESERVED.test(seg.split('.')[0])) return `reserved device name ${seg}`;
  }
  return null;
}

/**
 * Regular files of `dir` as {files: [{rel, full, size}], unsafe: [{path, reason}]}. Uses lstat only. A link, a hardlink,
 * a non-regular file, a `.npmrc`, a file above the size limit, too many files or too long a walk is `unsafe` (and a
 * link is not followed). `.git`, `node_modules`, `dist` and `*.tsbuildinfo` are skipped at any depth.
 */
export function walkClone(dir, limits = WALK_LIMITS, clock = Date.now) {
  const { maxFileBytes, maxFiles, maxMs } = { ...WALK_LIMITS, ...limits };
  const files = [];
  const unsafe = [];
  const started = clock();
  let stopped = false;
  const stop = (reason) => { unsafe.push({ path: '.', reason }); stopped = true; };
  const walk = (current, rel) => {
    for (const name of fs.readdirSync(current).sort()) {
      if (stopped) return;
      if (clock() - started > maxMs) { stop(`the walk took longer than ${maxMs} ms`); return; }
      const full = path.join(current, name);
      const relPath = rel ? `${rel}/${name}` : name;
      const st = fs.lstatSync(full);
      if (st.isSymbolicLink()) { unsafe.push({ path: relPath, reason: 'symlink or junction' }); continue; }
      if (st.isDirectory()) { if (!isSkippedName(name, true)) walk(full, relPath); continue; }
      if (!st.isFile()) { unsafe.push({ path: relPath, reason: 'not a regular file' }); continue; }
      if (isSkippedName(name, false)) continue;
      if (name === '.npmrc') { unsafe.push({ path: relPath, reason: '.npmrc is never accepted' }); continue; }
      if (st.nlink > 1) { unsafe.push({ path: relPath, reason: `hardlink (link count ${st.nlink})` }); continue; }
      if (st.size > maxFileBytes) { unsafe.push({ path: relPath, reason: `file larger than ${maxFileBytes} bytes` }); continue; }
      files.push({ rel: relPath, full, size: st.size });
      if (files.length > maxFiles) { stop(`more than ${maxFiles} files`); return; }
    }
  };
  walk(dir, '');
  return { files, unsafe };
}

/** Copy one regular file to `root/rel`. Re-checks the source with lstat and keeps the target inside `root`. */
export function copyFileSafe(src, root, rel) {
  const st = fs.lstatSync(src);
  if (!st.isFile() || st.isSymbolicLink()) throw new Error(`${src} is not a regular file`);
  const target = path.resolve(root, ...rel.split('/'));
  const inside = path.relative(path.resolve(root), target);
  if (inside === '' || inside.startsWith('..') || path.isAbsolute(inside)) throw new Error(`${rel} would be written outside ${root}`);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (fs.existsSync(target) && fs.lstatSync(target).isSymbolicLink()) fs.rmSync(target);
  fs.copyFileSync(src, target);
}
