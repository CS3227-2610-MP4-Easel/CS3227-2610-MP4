// Parsing rules of data-model.md: TAP from `node --test --test-reporter=tap` and the TypeScript error count.

const RESULT = /^(\s*)(not ok|ok) \d+ - (.*)$/;
const SUBTEST = /^(\s*)# Subtest: (.*)$/;
const DIRECTIVE = /\s#\s*(SKIP|TODO)\b.*$/i;
const MAX_LINES = 20;
const UNIT = 4; // node indents nested tests by four spaces

/**
 * Leaf results of one test file as [{id, result: 'passed'|'failed'|'skipped', lines}] in output order.
 * A parent (describe or test with subtests) is dropped unless it failed with no failing child. `lines` is only
 * filled for a failure (at most 20). A file that prints no result and exits non-zero is one failure `<file>::load`.
 */
export function parseTap(text, file, { exitCode = 0 } = {}) {
  const rows = String(text).split(/\r?\n/);
  const stack = [];
  const pending = []; // pending[level] = results seen one level down since the last result at `level`
  const results = [];
  for (let i = 0; i < rows.length; i += 1) {
    const sub = SUBTEST.exec(rows[i]);
    if (sub) {
      const level = Math.floor(sub[1].length / UNIT);
      stack.length = level;
      stack[level] = sub[2];
      continue;
    }
    const m = RESULT.exec(rows[i]);
    if (!m) continue;
    const level = Math.floor(m[1].length / UNIT);
    const directive = DIRECTIVE.exec(m[3]);
    const name = m[3].replace(DIRECTIVE, '');
    const result = directive ? 'skipped' : m[2] === 'ok' ? 'passed' : 'failed';
    // A file that cannot load is reported by node as a failing test named after the file path.
    const asFile = name.split(/\\+/).join('/'); // node writes each backslash of a Windows path twice
    const loadFailure = level === 0 && result === 'failed' && (asFile === file || asFile.endsWith(`/${file}`));
    const names = loadFailure ? ['load'] : [...stack.slice(0, level).map((s, k) => s ?? `#${k}`), name];
    const hadChildren = (pending[level] ?? 0) > 0;
    const failedChildren = hadChildren ? (pending[`f${level}`] ?? 0) > 0 : false;
    pending[level] = 0;
    pending[`f${level}`] = 0;
    if (level > 0) {
      pending[level - 1] = (pending[level - 1] ?? 0) + 1;
      if (result === 'failed') pending[`f${level - 1}`] = (pending[`f${level - 1}`] ?? 0) + 1;
    }
    const lines = [];
    if (result === 'failed') {
      for (let j = i; j < rows.length && lines.length < MAX_LINES; j += 1) {
        if (j > i && (RESULT.test(rows[j]) || SUBTEST.test(rows[j]) || /^\s*1\.\.\d+$/.test(rows[j]) || /^# /.test(rows[j]))) break;
        if (rows[j].trim() !== '') lines.push(rows[j].slice(0, 300));
      }
    }
    if (hadChildren && !(result === 'failed' && !failedChildren)) continue;
    results.push({ id: `${file}::${names.join(' > ')}`, result, lines });
  }
  if (results.length === 0) return exitCode !== 0 ? [{ id: `${file}::load`, result: 'failed', lines: [] }] : [];
  const seen = new Map();
  for (const r of results) {
    const n = (seen.get(r.id) ?? 0) + 1;
    seen.set(r.id, n);
    if (n > 1) r.id = `${r.id}#${n}`;
  }
  return results;
}

/** Number of output lines that match `error TS<digits>` (typecheck and lint). */
export function countTsErrors(text) {
  return String(text).split(/\r?\n/).filter((l) => /error TS[0-9]+/.test(l)).length;
}
