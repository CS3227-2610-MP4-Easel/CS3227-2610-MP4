import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import type { PrismaClient } from "@prisma/client";
import type { Feature } from "@agile/contracts";
import { createSessions, SESSION_FEATURE } from "../src/index.js";
import { fakeClock, integrationUrl, withIntegrationDb } from "./fakes.js";

const START = "2026-11-05T02:00:00.000Z";

/** A fake database holding one session row, so the rule is exercised without Postgres. */
function fakeSessions(sessionFeature: Feature, owner: string, id: string) {
  const clock = fakeClock(START);
  const row = { id, env: "test", userId: owner, feature: sessionFeature, outcome: "OPEN", lastActivityAt: clock.now() };
  const db = { aiSession: { findUnique: async () => row, updateMany: async () => ({ count: 0 }) } } as unknown as PrismaClient;
  return createSessions({ db, settings: { tier: "test" }, clock });
}

test("E1 an OPEN PM_PLAN_OUTLINE session admits PM_PLAN_EXPAND (unit)", async () => {
  const owner = randomUUID();
  const id = randomUUID();
  const sessions = fakeSessions("PM_PLAN_OUTLINE", owner, id);
  await assert.doesNotReject(sessions.assertUsable(id, owner, "PM_PLAN_EXPAND"));
  await assert.doesNotReject(sessions.assertUsable(id, owner, "PM_PLAN_OUTLINE"));
  await assert.rejects(sessions.assertUsable(id, randomUUID(), "PM_PLAN_EXPAND"), { message: "NOT_FOUND" });
  assert.deepEqual(SESSION_FEATURE, { PM_PLAN_EXPAND: "PM_PLAN_OUTLINE" });
});

test("E2 every other feature mismatch is still NOT_FOUND (unit)", async () => {
  const owner = randomUUID();
  const id = randomUUID();
  const outline = fakeSessions("PM_PLAN_OUTLINE", owner, id);
  await assert.rejects(outline.assertUsable(id, owner, "LEAD_DIGEST"), { message: "NOT_FOUND" });
  await assert.rejects(outline.assertUsable(id, owner, "DEV_STANDUP"), { message: "NOT_FOUND" });
  const expand = fakeSessions("PM_PLAN_EXPAND", owner, id);
  await assert.rejects(expand.assertUsable(id, owner, "PM_PLAN_OUTLINE"), { message: "NOT_FOUND" });
});

test("E1 E2 against the database: outline session admits expand only", { skip: !integrationUrl }, () => withIntegrationDb(async (base, { user, project }) => {
  const sessions = createSessions({ db: base, settings: { tier: "test" }, clock: fakeClock(START) });
  const owner = await user();
  const id = await sessions.open({ feature: "PM_PLAN_OUTLINE", userId: owner, projectId: await project(owner) });
  await assert.doesNotReject(sessions.assertUsable(id, owner, "PM_PLAN_EXPAND"));
  await assert.rejects(sessions.assertUsable(id, owner, "LEAD_DIGEST"), { message: "NOT_FOUND" });
  const expandId = await sessions.open({ feature: "PM_PLAN_EXPAND", userId: owner, projectId: null });
  await assert.rejects(sessions.assertUsable(expandId, owner, "PM_PLAN_OUTLINE"), { message: "NOT_FOUND" });
}));
