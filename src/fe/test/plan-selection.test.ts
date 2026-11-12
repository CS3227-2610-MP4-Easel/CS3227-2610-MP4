import assert from 'node:assert/strict';
import { test } from 'node:test';
import { advancePlanSelection } from '../lib/plan-selection';

test('a delayed operation from an earlier visit cannot match A → B → A', () => {
  const first = { key: 'project:plan-a', epoch: 0 };
  const second = advancePlanSelection(first, 'project:plan-b');
  const returned = advancePlanSelection(second, 'project:plan-a');
  assert.notEqual(first.epoch, returned.epoch);
  assert.equal(advancePlanSelection(returned, returned.key).epoch, returned.epoch);
});
