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

test("latest digest is caller-authorized and ordered by facts asOf, then createdAt, then id", async () => {
  const calls: unknown[] = [];
  const rows = [
    { id: "a", projectId: P, facts: { asOf: "2026-11-08T00:00:00.000Z" }, createdAt: new Date("2026-11-10T00:00:00.000Z") },
    { id: "b", projectId: P, facts: { asOf: "2026-11-09T00:00:00.000Z" }, createdAt: new Date("2026-11-09T00:00:00.000Z") },
  ];
  const flow = createLeadFlow({ db: { projectDigest: { findMany: async (args: unknown) => { calls.push(args); return rows; }, findFirst: async () => null } }, facts: { target: async () => facts, caller: async () => facts }, binding: { gateway: { run: async () => { throw new Error("unused"); } }, sessions: { open: async () => "s", close: async () => {} } }, requireMember: async () => {} });
  assert.equal((await flow.latestDigest({ userId: U, role: "DEV_LEAD" }, P)).id, "b");
  assert.deepEqual(calls, [{ where: { projectId: P }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] }]);
});

test("foreign and conflicting suggestion references degrade without inserting a proposal", async () => {
  const task = "00000000-0000-4000-0000-000000000003";
  let proposalCreates = 0;
  const db = {
    projectDigest: { findFirst: async () => null },
    task: { findMany: async () => [] }, epic: { findMany: async () => [] }, projectMember: { findMany: async () => [] },
    $transaction: async (fn: (tx: any) => Promise<unknown>) => fn({ projectDigest: { create: async () => ({ id: "d", createdAt: new Date() }) }, aiProposal: { create: async () => { proposalCreates++; return { id: "p" }; } }, projectDigestUpdate: {} }),
  };
  const flow = createLeadFlow({ db, facts: { target: async () => facts, caller: async () => facts }, binding: { gateway: { run: async () => ({ ok: true, value: { explanation: "x", suggestions: [{ id: "00000000-0000-4000-0000-000000000004", type: "REASSIGN_TASK", taskId: task, assigneeId: U, rationale: "x" }] as const }, callId: U, flagged: false, truncated: false, cacheHit: false, promptTokens: 0, completionTokens: 0, costMicroUsd: 0 }) }, sessions: { open: async () => "s", close: async () => {} } }, context: { assembleWith: async () => ({ sections: [], provenance: [] }) } as any });
  const result = await flow.createDigest({ userId: U, role: "DEV_LEAD" }, P);
  assert.equal(result.degraded, true); assert.equal(proposalCreates, 0);
});

test("duplicate target suggestions are rejected as one degraded result", async () => {
  const task = "00000000-0000-4000-0000-000000000003"; let proposalCreates = 0;
  const db = { projectDigest: { findFirst: async () => null }, task: { findMany: async () => [{ id: task }] }, epic: { findMany: async () => [] }, projectMember: { findMany: async () => [{ userId: U }] }, $transaction: async (fn: (tx: any) => Promise<unknown>) => fn({ projectDigest: { create: async () => ({ id: "d", createdAt: new Date() }) }, aiProposal: { create: async () => { proposalCreates++; return { id: "p" }; } } }) };
  const suggestion = (id: string, rationale: string) => ({ id, type: "REASSIGN_TASK", taskId: task, assigneeId: U, rationale });
  const flow = createLeadFlow({ db, facts: { target: async () => ({ ...facts, overload: [{ userId: U, displayName: "U", openPoints: 1, avgCompletedPerSprint: null, projects: [{ projectId: P, name: "P", openPoints: 1 }] }] }), caller: async () => facts }, binding: { gateway: { run: async () => ({ ok: true, value: { explanation: "x", suggestions: [suggestion("00000000-0000-4000-0000-000000000004", "a"), suggestion("00000000-0000-4000-0000-000000000005", "b")] }, callId: U, flagged: false, truncated: false, cacheHit: false, promptTokens: 0, completionTokens: 0, costMicroUsd: 0 }) }, sessions: { open: async () => "s", close: async () => {} } }, context: { assembleWith: async () => ({ sections: [], provenance: [] }) } as any });
  assert.equal((await flow.createDigest({ userId: U, role: "DEV_LEAD" }, P)).degraded, true); assert.equal(proposalCreates, 0);
});

test("latest digest refuses a caller who is not a target member", async () => {
  const flow = createLeadFlow({ db: { projectMember: { findFirst: async () => null }, projectDigest: { findMany: async () => [] } }, facts: { target: async () => facts, caller: async () => facts }, binding: { gateway: { run: async () => { throw new Error("unused"); } }, sessions: { open: async () => "s", close: async () => {} } } });
  await assert.rejects(flow.latestDigest({ userId: U, role: "DEV_LEAD" }, P), { message: "NOT_MEMBER" });
});

test("persistence failure still rejects the admitted session", async () => {
  let closed: string[] = [];
  const flow = createLeadFlow({ db: { projectDigest: { findFirst: async () => null }, $transaction: async () => { throw new Error("write failed"); } }, facts: { target: async () => facts, caller: async () => facts }, binding: { gateway: { run: async () => ({ ok: true, value: { explanation: "ok", suggestions: [] }, callId: U, flagged: false, truncated: false, cacheHit: false, promptTokens: 0, completionTokens: 0, costMicroUsd: 0 }) }, sessions: { open: async () => "s", close: async (_id, outcome) => { closed.push(outcome); } } }, context: { assembleWith: async () => ({ sections: [], provenance: [] }) } as any });
  await assert.rejects(flow.createDigest({ userId: U, role: "DEV_LEAD" }, P), /write failed/);
  assert.deepEqual(closed, ["REJECTED"]);
});
