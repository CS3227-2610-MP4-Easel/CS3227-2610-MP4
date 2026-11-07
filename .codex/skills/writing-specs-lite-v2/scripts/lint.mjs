#!/usr/bin/env node
// Deterministic checks for the v2 spec / plan / handover formats.
//   node lint.mjs spec <spec.md>        [--approved] [--max-lines N]
//   node lint.mjs plan <plan.md>        [--approved] [--closeout] [--root <repo root>]
//   node lint.mjs handover <Tn.json>    [--task Tn]
//   node lint.mjs hash <spec.md>        prints the value for the plan's "Spec hash:" line
// Exit code 1 if any error. Warnings never fail.
// Spec = ONE file. Plan = folder: plan.md (router + shared context) + tasks/Tn.md + handovers/Tn.json.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const args = process.argv.slice(2);
const mode = args[0];
const target = args[1];
const flag = (n) => args.includes(n);
const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
if (!['spec', 'plan', 'handover', 'hash'].includes(mode) || !target) {
  console.error('usage: lint.mjs spec|plan|handover|hash <file> [--approved] [--closeout] [--max-lines N] [--root dir] [--task Tn]');
  process.exit(2);
}

const APPROVED_STATUS = /^- \*\*Status:\*\*\s*Approved \([^,)]+,[^)]+\)/m;
const WEIGHTS = ['trivial', 'standard', 'complex'];
const REVIEWS = ['none', 'light', 'full'];
const STATUSES = ['not started', 'in progress', 'done', 'blocked', 'post-merge'];
const BANNED = /\b(appropriate(ly)?|as needed|as necessary|reasonable|reasonably|and so on|etc\.?|tbd|todo|if possible|where possible|should handle errors|handle edge cases|add validation|similar to task)\b/i;

const errors = [];
const warnings = [];
const err = (f, m) => errors.push(`${f}: ${m}`);
const warn = (f, m) => warnings.push(`${f}: ${m}`);
const read = (f) => fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const rel = (f) => path.relative(process.cwd(), f).replace(/\\/g, '/');
const root = path.resolve(opt('--root', process.cwd()));
const cells = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
const isSep = (l) => /^\s*\|[\s:|-]+\|\s*$/.test(l);

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
  return text.split('\n').filter((l) => /^\s*\|/.test(l) && !isSep(l)).map(cells);
}

// Table whose header line matches every regex in `must`; returns { header (lowercased), rows }.
function tableByHeader(text, must) {
  const lines = stripFences(text).split('\n');
  const h = lines.findIndex((l) => /^\s*\|/.test(l) && must.every((re) => re.test(l)));
  if (h < 0) return null;
  const rows = [];
  for (let i = h + 1; i < lines.length && /^\s*\|/.test(lines[i]); i++) if (!isSep(lines[i])) rows.push(cells(lines[i]));
  return { header: cells(lines[h]).map((c) => c.toLowerCase()), rows };
}

const uniq = (a) => [...new Set(a)];
const hashOf = (file) => crypto.createHash('sha256').update(read(file)).digest('hex').slice(0, 12);

// ---- dependency graph (shared by plan lint) ----
function checkDeps(f, tasks) {
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

// ---- spec ----
function specIds(text) {
  const goals = stripFences(section(text, /^## (?:2\. )?Goals/m) || '');
  const goalIds = [...goals.matchAll(/^\s*-\s+(?:\*\*)?([FN]\d+)\b/gm)].map((m) => m[1]);
  const edge = tableRows(stripFences(section(text, /^## (?:5\. )?Edge cases/m) || '')).filter((r) => /^E\d+$/.test(r[0]));
  return { goalIds, edge, fn: uniq(goalIds), e: edge.map((r) => r[0]) };
}

function lintSpec(file) {
  const f = rel(file);
  if (!fs.existsSync(file)) { err(f, 'spec file not found'); return; }
  const text = read(file);
  const medium = /^# .*\(Medium spec/m.test(text);
  const lines = text.split('\n').length;
  const MAX = Number(opt('--max-lines', medium ? 120 : 500));
  if (lines > MAX) err(f, `${lines} lines exceeds the ${MAX}-line cap${medium ? '' : ' - the feature is probably two workstreams'}`);
  else if (!medium && lines > 300) warn(f, `${lines} lines; target is 150-300`);

  if (!/^- \*\*Status:\*\*/m.test(text)) err(f, 'missing "- **Status:**" line');
  if (!/^- \*\*Format:\*\*\s*v2\b/m.test(text)) err(f, 'missing "- **Format:** v2" line (this is the v2 single-file spec)');
  if (!medium && !/^- \*\*Risk tier:\*\*\s*(Low|Medium|High)\b/m.test(text)) err(f, 'missing "- **Risk tier:** Low|Medium|High" line');
  const tier = (text.match(/^- \*\*Risk tier:\*\*\s*(Low|Medium|High)\b/m) || [])[1];
  banned(file, text);

  const { goalIds, edge, fn, e } = specIds(text);
  if (!fn.some((x) => x.startsWith('F'))) err(f, 'no functional requirement IDs (F1, ...) found under Goals');
  const dup = goalIds.filter((x, i) => goalIds.indexOf(x) !== i);
  if (dup.length) err(f, `duplicate requirement IDs: ${uniq(dup).join(', ')}`);

  const goalsText = stripFences(section(text, /^## (?:2\. )?Goals/m) || '');
  for (const l of goalsText.split('\n'))
    if (/^\s*-\s+(?:\*\*)?[FN]\d+\b/.test(l) && !medium && !/accept/i.test(l)) err(f, `goal without an acceptance criterion ("Accept: ..."): ${l.trim().slice(0, 60)}`);

  if (medium) {
    if (!/^## Tasks/m.test(text) || !/^- \[[ xX]\] T\d+/m.test(text)) err(f, 'Medium spec needs a "## Tasks" list with "- [ ] T1 ..." items');
  } else {
    for (const h of [/^## 1\. Problem/m, /^## 2\. Goals/m, /^## 3\. Non-goals/m, /^## 4\. Design/m, /^## 5\. Edge cases/m, /^## 6\. Security/m, /^## 7\. Open questions/m, /^## 8\. Decisions/m, /^## 9\. Review record/m])
      if (!h.test(text)) err(f, `missing section matching ${h}`);
    const ng = section(text, /^## 3\. Non-goals/m);
    if (ng !== null && !/^\s*-\s+\S/m.test(ng)) err(f, 'Non-goals section is empty');
    if (/^\s*(task|steps?)\b.*\bT\d+/im.test(stripFences(section(text, /^## 4\. Design/m) || ''))) warn(f, 'Design mentions task IDs; task boundaries belong to the plan');
    if (fs.existsSync(file.replace(/\.md$/, '')) && fs.statSync(file.replace(/\.md$/, '')).isDirectory()) warn(f, 'a v1-style component folder sits next to this spec; v2 specs are a single file');
  }

  // edge cases
  if (!e.length) err(f, 'no edge case rows (E1, ...) found');
  const seen = new Set();
  for (const r of edge) {
    if (seen.has(r[0])) err(f, `duplicate edge case ID ${r[0]}`);
    seen.add(r[0]);
    if (r.some((c) => c === '')) err(f, `${r[0]} has an empty cell`);
  }
  const covered = new Set(edge.flatMap((r) => r[1].match(/\b[FN]\d+\b/g) || []));
  for (const id of fn.filter((x) => x.startsWith('F'))) if (!covered.has(id)) err(f, `functional requirement ${id} has no edge-case row citing it`);
  for (const id of covered) if (!fn.includes(id)) err(f, `edge case cites unknown requirement ${id}`);
  if (tier === 'High' && !/what could corrupt data/i.test(text)) err(f, 'High tier requires a "What could corrupt data" group in Edge cases');

  if (flag('--approved')) {
    const q = tableRows(stripFences(section(text, /^## (?:7\. )?Open questions/m) || '')).filter((r) => /^Q\d+/.test(r[0]));
    if (q.length) err(f, `${q.length} open question(s) on an approved spec: ${q.map((r) => r[0]).join(', ')}`);
    if (!APPROVED_STATUS.test(text)) err(f, 'Status must read "Approved (<operator name>, <date>)": write it only after the operator says yes (AGENTS.md § 8)');
  }
}

// ---- handover ----
function lintHandover(file, expectId) {
  const f = rel(file);
  if (!fs.existsSync(file)) { err(f, 'handover file not found'); return; }
  let j;
  try { j = JSON.parse(read(file)); } catch (x) { err(f, `invalid JSON: ${x.message}`); return; }
  for (const k of ['task', 'status', 'summary', 'produces', 'next', 'deviations', 'checks'])
    if (!(k in j)) err(f, `missing key "${k}"`);
  if (expectId && j.task !== expectId) err(f, `task is "${j.task}", expected ${expectId}`);
  if (!['done', 'blocked', 'partial'].includes(j.status)) err(f, `status must be done|blocked|partial, got "${j.status}"`);
  if (typeof j.summary === 'string' && j.summary.length > 200) err(f, 'summary is over 200 characters (one line for a human)');
  if (typeof j.next === 'string' && j.next.length > 400) err(f, '"next" is over 400 characters (at most 3 short lines)');
  if (!Array.isArray(j.produces)) err(f, '"produces" must be an array');
  else j.produces.forEach((p, i) => { if (!p.kind || !p.name) err(f, `produces[${i}] needs "kind" and "name"`); });
  if (!Array.isArray(j.deviations)) err(f, '"deviations" must be an array');
  else j.deviations.forEach((d, i) => {
    if (!d.what || !d.why) err(f, `deviations[${i}] needs "what" and "why"`);
    if (!['operator', 'orchestrator', 'none'].includes(d.needs)) err(f, `deviations[${i}].needs must be operator|orchestrator|none`);
  });
  if (j.status === 'done') {
    if (!j.commit || typeof j.commit !== 'string') err(f, 'a done task must record its "commit"');
    if (!j.checks || !['pass', 'n/a'].includes(j.checks.build)) err(f, 'a done task needs checks.build = pass (or n/a for docs-only)');
    if ((j.deviations || []).some((d) => d.needs === 'operator')) err(f, 'a done task cannot carry a deviation that still needs the operator');
  } else if (!j.blocked_reason) err(f, `status ${j.status} needs "blocked_reason"`);
}

// ---- plan ----
function lintPlan(planFile) {
  const f = rel(planFile);
  if (!fs.existsSync(planFile)) { err(f, 'plan.md not found'); return; }
  const dir = path.dirname(planFile);
  const text = read(planFile);
  banned(planFile, text);
  const planLines = text.split('\n').length;
  if (planLines > 350) err(f, `${planLines} lines: plan.md is a router, keep it under 350 (move detail into task files)`);
  else if (planLines > 200) warn(f, `${planLines} lines; plan.md is read by the orchestrator every session`);

  if (!/^- \*\*Format:\*\*\s*v2\b/m.test(text)) err(f, 'missing "- **Format:** v2" line');
  if (flag('--approved')) { if (!APPROVED_STATUS.test(text)) err(f, 'plan Status must read "Approved (<operator name>, <date>)" (AGENTS.md § 8, gate 2)'); }
  else if (!/^- \*\*Status:\*\*/m.test(text)) err(f, 'missing "- **Status:**" line');

  // spec link + hash
  const link = text.match(/\*\*Spec:\*\*\s*\[[^\]]*\]\(([^)]+\.md)\)/);
  let spec = null;
  if (!link) err(f, 'header must contain "**Spec:** [name](path-to-spec.md)"');
  else {
    const specFile = path.resolve(dir, decodeURI(link[1]));
    if (!fs.existsSync(specFile)) err(f, `linked spec not found: ${link[1]}`);
    else {
      spec = specIds(read(specFile));
      const h = text.match(/\*\*Spec hash:\*\*\s*`?([0-9a-f]{12})`?/);
      if (!h) err(f, 'header must contain "**Spec hash:** <value from lint.mjs hash <spec>>"');
      else if (h[1] !== hashOf(specFile)) warn(f, `spec changed since this plan was written (hash ${h[1]} vs ${hashOf(specFile)}): re-check the affected task files, then update the hash`);
    }
  }

  for (const h of [/^## Scope/m, /^## Shared context/m, /^## Task order/m, /^## Traceability/m, /^## Close-out/m])
    if (!h.test(text)) err(f, `missing section ${h}`);
  if (!/\*\*Goal:\*\*/.test(text)) err(f, 'Scope must state **Goal:**');
  if (!/\*\*Non-goals:\*\*/.test(text)) err(f, 'Scope must state **Non-goals:**');
  const shared = section(text, /^## Shared context/m) || '';
  const sharedLines = shared.split('\n').filter((l) => l.trim()).length;
  if (sharedLines > 40) err(f, `Shared context is ${sharedLines} lines (>40): it is pasted into every brief, trim it`);
  if (!/commands/i.test(shared)) err(f, 'Shared context must list the build/test **Commands**');

  // task order
  const order = section(text, /^## Task order/m) || '';
  const tb = tableByHeader(order, [/task/i, /depends on/i, /wave/i]);
  const tasks = new Map();
  if (!tb) err(f, 'Task order needs a table with Task, File, Depends on, Concurrent with, Wave, Weight, Review, Status columns');
  else {
    const col = (re) => tb.header.findIndex((c) => re.test(c));
    const iFile = col(/^file/), iDep = col(/depends/), iConc = col(/concurrent/), iWave = col(/wave/), iW = col(/weight/), iR = col(/review/), iS = col(/status/);
    for (const [name, i] of [['File', iFile], ['Concurrent with', iConc], ['Weight', iW], ['Review', iR], ['Status', iS]]) if (i < 0) err(f, `Task order is missing the "${name}" column`);
    const ids = (c) => (c || '').match(/T\d+/g) || [];
    for (const r of tb.rows) {
      const id = (r[0].match(/^T\d+/) || [])[0];
      if (!id) continue;
      if (tasks.has(id)) { err(f, `duplicate Task order row for ${id}`); continue; }
      tasks.set(id, { deps: ids(r[iDep]), conc: ids(r[iConc]), wave: Number(r[iWave]), file: (r[iFile] || '').replace(/`/g, ''), weight: (r[iW] || '').toLowerCase(), review: (r[iR] || '').toLowerCase(), status: (r[iS] || '').toLowerCase() });
    }
    if (!tasks.size) err(f, 'Task order has no rows starting with a task ID (T1, ...)');
    for (const [id, t] of tasks) {
      if (!WEIGHTS.includes(t.weight)) err(f, `${id}: Weight must be ${WEIGHTS.join('|')}, got "${t.weight}"`);
      if (!REVIEWS.includes(t.review)) err(f, `${id}: Review must be ${REVIEWS.join('|')}, got "${t.review}"`);
      if (!STATUSES.includes(t.status)) err(f, `${id}: Status must be one of ${STATUSES.join(' / ')}, got "${t.status}"`);
      if (t.weight === 'complex' && t.review === 'none') err(f, `${id}: a complex task cannot have Review none`);
    }
    checkDeps(f, tasks);
  }

  // traceability
  const trace = section(text, /^## Traceability/m) || '';
  const traceRows = tableRows(trace).filter((r) => /^[FNE]\d+$/.test(r[0]));
  const byTask = new Map();
  for (const r of traceRows) {
    const ts = r[1] ? r[1].match(/T\d+/g) || [] : [];
    if (!ts.length || !r[2]) err(f, `Traceability row ${r[0]} needs a task and a verifier`);
    for (const t of ts) {
      if (!tasks.has(t)) err(f, `Traceability row ${r[0]} cites unknown task ${t}`);
      byTask.set(t, [...(byTask.get(t) || []), r[0]]);
    }
  }
  if (spec) for (const id of [...spec.fn, ...spec.e]) if (!traceRows.some((r) => r[0] === id)) err(f, `Traceability is missing ${id}`);

  // task files
  const tasksDir = path.join(dir, 'tasks');
  if (fs.existsSync(tasksDir))
    for (const n of fs.readdirSync(tasksDir).filter((x) => /^T\d+\.md$/.test(x)))
      if (!tasks.has(n.replace(/\.md$/, ''))) err(f, `tasks/${n} is not in the Task order table`);
  const paths = new Map();
  for (const [id, t] of tasks) {
    const tf = path.resolve(dir, t.file || `tasks/${id}.md`);
    const tr = rel(tf);
    if (!fs.existsSync(tf)) { err(f, `${id}: task file ${t.file} not found`); continue; }
    const tx = read(tf);
    banned(tf, tx);
    const n = tx.split('\n').length;
    if (n > 200) err(tr, `${n} lines (>200): split the task`);
    else if (n > 150) warn(tr, `${n} lines; task files should stay near 150`);
    if (!new RegExp(`^# ${id}\\b`, 'm').test(tx)) err(tr, `title must start with "# ${id}:"`);
    for (const h of ['Expected state', 'Objective', 'Rules that apply', 'Contract', 'Files', 'Steps', 'Handover directions'])
      if (!new RegExp(`^## ${h}`, 'm').test(tx)) err(tr, `missing section "## ${h}"`);
    if (/\b(STATE\.md|guardrails\.md)\b/.test(stripFences(section(tx, /^## Steps/m) || ''))) warn(tr, 'steps tell the implementer to read STATE.md/guardrails.md; copy the rule into "Rules that apply" instead');

    // satisfies must equal traceability
    const sat = uniq(((tx.match(/\*\*Satisfies:\*\*([^|\n]*)/) || [])[1] || '').match(/\b[FNE]\d+\b/g) || []);
    const tre = uniq(byTask.get(id) || []);
    if (!sat.length) err(tr, 'header needs "**Satisfies:** F1, E2, ..."');
    else if (JSON.stringify([...sat].sort()) !== JSON.stringify([...tre].sort())) err(tr, `Satisfies [${sat.join(', ')}] differs from Traceability [${tre.join(', ')}]`);
    if (spec) for (const x of sat) if (![...spec.fn, ...spec.e].includes(x)) err(tr, `Satisfies cites ${x}, which is not in the spec`);
    const wm = tx.match(/\*\*Wave:\*\*\s*(\d+)/);
    if (!wm || Number(wm[1]) !== t.wave) err(tr, `header Wave ${wm ? wm[1] : '(none)'} differs from Task order (${t.wave})`);

    // expected state may only lean on declared dependencies
    const exp = section(tx, /^## Expected state/m) || '';
    for (const m of exp.matchAll(/\bFrom (T\d+)\b/g)) if (!t.deps.includes(m[1])) err(tr, `Expected state uses ${m[1]}'s handover but Task order does not list it under Depends on`);

    // handover directions: every dependent task is addressed
    const hd = section(tx, /^## Handover directions/m) || '';
    const dependents = [...tasks].filter(([, o]) => o.deps.includes(id)).map(([k]) => k);
    for (const d of dependents) if (!new RegExp(`\\b${d}\\b`).test(hd)) err(tr, `Handover directions say nothing about dependent task ${d}`);
    if (!/produces/i.test(hd)) err(tr, 'Handover directions must name what the task "produces"');

    // steps
    const steps = stripFences(section(tx, /^## Steps/m) || '').split('\n').filter((l) => /^\s*\d+\.\s/.test(l));
    if (!steps.length) err(tr, 'no numbered steps');
    if (steps.length > 10) err(tr, `${steps.length} steps (>10): split the task`);
    if (!(t.status || '').startsWith('done'))
      for (const s of steps) if (!/GATE:/.test(s) && /\b(push|pull request|open a (draft )?PR|deploy|publish|force-push|merge)\b/i.test(s)) warn(tr, `step touches something outside the machine; start it with "GATE:": ${s.trim().slice(0, 70)}`);

    // files
    const mine = new Set();
    for (const r of tableRows(section(tx, /^## Files/m) || '')) {
      if (!['Create', 'Modify', 'Test'].includes(r[0])) continue;
      const m = r[1] && r[1].match(/`([^`]+)`/);
      if (!m) { err(tr, `Files row has no backticked path: ${r.join(' | ')}`); continue; }
      const p = m[1].replace(/\s*\(.*$/, '').replace(/:\d+(-\d+)?$/, '');
      mine.add(p);
      const exists = fs.existsSync(path.resolve(root, p));
      if (!(t.status || '').startsWith('done')) {
        if (r[0] === 'Modify' && !exists && !allCreated(tasks, dir, p, id)) err(tr, `Modify path does not exist and no earlier task creates it: ${p}`);
        if (r[0] === 'Create' && exists) err(tr, `Create path already exists: ${p}`);
      }
    }
    if (!mine.size) err(tr, 'Files table has no Create/Modify/Test rows');
    paths.set(id, mine);
  }
  // same-wave tasks must not share files
  const ids = [...tasks.keys()];
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const a = tasks.get(ids[i]), b = tasks.get(ids[j]);
    if (a.wave !== b.wave) continue;
    const shared2 = [...(paths.get(ids[i]) || [])].filter((p) => (paths.get(ids[j]) || new Set()).has(p));
    if (shared2.length && a.conc.includes(ids[j])) err(f, `${ids[i]} and ${ids[j]} are concurrent but both touch ${shared2[0]}`);
    else if (shared2.length) warn(f, `${ids[i]} and ${ids[j]} share ${shared2[0]}: the orchestrator will serialize them`);
  }

  if (flag('--closeout')) {
    const post = [...tasks].filter(([, t]) => t.status === 'post-merge').map(([k]) => k);
    const notDone = [...tasks].filter(([, t]) => !['done', 'post-merge'].includes(t.status)).map(([k]) => k);
    if (notDone.length) err(f, `Task order still shows tasks that are neither Done nor Post-merge: ${notDone.join(', ')}`);
    for (const [id, t] of tasks) if (t.status === 'done') lintHandover(path.join(dir, 'handovers', `${id}.json`), id);
    if (post.length) warn(f, `Post-merge tasks left open for a human: ${post.join(', ')} (write each as a Handover item in the branch state)`);
  }
}

function allCreated(tasks, dir, p, self) {
  for (const [id, t] of tasks) {
    if (id === self) continue;
    const tf = path.resolve(dir, t.file || `tasks/${id}.md`);
    if (!fs.existsSync(tf)) continue;
    for (const r of tableRows(section(read(tf), /^## Files/m) || '')) if (r[0] === 'Create' && (r[1] || '').includes('`' + p)) return true;
  }
  return false;
}

const file = path.resolve(target);
if (mode === 'hash') { console.log(hashOf(file)); process.exit(0); }
if (mode === 'spec') lintSpec(file);
else if (mode === 'plan') lintPlan(file);
else lintHandover(file, opt('--task', null));

for (const w of warnings) console.log(`WARN  ${w}`);
for (const e of errors) console.log(`ERROR ${e}`);
console.log(`${mode} lint: ${errors.length} error(s), ${warnings.length} warning(s)`);
process.exit(errors.length ? 1 : 0);
