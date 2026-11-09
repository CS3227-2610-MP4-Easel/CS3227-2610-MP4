import assert from "node:assert/strict";
import { test } from "node:test";
import type { PrismaClient } from "@prisma/client";
import { createCacheHits } from "../src/index.js";
import { fakeClock, integrationUrl, testSettings, withIntegrationDb } from "./fakes.js";

const settings = testSettings();
const input = (userId: string, projectId: string | null, sessionId: string | null) => ({
  feature: "DEV_SUMMARY" as const, caller: { userId, role: "DEVELOPER" as const }, sessionId, projectId, inputHash: "h".repeat(64), promptVersion: "v1abcdef0123",
});

test("F9 recordCacheHit writes exactly one CACHE_HIT row with zero usage", async () => {
  const calls: Array<{ data: Record<string, unknown> }> = [];
  const db = { llmCall: { create: async (args: { data: Record<string, unknown> }) => { calls.push(args); return { id: "x" }; } } } as unknown as PrismaClient;
  const clock = fakeClock("2026-11-05T02:00:00.000Z");
  await createCacheHits({ db, settings, clock }).recordCacheHit(input("u1", "p1", null));
  assert.equal(calls.length, 1);
  const d = calls[0].data;
  assert.equal(d.status, "CACHE_HIT");
  assert.equal(d.sessionId, null);
  assert.equal(d.userId, "u1");
  assert.equal(d.role, "DEVELOPER");
  assert.equal(d.projectId, "p1");
  assert.equal(d.env, "test");
  assert.equal(d.feature, "DEV_SUMMARY");
  assert.equal(typeof d.model, "string");
  assert.equal(d.promptVersion, "v1abcdef0123");
  assert.equal(d.prefixHash, "v1abcdef0123");
  assert.equal(d.inputHash, "h".repeat(64));
  for (const key of ["attempts", "promptTokens", "completionTokens", "totalTokens", "latencyMs", "estimatedPromptTokens"]) assert.equal(d[key], 0, key);
  assert.equal(d.costMicrousd, 0n);
  assert.deepEqual(d.sectionTokens, {});
  assert.equal(d.flagged, false);
  assert.equal(d.truncated, false);
  assert.deepEqual(d.experiment, { resultCache: false, llmMode: "mock" });
  assert.deepEqual(d.createdAt, clock.now());
});

test("F9 recordCacheHit inserts a real row", { skip: !integrationUrl }, () => withIntegrationDb(async (base, { user, project }) => {
  const owner = await user();
  const projectId = await project(owner);
  await createCacheHits({ db: base, settings, clock: fakeClock("2026-11-05T02:00:00.000Z") }).recordCacheHit(input(owner, projectId, null));
  const rows = await base.llmCall.findMany({ where: { userId: owner } });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, "CACHE_HIT");
  assert.equal(rows[0].projectId, projectId);
}));
