import assert from "node:assert/strict";
import { test } from "node:test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { createDbClient, inCoreTransaction, inMutationTransaction, isInTransaction } from "../src/index.js";

const url = process.env.W1_INTEGRATION_DATABASE_URL;
const fakeTransaction = { $transaction: async <R>(callback: (tx: unknown) => Promise<R>) => callback({}) };

test("E5 marker set only inside the transaction helpers' callbacks", async () => {
  assert.equal(isInTransaction(), false);
  const seen: boolean[] = [];
  await inCoreTransaction(fakeTransaction, async () => { seen.push(isInTransaction()); });
  await inMutationTransaction(fakeTransaction, async () => { seen.push(isInTransaction()); }, async () => { seen.push(isInTransaction()); }, async () => {
    // Work scheduled from inside the callback keeps the marker, as async context does.
    await new Promise((resolve) => setTimeout(resolve, 1));
    seen.push(isInTransaction());
  });
  assert.deepEqual(seen, [true, true, true, true]);
  assert.equal(isInTransaction(), false);
});

test("E5 marker set inside the filtered client's callback $transaction only", { skip: !url }, async () => {
  const base = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  const db = createDbClient(base);
  try {
    let inside = false;
    await db.$transaction(async () => { inside = isInTransaction(); });
    assert.equal(inside, true);
    assert.equal(isInTransaction(), false);
    // The array form runs no callback, so nothing is marked.
    await db.$transaction([]);
    assert.equal(isInTransaction(), false);
  } finally {
    await base.$disconnect();
  }
});
