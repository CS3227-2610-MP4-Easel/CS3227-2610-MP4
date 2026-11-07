import assert from "node:assert/strict";
import { test } from "node:test";
import { createDerived } from "../src/index.js";

test("E22 progress uses one task snapshot and reports exact zero totals", async () => {
  let calls = 0;
  const derived = createDerived({ task: { findMany: async () => { calls++; return [{ storyPoints: null, status: "DONE" }, { storyPoints: 3, status: "TODO" }, { storyPoints: 5, status: "DONE" }]; } } });
  assert.deepEqual(await derived.progress("p"), { pointsTotal: 8, pointsDone: 5, percent: 62.5, unestimatedTasks: 1 });
  assert.equal(calls, 1);
  assert.deepEqual(await createDerived({ task: { findMany: async () => [{ storyPoints: null, status: "DONE" }] } }).progress("p"), { pointsTotal: 0, pointsDone: 0, percent: 0, unestimatedTasks: 1 });
});

test("velocity accepts only a bounded integer limit", async () => {
  const velocity = createDerived({ sprint: { findMany: async (args) => [args] } }).velocity;
  await assert.rejects(() => velocity("p", 0), { name: "RangeError", message: "INVALID_VELOCITY_LIMIT" });
  await assert.rejects(() => velocity("p", 101), { name: "RangeError", message: "INVALID_VELOCITY_LIMIT" });
  await assert.rejects(() => velocity("p", 1.2), { name: "RangeError", message: "INVALID_VELOCITY_LIMIT" });
  assert.equal((await velocity("p", 1)).length, 1);
});
