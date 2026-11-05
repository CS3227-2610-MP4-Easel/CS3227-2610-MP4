// SD4, E47, E52, E102: the attempt-2 feedback text and the restore of protected and plan files. The feedback never
// shows check code; the restore writes harness-owned bytes after checking that no path component is a link, and
// runs no git.
import fs from 'node:fs';
import path from 'node:path';

const HEAD = 'Your build is not green. Fix these and end with EXP-DONE. Do not ask questions.';
const SECRET_LINE = 'The check output could not be shown. Re-read the plan and fix any step that fails.';
const LIMIT = 8000;
const CUT = '\n[cut]';

/** The fixed template of data-model.md. `restored` are the paths the harness restored; `checks` is checks.json. */
export function buildFeedback({ result, restored, checks }) {
  const sections = [];
  if (result.secret_in_check_output) {
    sections.push([SECRET_LINE]);
  } else {
    if (result.typecheck.lines.length) sections.push(['Typecheck errors:', ...result.typecheck.lines]);
    if (result.lint.lines.length) sections.push(['Lint errors:', ...result.lint.lines]);
    const failing = result.own_tests.failing;
    if (failing.length) sections.push(['Failing tests:', ...failing.flatMap((f) => [`- ${f.id}`, ...f.lines.map((l) => `  ${l}`)])]);
    const regressed = [...result.baseline_tests.newly_failing, ...result.baseline_tests.missing];
    if (regressed.length) sections.push(['Existing tests that no longer pass:', ...regressed.map((id) => `- ${id}`)]);
    const failedRequired = checks.filter((c) => c.required && result.shared?.[c.id]?.status !== 'pass');
    if (failedRequired.length) sections.push(['Required checks that failed:', ...failedRequired.map((c) => `- ${c.requirement}`)]);
  }
  if (restored.length) sections.push(['Restored files:', ...restored.map((p) => `- ${p}`)]);
  const text = [HEAD, '', ...sections.flatMap((s, i) => (i === 0 ? s : ['', ...s]))].join('\n');
  return text.length > LIMIT ? `${text.slice(0, LIMIT - CUT.length)}${CUT}` : text;
}

/** True when `rel` exists below `clone` and some component of it (the file included) is a link. */
function throughLink(clone, rel) {
  let current = clone;
  for (const seg of rel.split('/')) {
    current = path.join(current, seg);
    let st;
    try { st = fs.lstatSync(current); } catch { return false; }
    if (st.isSymbolicLink()) return true;
  }
  return false;
}

/** Write the harness's bytes of each path into the clone: the snapshot for plan files, the baseline tree for the rest. */
export function restoreFiles({ paths, clone, baselineTree, planFiles }) {
  const restored = [];
  const refused = [];
  for (const rel of paths) {
    const bytes = planFiles.has(rel) ? planFiles.get(rel) : (() => { const f = path.join(baselineTree, ...rel.split('/')); return fs.existsSync(f) ? fs.readFileSync(f) : null; })();
    if (bytes === null) { refused.push({ path: rel, reason: 'no harness copy' }); continue; }
    if (throughLink(clone, rel)) { refused.push({ path: rel, reason: 'containment: the path goes through a link' }); continue; }
    const target = path.join(clone, ...rel.split('/'));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, bytes);
    restored.push(rel);
  }
  return { restored, refused };
}
