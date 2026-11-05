// SD6, E74: split the cost of an implementation run into the first attempt and the fix attempt. An event belongs to
// attempt 2 when it started at or after `attempt2Started`; a question turn inside an attempt stays with that attempt.
import { round4 } from './budget.mjs';

/** events: [{started, cost_usd}] from events.csv (cost_usd null when the model is unpriced). */
export function splitCosts(events, attempt2Started) {
  let impl = 0;
  let fix = 0;
  const boundary = attempt2Started ? Date.parse(attempt2Started) : Infinity;
  for (const e of events) {
    if (e.cost_usd === null || e.cost_usd === undefined) return { impl_cost_usd: null, fix_cost_usd: null };
    if (Date.parse(e.started) >= boundary) fix += e.cost_usd;
    else impl += e.cost_usd;
  }
  return { impl_cost_usd: round4(impl), fix_cost_usd: round4(fix) };
}
