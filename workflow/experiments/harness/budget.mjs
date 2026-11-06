// F14: spend by cost class, ceilings, overshoot and the exit-code summary of a batch.
import { eventCost } from './pricing.mjs';

export const COST_CLASSES = ['arm', 'answerer', 'matcher', 'judge', 'probe'];

const FIELD = {
  inputTokens: 'input', outputTokens: 'output', cacheReadInputTokens: 'cache_read',
  cacheCreationEphemeral5mInputTokens: 'cache_write_5m', cacheCreationEphemeral1hInputTokens: 'cache_write_1h',
};

/** Unrounded cost of a CLI result's cumulative `modelUsage`; null when a model is not in pricing.json. */
export function costFromModelUsage(modelUsage, pricing) {
  let total = 0;
  for (const [model, u] of Object.entries(modelUsage ?? {})) {
    const price = pricing.models?.[model];
    if (!price) return null;
    const usage = Object.fromEntries(Object.entries(FIELD).map(([k, v]) => [v, u[k] ?? 0]));
    total += eventCost(usage, price);
  }
  return total;
}

export const round4 = (x) => Math.round(x * 1e4) / 1e4;

/** `--max-budget-usd` for the next invocation: the run ceiling minus the spend so far (0 means: do not launch). */
export function invocationCap(runCeiling, armSpent) {
  return Math.max(0, round4(runCeiling - armSpent));
}

/** Run check at a turn end (E53). The run ceiling applies to the arm's own spend. */
export function evaluateRun({ armSpent, runCeiling }) {
  const exceeded = armSpent >= runCeiling;
  return { exceeded, overshoot: exceeded ? round4(armSpent - runCeiling) : 0 };
}

/** Batch check over every cost class (E54): at or above the ceiling, no new run starts. */
export function batchReached({ batchSpent, batchCeiling }) {
  return batchSpent >= batchCeiling;
}

export const totalOf = (spend) => COST_CLASSES.reduce((s, c) => s + (spend[c] ?? 0), 0);

/** Map a CLI result to an abort reason (E65, E18): the budget stop is `budget`, any other error `crash`. */
export function reasonFromResult(result, exitCode) {
  if (result?.subtype === 'error_max_budget_usd') return 'budget';
  if (!result || result.is_error || exitCode !== 0) return 'crash';
  return null;
}

export const EXIT_FOR_REASON = { isolation_mismatch: 4, budget: 5, turn_cap: 6, timeout: 6, crash: 6, containment: 10 };
export const exitForReason = (reason) => (reason ? (EXIT_FOR_REASON[reason] ?? 6) : 0);

/** Highest exit code of the runs and the table of run id, status and reason (E55, E66). */
export function summarize(runs) {
  const exit = runs.reduce((m, r) => Math.max(m, r.status === 'queued' ? 0 : exitForReason(r.abort_reason)), 0);
  const table = runs.map((r) => {
    const reason = r.status === 'queued' ? 'not_started: batch_ceiling' : (r.abort_reason ?? '');
    return `${r.run_id}  ${r.status}  ${reason}`.trimEnd();
  });
  return { exit, table };
}
