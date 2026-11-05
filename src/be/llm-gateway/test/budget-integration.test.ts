import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import type { PrismaClient } from "@prisma/client";
import { checkBudget } from "../src/index.js";
import { fakeClock, integrationUrl, withIntegrationDb } from "./fakes.js";

const skip = !integrationUrl;
// A day no other test writes calls on, and a state key of its own, so parallel test files cannot interfere.
const DAY = "2031-03-03";

const call = (userId: string, cost: number, createdAt: string, overrides: Record<string, unknown> = {}) => ({
  userId, role: "DEVELOPER" as const, env: "test", feature: "DEV_STANDUP" as const, model: "llama3.1:8b", promptVersion: "000000000000", status: "OK" as const,
  attempts: 1, estimatedPromptTokens: 0, sectionTokens: {}, prefixHash: "p", inputHash: "i", flagged: false, truncated: false, experiment: {},
  costMicrousd: BigInt(cost), createdAt: new Date(createdAt), ...overrides,
});
/** Counts sum queries, so the test can show a block in force answers without summing. */
const counting = (base: PrismaClient) => {
  let sums = 0;
  const db = { llmCall: { aggregate: (args: Parameters<PrismaClient["llmCall"]["aggregate"]>[0]) => { sums++; return base.llmCall.aggregate(args); } }, llmGatewayState: base.llmGatewayState } as unknown as PrismaClient;
  return { db, sums: () => sums };
};

test("E10 the budget block decays: 15 minutes or UTC midnight, then a re-check", { skip }, () => withIntegrationDb(async (base, { user }) => {
  const stateKey = `budget-test-${randomUUID()}`;
  try {
    const userId = await user();
    await base.llmCall.create({ data: call(userId, 20_000_000, `${DAY}T09:00:00.000Z`) });
    const clock = fakeClock(`${DAY}T10:00:00.000Z`);
    const { db, sums } = counting(base);
    const check = () => checkBudget({ db, settings: { tier: "test" }, clock, stateKey });

    assert.deepEqual(await check(), { ok: false, retryAfterSeconds: 900 });
    assert.equal(sums(), 1);
    clock.set(`${DAY}T10:05:00.000Z`);
    assert.deepEqual(await check(), { ok: false, retryAfterSeconds: 600 });
    assert.equal(sums(), 1, "a block in force answers without summing");
    clock.set(`${DAY}T10:15:00.000Z`);
    assert.deepEqual(await check(), { ok: false, retryAfterSeconds: 900 }, "the probe re-sums and blocks again");
    assert.equal(sums(), 2);
    clock.set(`${DAY}T23:55:00.000Z`);
    assert.deepEqual(await check(), { ok: false, retryAfterSeconds: 300 }, "never past UTC midnight");
    clock.set("2031-03-04T00:00:01.000Z");
    assert.deepEqual(await check(), { ok: true }, "the new UTC day's sum starts again");
  } finally {
    await base.llmGatewayState.deleteMany({ where: { key: stateKey } });
  }
}));

test("E47 in-flight reservations and failed calls count; other tiers and earlier days do not", { skip }, () => withIntegrationDb(async (base, { user }) => {
  const stateKey = `budget-test-${randomUUID()}`;
  try {
    const userId = await user();
    const day = "2031-04-04";
    const clock = fakeClock(`${day}T12:00:00.000Z`);
    const check = () => checkBudget({ db: base, settings: { tier: "test" }, clock, stateKey });
    await base.llmCall.createMany({ data: [
      call(userId, 19_000_000, `${day}T00:00:00.000Z`, { env: "dev" }),
      call(userId, 19_000_000, "2031-04-03T23:59:59.000Z"),
      call(userId, 19_000_000, "2031-04-05T00:00:00.000Z"),
      call(userId, 7_000_000, `${day}T08:00:00.000Z`, { status: "IN_FLIGHT" }),
      call(userId, 7_000_000, `${day}T09:00:00.000Z`, { status: "IN_FLIGHT" }),
    ] });
    assert.deepEqual(await check(), { ok: true }, "14,000,000 from this tier today; other tiers, yesterday and tomorrow excluded");
    await base.llmCall.create({ data: call(userId, 5_999_999, `${day}T09:30:00.000Z`, { status: "TIMEOUT" }) });
    assert.deepEqual(await check(), { ok: true }, "one µ$ under the cap passes");
    await base.llmCall.create({ data: call(userId, 1, `${day}T10:00:00.000Z`, { status: "TIMEOUT" }) });
    assert.deepEqual(await check(), { ok: false, retryAfterSeconds: 900 }, "the TIMEOUT row keeps its reservation");
  } finally {
    await base.llmGatewayState.deleteMany({ where: { key: stateKey } });
  }
}));
