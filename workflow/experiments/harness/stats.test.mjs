import { test } from 'node:test';
import assert from 'node:assert/strict';
import { geometricMean, maxOf, median, minOf, summarizeArm, verdict } from './stats.mjs';

const run = (cost, rubric, issues = 4) => ({ arm_cost_usd: cost, rubric_total: rubric, issues_found: issues });
const arm = (costs, rubrics, issues) => summarizeArm(costs.map((c, i) => run(c, rubrics[i], issues)));

test('median: odd n takes the middle, even n the mean of the middle two, nothing gives null', () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 3, 2]), 2.5);
  assert.equal(median([]), null);
  assert.equal(median([null, undefined, 5]), 5);
  assert.deepEqual([minOf([3, 1, 2]), maxOf([3, 1, 2]), minOf([]), maxOf([])], [1, 3, null, null]);
});

test('E49: worked table 1: geometric means of 2 and 8, and of 8 and 2, are both 4.00', () => {
  assert.equal(geometricMean([2, 8]).gm.toFixed(2), '4.00');
  assert.equal(geometricMean([8, 2]).gm.toFixed(2), '4.00');
});

// worked table 2 of runtime.md
const X = arm([3.0, 4.0, 5.0], [20, 22, 24], 4);
const Y = arm([1.0, 1.5, 2.0], [28, 30, 32], 5);
const Z = arm([1.8, 2.5, 3.5], [25, 27, 29], 5);
const W = arm([2.0, 3.0], [24, 26], 4);

test('E49: worked table 2 verdicts', () => {
  assert.equal(verdict('X', X, 'Y', Y), 'dominated(X by Y)');
  assert.equal(verdict('X', X, 'Z', Z), 'dominated(X by Z)');
  assert.equal(verdict('Z', Z, 'Y', Y), 'inconclusive');
  for (const [n, a] of [['X', X], ['Y', Y], ['Z', Z]]) {
    assert.equal(verdict(n, a, 'W', W), 'inconclusive', `${n} vs W`);
    assert.equal(verdict('W', W, n, a), 'inconclusive', `W vs ${n}`);
  }
});

test('the verdict is symmetric in which arm is named first', () => {
  assert.equal(verdict('Y', Y, 'X', X), 'dominated(X by Y)');
  assert.equal(verdict('Z', Z, 'X', X), 'dominated(X by Z)');
});

test('a tradeoff: one arm cheaper, the other better, with a range that does not overlap', () => {
  const cheap = arm([1.0, 1.1, 1.2], [15, 16, 17], 3);
  const good = arm([4.0, 4.5, 5.0], [27, 28, 29], 6);
  assert.equal(verdict('cheap', cheap, 'good', good), 'tradeoff');
});

test('E50: one replicate gives n=1 and an inconclusive verdict', () => {
  const one = arm([2.0], [20], 4);
  assert.equal(one.n, 1);
  assert.equal(verdict('A', one, 'B', Y), 'inconclusive');
});

test('E50: an arm with fewer than three graded runs is inconclusive even with three cost samples', () => {
  const costs = summarizeArm([run(1, 30), run(1.2, 31), { arm_cost_usd: 1.1, rubric_total: null, issues_found: null }]);
  assert.equal(costs.n, 3);
  assert.equal(costs.graded, 2);
  assert.equal(verdict('A', costs, 'B', X), 'inconclusive');
});

test('E50: one task is flagged single_task, and a zero median is excluded and counted', () => {
  assert.equal(geometricMean([4]).single_task, true);
  assert.equal(geometricMean([4, 9]).single_task, false);
  const g = geometricMean([0, 4, null, 9]);
  assert.equal(g.excluded, 2);
  assert.equal(g.gm.toFixed(2), '6.00');
  assert.deepEqual(geometricMean([0]), { gm: null, excluded: 1, single_task: true });
});

test('quality medians leave out runs that were not graded', () => {
  const a = summarizeArm([run(1, 30, 5), run(2, 20, 3), { arm_cost_usd: 9, rubric_total: null, issues_found: null }]);
  assert.equal(a.medCost, 2);
  assert.equal(a.medRubric, 25);
  assert.deepEqual(a.costRange, [1, 9]);
  assert.deepEqual(a.rubricRange, [20, 30]);
});
