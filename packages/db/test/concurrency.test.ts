import assert from "node:assert/strict";
import { test } from "node:test";
import { buildAtomicVersionUpdate } from "../src/transactions.js";

test("N5/E8/E17 atomic update includes id and expected version", () => {
  assert.deepEqual(buildAtomicVersionUpdate("task-1", 3), { where: { id: "task-1", version: 3 }, data: { version: { increment: 1 } } });
});
