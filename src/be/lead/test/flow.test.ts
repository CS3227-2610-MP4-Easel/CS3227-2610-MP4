import assert from "node:assert/strict";
import { test } from "node:test";
import { createLeadFlow } from "../src/flow.js";
const P = "00000000-0000-4000-8000-000000000001"; const U = "00000000-0000-4000-8000-000000000002";
const facts = { asOf: "2026-11-09T00:00:00.000Z", pointsTotal: 0, pointsDone: 0, pointsRemaining: 0, unestimatedTasks: 0, velocity: [], avgVelocity: null, projectedCompletionDate: null, checkpoints: [], overload: [] };
test("digest cache is checked before session or gateway and persistence is the only transaction", async () => {
  const order: string[] = []; let tx = 0;
  const db = { projectDigest: { findFirst: async () => { order.push("cache"); return { id: "d", projectId: P, facts, factsHash: "x", degraded: false, proposalId: null }; } }, $transaction: async () => { tx++; return undefined; } };
  const flow = createLeadFlow({ db, facts: { target: async () => { order.push("facts"); return facts; }, caller: async () => facts }, binding: { gateway: { run: async () => { order.push("gateway"); throw new Error("called"); } }, sessions: { open: async () => { order.push("session"); return "s"; }, close: async () => {} } } });
  const result = await flow.createDigest({ userId: U, role: "DEV_LEAD" }, P);
  assert.equal(result.cached, true); assert.deepEqual(order, ["cache"]); assert.equal(tx, 0);
});
