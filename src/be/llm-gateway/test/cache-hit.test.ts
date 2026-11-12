import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import type { PrismaClient } from "@prisma/client";
import { createCacheHits, modelFor } from "../src/index.js";
import { fakeClock, integrationUrl, testSettings, withIntegrationDb } from "./fakes.js";

const settings = testSettings();
const HASH = "ab".repeat(32);
const VERSION = "0123456789ab";
const input = (userId: string, projectId: string | null, sessionId: string | null) => ({
  feature: "DEV_SUMMARY" as const, caller: { userId, role: "DEVELOPER" as const }, sessionId, projectId, inputHash: HASH, promptVersion: VERSION,
});
type Data = Record<string, unknown>;
type Session = { env: string; userId: string; feature: string };
function fakeDb(sessions: Record<string, Session> = {}) {
  const calls: Array<{ data: Data }> = [];
  const db = {
    llmCall: { create: async (args: { data: Data }) => { calls.push(args); return { id: "x" }; } },
    aiSession: { findUnique: async ({ where }: { where: { id: string } }) => sessions[where.id] ?? null },
  } as unknown as PrismaClient;
  return { db, calls };
}

test("F9 recordCacheHit writes exactly one CACHE_HIT row with zero usage", async () => {
  const { db, calls } = fakeDb();
  const clock = fakeClock("2026-11-05T02:00:00.000Z");
  const user = randomUUID();
  const project = randomUUID();
  await createCacheHits({ db, settings, clock }).recordCacheHit(input(user, project, null));
  assert.equal(calls.length, 1);
  const d = calls[0].data;
  assert.equal(d.status, "CACHE_HIT");
  assert.equal(d.sessionId, null);
  assert.equal(d.userId, user);
  assert.equal(d.role, "DEVELOPER");
  assert.equal(d.projectId, project);
  assert.equal(d.env, "test");
  assert.equal(d.feature, "DEV_SUMMARY");
  assert.equal(d.model, modelFor(settings, "DEV_SUMMARY"));
  assert.equal(d.promptVersion, VERSION);
  assert.equal(d.prefixHash, VERSION);
  assert.equal(d.inputHash, HASH);
  for (const key of ["attempts", "promptTokens", "completionTokens", "totalTokens", "latencyMs", "estimatedPromptTokens"]) assert.equal(d[key], 0, key);
  assert.equal(d.costMicrousd, 0n);
  assert.deepEqual(d.sectionTokens, {});
  assert.equal(d.flagged, false);
  assert.equal(d.truncated, false);
  assert.deepEqual(d.experiment, { resultCache: false, llmMode: "mock" });
  assert.deepEqual(d.createdAt, clock.now());
});

test("F9 recordCacheHit checks the session: owned passes; another user's, tier's or feature's is NOT_FOUND with no row", async () => {
  const user = randomUUID();
  const [own, other, tier, feature] = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
  const { db, calls } = fakeDb({
    [own]: { env: "test", userId: user, feature: "DEV_SUMMARY" },
    [other]: { env: "test", userId: randomUUID(), feature: "DEV_SUMMARY" },
    [tier]: { env: "dev", userId: user, feature: "DEV_SUMMARY" },
    [feature]: { env: "test", userId: user, feature: "DEV_STANDUP" },
  });
  const hits = createCacheHits({ db, settings });
  await hits.recordCacheHit(input(user, null, own));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].data.sessionId, own);
  for (const id of [other, tier, feature, randomUUID(), "not-a-uuid"]) await assert.rejects(hits.recordCacheHit(input(user, null, id)), { message: "NOT_FOUND" });
  assert.equal(calls.length, 1);
});

test("F9 recordCacheHit rejects malformed input", async () => {
  const { db, calls } = fakeDb();
  const hits = createCacheHits({ db, settings });
  const user = randomUUID();
  const base = input(user, null, null);
  const bad = [
    input("u1", null, null), input(user, "p1", null),
    { ...base, caller: { userId: user, role: "ADMIN" as never } },
    { ...base, inputHash: "" }, { ...base, inputHash: "H".repeat(10) }, { ...base, inputHash: "a".repeat(129) },
    { ...base, promptVersion: "xyz" }, { ...base, promptVersion: "" },
  ];
  for (const value of bad) await assert.rejects(hits.recordCacheHit(value), { message: "INVALID_CACHE_HIT" });
  assert.equal(calls.length, 0);
});

test("F9 recordCacheHit inserts a real row", { skip: !integrationUrl }, () => withIntegrationDb(async (base, { user, project }) => {
  const owner = await user();
  const projectId = await project(owner);
  const hits = createCacheHits({ db: base, settings, clock: fakeClock("2026-11-05T02:00:00.000Z") });
  const session = await base.aiSession.create({ data: { feature: "DEV_SUMMARY", userId: owner, projectId, env: "test" }, select: { id: true } });
  await hits.recordCacheHit(input(owner, projectId, session.id));
  const rows = await base.llmCall.findMany({ where: { userId: owner } });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, "CACHE_HIT");
  assert.equal(rows[0].projectId, projectId);
  assert.equal(rows[0].sessionId, session.id);
  assert.equal(rows[0].feature, "DEV_SUMMARY");
  assert.equal(rows[0].inputHash, HASH);
  assert.equal(rows[0].promptTokens, 0);
}));
