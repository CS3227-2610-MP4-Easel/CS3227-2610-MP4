import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eventCost, runCost } from './pricing.mjs';

// Stub prices, USD per million tokens.
const price = { input: 3, output: 15, cache_read: 0.3, cache_write_5m: 3.75, cache_write_1h: 6 };

test('eventCost: input and output only', () => {
  // (1000*3 + 500*15) / 1e6
  assert.ok(Math.abs(eventCost({ input: 1000, output: 500 }, price) - 0.0105) < 1e-12);
});

test('eventCost: all four buckets, hand computed', () => {
  // (200000*3 + 4000*15 + 150000*0.3 + 20000*3.75) / 1e6 = 780000 / 1e6
  const usage = { input: 200000, output: 4000, cache_read: 150000, cache_write_5m: 20000 };
  assert.ok(Math.abs(eventCost(usage, price) - 0.78) < 1e-12);
});

test('eventCost: one-hour cache writes use their own price', () => {
  // (10*3 + 20*15 + 1000*0.3 + 500*6) / 1e6 = 3630 / 1e6
  const usage = { input: 10, output: 20, cache_read: 1000, cache_write_1h: 500 };
  assert.ok(Math.abs(eventCost(usage, price) - 0.00363) < 1e-12);
});

test('eventCost is not rounded', () => {
  assert.ok(Math.abs(eventCost({ input: 16 }, price) - 0.000048) < 1e-12);
});

test('missing usage buckets count as zero', () => {
  assert.equal(eventCost({}, price), 0);
});

test('runCost sums unrounded event costs and rounds once to 4 decimals', () => {
  const costs = [
    eventCost({ input: 1000, output: 500 }, price), // 0.0105
    eventCost({ input: 200000, output: 4000, cache_read: 150000, cache_write_5m: 20000 }, price), // 0.78
    eventCost({ input: 10, output: 20, cache_read: 1000, cache_write_1h: 500 }, price), // 0.00363
    eventCost({ input: 16 }, price), // 0.000048
  ];
  // Unrounded sum 0.794178 -> 0.7942. Rounding each event first would give 0.7941.
  assert.equal(runCost(costs.map((cost) => ({ cost }))), 0.7942);
});

test('runCost is null when any event is unpriced', () => {
  assert.equal(runCost([{ cost: 0.5 }, { cost: null }]), null);
});

test('runCost of no events is 0', () => {
  assert.equal(runCost([]), 0);
});
