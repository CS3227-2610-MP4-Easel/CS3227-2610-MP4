import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { IMPL_RUN_COLUMNS, IMPL_SUMMARY_COLUMNS } from './implreport.mjs';
import { ReportError, writeReport } from './report.mjs';
import { runPaths, writeJsonAtomic } from './state.mjs';
import { put, tmpDir } from './testkit.mjs';

/** An implementation experiment with hand-written finished runs: {plan, sample, status, abort, pass1, pass2, impl, fix, ...}. */
function fixture(runs, { plans = { 'plan-a': 1 }, samples = 2 } = {}) {
  const expRoot = tmpDir('exp-rep-');
  const outDir = tmpDir('exp-out-');
  put(path.join(expRoot, 'experiments', 'impl-one.json'), { id: 'impl-one', stage: 'implementation', task_id: 'impl-task', implementer_arm_id: 'imp', plans: Object.keys(plans).map((p) => ({ source_experiment_id: 'pilot-001', plan_id: p, snapshot_sha256: '0'.repeat(64) })), samples });
  for (const [p, cost] of Object.entries(plans)) put(path.join(expRoot, 'local', 'plans', 'pilot-001', p, 'snapshot.json'), { plan_id: p, plan_cost_usd: cost, files: [] });
  runs.forEach((r, i) => {
    const id = `run-${i + 1}`;
    const paths = runPaths(expRoot, id);
    const status = r.status ?? 'extracted';
    writeJsonAtomic(paths.manifest, { run_id: id, experiment_id: 'impl-one', task_id: 'impl-task', arm_id: 'imp', rep: r.sample, plan_id: r.plan ?? 'plan-a', plan_arm_id: r.planArm ?? 'lite', sample: r.sample, status, flags: r.flags ?? [], models: { main: 'claude-sonnet-5-5' } });
    writeJsonAtomic(paths.state, { status, abort_reason: r.abort ?? null, attempt: r.attempts ?? 1, plan_gap_questions: r.gaps ?? 0 });
    writeJsonAtomic(path.join(paths.dir, 'usage.json'), { in_tok: 10, out_tok: 20, cache_read_tok: 30, cache_write_tok: 40, time: { wall_s: 5 } });
    if (!r.noGrades) {
      writeJsonAtomic(path.join(paths.dir, 'grades.json'), {
        green_attempt: r.pass1 ? 1 : r.pass2 ? 2 : null, pass1: !!r.pass1, pass2: !!r.pass2, impl_cost_usd: r.impl, fix_cost_usd: r.fix, review_cost_usd: r.review ?? 0,
        typecheck_errors: r.abort ? null : 0, lint_errors: r.abort ? null : 0, own_tests_failed: r.abort ? null : 0, newly_failing_tests: r.abort ? null : 0,
        shared_required_failed: r.abort ? null : 0, shared_info_failed: r.abort ? null : 1, files_off_plan: 0, plan_files_missing: 0, gates_skipped: 0, gates_in_plan: 0,
        review: { findings: r.findings ?? [] }, flags: r.gradeFlags ?? [],
      });
    }
  });
  return { expRoot, outDir };
}
const parse = (file) => {
  const [head, ...rows] = fs.readFileSync(file, 'utf8').trim().split('\n');
  const cols = head.split(',');
  return rows.map((l) => Object.fromEntries(l.split(',').map((v, i) => [cols[i], v])));
};
const report = (fx) => writeReport({ expRoot: fx.expRoot, outDir: fx.outDir, experimentId: 'impl-one' });
const summaryOf = (fx) => parse(path.join(fx.outDir, 'impl-summary.csv'));
const runsOf = (fx) => parse(path.join(fx.outDir, 'impl-runs.csv'));

test('E75: plan 1.0000, sample 0.3000 green at attempt 2 and sample 0.2000 never green: expected cost 1.5000, pass counts 0 and 1, underpowered', () => {
  const fx = fixture([{ sample: 1, pass2: true, impl: 0.1, fix: 0.2, attempts: 2 }, { sample: 2, impl: 0.1, fix: 0.1, attempts: 2 }]);
  const res = report(fx);
  const [s] = summaryOf(fx);
  assert.deepEqual([s.pass1_count, s.pass2_count, s.expected_cost_to_green_usd, s.note, s.n, s.mean_run_cost_usd], ['0', '1', '1.5', 'underpowered', '2', '0.25']);
  assert.equal(s.min_cost_to_green_usd, '1.3');
  assert.equal(s.max_cost_to_green_usd, '1.3');
  const runs = runsOf(fx);
  assert.equal(runs[0].cost_to_green_usd, '1.3');
  assert.equal(runs[1].cost_to_green_usd, '', 'empty when pass2 is false');
  assert.ok(res.lines.some((l) => /plan-a: pass@1 0\/2, pass@2 1\/2.*underpowered/.test(l)));
});

test('cost to green: attempt 1 green counts only impl cost; attempt 2 green counts the whole run', () => {
  const fx = fixture([{ sample: 1, pass1: true, pass2: true, impl: 0.1, fix: 0 }, { sample: 2, pass2: true, impl: 0.1, fix: 0.05, attempts: 2 }]);
  report(fx);
  const [a, b] = runsOf(fx);
  assert.deepEqual([a.cost_to_green_usd, b.cost_to_green_usd], ['1.1', '1.15']);
});

test('E76: no green gives an empty expected cost and no_green; fewer runs than samples add incomplete, in the order underpowered;no_green;incomplete', () => {
  const fx = fixture([{ sample: 1, impl: 0.1, fix: 0 }], { samples: 2 });
  report(fx);
  const [s] = summaryOf(fx);
  assert.equal(s.expected_cost_to_green_usd, '');
  assert.equal(s.note, 'underpowered;no_green;incomplete');
});

test('E77: an aborted run counts in n, n_aborted and the cost sums, with false passes and empty check columns', () => {
  const fx = fixture([{ sample: 1, pass2: true, impl: 0.1, fix: 0 }, { sample: 2, abort: 'budget', impl: 0.4, fix: 0, noGrades: false }]);
  report(fx);
  const [s] = summaryOf(fx);
  assert.deepEqual([s.n, s.n_aborted, s.pass2_count, s.mean_run_cost_usd, s.expected_cost_to_green_usd], ['2', '1', '1', '0.25', '1.5']);
  const aborted = runsOf(fx)[1];
  assert.deepEqual([aborted.abort_reason, aborted.typecheck_errors, aborted.shared_required_failed, aborted.pass1, aborted.pass2], ['budget', '', '', 'false', 'false']);
});

test('E78: a plan id or flag that starts with = is prefixed with a quote', () => {
  const fx = fixture([{ sample: 1, plan: '=cmd', pass1: true, pass2: true, impl: 0.1, fix: 0, flags: ['-x'] }], { plans: { '=cmd': 1 } });
  report(fx);
  const csv = fs.readFileSync(path.join(fx.outDir, 'impl-runs.csv'), 'utf8');
  assert.match(csv, /,'=cmd,/);
  assert.match(csv, /,'-x,/);
  assert.match(fs.readFileSync(path.join(fx.outDir, 'impl-summary.csv'), 'utf8'), /,'=cmd,/);
});

test('E79: a key pattern in any output exits 9 and nothing is written or renamed', () => {
  const fx = fixture([{ sample: 1, pass1: true, pass2: true, impl: 0.1, fix: 0, flags: ['' + ['sk-ant-', 'api03-abcdefghijklmnopqrstuvwxyz0123456789ABCD'].join('') + ''] }]);
  assert.throws(() => report(fx), (e) => e instanceof ReportError && e.exit === 9 && /anthropic-key/.test(e.message) && !e.message.includes('abcdefgh'));
  assert.deepEqual(fs.readdirSync(fx.outDir), []);
});

test('E80: no finished runs exits 2; runs that are not extracted or complete are left out', () => {
  assert.throws(() => report(fixture([])), (e) => e instanceof ReportError && e.exit === 2);
  const only = fixture([{ sample: 1, status: 'done', impl: 0.1, fix: 0 }]);
  assert.throws(() => report(only), (e) => e.exit === 2);
});

test('the printed pass counts equal the counts in the CSV, columns follow data-model.md, and no ranking or verdict is printed', () => {
  const fx = fixture([{ sample: 1, pass1: true, pass2: true, impl: 0.1, fix: 0 }, { sample: 2, pass2: true, impl: 0.1, fix: 0.1, attempts: 2 }], { plans: { 'plan-a': 1, 'plan-b': 2 } });
  const res = report(fx);
  const head = (f) => fs.readFileSync(path.join(fx.outDir, f), 'utf8').split('\n')[0];
  assert.equal(head('impl-runs.csv'), IMPL_RUN_COLUMNS.join(','));
  assert.equal(head('impl-summary.csv'), IMPL_SUMMARY_COLUMNS.join(','));
  const [s] = summaryOf(fx);
  assert.ok(res.lines.some((l) => l.startsWith(`${s.plan_id}: pass@1 ${s.pass1_count}/${s.n}, pass@2 ${s.pass2_count}/${s.n}`)));
  assert.ok(!res.lines.some((l) => /winner|best|rank|dominat/i.test(l)));
  assert.equal(res.summary.length, 1, 'plan-b has no runs and so no row');
});

test('review findings are counted by severity and category', () => {
  const fx = fixture([{ sample: 1, pass1: true, pass2: true, impl: 0.1, fix: 0, findings: [{ category: 'bug', severity: 'major' }, { category: 'bug', severity: 'blocker' }, { category: 'other', severity: 'minor' }] }]);
  report(fx);
  const r = runsOf(fx)[0];
  assert.deepEqual([r.review_blockers, r.review_majors, r.review_minors, r.review_bugs], ['1', '1', '1', '2']);
  assert.equal(summaryOf(fx)[0].mean_review_majors, '1');
});
