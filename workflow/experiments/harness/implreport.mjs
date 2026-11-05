// F14, N4 (T8): `exp report` for an implementation experiment: impl-runs.csv and impl-summary.csv under
// docs/telemetry/experiments/, written through temp files and renamed after a credential scan. Counts and formulas only
// (SD6); no verdict and no ranking. Fewer than 5 samples per plan is `underpowered`.
import fs from 'node:fs';
import path from 'node:path';
import { round4 } from './budget.mjs';
import { ReportError } from './reporterror.mjs';
import { scan } from './secrets.mjs';
import { readJson, runPaths, writeAtomic } from './state.mjs';

export const IMPL_RUN_COLUMNS = ['run_id', 'experiment_id', 'task_id', 'plan_id', 'plan_arm_id', 'sample', 'status', 'abort_reason', 'flags', 'model_main', 'attempts_used', 'green_attempt', 'pass1', 'pass2', 'wall_s', 'in_tok', 'out_tok', 'cache_read_tok', 'cache_write_tok', 'impl_cost_usd', 'fix_cost_usd', 'review_cost_usd', 'plan_cost_usd', 'cost_to_green_usd', 'typecheck_errors', 'lint_errors', 'own_tests_failed', 'newly_failing_tests', 'shared_required_failed', 'shared_info_failed', 'plan_gap_questions', 'files_off_plan', 'plan_files_missing', 'gates_skipped', 'gates_in_plan', 'review_blockers', 'review_majors', 'review_minors', 'review_bugs'];
export const IMPL_SUMMARY_COLUMNS = ['experiment_id', 'plan_id', 'plan_arm_id', 'n', 'n_aborted', 'pass1_count', 'pass2_count', 'plan_cost_usd', 'mean_run_cost_usd', 'expected_cost_to_green_usd', 'min_cost_to_green_usd', 'max_cost_to_green_usd', 'mean_gaps', 'mean_review_majors', 'note'];
export { ReportError };

/** A leading =, +, - or @ in a text cell would be a spreadsheet formula (E78). */
const cell = (v) => {
  if (v === null || v === undefined) return '';
  let s = Array.isArray(v) ? v.join(';') : String(v);
  if (typeof v === 'string' || Array.isArray(v)) if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
};
const line = (cols, row) => cols.map((c) => cell(row[c])).join(',');
const sum = (xs) => xs.reduce((s, x) => s + x, 0);
const mean = (xs) => (xs.length ? sum(xs) / xs.length : null);
const count = (findings, key, value) => findings.filter((f) => f[key] === value).length;

/** One record per finished (extracted or complete) implementation run of the experiment. */
export function collectImplRuns(expRoot, experimentId, experiment) {
  const dir = path.join(expRoot, 'local', 'runs');
  if (!fs.existsSync(dir)) return [];
  const planCost = Object.fromEntries(experiment.plans.map((p) => {
    try { return [p.plan_id, readJson(path.join(expRoot, 'local', 'plans', p.source_experiment_id, p.plan_id, 'snapshot.json')).plan_cost_usd]; } catch { return [p.plan_id, null]; }
  }));
  const rows = [];
  for (const id of fs.readdirSync(dir).sort()) {
    const p = runPaths(expRoot, id);
    let manifest;
    let state;
    try { manifest = readJson(p.manifest); state = readJson(p.state); } catch { continue; }
    if (manifest.experiment_id !== experimentId || !manifest.plan_id || !['extracted', 'complete'].includes(state.status)) continue;
    const read = (f) => { try { return readJson(path.join(p.dir, f)); } catch { return null; } };
    const usage = read('usage.json') ?? {};
    const grades = read('grades.json') ?? {};
    const findings = grades.review?.findings ?? [];
    const impl = grades.impl_cost_usd ?? null;
    const fix = grades.fix_cost_usd ?? null;
    const runCost = impl === null && fix === null ? null : round4((impl ?? 0) + (fix ?? 0));
    const plan = planCost[manifest.plan_id] ?? null;
    const pass1 = grades.pass1 === true;
    const pass2 = grades.pass2 === true;
    const toGreen = plan === null || runCost === null ? null : pass1 ? round4(plan + (impl ?? 0)) : pass2 ? round4(plan + runCost) : null;
    rows.push({
      run_id: id, experiment_id: experimentId, task_id: manifest.task_id, plan_id: manifest.plan_id, plan_arm_id: manifest.plan_arm_id, sample: manifest.sample,
      status: state.status, abort_reason: state.abort_reason, flags: [...new Set([...(manifest.flags ?? []), ...(grades.flags ?? [])])].sort(), model_main: manifest.models?.main,
      attempts_used: state.attempt ?? null, green_attempt: grades.green_attempt ?? null, pass1, pass2, wall_s: usage.time?.wall_s ?? null,
      in_tok: usage.in_tok, out_tok: usage.out_tok, cache_read_tok: usage.cache_read_tok, cache_write_tok: usage.cache_write_tok,
      impl_cost_usd: impl, fix_cost_usd: fix, review_cost_usd: grades.review_cost_usd ?? 0, plan_cost_usd: plan, cost_to_green_usd: toGreen,
      typecheck_errors: grades.typecheck_errors, lint_errors: grades.lint_errors, own_tests_failed: grades.own_tests_failed, newly_failing_tests: grades.newly_failing_tests,
      shared_required_failed: grades.shared_required_failed, shared_info_failed: grades.shared_info_failed, plan_gap_questions: state.plan_gap_questions ?? 0,
      files_off_plan: grades.files_off_plan, plan_files_missing: grades.plan_files_missing, gates_skipped: grades.gates_skipped, gates_in_plan: grades.gates_in_plan,
      review_blockers: count(findings, 'severity', 'blocker'), review_majors: count(findings, 'severity', 'major'), review_minors: count(findings, 'severity', 'minor'),
      review_bugs: count(findings, 'category', 'bug'), _run_cost: runCost,
    });
  }
  return rows;
}

/** One row per plan with the SD6 formulas. `samples` is the experiment's planned number of samples per plan. */
export function summarizePlans(rows, experimentId, samples) {
  const byPlan = new Map();
  for (const r of rows) byPlan.set(r.plan_id, [...(byPlan.get(r.plan_id) ?? []), r]);
  return [...byPlan.keys()].sort().map((planId) => {
    const rs = byPlan.get(planId);
    const pass1 = rs.filter((r) => r.pass1).length;
    const pass2 = rs.filter((r) => r.pass2).length;
    const plan = rs[0].plan_cost_usd;
    const costs = rs.map((r) => r._run_cost);
    const known = costs.every((c) => c !== null);
    const green = rs.filter((r) => r.pass2 && r.cost_to_green_usd !== null).map((r) => r.cost_to_green_usd);
    const notes = [];
    if (rs.length < 5) notes.push('underpowered');
    if (pass2 === 0) notes.push('no_green');
    if (rs.length < samples) notes.push('incomplete');
    return {
      experiment_id: experimentId, plan_id: planId, plan_arm_id: rs[0].plan_arm_id, n: rs.length, n_aborted: rs.filter((r) => r.abort_reason).length,
      pass1_count: pass1, pass2_count: pass2, plan_cost_usd: plan,
      mean_run_cost_usd: known ? round4(mean(costs)) : null,
      expected_cost_to_green_usd: pass2 > 0 && known && plan !== null ? round4(plan + sum(costs) / pass2) : null,
      min_cost_to_green_usd: green.length ? Math.min(...green) : null, max_cost_to_green_usd: green.length ? Math.max(...green) : null,
      mean_gaps: round4(mean(rs.map((r) => r.plan_gap_questions)) ?? 0), mean_review_majors: round4(mean(rs.map((r) => r.review_majors)) ?? 0), note: notes.join(';'),
    };
  });
}

/** Writes impl-runs.csv and impl-summary.csv; exit 9 and nothing renamed on a credential pattern, exit 2 with no finished runs. */
export function writeImplReport({ expRoot, outDir, experimentId }) {
  const experiment = readJson(path.join(expRoot, 'experiments', `${experimentId}.json`));
  const rows = collectImplRuns(expRoot, experimentId, experiment);
  if (!rows.length) throw new ReportError(`no finished runs for experiment ${experimentId}`, 2);
  const summary = summarizePlans(rows, experimentId, experiment.samples ?? 2);
  const runsCsv = `${[IMPL_RUN_COLUMNS.join(','), ...rows.map((r) => line(IMPL_RUN_COLUMNS, r))].join('\n')}\n`;
  const summaryCsv = `${[IMPL_SUMMARY_COLUMNS.join(','), ...summary.map((r) => line(IMPL_SUMMARY_COLUMNS, r))].join('\n')}\n`;
  const hits = [...new Set([runsCsv, summaryCsv].flatMap((t) => scan(t).map((h) => h.type)))];
  if (hits.length) throw new ReportError(`credential pattern(s) in the report output: ${hits.join(', ')}; nothing was written`, 9);
  fs.mkdirSync(outDir, { recursive: true });
  writeAtomic(path.join(outDir, 'impl-runs.csv'), runsCsv);
  writeAtomic(path.join(outDir, 'impl-summary.csv'), summaryCsv);
  const lines = [`wrote ${rows.length} runs to ${outDir}`];
  for (const s of summary) {
    lines.push(`${s.plan_id}: pass@1 ${s.pass1_count}/${s.n}, pass@2 ${s.pass2_count}/${s.n}, expected cost to green ${s.expected_cost_to_green_usd ?? 'n/a'}${s.note ? ` [${s.note}]` : ''}`);
  }
  return { rows, summary, lines };
}
