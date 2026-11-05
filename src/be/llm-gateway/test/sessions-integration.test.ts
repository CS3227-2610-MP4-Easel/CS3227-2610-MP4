import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import type { PrismaClient } from "@prisma/client";
import { createSessions, SessionCapReached } from "../src/index.js";
import { fakeClock, integrationUrl, withIntegrationDb } from "./fakes.js";

const skip = !integrationUrl;
const MIN = 60_000;
// 10:00 in Singapore (UTC+8); the next Singapore midnight is 14 hours away.
const START = "2026-11-05T02:00:00.000Z";
const setup = (base: PrismaClient, tier: "test" | "dev" = "test") => {
  const clock = fakeClock(START);
  return { clock, sessions: createSessions({ db: base, settings: { tier }, clock }) };
};
const capReached = (seconds: number) => (error: unknown) => error instanceof SessionCapReached && error.message === "RATE_LIMITED" && error.retryAfterSeconds === seconds;

test("E13 missing, other user's, other feature's and other tier's sessions are NOT_FOUND", { skip }, () => withIntegrationDb(async (base, { user, project }) => {
  const { sessions } = setup(base);
  const owner = await user();
  const other = await user();
  const id = await sessions.open({ feature: "DEV_STANDUP", userId: owner, projectId: await project(owner) });
  await assert.doesNotReject(sessions.assertUsable(id, owner, "DEV_STANDUP"));
  for (const [sessionId, userId, feature] of [[randomUUID(), owner, "DEV_STANDUP"], [id, other, "DEV_STANDUP"], [id, owner, "DEV_SUMMARY"]] as const) {
    await assert.rejects(sessions.assertUsable(sessionId, userId, feature), { message: "NOT_FOUND" });
  }
  const devTier = setup(base, "dev").sessions;
  await assert.rejects(devTier.assertUsable(id, owner, "DEV_STANDUP"), { message: "NOT_FOUND" });
}));

test("E14 closed and idle sessions are CONFLICT_STATE; idle ones are abandoned", { skip }, () => withIntegrationDb(async (base, { user }) => {
  const { sessions, clock } = setup(base);
  const owner = await user();
  const closed = await sessions.open({ feature: "DEV_STANDUP", userId: owner, projectId: null });
  await sessions.close(closed, "ACCEPTED", owner);
  await assert.rejects(sessions.assertUsable(closed, owner, "DEV_STANDUP"), { message: "CONFLICT_STATE" });

  const fresh = await sessions.open({ feature: "DEV_SUMMARY", userId: owner, projectId: null });
  clock.advance(30 * MIN - 1_000);
  await assert.doesNotReject(sessions.assertUsable(fresh, owner, "DEV_SUMMARY"), "29 min 59 s idle passes");

  const idle = await sessions.open({ feature: "LEAD_DIGEST", userId: owner, projectId: null });
  clock.advance(30 * MIN + 1_000);
  await assert.rejects(sessions.assertUsable(idle, owner, "LEAD_DIGEST"), { message: "CONFLICT_STATE" });
  const row = await base.aiSession.findUniqueOrThrow({ where: { id: idle } });
  assert.equal(row.outcome, "ABANDONED");
  assert.deepEqual(row.endedAt, clock.now());

  await sessions.touch(idle);
  assert.deepEqual((await base.aiSession.findUniqueOrThrow({ where: { id: idle } })).lastActivityAt, row.lastActivityAt, "touch leaves a closed session alone");
  await assert.rejects(sessions.regenerate(idle, owner), { message: "CONFLICT_STATE" });
  assert.equal((await base.aiSession.findUniqueOrThrow({ where: { id: idle } })).regenerateCount, 0);
}));

test("E15 open caps: three open per feature, twenty a Singapore day, idle sessions freed first", { skip }, () => withIntegrationDb(async (base, { user }) => {
  const { sessions, clock } = setup(base);
  const owner = await user();
  await sessions.open({ feature: "DEV_STANDUP", userId: owner, projectId: null });
  clock.advance(10 * MIN);
  await sessions.open({ feature: "DEV_STANDUP", userId: owner, projectId: null });
  await sessions.open({ feature: "DEV_STANDUP", userId: owner, projectId: null });
  await assert.rejects(sessions.open({ feature: "DEV_STANDUP", userId: owner, projectId: null }), capReached(20 * 60), "the oldest reaches 30 min idle in 20 min");

  clock.advance(21 * MIN); // the first session is now 31 min idle, the others 21 min
  const opened = await sessions.open({ feature: "DEV_STANDUP", userId: owner, projectId: null });
  assert.ok(opened);
  assert.equal(await base.aiSession.count({ where: { userId: owner, outcome: "ABANDONED" } }), 1);

  const daily = await user();
  for (let i = 0; i < 17; i++) await sessions.close(await sessions.open({ feature: "DEV_SUMMARY", userId: daily, projectId: null }), "ACCEPTED", daily);
  for (let i = 0; i < 3; i++) await sessions.open({ feature: "DEV_SUMMARY", userId: daily, projectId: null });
  // 20 started today and 3 open: the day cap wins. Clock is 10:31 Singapore time.
  const toMidnight = (new Date("2026-11-05T16:00:00.000Z").getTime() - clock.now().getTime()) / 1000;
  await assert.rejects(sessions.open({ feature: "DEV_SUMMARY", userId: daily, projectId: null }), capReached(toMidnight));
}));

test("E16 close is idempotent and checks its arguments", { skip }, () => withIntegrationDb(async (base, { user }) => {
  const { sessions } = setup(base);
  const owner = await user();
  const id = await sessions.open({ feature: "DEV_STANDUP", userId: owner, projectId: null });
  await sessions.close(id, "EDITED", owner);
  await sessions.close(id, "REJECTED", owner);
  assert.equal((await base.aiSession.findUniqueOrThrow({ where: { id } })).outcome, "EDITED");
  for (const outcome of ["OPEN", "WEIRD"]) await assert.rejects(sessions.close(id, outcome, owner), { message: "INVALID_OUTCOME" });
  await assert.rejects(sessions.close(randomUUID(), "ACCEPTED", owner), { message: "NOT_FOUND" });
  await assert.rejects(sessions.close(id, "ACCEPTED", "x"), { message: "INVALID_ACTOR" });
}));

test("E26 regeneration stops at five, also under concurrency", { skip }, () => withIntegrationDb(async (base, { user }) => {
  const { sessions } = setup(base);
  const owner = await user();
  const id = await sessions.open({ feature: "PM_PLAN_EXPAND", userId: owner, projectId: null });
  for (let i = 0; i < 5; i++) await sessions.regenerate(id, owner);
  await assert.rejects(sessions.regenerate(id, owner), capReached(1800));

  const raced = await sessions.open({ feature: "PM_PLAN_EXPAND", userId: owner, projectId: null });
  for (let i = 0; i < 4; i++) await sessions.regenerate(raced, owner);
  const results = await Promise.allSettled([sessions.regenerate(raced, owner), sessions.regenerate(raced, owner)]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.ok(results.some((r) => r.status === "rejected" && capReached(1800)(r.reason)));
  assert.equal((await base.aiSession.findUniqueOrThrow({ where: { id: raced } })).regenerateCount, 5);
}));

test("E37 concurrent opens overshoot the open cap by at most one", { skip }, () => withIntegrationDb(async (base, { user }) => {
  const { sessions } = setup(base);
  const owner = await user();
  await sessions.open({ feature: "DEV_STANDUP", userId: owner, projectId: null });
  await sessions.open({ feature: "DEV_STANDUP", userId: owner, projectId: null });
  await Promise.allSettled([sessions.open({ feature: "DEV_STANDUP", userId: owner, projectId: null }), sessions.open({ feature: "DEV_STANDUP", userId: owner, projectId: null })]);
  const open = await base.aiSession.count({ where: { userId: owner, outcome: "OPEN" } });
  assert.ok(open === 3 || open === 4, `open sessions: ${open}`);
}));
