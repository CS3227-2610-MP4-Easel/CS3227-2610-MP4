import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { incrementRateCounter } from "@agile/db";
import { createHit } from "../src/index.js";

const url = process.env.W1_INTEGRATION_DATABASE_URL;

test("E8 E35 hit over Postgres: 21 concurrent calls allow 20, the 21st gets Retry-After within the window", { skip: !url }, async () => {
  const base = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  const key = `test:${randomUUID()}`;
  try {
    const hit = createHit((k, windowSeconds) => incrementRateCounter(base, k, windowSeconds));
    const results = await Promise.all(Array.from({ length: 21 }, () => hit(key, 60, 20)));
    assert.equal(results.filter((r) => r.allowed).length, 20);
    const [rejected] = results.filter((r) => !r.allowed);
    assert.ok(Number.isInteger(rejected.retryAfterSeconds) && rejected.retryAfterSeconds >= 1 && rejected.retryAfterSeconds <= 60);
  } finally { await base.rateCounter.deleteMany({ where: { key } }); await base.$disconnect(); }
});
