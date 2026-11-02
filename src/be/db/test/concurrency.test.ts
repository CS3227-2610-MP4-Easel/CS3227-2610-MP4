import assert from "node:assert/strict";
import { test } from "node:test";
import { buildAtomicVersionUpdate, inMutationTransaction } from "../src/transactions.js";

test("N5/E8/E17 atomic update includes id and expected version", () => {
  assert.deepEqual(buildAtomicVersionUpdate("task-1", 3), { where: { id: "task-1", version: 3 }, data: { version: { increment: 1 } } });
});

test("F3/E25 mutation re-check runs after the resource lock in a repeatable-read transaction", async () => {
  const events: string[] = [];
  await inMutationTransaction({
    $transaction: async (callback, options) => { assert.deepEqual(options, { isolationLevel: "RepeatableRead" }); return callback({ id: "tx" }); },
  }, async (tx) => { assert.deepEqual(tx, { id: "tx" }); events.push("lock"); }, async () => { events.push("recheck"); }, async () => { events.push("mutate"); return "ok"; });
  assert.deepEqual(events, ["lock", "recheck", "mutate"]);
});
