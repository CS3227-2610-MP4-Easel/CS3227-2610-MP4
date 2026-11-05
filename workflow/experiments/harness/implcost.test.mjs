import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitCosts } from './implcost.mjs';

const ev = (started, cost) => ({ started, ended: started, cost_usd: cost });

test('SD6: events before attempt2_started are implementation cost, the rest fix cost, and the two add up to every event', () => {
  const events = [ev('2026-11-05T10:00:00Z', 0.1), ev('2026-11-05T10:05:00Z', 0.2), ev('2026-11-05T10:20:00Z', 0.05), ev('2026-11-05T10:30:00Z', 0.15)];
  const r = splitCosts(events, '2026-11-05T10:10:00Z');
  assert.deepEqual(r, { impl_cost_usd: 0.3, fix_cost_usd: 0.2 });
  assert.equal(Math.round((r.impl_cost_usd + r.fix_cost_usd) * 1e4) / 1e4, 0.5);
});

test('E74: with no attempt 2 everything is implementation cost; an event exactly at the boundary belongs to attempt 2', () => {
  const events = [ev('2026-11-05T10:00:00Z', 0.1), ev('2026-11-05T10:10:00Z', 0.4)];
  assert.deepEqual(splitCosts(events, null), { impl_cost_usd: 0.5, fix_cost_usd: 0 });
  assert.deepEqual(splitCosts(events, '2026-11-05T10:10:00Z'), { impl_cost_usd: 0.1, fix_cost_usd: 0.4 });
});

test('an unpriced event makes both figures null; an empty list gives zeros; sums are rounded once', () => {
  assert.deepEqual(splitCosts([ev('2026-11-05T10:00:00Z', null)], null), { impl_cost_usd: null, fix_cost_usd: null });
  assert.deepEqual(splitCosts([], null), { impl_cost_usd: 0, fix_cost_usd: 0 });
  const third = Array.from({ length: 3 }, () => ev('2026-11-05T10:00:00Z', 0.00003333));
  assert.equal(splitCosts(third, null).impl_cost_usd, 0.0001);
});
