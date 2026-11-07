// Cost from the four token buckets. Prices are USD per million tokens (pricing.json).
const BUCKETS = ['input', 'output', 'cache_read', 'cache_write_5m', 'cache_write_1h'];

/** Unrounded cost of one event; `usage` uses the same keys as the price entry. */
export function eventCost(usage, price) {
  let total = 0;
  for (const b of BUCKETS) total += (usage[b] ?? 0) * price[b];
  return total / 1e6;
}

/** Sum of unrounded event costs, rounded once to 4 decimals; null if any event is unpriced. */
export function runCost(events) {
  let total = 0;
  for (const e of events) {
    if (e.cost == null) return null;
    total += e.cost;
  }
  return Math.round(total * 1e4) / 1e4;
}
