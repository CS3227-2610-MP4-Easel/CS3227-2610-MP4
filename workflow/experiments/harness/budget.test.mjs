import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  batchReached, costFromModelUsage, evaluateRun, exitForReason, invocationCap, reasonFromResult, summarize, totalOf,
} from './budget.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = (n) => JSON.parse(fs.readFileSync(path.join(here, 'fixtures', n), 'utf8'));
const pricing = { models: { 'claude-sonnet-5-5': { input: 2, output: 10, cache_read: 0.1, cache_write_5m: 2.5, cache_write_1h: 4 } } };

test('cost from a real result\'s cumulative modelUsage equals the CLI total (N1 shape)', () => {
  const result = fixture('cli-result.json');
  const cost = costFromModelUsage(result.modelUsage, pricing);
  assert.ok(Math.abs(cost - result.total_cost_usd) < 1e-9, `${cost} vs ${result.total_cost_usd}`);
});

test('an unpriced model gives null, not a silent zero', () => {
  assert.equal(costFromModelUsage({ 'claude-unknown': { inputTokens: 5 } }, pricing), null);
});

test('E53: the run check trips at the ceiling and records the overshoot', () => {
  assert.deepEqual(evaluateRun({ armSpent: 0.9, runCeiling: 1 }), { exceeded: false, overshoot: 0 });
  assert.deepEqual(evaluateRun({ armSpent: 1, runCeiling: 1 }), { exceeded: true, overshoot: 0 });
  assert.deepEqual(evaluateRun({ armSpent: 1.2345678, runCeiling: 1 }), { exceeded: true, overshoot: 0.2346 });
});

test('F14: --max-budget-usd is the run ceiling minus the spend so far, never negative', () => {
  assert.equal(invocationCap(1, 0.25), 0.75);
  assert.equal(invocationCap(1, 1.5), 0);
  assert.equal(invocationCap(0.6338, 0.1312), 0.5026);
});

test('E54: the batch ceiling counts every cost class', () => {
  const spend = { arm: 1, answerer: 0.2, matcher: 0.1, judge: 0.4, probe: 0.3 };
  assert.ok(Math.abs(totalOf(spend) - 2) < 1e-12);
  assert.equal(batchReached({ batchSpent: totalOf(spend), batchCeiling: 2 }), true);
  assert.equal(batchReached({ batchSpent: totalOf(spend), batchCeiling: 2.01 }), false);
});

test('E65: the CLI budget stop maps to budget, not crash', () => {
  assert.equal(reasonFromResult(fixture('cli-result-budget-stop.json'), 1), 'budget');
  assert.equal(exitForReason('budget'), 5);
});

test('E18: any other error stop, a missing result or a non-zero exit is a crash', () => {
  assert.equal(reasonFromResult({ subtype: 'error_during_execution', is_error: true }, 1), 'crash');
  assert.equal(reasonFromResult(undefined, 0), 'crash');
  assert.equal(reasonFromResult({ subtype: 'success', is_error: false }, 3), 'crash');
  assert.equal(reasonFromResult({ subtype: 'success', is_error: false }, 0), null);
});

test('exit codes per reason', () => {
  assert.deepEqual(
    ['isolation_mismatch', 'budget', 'turn_cap', 'timeout', 'crash', 'containment', null].map(exitForReason),
    [4, 5, 6, 6, 6, 10, 0],
  );
});

test('E55: a batch with one budget stop (5) and one crash (6) exits 6 and prints the table', () => {
  const runs = [
    { run_id: 'r-a', status: 'aborted', abort_reason: 'budget' },
    { run_id: 'r-b', status: 'aborted', abort_reason: 'crash' },
    { run_id: 'r-c', status: 'done', abort_reason: null },
  ];
  const { exit, table } = summarize(runs);
  assert.equal(exit, 6);
  assert.deepEqual(table, ['r-a  aborted  budget', 'r-b  aborted  crash', 'r-c  done']);
});

test('E66: runs never started stay queued and print not_started: batch_ceiling', () => {
  const { exit, table } = summarize([
    { run_id: 'r-a', status: 'done', abort_reason: null },
    { run_id: 'r-b', status: 'queued', abort_reason: null },
  ]);
  assert.equal(exit, 0);
  assert.equal(table[1], 'r-b  queued  not_started: batch_ceiling');
});

test('E54: only budget stops give exit 5 for the batch', () => {
  assert.equal(summarize([{ run_id: 'a', status: 'aborted', abort_reason: 'budget' }, { run_id: 'b', status: 'queued' }]).exit, 5);
});
