import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MEDIAN_COLUMNS, RUN_COLUMNS, ReportError, writeReport } from './report.mjs';
import { appendQuestion } from './questions.mjs';
import { newRunState, runPaths, writeJsonAtomic } from './state.mjs';
import { tmpDir } from './testkit.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const EVENTS_HEADER = 'run_id,seq,message_id,agent_id,parent_id,model,phase,in_tok,out_tok,cache_read_tok,cache_write_tok,tools,started,ended,cost_usd';

/** A finished run folder: manifest, state, usage, optional grades, questions and events. */
function addRun(root, { id, arm = 'lite', task = 'task-one', rep = 1, status = 'complete', abort = null, cost = 1, rubric = 30, issues = 4, flags = [], grades = true, graded = {} }) {
  const p = runPaths(root, id);
  fs.mkdirSync(p.dir, { recursive: true });
  writeJsonAtomic(p.manifest, { run_id: id, experiment_id: 'exp', task_id: task, arm_id: arm, rep, status, abort_reason: abort, flags, models: { main: 'claude-sonnet-5-5' } });
  writeJsonAtomic(p.state, { ...newRunState(), status, abort_reason: abort, overshoot_usd: abort === 'budget' ? 0.01 : 0 });
  writeJsonAtomic(path.join(p.dir, 'usage.json'), {
    events: 1, in_tok: 100, out_tok: 50, cache_read_tok: 400, cache_write_tok: 20, peak_prompt_tok: 520, cache_read_share: 0.77, total_tok: 570,
    arm_cost_usd: cost, answerer_cost_usd: 0.01, matcher_cost_usd: 0, probe_cost_usd: 0.02, review_rounds: 1, fix_iterations: 0, time: { wall_s: 100, wait_s: 30, answerer_s: 4, agent_s: 66 },
  });
  fs.writeFileSync(path.join(p.dir, 'events.csv'), `${EVENTS_HEADER}\n${id},1,m1,main,,claude-sonnet-5-5,spec,100,50,400,20,Read,t0,t1,${cost.toFixed(6)}\n`);
  appendQuestion(p, { run_id: id, turn: 1, text: 'q1?', source: 'sheet' });
  appendQuestion(p, { run_id: id, turn: 2, text: 'q2?', source: 'operator' });
  if (grades) {
    writeJsonAtomic(path.join(p.dir, 'grades.json'), {
      lint_errors_spec: 0, lint_errors_plan: 1, rubric_spec: rubric / 2, rubric_plan: rubric / 2, rubric_gap: 1, rubric_total: rubric, review_rounds: 1, fix_iterations: 0, judge_cost_usd: 0.05, flags: ['judge_same_model'],
      issues: { a: { outcome: 'raised_as_question' }, b: { outcome: 'resolved_in_artifact' }, c: { outcome: 'missed' } }, ...graded,
    });
  }
  void issues;
}
const read = (dir, f) => fs.readFileSync(path.join(dir, f), 'utf8').trim().split('\n');
const specColumns = () => {
  const md = fs.readFileSync(path.join(here, '..', '..', 'specs', '2026-11-03-experiment-framework-design', 'data-model.md'), 'utf8');
  return md.split('\n').find((l) => l.startsWith('- `runs.csv`:')).split(':').slice(1).join(':').split(',').map((s) => s.trim().replace(/\.$/, ''));
};
const report = (root, out) => writeReport({ expRoot: root, outDir: out, experimentId: 'exp' });

test('F13: runs.csv has exactly the columns of data-model.md; events.csv has one header; medians.csv starts with the stated columns', () => {
  assert.deepEqual(RUN_COLUMNS, specColumns());
  const root = tmpDir();
  const out = path.join(tmpDir(), 'telemetry');
  addRun(root, { id: 'r1', rep: 1 });
  addRun(root, { id: 'r2', rep: 2, cost: 2 });
  report(root, out);
  assert.equal(read(out, 'runs.csv')[0], RUN_COLUMNS.join(','));
  assert.equal(read(out, 'runs.csv').length, 3);
  const events = read(out, 'events.csv');
  assert.equal(events[0], EVENTS_HEADER);
  assert.equal(events.length, 3);
  assert.equal(read(out, 'medians.csv')[0], MEDIAN_COLUMNS.join(','));
  assert.deepEqual(MEDIAN_COLUMNS.slice(0, 5), ['experiment_id', 'task_id', 'arm_id', 'n', 'n_aborted']);
  assert.deepEqual(MEDIAN_COLUMNS.slice(-3), ['gm_excluded', 'single_task', 'verdict']);
});

test('a run row carries cost classes, time terms, question counts and issue counts', () => {
  const root = tmpDir();
  const out = path.join(tmpDir(), 'telemetry');
  addRun(root, { id: 'r1' });
  report(root, out);
  const [head, row] = read(out, 'runs.csv');
  const rec = Object.fromEntries(head.split(',').map((h, i) => [h, row.split(',')[i]]));
  assert.deepEqual([rec.wall_s, rec.wait_s, rec.answerer_s, rec.agent_s], ['100', '30', '4', '66']);
  assert.deepEqual([rec.questions, rec.questions_operator], ['2', '1']);
  assert.deepEqual([rec.issues_raised, rec.issues_resolved, rec.issues_found, rec.issues_missed], ['1', '1', '2', '1']);
  assert.deepEqual([rec.arm_cost_usd, rec.answerer_cost_usd, rec.judge_cost_usd, rec.probe_cost_usd], ['1', '0.01', '0.05', '0.02']);
  assert.equal(rec.flags, 'judge_same_model');
  assert.equal(rec.rubric_total, '30');
});

test('E52: a run without grades is listed with its cost and empty quality columns, and named in the output', () => {
  const root = tmpDir();
  const out = path.join(tmpDir(), 'telemetry');
  addRun(root, { id: 'r1' });
  addRun(root, { id: 'r2', rep: 2, grades: false, status: 'extracted', cost: 3 });
  const res = report(root, out);
  const [head, , row2] = read(out, 'runs.csv');
  const rec = Object.fromEntries(head.split(',').map((h, i) => [h, row2.split(',')[i]]));
  assert.equal(rec.arm_cost_usd, '3');
  for (const f of ['rubric_total', 'issues_found', 'lint_errors_spec']) assert.equal(rec[f], '', f);
  assert.ok(res.lines.some((l) => l.startsWith('r2:') && l.includes('not graded')));
});

test('aborted runs count in the cost medians and n_aborted only, never in the quality medians', () => {
  const root = tmpDir();
  const out = path.join(tmpDir(), 'telemetry');
  addRun(root, { id: 'r1', rep: 1, cost: 1, rubric: 30 });
  addRun(root, { id: 'r2', rep: 2, cost: 2, rubric: 20 });
  addRun(root, { id: 'r3', rep: 3, cost: 9, status: 'extracted', abort: 'budget', grades: false });
  report(root, out);
  const [head, row] = read(out, 'medians.csv');
  const rec = Object.fromEntries(head.split(',').map((h, i) => [h, row.split(',')[i]]));
  assert.deepEqual([rec.n, rec.n_aborted], ['3', '1']);
  assert.equal(rec.med_arm_cost_usd, '2');
  assert.equal(rec.med_rubric_total, '25');
  assert.equal(rec.max_arm_cost_usd, '9');
  assert.equal(rec.max_rubric_total, '30');
});

test('medians.csv has an arm-level row with geometric means and pair verdicts; the output names dominated arms', () => {
  const root = tmpDir();
  const out = path.join(tmpDir(), 'telemetry');
  [['good', 1.0, 30], ['good', 1.5, 31], ['good', 2.0, 32], ['bad', 3.0, 20], ['bad', 4.0, 21], ['bad', 5.0, 22]].forEach(([arm, cost, rubric], i) => addRun(root, { id: `r${i}`, arm, rep: (i % 3) + 1, cost, rubric }));
  const res = report(root, out);
  const rows = read(out, 'medians.csv').slice(1).map((l) => l.split(','));
  const idx = MEDIAN_COLUMNS.indexOf('verdict');
  const summary = rows.filter((r) => r[1] === '*');
  assert.equal(summary.length, 2);
  assert.ok(summary.find((r) => r[2] === 'bad')[idx].includes('dominated(bad by good)'));
  assert.equal(summary.find((r) => r[2] === 'good')[MEDIAN_COLUMNS.indexOf('single_task')], 'single_task');
  assert.ok(res.lines.some((l) => l.includes('dominated(bad by good)')));
  assert.equal(summary.find((r) => r[2] === 'good')[MEDIAN_COLUMNS.indexOf('gm_arm_cost_usd')], '1.5000');
});

test('E51: a credential pattern in any output exits 9, prints the type but not the value, and renames nothing', () => {
  const root = tmpDir();
  const out = path.join(tmpDir(), 'telemetry');
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'runs.csv'), 'previous,content\n');
  const key = ['sk-ant-', 'api03-', 'abcdefghij0123456789ABCD'].join('');
  addRun(root, { id: 'r1' });
  addRun(root, { id: 'r2', rep: 2, flags: [key] });
  assert.throws(() => report(root, out), (e) => e instanceof ReportError && e.exit === 9 && /anthropic-key/.test(e.message) && !e.message.includes(key));
  assert.equal(fs.readFileSync(path.join(out, 'runs.csv'), 'utf8'), 'previous,content\n');
  assert.deepEqual(fs.readdirSync(out), ['runs.csv']);
});

test('E51: a git sha and a base64 image header in the output do not trigger the scan', () => {
  const root = tmpDir();
  const out = path.join(tmpDir(), 'telemetry');
  addRun(root, { id: 'a3f5c9d8e7b6a5948372615049382716abcdef01', flags: ['iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgGAWjYBQAAAUAAQ=='] });
  assert.doesNotThrow(() => report(root, out));
});

test('with no finished runs the report exits 2', () => {
  assert.throws(() => report(tmpDir(), path.join(tmpDir(), 'o')), (e) => e instanceof ReportError && e.exit === 2);
});

test('queued and running runs are left out', () => {
  const root = tmpDir();
  const out = path.join(tmpDir(), 'telemetry');
  addRun(root, { id: 'r1' });
  addRun(root, { id: 'r2', rep: 2, status: 'running', grades: false });
  addRun(root, { id: 'r3', rep: 3, status: 'queued', grades: false });
  assert.equal(report(root, out).rows.length, 1);
});
