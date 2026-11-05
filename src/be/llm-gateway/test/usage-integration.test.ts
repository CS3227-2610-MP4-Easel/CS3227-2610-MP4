import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { UsageSessionSchema, UsageSummarySchema } from "@agile/contracts";
import { failureReason, usageSessions, usageSummary } from "../src/index.js";
import { integrationUrl, withIntegrationDb } from "./fakes.js";

const skip = !integrationUrl;
// A day no other test writes on, because usageSummary aggregates every user's calls in the tier.
const DAY = "2032-05-05";
const at = (time: string) => new Date(`${DAY}T${time}.000Z`);
const call = (userId: string, overrides: Record<string, unknown> = {}) => ({
  userId, role: "DEVELOPER" as const, env: "test", feature: "DEV_STANDUP" as const, model: "llama3.1:8b", promptVersion: "000000000000", status: "OK" as const,
  attempts: 1, estimatedPromptTokens: 100, sectionTokens: {}, prefixHash: "p", inputHash: "i", flagged: false, truncated: false, experiment: {},
  promptTokens: 100, completionTokens: 20, totalTokens: 120, costMicrousd: 3n, latencyMs: 1_000, createdAt: at("10:00:00"), ...overrides,
});

test("E33 usageSessions: the caller's sessions in [from, to), newest first, with per-session sums and paging", { skip }, () => withIntegrationDb(async (base, { user }) => {
  const me = await user();
  const other = await user();
  const session = (userId: string, startedAt: string, extra: Record<string, unknown> = {}) =>
    base.aiSession.create({ data: { feature: "DEV_STANDUP", userId, env: "test", startedAt: at(startedAt), lastActivityAt: at(startedAt), ...extra } });
  const early = await session(me, "08:00:00", { outcome: "ACCEPTED", endedAt: at("08:30:00"), regenerateCount: 2 });
  const late = await session(me, "09:00:00");
  await session(me, "12:00:00");
  await session(other, "09:30:00");
  await base.aiSession.create({ data: { feature: "DEV_STANDUP", userId: me, env: "dev", startedAt: at("09:15:00"), lastActivityAt: at("09:15:00") } });
  await base.llmCall.createMany({ data: [call(me, { sessionId: early.id, costMicrousd: 5n }), call(me, { sessionId: early.id, status: "SCHEMA_FAIL", promptTokens: null, completionTokens: null, costMicrousd: 104n })] });

  const atFrom = await session(me, "00:00:00");
  const page = await usageSessions(base, me, { from: at("00:00:00"), to: at("12:00:00"), page: 0, size: 20 }, "test");
  assert.equal(page.total, 3, "the session at `from` counts; the one at `to`, the other user's and the other tier's do not");
  assert.deepEqual(page.items.map((s) => s.id), [late.id, early.id, atFrom.id]);
  for (const item of page.items) UsageSessionSchema.parse(item);
  assert.deepEqual(page.items[1], {
    id: early.id, feature: "DEV_STANDUP", startedAt: at("08:00:00").toISOString(), endedAt: at("08:30:00").toISOString(), outcome: "ACCEPTED", regenerateCount: 2,
    feedback: null, calls: 2, promptTokens: 100, completionTokens: 20, costMicroUsd: 109, elapsedSeconds: 1_800,
  });
  assert.deepEqual([page.items[0].calls, page.items[0].costMicroUsd, page.items[0].elapsedSeconds], [0, 0, null]);

  const past = await usageSessions(base, me, { from: at("00:00:00"), to: at("12:00:00"), page: 5, size: 1 }, "test");
  assert.deepEqual([past.items, past.total, past.page, past.size], [[], 3, 5, 1]);
  const byFeature = await usageSessions(base, me, { feature: "DEV_SUMMARY", page: 0, size: 10 }, "test");
  assert.equal(byFeature.total, 0);
  for (const query of [{ page: 0, size: 0 }, { page: 0, size: 101 }, { page: -1, size: 10 }, { page: 0.5, size: 10 }, { page: 10_001, size: 10 }, { page: 0, size: 10, from: new Date("nope") }]) {
    await assert.rejects(usageSessions(base, me, query, "test"), RangeError);
  }
  await assert.rejects(usageSummary(base, { to: new Date("nope") }, "test"), RangeError);
}));

test("E34 usageSummary: one row per feature and model for this tier, aggregate only", { skip }, () => withIntegrationDb(async (base, { user }) => {
  const a = await user();
  const b = await user();
  await base.llmCall.createMany({ data: [
    call(a, { estimatedPromptTokens: 110, promptTokens: 100, latencyMs: 1_000 }),
    call(b, { estimatedPromptTokens: 90, promptTokens: 120, latencyMs: 2_001 }),
    call(a, { status: "SCHEMA_FAIL", promptTokens: null, completionTokens: null, latencyMs: null, costMicrousd: 104n }),
    call(a, { status: "CACHE_HIT", promptTokens: 0, completionTokens: 0, costMicrousd: 0n, latencyMs: 3 }),
    call(a, { feature: "PM_PLAN_OUTLINE", model: "qwen3.5:9b", role: "PM", costMicrousd: 40n }),
    call(a, { env: "dev", costMicrousd: 1_000n }),
    call(a, { createdAt: at("12:00:00"), costMicrousd: 1_000n }),
  ] });
  const summary = await usageSummary(base, { from: at("00:00:00"), to: at("12:00:00") }, "test");
  UsageSummarySchema.parse(summary);
  assert.deepEqual(summary, [
    { feature: "DEV_STANDUP", model: "llama3.1:8b", calls: 4, promptTokens: 220, completionTokens: 40, costMicroUsd: 3 + 3 + 104 + 0, cacheHits: 1, avgLatencyMs: 1001.33, schemaFailures: 1, estimateErrorPercent: 17.5 },
    { feature: "PM_PLAN_OUTLINE", model: "qwen3.5:9b", calls: 1, promptTokens: 100, completionTokens: 20, costMicroUsd: 40, cacheHits: 0, avgLatencyMs: 1000, schemaFailures: 0, estimateErrorPercent: 0 },
  ]);
  assert.ok(!JSON.stringify(summary).includes(a) && !JSON.stringify(summary).includes(b), "no user ids");
}));

test("E35 E19 failureReason: UPSTREAM_LIMIT only for the owner's rate-limited call", { skip }, () => withIntegrationDb(async (base, { user }) => {
  const owner = await user();
  const other = await user();
  const limited = await base.llmCall.create({ data: call(owner, { status: "RATE_LIMITED" }) });
  const ok = await base.llmCall.create({ data: call(owner) });
  assert.equal(await failureReason(base, limited.id, owner), "UPSTREAM_LIMIT");
  assert.equal(await failureReason(base, ok.id, owner), null);
  assert.equal(await failureReason(base, randomUUID(), owner), null);
  assert.equal(await failureReason(base, "not-a-uuid", owner), null);
  assert.equal(await failureReason(base, limited.id, other), null);
}));
