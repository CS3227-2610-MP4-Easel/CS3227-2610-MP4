// F13, N3: `exp report`. runs.csv, events.csv and medians.csv under docs/telemetry/experiments/, written through temp
// files and renamed, after a credential scan of all three. Verdicts are over pooled replicates; no winner is declared.
import fs from 'node:fs';
import path from 'node:path';
import { readQuestions } from './questions.mjs';
import { scan } from './secrets.mjs';
import { geometricMean, maxOf, median, minOf, summarizeArm, verdict } from './stats.mjs';
import { readJson, runPaths, writeAtomic } from './state.mjs';

export const RUN_COLUMNS = ['run_id', 'experiment_id', 'task_id', 'arm_id', 'rep', 'status', 'abort_reason', 'flags', 'model_main', 'wall_s', 'wait_s', 'answerer_s', 'agent_s', 'in_tok', 'out_tok', 'cache_read_tok', 'cache_write_tok', 'peak_prompt_tok', 'cache_read_share', 'arm_cost_usd', 'answerer_cost_usd', 'matcher_cost_usd', 'judge_cost_usd', 'probe_cost_usd', 'overshoot_usd', 'questions', 'questions_operator', 'issues_raised', 'issues_resolved', 'issues_found', 'issues_missed', 'lint_errors_spec', 'lint_errors_plan', 'rubric_spec', 'rubric_plan', 'rubric_gap', 'rubric_total', 'review_rounds', 'fix_iterations'];
const MED_FIELDS = ['arm_cost_usd', 'agent_s', 'in_tok', 'out_tok', 'peak_prompt_tok', 'questions', 'issues_found', 'lint_errors_spec', 'lint_errors_plan', 'rubric_spec', 'rubric_plan', 'rubric_total', 'review_rounds', 'fix_iterations'];
const QUALITY_FIELDS = new Set(['issues_found', 'lint_errors_spec', 'lint_errors_plan', 'rubric_spec', 'rubric_plan', 'rubric_total']);
export const MEDIAN_COLUMNS = ['experiment_id', 'task_id', 'arm_id', 'n', 'n_aborted', ...MED_FIELDS.map((f) => `med_${f}`), 'min_arm_cost_usd', 'max_arm_cost_usd', 'min_rubric_total', 'max_rubric_total', 'gm_arm_cost_usd', 'gm_agent_s', 'gm_total_tok', 'gm_excluded', 'single_task', 'verdict'];

export class ReportError extends Error {
  constructor(message, exit) { super(message); this.exit = exit; }
}

const cell = (v) => {
  if (v === null || v === undefined) return '';
  const s = Array.isArray(v) ? v.join('|') : String(v);
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
};
const line = (cols, row) => cols.map((c) => cell(row[c])).join(',');
const fmt = (v) => (v === null || v === undefined ? null : Math.round(v * 1e6) / 1e6);

/** One flat record per terminal run: manifest, state, usage, grades and questions merged under the runs.csv names. */
export function collectRuns(expRoot, experimentId) {
  const dir = path.join(expRoot, 'local', 'runs');
  if (!fs.existsSync(dir)) return [];
  const rows = [];
  for (const id of fs.readdirSync(dir).sort()) {
    const p = runPaths(expRoot, id);
    let manifest;
    let state;
    try { manifest = readJson(p.manifest); state = readJson(p.state); } catch { continue; }
    if (manifest.experiment_id !== experimentId || !['done', 'aborted', 'extracted', 'complete'].includes(state.status)) continue;
    const read = (f) => { try { return readJson(path.join(p.dir, f)); } catch { return null; } };
    const usage = read('usage.json') ?? {};
    const grades = read('grades.json');
    const questions = readQuestions(p);
    const issues = grades?.issues ? Object.values(grades.issues).map((v) => v.outcome) : null;
    const count = (o) => (issues ? issues.filter((x) => x === o).length : null);
    const events = path.join(p.dir, 'events.csv');
    rows.push({
      run_id: id, experiment_id: experimentId, task_id: manifest.task_id, arm_id: manifest.arm_id, rep: manifest.rep, status: state.status,
      abort_reason: state.abort_reason, flags: [...new Set([...(manifest.flags ?? []), ...(grades?.flags ?? [])])].sort(), model_main: manifest.models?.main,
      ...(usage.time ?? {}), in_tok: usage.in_tok, out_tok: usage.out_tok, cache_read_tok: usage.cache_read_tok, cache_write_tok: usage.cache_write_tok,
      peak_prompt_tok: usage.peak_prompt_tok, cache_read_share: usage.cache_read_share, arm_cost_usd: usage.arm_cost_usd,
      answerer_cost_usd: usage.answerer_cost_usd, matcher_cost_usd: usage.matcher_cost_usd, judge_cost_usd: usage.judge_cost_usd ?? grades?.judge_cost_usd,
      probe_cost_usd: usage.probe_cost_usd, overshoot_usd: state.overshoot_usd, total_tok: usage.total_tok,
      questions: questions.length, questions_operator: questions.filter((q) => q.source === 'operator').length,
      issues_raised: count('raised_as_question'), issues_resolved: count('resolved_in_artifact'),
      issues_found: issues ? count('raised_as_question') + count('resolved_in_artifact') : null, issues_missed: count('missed'),
      lint_errors_spec: grades?.lint_errors_spec, lint_errors_plan: grades?.lint_errors_plan,
      rubric_spec: grades?.rubric_spec, rubric_plan: grades?.rubric_plan, rubric_gap: grades?.rubric_gap, rubric_total: grades?.rubric_total,
      review_rounds: grades?.review_rounds ?? usage.review_rounds, fix_iterations: grades?.fix_iterations ?? usage.fix_iterations,
      _graded: !!grades && !state.abort_reason, _events: fs.existsSync(events) ? fs.readFileSync(events, 'utf8') : null,
    });
  }
  // aborted runs and runs without grades keep their cost but leave the quality columns empty (E52)
  for (const r of rows) if (!r._graded) for (const f of ['issues_raised', 'issues_resolved', 'issues_found', 'issues_missed', 'lint_errors_spec', 'lint_errors_plan', 'rubric_spec', 'rubric_plan', 'rubric_gap', 'rubric_total']) r[f] = null;
  return rows;
}

export function buildMedians(rows, experimentId) {
  const byArm = new Map();
  for (const r of rows) byArm.set(r.arm_id, [...(byArm.get(r.arm_id) ?? []), r]);
  const arms = [...byArm.keys()].sort();
  const out = [];
  const summaries = Object.fromEntries(arms.map((a) => [a, summarizeArm(byArm.get(a))]));
  for (const arm of arms) {
    const runs = byArm.get(arm);
    const tasks = [...new Set(runs.map((r) => r.task_id))].sort();
    for (const task of tasks) {
      const rs = runs.filter((r) => r.task_id === task);
      const row = { experiment_id: experimentId, task_id: task, arm_id: arm, n: rs.length, n_aborted: rs.filter((r) => r.abort_reason).length };
      for (const f of MED_FIELDS) row[`med_${f}`] = fmt(median((QUALITY_FIELDS.has(f) ? rs.filter((r) => r._graded) : rs).map((r) => r[f])));
      row.min_arm_cost_usd = fmt(minOf(rs.map((r) => r.arm_cost_usd)));
      row.max_arm_cost_usd = fmt(maxOf(rs.map((r) => r.arm_cost_usd)));
      row.min_rubric_total = fmt(minOf(rs.filter((r) => r._graded).map((r) => r.rubric_total)));
      row.max_rubric_total = fmt(maxOf(rs.filter((r) => r._graded).map((r) => r.rubric_total)));
      out.push(row);
    }
    // arm-level summary row (task_id *): geometric means over per-task medians, and the pair verdicts
    const perTask = (f) => tasks.map((t) => median(runs.filter((r) => r.task_id === t).map((r) => r[f])));
    const g = { cost: geometricMean(perTask('arm_cost_usd')), time: geometricMean(perTask('agent_s')), tok: geometricMean(perTask('total_tok')) };
    out.push({
      experiment_id: experimentId, task_id: '*', arm_id: arm, n: runs.length, n_aborted: runs.filter((r) => r.abort_reason).length,
      gm_arm_cost_usd: g.cost.gm === null ? null : g.cost.gm.toFixed(4), gm_agent_s: g.time.gm === null ? null : g.time.gm.toFixed(4), gm_total_tok: g.tok.gm === null ? null : g.tok.gm.toFixed(4),
      gm_excluded: g.cost.excluded + g.time.excluded + g.tok.excluded > 0 ? 'gm_excluded' : '', single_task: tasks.length === 1 ? 'single_task' : '',
      verdict: arms.filter((o) => o !== arm).map((o) => `${arm} vs ${o}: ${verdict(arm, summaries[arm], o, summaries[o])}`).join('; '),
    });
  }
  return out;
}

/** Writes the three CSVs; exit 9 and no file touched when any of them holds a credential pattern. */
export function writeReport({ expRoot, outDir, experimentId }) {
  const rows = collectRuns(expRoot, experimentId);
  if (!rows.length) throw new ReportError(`no finished runs for experiment ${experimentId}`, 2);
  const runsCsv = `${[RUN_COLUMNS.join(','), ...rows.map((r) => line(RUN_COLUMNS, r))].join('\n')}\n`;
  const header = rows.map((r) => r._events).find(Boolean)?.split('\n')[0] ?? '';
  const eventsCsv = `${[header, ...rows.flatMap((r) => (r._events ? r._events.trim().split('\n').slice(1) : []))].join('\n')}\n`;
  const medians = buildMedians(rows, experimentId);
  const mediansCsv = `${[MEDIAN_COLUMNS.join(','), ...medians.map((r) => line(MEDIAN_COLUMNS, r))].join('\n')}\n`;
  const hits = [...new Set([runsCsv, eventsCsv, mediansCsv].flatMap((t) => scan(t).map((h) => h.type)))];
  if (hits.length) throw new ReportError(`credential pattern(s) in the report output: ${hits.join(', ')}; nothing was written`, 9);
  fs.mkdirSync(outDir, { recursive: true });
  writeAtomic(path.join(outDir, 'runs.csv'), runsCsv);
  writeAtomic(path.join(outDir, 'events.csv'), eventsCsv);
  writeAtomic(path.join(outDir, 'medians.csv'), mediansCsv);
  const lines = [`wrote ${rows.length} runs to ${outDir}`];
  for (const r of rows) if (!r._graded) lines.push(`${r.run_id}: ${r.abort_reason ? `aborted (${r.abort_reason})` : 'not graded'}; quality columns left empty`);
  for (const m of medians.filter((x) => x.task_id === '*')) for (const v of m.verdict.split('; ').filter(Boolean)) if (/dominated|inconclusive|tradeoff/.test(v)) lines.push(v);
  return { rows, medians, lines };
}
