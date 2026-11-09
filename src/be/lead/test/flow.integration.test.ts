import assert from "node:assert/strict";
import { test } from "node:test";
import { createLeadFlow } from "../src/flow.js";
const P = "00000000-0000-4000-8000-000000000001"; const U = "00000000-0000-4000-8000-000000000002"; const T = "00000000-0000-4000-8000-000000000003";
const facts = { asOf: "2026-11-09T00:00:00.000Z", pointsTotal: 0, pointsDone: 0, pointsRemaining: 0, unestimatedTasks: 0, velocity: [], avgVelocity: null, projectedCompletionDate: null, checkpoints: [], overload: [{ userId: U, displayName: "U", openPoints: 1, avgCompletedPerSprint: null, projects: [{ projectId: P, name: "P", openPoints: 1 }] }] };
test("transaction rollback removes a digest when proposal insertion fails", async () => {
  const digests: any[] = []; let closed = "";
  const db = { projectDigest: { findFirst: async () => null }, task: { findMany: async () => [{ id: T }] }, epic: { findMany: async () => [] }, projectMember: { findMany: async () => [{ userId: U }] }, $transaction: async (fn: (tx: any) => Promise<unknown>) => { const before = digests.length; try { return await fn({ projectDigest: { create: async ({ data }: any) => { const row = { id: "d", ...data }; digests.push(row); return row; } }, aiProposal: { create: async () => { throw new Error("proposal insert failed"); } } }); } catch (error) { digests.length = before; throw error; } } };
  const flow = createLeadFlow({ db, facts: { target: async () => facts, caller: async () => facts }, binding: { gateway: { run: async () => ({ ok: true, value: { explanation: "ok", suggestions: [{ id: "00000000-0000-4000-8000-000000000004", type: "REASSIGN_TASK", taskId: T, assigneeId: U, rationale: "ok" }] }, callId: U, flagged: false, truncated: false, cacheHit: false, promptTokens: 0, completionTokens: 0, costMicroUsd: 0 }) }, sessions: { open: async () => "s", close: async (_id, outcome) => { closed = outcome; } } }, context: { assembleWith: async () => ({ sections: [], provenance: [] }) } as any });
  await assert.rejects(flow.createDigest({ userId: U, role: "DEV_LEAD" }, P), /proposal insert failed/);
  assert.deepEqual(digests, []); assert.equal(closed, "REJECTED");
});
