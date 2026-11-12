#!/usr/bin/env node
// Deterministic checks for writing-specs-lite specs and writing-plans-lite plans.
//   node lint.mjs spec <index.md> [--approved] [--max-lines N]
//   node lint.mjs plan <plan.md>  [--approved] [--closeout] [--root <repo root>]
// Exit code 1 if any error. Warnings never fail.
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const mode = args[0];
const target = args[1];
const flag = (n) => args.includes(n);
const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
if (!['spec', 'plan'].includes(mode) || !target) {
  console.error('usage: lint.mjs spec|plan <file> [--approved] [--closeout] [--max-lines N] [--root dir]');
  process.exit(2);
}

const APPROVED_STATUS = /^- \*\*Status:\*\*\s*Approved \([^,)]+,[^)]+\)/m;

const errors = [];
const warnings = [];
const err = (f, m) => errors.push(`${f}: ${m}`);
const warn = (f, m) => warnings.push(`${f}: ${m}`);
const read = (f) => fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const rel = (f) => path.relative(process.cwd(), f).replace(/\\/g, '/');
const MAX = Number(opt('--max-lines', 200));
const root = path.resolve(opt('--root', process.cwd()));

const BANNED = /\b(appropriate(ly)?|as needed|as necessary|reasonable|reasonably|and so on|etc\.?|tbd|todo|if possible|where possible|should handle errors|handle edge cases|add validation|similar to task)\b/i;

function stripFences(text) {
  let inFence = false;
  return text.split('\n').map((l) => {
    if (/^\s*```/.test(l)) { inFence = !inFence; return ''; }
    return inFence ? '' : l;
  }).join('\n');
}

function banned(file, text) {
  stripFences(text).split('\n').forEach((l, i) => {
    const m = l.match(BANNED);
    if (m) err(rel(file), `line ${i + 1}: vague wording "${m[0]}" - decide it or make it an open question`);
  });
}

function section(text, headingRe) {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => headingRe.test(l));
  if (start < 0) return null;
  const level = (lines[start].match(/^#+/) || ['##'])[0].length;
  const out = [];
  for (let i = start + 1; i < lines.length; i++) {
    const m = lines[i].match(/^(#+)\s/);
    if (m && m[1].length <= level) break;
    out.push(lines[i]);
  }
  return out.join('\n');
}

function tableRows(text) {
  return text.split('\n')
    .filter((l) => /^\s*\|/.test(l) && !/^\s*\|[\s:|-]+\|\s*$/.test(l))
    .map((l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim()));
}

function ids(text, re) {
  return [...new Set((text.match(re) || []))];
}

function parseDeps(file, text) {
  // Find the table whose header has a "Depends on" column; ignore other tables.
  const lines = stripFences(text).split('\n');
  const cells = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
  const tasks = new Map();
  const h = lines.findIndex((l) => /^\s*\|/.test(l) && /depends on/i.test(l));
  if (h < 0) return tasks;
  const header = cells(lines[h]);
  const col = (re) => header.findIndex((c) => re.test(c));
  const iDep = col(/depends on/i), iConc = col(/concurrent/i), iWave = col(/wave/i);
  for (let i = h + 1; i < lines.length && /^\s*\|/.test(lines[i]); i++) {
    if (/^\s*\|[\s:|-]+\|\s*$/.test(lines[i])) continue;
    const r = cells(lines[i]);
    const m = r[0].match(/^T\d+/);
    if (!m) continue;
    const listIds = (c) => (c || '').match(/T\d+/g) || [];
    if (tasks.has(m[0])) err(rel(file), `duplicate dependency row for ${m[0]}`);
    tasks.set(m[0], { deps: listIds(r[iDep]), conc: listIds(r[iConc]), wave: Number(r[iWave]), raw: r });
  }
  return tasks;
}

function checkDeps(file, tasks) {
  const f = rel(file);
  for (const [id, t] of tasks) {
    if (!Number.isInteger(t.wave) || t.wave < 1) err(f, `${id}: wave must be a positive integer`);
    for (const d of t.deps) {
      if (!tasks.has(d)) { err(f, `${id}: depends on unknown task ${d}`); continue; }
      if (tasks.get(d).wave >= t.wave) err(f, `${id} (wave ${t.wave}) depends on ${d} (wave ${tasks.get(d).wave}); a task must be in a later wave than its dependencies`);
    }
    for (const c of t.conc) {
      if (!tasks.has(c)) { err(f, `${id}: concurrent with unknown task ${c}`); continue; }
      if (!tasks.get(c).conc.includes(id)) err(f, `${id} lists ${c} as concurrent but ${c} does not list ${id}`);
      if (tasks.get(c).deps.includes(id) || t.deps.includes(c)) err(f, `${id} and ${c} cannot be concurrent: one depends on the other`);
    }
  }
  // cycle check
  const seen = new Map();
  const visit = (id, stack) => {
    if (seen.get(id) === 2) return;
    if (seen.get(id) === 1) { err(f, `dependency cycle: ${[...stack, id].join(' -> ')}`); return; }
    seen.set(id, 1);
    for (const d of tasks.get(id)?.deps ?? []) if (tasks.has(d)) visit(d, [...stack, id]);
    seen.set(id, 2);
  };
  for (const id of tasks.keys()) visit(id, []);
}

function specIds(indexFile) {
  const dir = indexFile.replace(/\.md$/, '');
  const index = read(indexFile);
  let req = index;
  const rf = path.join(dir, 'requirements.md');
  if (fs.existsSync(rf)) req += '\n' + read(rf);
  const goals = stripFences(req);
  const fn = ids(goals, /\b[FN]\d+\b/g);
  const edge = fs.existsSync(path.join(dir, 'edge-cases.md')) ? read(path.join(dir, 'edge-cases.md')) : '';
  const e = ids(stripFences(edge), /\bE\d+\b/g);
  const orderFile = path.join(dir, 'implementation-order.md');
  const tasks = fs.existsSync(orderFile) ? parseDeps(orderFile, read(orderFile)) : new Map();
  return { index, dir, fn, e, edge, tasks };
}

function lintSpec(indexFile) {
  const f = rel(indexFile);
  if (!fs.existsSync(indexFile)) { err(f, 'index file not found'); return; }
  const { index, dir, fn, e, edge, tasks } = specIds(indexFile);

  if (!/^- \*\*Status:\*\*/m.test(index)) err(f, 'missing "- **Status:**" line');
  const tier = index.match(/^- \*\*Risk tier:\*\*\s*(Low|Medium|High)\b/m);
  if (!tier) err(f, 'missing "- **Risk tier:** Low|Medium|High" line');
  for (const h of [/^## 1\. Problem/m, /^## 2\. Goals/m, /^## 3\. Non-goals/m, /^## 4\. Components/m, /^## 5\. Open questions/m])
    if (!h.test(index)) err(f, `missing section matching ${h}`);

  const nonGoals = section(index, /^## 3\. Non-goals/m);
  if (nonGoals !== null && !/^\s*-\s+\S/m.test(nonGoals)) err(f, 'Non-goals section is empty');

  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    err(f, `component folder ${rel(dir)}/ not found`);
    return;
  }
  const files = fs.readdirSync(dir).filter((n) => n.endsWith('.md'));
  for (const req of ['edge-cases.md', 'implementation-order.md'])
    if (!files.includes(req)) err(f, `required component ${req} missing in ${rel(dir)}/`);
  if (fn.length > 6 && !files.includes('requirements.md')) err(f, `${fn.length} F/N requirements (>6): move them to requirements.md`);
  if (fn.length === 0) err(f, 'no F/N requirement IDs found');

  const components = section(index, /^## 4\. Components/m) || '';
  for (const n of files) {
    const p = path.join(dir, n);
    const txt = read(p);
    const lines = txt.split('\n').length;
    if (!txt.trim()) err(rel(p), 'empty component file - delete it and say why in the index');
    if (lines > MAX) err(rel(p), `${lines} lines exceeds the ${MAX}-line cap - split it`);
    else if (lines > MAX * 0.75) warn(rel(p), `${lines} lines is near the ${MAX}-line cap`);
    if (!components.includes(n)) err(f, `component ${n} is not linked in § 4. Components`);
    banned(p, txt);
  }
  banned(indexFile, index);
  const idxLines = index.split('\n').length;
  if (idxLines > MAX) err(f, `${idxLines} lines exceeds the ${MAX}-line cap`);

  // edge cases
  const edgeRows = tableRows(stripFences(edge)).filter((r) => /^E\d+$/.test(r[0]));
  const seen = new Set();
  for (const r of edgeRows) {
    if (seen.has(r[0])) err(rel(path.join(dir, 'edge-cases.md')), `duplicate edge case ID ${r[0]}`);
    seen.add(r[0]);
    if (r.some((c) => c === '')) err(rel(path.join(dir, 'edge-cases.md')), `${r[0]} has an empty cell`);
  }
  if (e.length === 0) err(rel(path.join(dir, 'edge-cases.md')), 'no edge case IDs (E1, E2, ...) found');
  const covered = new Set(edgeRows.flatMap((r) => r[1].match(/\b[FN]\d+\b/g) || []));
  for (const id of fn.filter((x) => x.startsWith('F')))
    if (!covered.has(id)) err(rel(path.join(dir, 'edge-cases.md')), `functional requirement ${id} has no edge-case row citing it`);
  if (tier && tier[1] === 'High' && !/what could corrupt data/i.test(edge))
    err(rel(path.join(dir, 'edge-cases.md')), 'High tier requires a "What could corrupt data" section');

  // implementation order
  const orderFile = path.join(dir, 'implementation-order.md');
  if (fs.existsSync(orderFile)) {
    if (tasks.size === 0) err(rel(orderFile), 'no dependency-table rows starting with a task ID (T1, T2, ...)');
    checkDeps(orderFile, tasks);
  }

  // open questions
  if (flag('--approved')) {
    const q = section(index, /^## 5\. Open questions/m) || '';
    const open = tableRows(q).filter((r) => /^Q\d+/.test(r[0]));
    if (open.length) err(f, `${open.length} open question(s) on an approved spec: ${open.map((r) => r[0]).join(', ')}`);
    if (!APPROVED_STATUS.test(index)) err(f, 'Status must read "Approved (<operator name>, <date>)": write it only after the operator says yes (AGENTS.md § 8)');
  }
}

function lintPlan(planFile) {
  const f = rel(planFile);
  if (!fs.existsSync(planFile)) { err(f, 'plan file not found'); return; }
  const text = read(planFile);
  const body = stripFences(text);
  banned(planFile, text);

  const link = text.match(/Spec:\s*\[[^\]]*\]\(([^)]+\.md)\)/);
  if (!link) { err(f, 'header must contain "Spec: [name](path-to-spec-index.md)"'); return; }
  const specFile = path.resolve(path.dirname(planFile), decodeURI(link[1]));
  if (!fs.existsSync(specFile)) { err(f, `linked spec not found: ${link[1]}`); return; }
  const spec = specIds(specFile);

  // approval marker (AGENTS.md § 8, gate 2): older plans lack the line, so only --approved makes it an error
  if (flag('--approved')) {
    if (!APPROVED_STATUS.test(text)) err(f, 'plan Status must read "Approved (<operator name>, <date>)": write it only after the operator says yes (AGENTS.md § 8)');
  } else if (!/^- \*\*Status:\*\*/m.test(text)) {
    warn(f, 'plan has no "- **Status:**" line; add it under the title (Draft | In review | Approved (operator name, date))');
  }

  for (const h of [/^## Scope/m, /^## Task order/m, /^## Traceability/m])
    if (!h.test(text)) err(f, `missing section ${h}`);
  if (!/\*\*Non-goals:\*\*/.test(text)) err(f, 'Scope must restate **Non-goals:**');
  if (!/\*\*Goal:\*\*/.test(text)) err(f, 'Scope must restate **Goal:**');

  // task parity
  const planTasks = [...body.matchAll(/^### (T\d+):/gm)].map((m) => m[1]);
  const specTasks = [...spec.tasks.keys()];
  if (JSON.stringify(planTasks) !== JSON.stringify(specTasks))
    err(f, `task sections [${planTasks.join(', ')}] must equal the spec's implementation order [${specTasks.join(', ')}], same IDs in the same order`);
  const last = [...body.matchAll(/^### .*$/gm)].map((m) => m[0]).pop() || '';
  if (!/close-out/i.test(last)) err(f, 'the last task section must be the Close-out task');

  // plan dependency table must match spec
  const planOrder = section(text, /^## Task order/m) || '';
  const planTable = parseDeps(planFile, planOrder);
  for (const [id, t] of spec.tasks) {
    const p = planTable.get(id);
    if (!p) { err(f, `Task order table is missing ${id}`); continue; }
    if (JSON.stringify(p.deps.sort()) !== JSON.stringify([...t.deps].sort()) || p.wave !== t.wave)
      err(f, `${id}: dependencies/wave differ from the spec's table`);
  }

  // traceability
  const trace = section(text, /^## Traceability/m) || '';
  for (const id of [...spec.fn, ...spec.e])
    if (!new RegExp(`(^|[^A-Za-z0-9])${id}(?![0-9])`).test(trace)) err(f, `Traceability is missing ${id}`);
  for (const r of tableRows(trace)) {
    if (/^[FNE]\d+$/.test(r[0]) && (!r[1] || !/T\d+/.test(r[1]) || !r[2])) err(f, `Traceability row ${r[0]} needs a task and a verifier`);
  }

  // per-task checks
  // Task status comes from the plan's Task order table: Done tasks are history (their paths have moved on), and
  // Post-merge tasks are human steps done after the merge (see close-out below).
  const status = new Map(tableRows(planOrder).filter((r) => /^T\d+/.test(r[0])).map((r) => [r[0].match(/^T\d+/)[0], r[r.length - 1]]));
  const created = new Set();
  const blocks = body.split(/^### /m).slice(1);
  for (const b of blocks) {
    const title = b.split('\n')[0];
    const id = (title.match(/^T\d+/) || [])[0];
    const boxes = (b.match(/^- \[[ xX]\]/gm) || []).length;
    if (!boxes) err(f, `${title}: no checklist`);
    if (id) {
      if (!/\*\*Files\*\*/.test(b)) err(f, `${id}: missing **Files** table`);
      if (!/^\|\s*(Create|Modify|Test)\s*\|/m.test(b)) err(f, `${id}: Files table has no Create/Modify/Test rows`);
      if (boxes > 10) err(f, `${id}: ${boxes} checklist steps (>10): split the task`);
      const history = /^done/i.test(status.get(id) || '');
      for (const line of b.split(/\r?\n/)) {
        const step = line.match(/^- \[[ xX]\]\s*(?:\d+\.\s*)?(.*)$/);
        if (step && !/^GATE:/.test(step[1]) && /\b(push|pull request|open a (draft )?PR|deploy|publish|force-push|merge)\b/i.test(step[1]) && !history)
          warn(f, `${id}: step touches something outside the machine; start it with "GATE:" so the executor stops for the operator: ${step[1].slice(0, 70)}`);
      }
      for (const r of tableRows(b)) {
        if (!['Create', 'Modify', 'Test'].includes(r[0])) continue;
        const m = r[1] && r[1].match(/`([^`]+)`/);
        if (!m) { err(f, `${id}: Files row has no backticked path: ${r.join(' | ')}`); continue; }
        const p = m[1].replace(/\s*\(.*$/, '').replace(/:\d+(-\d+)?$/, '');
        const abs = path.resolve(root, p);
        const exists = fs.existsSync(abs);
        if (r[0] === 'Create') created.add(p);
        if (!history) {
          if (r[0] === 'Modify' && !exists && !created.has(p)) err(f, `${id}: Modify path does not exist: ${p}`);
          if (r[0] === 'Create' && exists) err(f, `${id}: Create path already exists: ${p}`);
        }
        if (r[0] === 'Test' && !exists && !/Create/.test(r[0])) warn(f, `${id}: Test path does not exist yet (ok if the task creates it): ${p}`);
      }
    }
  }
  if (flag('--closeout')) {
    // A Post-merge task is a human step done after the merge: it may stay open at close-out, but it is
    // reported so it can be carried into the project state as a Handover item.
    const post = [...status].filter(([, v]) => /^post-merge/i.test(v)).map(([k]) => k);
    const open = blocks.filter((b) => !post.includes((b.match(/^T\d+/) || [])[0])).reduce((n, b) => n + (b.match(/^- \[ \]/gm) || []).length, 0);
    if (open) err(f, `${open} unticked checklist step(s) at close-out`);
    const notDone = [...status].filter(([, v]) => !/^(done|post-merge)/i.test(v)).map(([k]) => k);
    if (notDone.length) err(f, `Task order still shows tasks that are neither Done nor Post-merge: ${notDone.join(', ')}`);
    if (post.length) warn(f, `Post-merge tasks left open for a human: ${post.join(', ')} (write each as a Handover item in the branch state)`);
  }
}

const file = path.resolve(target);
if (mode === 'spec') lintSpec(file); else lintPlan(file);

for (const w of warnings) console.log(`WARN  ${w}`);
for (const e of errors) console.log(`ERROR ${e}`);
console.log(`${mode} lint: ${errors.length} error(s), ${warnings.length} warning(s)`);
process.exit(errors.length ? 1 : 0);
