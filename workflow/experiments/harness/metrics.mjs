// N5, N6, F9: time terms, token terms and counts for one run (runtime.md § Cost and metrics).

const toMs = (v) => (typeof v === 'number' ? v : Date.parse(v));
const secs = (ms) => Math.round(ms / 1000);

/** Overlap of [a0,a1) with a list of intervals, in ms. */
function overlap(a0, a1, intervals) {
  return intervals.reduce((s, [b0, b1]) => s + Math.max(0, Math.min(a1, b1) - Math.max(a0, b0)), 0);
}

/**
 * timeline: {start, end, waits: [{start, end}], answerer: [{start, end}]} (ISO strings or ms).
 * Answerer time counts only while the run was `running`, so any part inside a wait is dropped (N5).
 * Each term is rounded once, in whole seconds; agent_s is computed from the rounded terms.
 */
export function timeTerms(timeline) {
  const start = toMs(timeline.start);
  const end = toMs(timeline.end);
  const waits = (timeline.waits ?? []).map((w) => [toMs(w.start), toMs(w.end)]);
  const waitMs = waits.reduce((s, [a, b]) => s + Math.max(0, b - a), 0);
  const answererMs = (timeline.answerer ?? []).reduce((s, c) => {
    const a = toMs(c.start);
    const b = toMs(c.end);
    return s + Math.max(0, b - a) - overlap(a, b, waits);
  }, 0);
  const wall_s = secs(end - start);
  const wait_s = secs(waitMs);
  const answerer_s = secs(answererMs);
  return { wall_s, wait_s, answerer_s, agent_s: wall_s - wait_s - answerer_s };
}

/** Token terms over event rows {in_tok, out_tok, cache_read_tok, cache_write_tok}. */
export function tokenTerms(events) {
  let peak = 0;
  let prompt = 0;
  let cacheRead = 0;
  let total = 0;
  const sums = { in_tok: 0, out_tok: 0, cache_read_tok: 0, cache_write_tok: 0 };
  for (const e of events) {
    const p = e.in_tok + e.cache_read_tok + e.cache_write_tok;
    peak = Math.max(peak, p);
    prompt += p;
    cacheRead += e.cache_read_tok;
    total += p + e.out_tok;
    for (const k of Object.keys(sums)) sums[k] += e[k];
  }
  return { ...sums, peak_prompt_tok: peak, cache_read_share: prompt === 0 ? 0 : Math.round((cacheRead / prompt) * 1e4) / 1e4, total_tok: total };
}

/**
 * review_rounds: distinct parent messages that launched one or more subagents whose type is in `agentTypes`.
 * `launches`: [{parent_message_id, agent_type}].
 */
export function reviewRounds(launches, agentTypes, maxRounds) {
  const rounds = new Set(launches.filter((l) => agentTypes.includes(l.agent_type)).map((l) => l.parent_message_id)).size;
  return { review_rounds: rounds, review_cap_exceeded: rounds > maxRounds };
}

/** fix_iterations: Bash calls running lint.mjs that ended in an error. `bashCalls`: [{command, failed}]. */
export function fixIterations(bashCalls) {
  return bashCalls.filter((c) => /lint\.mjs/.test(c.command ?? '') && c.failed).length;
}

/** Five cost classes stay separate (N6); arm_cost_usd comes from events only. */
export function costClasses({ armCost, spend }) {
  const r4 = (x) => Math.round((x ?? 0) * 1e4) / 1e4;
  return {
    arm_cost_usd: armCost,
    answerer_cost_usd: r4(spend.answerer), matcher_cost_usd: r4(spend.matcher), judge_cost_usd: r4(spend.judge), probe_cost_usd: r4(spend.probe),
  };
}
