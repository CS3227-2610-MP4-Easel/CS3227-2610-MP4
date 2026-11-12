import { test } from 'node:test';
import assert from 'node:assert/strict';
import { costClasses, fixIterations, reviewRounds, timeTerms, tokenTerms } from './metrics.mjs';

const T0 = Date.parse('2026-11-03T12:00:00Z');
const at = (s) => new Date(T0 + s * 1000).toISOString();

test('E63: run 100 s, wait 30 s, answerer call of 4 s ending exactly when the wait starts', () => {
  const t = timeTerms({
    start: at(0), end: at(100),
    waits: [{ start: at(40), end: at(70) }],
    answerer: [{ start: at(36), end: at(40) }],
  });
  assert.deepEqual(t, { wall_s: 100, wait_s: 30, answerer_s: 4, agent_s: 66 });
});

test('N5: answerer time that overlaps a wait is counted once, outside the wait only', () => {
  const t = timeTerms({ start: at(0), end: at(100), waits: [{ start: at(40), end: at(70) }], answerer: [{ start: at(38), end: at(42) }] });
  assert.equal(t.answerer_s, 2);
  assert.equal(t.agent_s, 100 - 30 - 2);
});

test('N5: each term is rounded once, agent_s comes from the rounded terms', () => {
  const t = timeTerms({ start: 0, end: 10_400, waits: [{ start: 1_000, end: 4_400 }], answerer: [{ start: 5_000, end: 6_600 }] });
  // wall 10.4 -> 10, wait 3.4 -> 3, answerer 1.6 -> 2, agent 10 - 3 - 2 = 5 (not round(10.4 - 3.4 - 1.6) = 5 by luck: check the rule)
  assert.deepEqual(t, { wall_s: 10, wait_s: 3, answerer_s: 2, agent_s: 5 });
  const u = timeTerms({ start: 0, end: 10_500, waits: [{ start: 0, end: 4_500 }], answerer: [{ start: 5_000, end: 6_500 }] });
  // 10.5 -> 11 (Math.round), 4.5 -> 5, 1.5 -> 2; agent = 11 - 5 - 2 = 4, whereas round(10.5 - 4.5 - 1.5) = round(4.5) = 5
  assert.deepEqual(u, { wall_s: 11, wait_s: 5, answerer_s: 2, agent_s: 4 });
});

test('a run with no waits and no answerer calls', () => {
  assert.deepEqual(timeTerms({ start: at(0), end: at(12) }), { wall_s: 12, wait_s: 0, answerer_s: 0, agent_s: 12 });
});

test('runtime.md formulas: peak prompt, cache read share, total tokens', () => {
  const events = [
    { in_tok: 10, out_tok: 5, cache_read_tok: 90, cache_write_tok: 0 }, // prompt 100
    { in_tok: 20, out_tok: 10, cache_read_tok: 60, cache_write_tok: 120 }, // prompt 200
  ];
  const t = tokenTerms(events);
  assert.equal(t.peak_prompt_tok, 200);
  assert.equal(t.cache_read_share, 0.5); // 150 / 300
  assert.equal(t.total_tok, 315);
  assert.deepEqual([t.in_tok, t.out_tok, t.cache_read_tok, t.cache_write_tok], [30, 15, 150, 120]);
});

test('no events gives zeros, not NaN', () => {
  assert.deepEqual(tokenTerms([]), { in_tok: 0, out_tok: 0, cache_read_tok: 0, cache_write_tok: 0, peak_prompt_tok: 0, cache_read_share: 0, total_tok: 0 });
});

test('review_rounds counts distinct parent turns that launched review-type subagents', () => {
  const launches = [
    { parent_message_id: 'm1', agent_type: 'reviewer' },
    { parent_message_id: 'm1', agent_type: 'reviewer' }, // two lenses in parallel: one round
    { parent_message_id: 'm2', agent_type: 'spec-writer' }, // not a review type
    { parent_message_id: 'm3', agent_type: 'reviewer' },
  ];
  assert.deepEqual(reviewRounds(launches, ['reviewer'], 2), { review_rounds: 2, review_cap_exceeded: false });
  assert.deepEqual(reviewRounds(launches, ['reviewer'], 1), { review_rounds: 2, review_cap_exceeded: true });
  assert.deepEqual(reviewRounds([], ['reviewer'], 0), { review_rounds: 0, review_cap_exceeded: false });
});

test('fix_iterations counts failed Bash calls that run lint.mjs only', () => {
  assert.equal(fixIterations([
    { command: 'node .claude/skills/x/scripts/lint.mjs spec a.md', failed: true },
    { command: 'node .claude/skills/x/scripts/lint.mjs spec a.md', failed: false },
    { command: 'ls', failed: true },
    { command: 'node lint.mjs plan p.md', failed: true },
  ]), 2);
});

test('N6: arm cost excludes the other four classes, which stay separate', () => {
  assert.deepEqual(
    costClasses({ armCost: 0.5, spend: { arm: 9, answerer: 0.01234, matcher: 0, judge: 0.2, probe: 0.04999 } }),
    { arm_cost_usd: 0.5, answerer_cost_usd: 0.0123, matcher_cost_usd: 0, judge_cost_usd: 0.2, probe_cost_usd: 0.05 },
  );
});
