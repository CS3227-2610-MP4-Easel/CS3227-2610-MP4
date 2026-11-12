import assert from "node:assert/strict";
import { test } from "node:test";
import { createLeadFlow } from "../src/flow.js";
import { hashFacts } from "../src/hash.js";
const P = "00000000-0000-4000-8000-000000000001"; const U = "00000000-0000-4000-8000-000000000002";
const facts = { asOf: "2026-11-09T00:00:00.000Z", pointsTotal: 0, pointsDone: 0, pointsRemaining: 0, unestimatedTasks: 0, velocity: [], avgVelocity: null, projectedCompletionDate: null, checkpoints: [], overload: [] };
test("digest cache is checked before session or gateway and persistence is the only transaction", async () => {
  const order: string[] = []; let tx = 0;
  const db = { projectDigest: { findFirst: async () => { order.push("cache"); return { id: "d", projectId: P, facts, factsHash: hashFacts(facts), degraded: false, proposalId: null }; } }, $transaction: async () => { tx++; return undefined; } };
  const flow = createLeadFlow({ db, facts: { target: async () => { order.push("facts"); return facts; }, caller: async () => facts }, binding: { gateway: { run: async () => { order.push("gateway"); throw new Error("called"); } }, sessions: { open: async () => { order.push("session"); return "s"; }, close: async () => {} } } });
  const result = await flow.createDigest({ userId: U, role: "DEV_LEAD" }, P);
  assert.equal(result.cached, true); assert.deepEqual(order, ["facts", "cache"]); assert.equal(tx, 0);
});

test("degraded same-hash rows retry while healthy same-hash rows hit cache", async () => {
  let sessions = 0; let calls = 0; let writes = 0;
  const db = { projectDigest: { findFirst: async () => null, }, $transaction: async (fn: (tx: any) => Promise<unknown>) => { writes++; return fn({ projectDigest: { create: async () => ({ id: "d", createdAt: new Date() }) } }); } };
  const flow = createLeadFlow({ db, facts: { target: async () => facts, caller: async () => facts }, binding: { gateway: { run: async () => { calls++; return { ok: false, code: "AI_DISABLED", flagged: false } as any; } }, sessions: { open: async () => { sessions++; return "s"; }, close: async () => {} }, sessionCloser: { closeInTransaction: async () => {} } }, context: { assembleWith: async () => ({ sections: [], provenance: [] }) } as any });
  const degraded = await flow.createDigest({ userId: U, role: "DEV_LEAD" }, P);
  assert.equal(degraded.degraded, true); assert.equal(sessions, 1); assert.equal(calls, 1); assert.equal(writes, 1);
  const healthyDb = { projectDigest: { findFirst: async () => ({ id: "h", projectId: P, facts, factsHash: hashFacts(facts), degraded: false, proposalId: null }) }, $transaction: async () => { throw new Error("cache miss"); } };
  const healthy = createLeadFlow({ db: healthyDb, facts: { target: async () => facts, caller: async () => facts }, binding: { gateway: { run: async () => { throw new Error("gateway"); } }, sessions: { open: async () => { throw new Error("session"); }, close: async () => {} } } });
  assert.equal((await healthy.createDigest({ userId: U, role: "DEV_LEAD" }, P)).cached, true);
});

test("createDigest only caches the latest project digest", async () => {
  let gatewayCalls = 0;
  let writes = 0;
  const oldHealthy = { id: "old", projectId: P, facts, factsHash: hashFacts(facts), degraded: false, proposalId: null };
  const latestChanged = { id: "latest", projectId: P, facts, factsHash: "different", degraded: false, proposalId: null };
  const db = {
    projectDigest: { findFirst: async () => latestChanged },
    $transaction: async (fn: (tx: any) => Promise<unknown>) => { writes++; return fn({ projectDigest: { create: async () => ({ id: "new", createdAt: new Date() }) } }); },
  };
  const flow = createLeadFlow({ db, facts: { target: async () => facts, caller: async () => facts }, binding: {
    gateway: { run: async () => { gatewayCalls++; return { ok: false, code: "AI_DISABLED", flagged: false } as any; } },
    sessions: { open: async () => "s", close: async () => {} },
    sessionCloser: { closeInTransaction: async () => {} },
  }, context: { assembleWith: async () => ({ sections: [], provenance: [] }) } as any });
  const result = await flow.createDigest({ userId: U, role: "DEV_LEAD" }, P);
  assert.equal(result.degraded, true);
  assert.equal(gatewayCalls, 1);
  assert.equal(writes, 1);
  assert.notEqual(oldHealthy.id, result.id);
});

test("createDigest passes its captured facts snapshot to context assembly", async () => {
  let captured: unknown;
  const db = { projectDigest: { findFirst: async () => null }, $transaction: async () => ({ digest: { id: "d", createdAt: new Date() }, proposalId: null }) };
  const flow = createLeadFlow({ db, facts: { target: async () => facts, caller: async () => facts }, binding: {
    gateway: { run: async () => ({ ok: false, code: "AI_DISABLED", flagged: false } as any) },
    sessions: { open: async () => "s", close: async () => {} },
  }, sessionCloser: { closeInTransaction: async () => {} }, context: { assembleWith: async (...args: any[]) => { captured = args[4]; return { sections: [], provenance: [] }; } } as any });
  await flow.createDigest({ userId: U, role: "DEV_LEAD" }, P);
  assert.deepEqual(captured, { facts });
});

test("cached and latest digests expose only public DigestSchema fields", async () => {
  const persisted = { id: "d", projectId: P, facts, factsHash: hashFacts(facts), sessionId: "private-session", explanation: null, degraded: false, flagged: false, proposalId: null, createdAt: new Date("2026-11-09T00:00:00.000Z") };
  const cachedFlow = createLeadFlow({ db: { projectDigest: { findFirst: async () => persisted } }, facts: { target: async () => facts, caller: async () => facts }, binding: { gateway: { run: async () => { throw new Error("unused"); } }, sessions: { open: async () => "unused", close: async () => {} } } });
  const cached = await cachedFlow.createDigest({ userId: U, role: "DEV_LEAD" }, P);
  const latestFlow = createLeadFlow({ db: { projectMember: { findFirst: async () => ({ userId: U }) }, projectDigest: { findFirst: async () => persisted } }, facts: { target: async () => facts, caller: async () => facts }, binding: { gateway: { run: async () => { throw new Error("unused"); } }, sessions: { open: async () => "unused", close: async () => {} } }, requireMember: async () => {} });
  const latest = await latestFlow.latestDigest({ userId: U, role: "DEV_LEAD" }, P);
  assert.deepEqual(Object.keys(cached).sort(), ["cached", "createdAt", "degraded", "explanation", "facts", "flagged", "id", "projectId", "proposalId"]);
  assert.deepEqual(Object.keys(latest ?? {}).sort(), ["cached", "createdAt", "degraded", "explanation", "facts", "flagged", "id", "projectId", "proposalId"]);
});

test("flagged invalid output is persisted as flagged degraded with its admitted session", async () => {
  let persisted: any; let closed = "";
  const db = { projectDigest: { findFirst: async () => null }, task: { findMany: async () => [] }, $transaction: async (fn: (tx: any) => Promise<unknown>) => fn({ projectDigest: { create: async ({ data }: any) => { persisted = data; return { id: "d", createdAt: new Date() }; } } }) };
  const flow = createLeadFlow({ db, facts: { target: async () => facts, caller: async () => facts }, binding: { gateway: { run: async () => ({ ok: true, flagged: true, value: { explanation: "bad foreign suggestion", suggestions: [{ id: "00000000-0000-4000-0000-000000000003", type: "REASSIGN_TASK", taskId: "00000000-0000-4000-0000-000000000004", assigneeId: U, rationale: "x" }] }, callId: U, truncated: false, cacheHit: false, promptTokens: 0, completionTokens: 0, costMicroUsd: 0 }) }, sessions: { open: async () => "admitted", close: async () => {} }, sessionCloser: { closeInTransaction: async () => { closed = "REJECTED"; } } }, context: { assembleWith: async () => ({ sections: [], provenance: [] }) } as any });
  const result = await flow.createDigest({ userId: U, role: "DEV_LEAD" }, P);
  assert.equal(result.degraded, true); assert.equal(persisted.flagged, true); assert.equal(persisted.sessionId, "admitted"); assert.equal(closed, "REJECTED");
});

test("disabled AI persists null sessionId while admitted failures retain it", async () => {
  const run = async (gatewayResult: any) => {
    let persisted: any; let closed = "";
    const db = { projectDigest: { findFirst: async () => null }, $transaction: async (fn: (tx: any) => Promise<unknown>) => fn({ projectDigest: { create: async ({ data }: any) => { persisted = data; return { id: "d", createdAt: new Date() }; } } }) };
    const flow = createLeadFlow({ db, facts: { target: async () => facts, caller: async () => facts }, binding: { gateway: { run: async () => gatewayResult }, sessions: { open: async () => "opened", close: async () => {} }, sessionCloser: { closeInTransaction: async () => { closed = "REJECTED"; } } }, context: { assembleWith: async () => ({ sections: [], provenance: [] }) } as any });
    await flow.createDigest({ userId: U, role: "DEV_LEAD" }, P); return { persisted, closed };
  };
  assert.deepEqual(await run({ ok: false, code: "AI_DISABLED", flagged: true }), { persisted: { projectId: P, facts, factsAsOf: new Date(facts.asOf), factsHash: hashFacts(facts), explanation: null, degraded: true, flagged: true, sessionId: null }, closed: "REJECTED" });
  const admitted = await run({ ok: false, code: "BLOCKED_INPUT", callId: U, flagged: true });
  assert.equal(admitted.persisted.sessionId, "opened"); assert.equal(admitted.persisted.flagged, true); assert.equal(admitted.closed, "REJECTED");
});

test("latest digest is caller-authorized and ordered by facts asOf, then createdAt, then id", async () => {
  const calls: unknown[] = [];
  const rows = [
    { id: "a", projectId: P, facts: { asOf: "2026-11-08T00:00:00.000Z" }, factsAsOf: new Date("2026-11-08T00:00:00.000Z"), createdAt: new Date("2026-11-10T00:00:00.000Z") },
    { id: "b", projectId: P, facts: { asOf: "2026-11-09T00:00:00.000Z" }, factsAsOf: new Date("2026-11-09T00:00:00.000Z"), createdAt: new Date("2026-11-09T00:00:00.000Z") },
  ];
  const flow = createLeadFlow({ db: { projectDigest: { findFirst: async (args: unknown) => { calls.push(args); return rows[1]; } } }, facts: { target: async () => facts, caller: async () => facts }, binding: { gateway: { run: async () => { throw new Error("unused"); } }, sessions: { open: async () => "s", close: async () => {} } }, requireMember: async () => {} });
  assert.equal((await flow.latestDigest({ userId: U, role: "DEV_LEAD" }, P)).id, "b");
  assert.deepEqual(calls, [{ where: { projectId: P }, orderBy: [{ factsAsOf: "desc" }, { createdAt: "desc" }, { id: "desc" }], take: 1 }]);
});

test("latest digest uses the bounded factsAsOf query rather than a full-history scan", async () => {
  const rows = Array.from({ length: 101 }, (_, index) => ({
    id: `d${index}`,
    projectId: P,
    facts: { asOf: "2026-11-08T00:00:00.000Z" },
    createdAt: new Date(Date.UTC(2026, 10, 10, 0, 0, 101 - index)),
  }));
  rows[100] = { ...rows[100], id: "latest", facts: { asOf: "2026-11-09T00:00:00.000Z" }, createdAt: new Date("2026-11-01T00:00:00.000Z") };
  let query: any;
  const flow = createLeadFlow({ db: { projectDigest: { findFirst: async (args: any) => { query = args; return rows[100]; } } }, facts: { target: async () => facts, caller: async () => facts }, binding: { gateway: { run: async () => { throw new Error("unused"); } }, sessions: { open: async () => "s", close: async () => {} } }, requireMember: async () => {} });
  assert.equal((await flow.latestDigest({ userId: U, role: "DEV_LEAD" }, P)).id, "latest");
  assert.deepEqual(query, { where: { projectId: P }, orderBy: [{ factsAsOf: "desc" }, { createdAt: "desc" }, { id: "desc" }], take: 1 });
});

test("gateway exception after session admission persists that session on the rejected degraded digest", async () => {
  let persisted: any;
  let closed = "";
  const db = { projectDigest: { findFirst: async () => null }, $transaction: async (fn: (tx: any) => Promise<unknown>) => fn({ projectDigest: { create: async ({ data }: any) => { persisted = data; return { id: "d", createdAt: new Date() }; } } }) };
  const flow = createLeadFlow({ db, facts: { target: async () => facts, caller: async () => facts }, binding: { gateway: { run: async () => { throw new Error("gateway failed"); } }, sessions: { open: async () => "admitted", close: async () => {} }, sessionCloser: { closeInTransaction: async () => { closed = "REJECTED"; } } }, context: { assembleWith: async () => ({ sections: [], provenance: [] }) } as any });
  const result = await flow.createDigest({ userId: U, role: "DEV_LEAD" }, P);
  assert.equal(result.degraded, true);
  assert.equal(persisted.sessionId, "admitted");
  assert.equal(closed, "REJECTED");
});

test("createDigest uses target-only facts and accepts a valid proposal", async () => {
  const targetFacts = { ...facts, checkpoints: [], overload: [{ userId: U, displayName: "U", openPoints: 1, avgCompletedPerSprint: null, projects: [{ projectId: P, name: "P", openPoints: 1 }] }] };
  const task = "00000000-0000-4000-0000-000000000003"; let persisted: any; let proposalId = ""; let closed = "";
  const db = { projectDigest: { findFirst: async () => null }, task: { findMany: async () => [{ id: task }] }, projectMember: { findMany: async () => [{ userId: U }] }, $transaction: async (fn: (tx: any) => Promise<unknown>) => fn({ projectDigest: { create: async ({ data }: any) => { persisted = data; return { id: "d", createdAt: new Date() }; }, update: async () => {} } }) };
  const flow = createLeadFlow({ db, facts: { target: async () => targetFacts, caller: async () => ({ ...targetFacts, pointsTotal: 999 }) }, proposalService: { createReplanInTransaction: async () => ({ proposalId, supersededProposalIds: [] }) }, binding: { gateway: { run: async () => ({ ok: true, value: { explanation: "Move the task", suggestions: [{ id: "00000000-0000-4000-0000-000000000004", type: "REASSIGN_TASK", taskId: task, assigneeId: U, rationale: "Assign it" }] }, callId: U, flagged: false, truncated: false, cacheHit: false, promptTokens: 0, completionTokens: 0, costMicroUsd: 0 }) }, sessions: { open: async () => "s", close: async (_id, outcome) => { closed = outcome; } } }, context: { assembleWith: async () => ({ sections: [], provenance: [] }) } as any });
  const result = await flow.createDigest({ userId: U, role: "DEV_LEAD" }, P);
  assert.equal(result.degraded, false); assert.equal(result.proposalId, proposalId); assert.equal(persisted.facts.pointsTotal, targetFacts.pointsTotal); assert.equal(persisted.factsHash, hashFacts(targetFacts)); assert.equal(closed, "");
});

test("foreign and conflicting suggestion references degrade without inserting a proposal", async () => {
  const task = "00000000-0000-4000-0000-000000000003";
  let proposalCreates = 0;
  const db = {
    projectDigest: { findFirst: async () => null },
    task: { findMany: async () => [] }, epic: { findMany: async () => [] }, projectMember: { findMany: async () => [] },
    $transaction: async (fn: (tx: any) => Promise<unknown>) => fn({ projectDigest: { create: async () => ({ id: "d", createdAt: new Date() }) }, aiProposal: { create: async () => { proposalCreates++; return { id: "p" }; } }, projectDigestUpdate: {} }),
  };
  const flow = createLeadFlow({ db, facts: { target: async () => facts, caller: async () => facts }, binding: { gateway: { run: async () => ({ ok: true, value: { explanation: "x", suggestions: [{ id: "00000000-0000-0000-0000-000000000004", type: "REASSIGN_TASK", taskId: task, assigneeId: U, rationale: "x" }] as const }, callId: U, flagged: false, truncated: false, cacheHit: false, promptTokens: 0, completionTokens: 0, costMicroUsd: 0 }) }, sessions: { open: async () => "s", close: async () => {} }, sessionCloser: { closeInTransaction: async () => {} } }, context: { assembleWith: async () => ({ sections: [], provenance: [] }) } as any });
  const result = await flow.createDigest({ userId: U, role: "DEV_LEAD" }, P);
  assert.equal(result.degraded, true); assert.equal(proposalCreates, 0);
});

test("duplicate target suggestions are rejected as one degraded result", async () => {
  const task = "00000000-0000-4000-0000-000000000003"; let proposalCreates = 0;
  const db = { projectDigest: { findFirst: async () => null }, task: { findMany: async () => [{ id: task }] }, epic: { findMany: async () => [] }, projectMember: { findMany: async () => [{ userId: U }] }, $transaction: async (fn: (tx: any) => Promise<unknown>) => fn({ projectDigest: { create: async () => ({ id: "d", createdAt: new Date() }) }, aiProposal: { create: async () => { proposalCreates++; return { id: "p" }; } } }) };
  const suggestion = (id: string, rationale: string) => ({ id, type: "REASSIGN_TASK", taskId: task, assigneeId: U, rationale });
  const flow = createLeadFlow({ db, facts: { target: async () => ({ ...facts, overload: [{ userId: U, displayName: "U", openPoints: 1, avgCompletedPerSprint: null, projects: [{ projectId: P, name: "P", openPoints: 1 }] }] }), caller: async () => facts }, binding: { gateway: { run: async () => ({ ok: true, value: { explanation: "x", suggestions: [suggestion("00000000-0000-4000-0000-000000000004", "a"), suggestion("00000000-0000-4000-0000-000000000005", "b")] }, callId: U, flagged: false, truncated: false, cacheHit: false, promptTokens: 0, completionTokens: 0, costMicroUsd: 0 }) }, sessions: { open: async () => "s", close: async () => {} }, sessionCloser: { closeInTransaction: async () => {} } }, context: { assembleWith: async () => ({ sections: [], provenance: [] }) } as any });
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
  assert.deepEqual(closed, []);
});

test("session-cap refusal is surfaced as AI_BUSY instead of a degraded success", async () => {
  const error = Object.assign(new Error("RATE_LIMITED"), { name: "SessionCapReached", retryAfterSeconds: 37 });
  const flow = createLeadFlow({ db: { projectDigest: { findFirst: async () => null } }, facts: { target: async () => facts, caller: async () => facts }, binding: { gateway: { run: async () => { throw new Error("unused"); } }, sessions: { open: async () => { throw error; }, close: async () => {} } } });
  await assert.rejects(flow.createDigest({ userId: U, role: "DEV_LEAD" }, P), (actual: any) => actual.code === "AI_BUSY" && actual.retryAfterSeconds === 37);
});
