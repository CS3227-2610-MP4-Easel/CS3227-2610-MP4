import { expect, test } from 'vitest';
import { advancePlanSelection } from '../lib/plan-selection';

test('a delayed operation from an earlier visit cannot match A → B → A', () => {
  const first = { key: 'project:plan-a', epoch: 0 };
  const second = advancePlanSelection(first, 'project:plan-b');
  const returned = advancePlanSelection(second, 'project:plan-a');
  expect(first.epoch).not.toEqual(returned.epoch);
  expect(advancePlanSelection(returned, returned.key).epoch).toEqual(returned.epoch);
});
