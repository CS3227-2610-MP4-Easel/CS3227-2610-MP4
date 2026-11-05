import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { incrementRateCounter } from "../src/index.js";

const url = process.env.W1_INTEGRATION_DATABASE_URL;

async function withClient(run: (base: PrismaClient, key: string) => Promise<void>) {
  const base = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  const key = `test:${randomUUID()}`;
  try { await run(base, key); } finally { await base.rateCounter.deleteMany({ where: { key } }); await base.$disconnect(); }
}

test("E8 21 concurrent hits admit exactly 20", { skip: !url }, () => withClient(async (base, key) => {
  const results = await Promise.all(Array.from({ length: 21 }, () => incrementRateCounter(base, key, 60)));
  const counts = results.map((r) => r.count).sort((a, b) => a - b);
  assert.deepEqual(counts, Array.from({ length: 21 }, (_, i) => i + 1));
  const rejected = results.filter((r) => r.count > 20);
  assert.equal(rejected.length, 1);
  assert.ok(rejected[0].remainingSeconds >= 1 && rejected[0].remainingSeconds <= 61);
}));

test("E10 elapsed window resets to 1", { skip: !url }, () => withClient(async (base, key) => {
  await incrementRateCounter(base, key, 60);
  await incrementRateCounter(base, key, 60);
  await base.$executeRaw`UPDATE rate_counters SET window_start = window_start - make_interval(secs => 60) WHERE key = ${key}`;
  const result = await incrementRateCounter(base, key, 60);
  assert.equal(result.count, 1);
}));

test("E35 count keeps rising past the limit", { skip: !url }, () => withClient(async (base, key) => {
  let last = 0;
  for (let i = 0; i < 25; i += 1) last = (await incrementRateCounter(base, key, 60)).count;
  assert.equal(last, 25);
}));
