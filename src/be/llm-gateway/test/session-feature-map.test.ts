import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import type { PrismaClient } from "@prisma/client";
import type { Feature } from "@agile/contracts";
import { createSessions, SESSION_FEATURE } from "../src/index.js";
import { fakeClock, integrationUrl, withIntegrationDb } from "./fakes.js";

const START = "2026-11-05T02:00:00.000Z";

/** A fake database holding one session row, so the rule is exercised without Postgres. */
function fakeSessions(sessionFeature: Feature, owner: string, id: string, overrides: Record<string, unknown> = {}) {
  const clock = fakeClock(START);
  const row = { id, env: "test", userId: owner, feature: sessionFeature, outcome: "OPEN", lastActivityAt: clock.now(), ...overrides };
  const updates: unknown[] = [];
  const db = {
    aiSession: { findUnique: async () => row, updateMany: async (args: unknown) => { updates.push(args); return { count: 1 }; } },
  } as unknown as PrismaClient;
  return { sessions: createSessions({ db, settings: { tier: "test" }, clock }), updates };
}

test("E1 an OPEN PM_PLAN_OUTLINE session admits PM_PLAN_EXPAND (unit)", async () => {
  const owner = randomUUID();
  const id = randomUUID();
  const { sessions } = fakeSessions("PM_PLAN_OUTLINE", owner, id);
  await assert.doesNotReject(sessions.assertUsable(id, owner, "PM_PLAN_EXPAND"));
  await assert.doesNotReject(sessions.assertUsable(id, owner, "PM_PLAN_OUTLINE"));
  await assert.rejects(sessions.assertUsable(id, randomUUID(), "PM_PLAN_EXPAND"), { message: "NOT_FOUND" });
  assert.deepEqual(SESSION_FEATURE, { PM_PLAN_EXPAND: "PM_PLAN_OUTLINE" });
});

test("E2 every other feature mismatch is still NOT_FOUND (unit)", async () => {
  const owner = randomUUID();
  const id = randomUUID();
  const { sessions: outline } = fakeSessions("PM_PLAN_OUTLINE", owner, id);
  await assert.rejects(outline.assertUsable(id, owner, "LEAD_DIGEST"), { message: "NOT_FOUND" });
  await assert.rejects(outline.assertUsable(id, owner, "DEV_STANDUP"), { message: "NOT_FOUND" });
  const { sessions: expand } = fakeSessions("PM_PLAN_EXPAND", owner, id);
  await assert.rejects(expand.assertUsable(id, owner, "PM_PLAN_OUTLINE"), { message: "NOT_FOUND" });
  await assert.doesNotReject(expand.assertUsable(id, owner, "PM_PLAN_EXPAND"));
});

test("inherited object keys never select a mapping (unit)", async () => {
  const owner = randomUUID();
  const id = randomUUID();
  const { sessions } = fakeSessions("PM_PLAN_OUTLINE", owner, id);
  for (const key of ["constructor", "__proto__"]) {
    await assert.rejects(sessions.assertUsable(id, owner, key as Feature), { message: "NOT_FOUND" });
  }
});

test("a mapped EXPAND call on a closed OUTLINE session is CONFLICT_STATE (unit)", async () => {
  const owner = randomUUID();
  const id = randomUUID();
  for (const outcome of ["ACCEPTED", "EDITED", "REJECTED", "ABANDONED"]) {
    const { sessions } = fakeSessions("PM_PLAN_OUTLINE", owner, id, { outcome });
    await assert.rejects(sessions.assertUsable(id, owner, "PM_PLAN_EXPAND"), { message: "CONFLICT_STATE" }, outcome);
  }
});

test("a mapped EXPAND call on an OUTLINE session idle over 30 minutes is CONFLICT_STATE and abandons it (unit)", async () => {
  const owner = randomUUID();
  const id = randomUUID();
  const lastActivityAt = new Date(new Date(START).getTime() - 31 * 60_000);
  const { sessions, updates } = fakeSessions("PM_PLAN_OUTLINE", owner, id, { lastActivityAt });
  await assert.rejects(sessions.assertUsable(id, owner, "PM_PLAN_EXPAND"), { message: "CONFLICT_STATE" });
  assert.equal(updates.length, 1);
  assert.equal((updates[0] as { data: { outcome: string } }).data.outcome, "ABANDONED");
});

test("foreign, other-tier and malformed sessions are NOT_FOUND for an EXPAND call (unit)", async () => {
  const owner = randomUUID();
  const id = randomUUID();
  const foreign = fakeSessions("PM_PLAN_OUTLINE", randomUUID(), id).sessions;
  await assert.rejects(foreign.assertUsable(id, owner, "PM_PLAN_EXPAND"), { message: "NOT_FOUND" });
  const otherTier = fakeSessions("PM_PLAN_OUTLINE", owner, id, { env: "prod" }).sessions;
  await assert.rejects(otherTier.assertUsable(id, owner, "PM_PLAN_EXPAND"), { message: "NOT_FOUND" });
  const { sessions } = fakeSessions("PM_PLAN_OUTLINE", owner, id);
  await assert.rejects(sessions.assertUsable("not-a-uuid", owner, "PM_PLAN_EXPAND"), { message: "NOT_FOUND" });
});

test("E1 E2 against the database: outline session admits expand only", { skip: !integrationUrl }, () => withIntegrationDb(async (base, { user, project }) => {
  const sessions = createSessions({ db: base, settings: { tier: "test" }, clock: fakeClock(START) });
  const owner = await user();
  const id = await sessions.open({ feature: "PM_PLAN_OUTLINE", userId: owner, projectId: await project(owner) });
  await assert.doesNotReject(sessions.assertUsable(id, owner, "PM_PLAN_EXPAND"));
  await assert.rejects(sessions.assertUsable(id, owner, "LEAD_DIGEST"), { message: "NOT_FOUND" });
  const expandId = await sessions.open({ feature: "PM_PLAN_EXPAND", userId: owner, projectId: null });
  await assert.rejects(sessions.assertUsable(expandId, owner, "PM_PLAN_OUTLINE"), { message: "NOT_FOUND" });
  await assert.doesNotReject(sessions.assertUsable(expandId, owner, "PM_PLAN_EXPAND"));
}));
