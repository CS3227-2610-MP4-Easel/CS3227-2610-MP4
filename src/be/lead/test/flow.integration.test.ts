import assert from "node:assert/strict";
import { test } from "node:test";
import { createLeadFlow } from "../src/flow.js";

const P = "00000000-0000-4000-8000-000000000001";
const U = "00000000-0000-4000-8000-000000000002";
const T = "00000000-0000-4000-8000-000000000003";
const SUGGESTION = "00000000-0000-4000-8000-000000000004";
const facts = {
  asOf: "2026-11-09T00:00:00.000Z", pointsTotal: 1, pointsDone: 0, pointsRemaining: 1,
  unestimatedTasks: 0, velocity: [], avgVelocity: null, projectedCompletionDate: null,
  checkpoints: [], overload: [{ userId: U, displayName: "U", openPoints: 1, avgCompletedPerSprint: null, projects: [{ projectId: P, name: "P", openPoints: 1 }] }],
};
const output = { explanation: "Move the task", suggestions: [{ id: SUGGESTION, type: "REASSIGN_TASK" as const, taskId: T, assigneeId: U, rationale: "Balance work" }] };

function transactionFixture() {
  const state = {
    digests: [] as any[],
    proposals: [] as any[],
    sessions: [{ id: "s", projectId: P, userId: U, feature: "LEAD_DIGEST", env: "test", outcome: "OPEN" } as any],
  };
  const clone = () => structuredClone(state);
  const txFor = (local: typeof state) => ({
    projectDigest: {
      create: async ({ data }: any) => { const row = { id: `d${local.digests.length + 1}`, ...data }; local.digests.push(row); return row; },
      update: async ({ where, data }: any) => { const row = local.digests.find((candidate) => candidate.id === where.id); Object.assign(row, data); return row; },
    },
    aiProposal: {
      create: async ({ data }: any) => { const row = { id: `p${local.proposals.length + 1}`, ...data }; local.proposals.push(row); return row; },
    },
    aiSession: {
      updateMany: async ({ where, data }: any) => {
        const row = local.sessions.find((candidate) => candidate.id === where.id && candidate.outcome === where.outcome);
        if (!row) return { count: 0 };
        Object.assign(row, data); return { count: 1 };
      },
    },
  });
  const db = {
    projectDigest: { findFirst: async () => null },
    task: { findMany: async () => [{ id: T }] },
    epic: { findMany: async () => [] },
    projectMember: { findMany: async () => [{ userId: U }] },
    $transaction: async (callback: (tx: any) => Promise<unknown>) => {
      const local = clone();
      const result = await callback(txFor(local));
      state.digests.splice(0, state.digests.length, ...local.digests);
      state.proposals.splice(0, state.proposals.length, ...local.proposals);
      state.sessions.splice(0, state.sessions.length, ...local.sessions);
      return result;
    },
  };
  return { state, db };
}

function binding(sessionId: string, closeInTransaction: (tx: any, input: any) => Promise<void>) {
  return {
    gateway: { run: async () => ({ ok: true, value: output, callId: U, flagged: false, truncated: false, cacheHit: false, promptTokens: 0, completionTokens: 0, costMicroUsd: 0 }) },
    sessions: { open: async () => sessionId, close: async () => { throw new Error("public close must not be used"); } },
    sessionCloser: { closeInTransaction },
  };
}

test("proposal and session writes roll back with the digest and do not invoke public close", async () => {
  const fixture = transactionFixture();
  let publicCloseCalls = 0;
  const flow = createLeadFlow({
    db: fixture.db,
    facts: { target: async () => facts, caller: async () => facts },
    proposalService: {
      createReplanInTransaction: async (tx) => {
        await tx.aiProposal.create({ data: { projectId: P, sessionId: "s", createdBy: U } });
        await tx.aiSession.updateMany({ where: { id: "s", outcome: "OPEN" }, data: { outcome: "REJECTED" } });
        throw new Error("proposal insert failed");
      },
    },
    binding: { ...binding("s", async () => {}), sessions: { open: async () => "s", close: async () => { publicCloseCalls++; } } },
    context: { assembleWith: async () => ({ sections: [], provenance: [] }) } as any,
  });

  await assert.rejects(flow.createDigest({ userId: U, role: "DEV_LEAD" }, P), /proposal insert failed/);
  assert.deepEqual(fixture.state.digests, []);
  assert.deepEqual(fixture.state.proposals, []);
  assert.equal(fixture.state.sessions[0].outcome, "OPEN");
  assert.equal(publicCloseCalls, 0);
});

test("degraded digest closes an admitted session through the same transaction", async () => {
  const fixture = transactionFixture();
  const calls: any[] = [];
  const flow = createLeadFlow({
    db: fixture.db,
    facts: { target: async () => facts, caller: async () => facts },
    binding: {
      gateway: { run: async () => ({ ok: false, code: "BLOCKED_INPUT", callId: U, flagged: true }) },
      sessions: { open: async () => "s", close: async () => { throw new Error("public close must not be used"); } },
      sessionCloser: { closeInTransaction: async (tx, input) => { calls.push({ tx, input }); await tx.aiSession.updateMany({ where: { id: input.sessionId, outcome: "OPEN" }, data: { outcome: input.outcome } }); } },
    },
    context: { assembleWith: async () => ({ sections: [], provenance: [] }) } as any,
  });

  const result = await flow.createDigest({ userId: U, role: "DEV_LEAD" }, P);
  assert.equal(result.degraded, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].input.proposalId, null);
  assert.equal(fixture.state.digests.length, 1);
  assert.equal(fixture.state.sessions[0].outcome, "REJECTED");
});

test("E27 barrier race commits one digest/proposal and rolls back the competing transaction", async () => {
  const state = { digests: [] as any[], proposals: [] as any[], sessions: [] as any[] };
  let arrivals = 0;
  let release!: () => void;
  const barrier = new Promise<void>((resolve) => { release = resolve; });
  let winner: string | null = null;
  const makeLocalTx = (local: typeof state) => ({
    projectDigest: {
      create: async ({ data }: any) => { const row = { id: `d${local.digests.length + 1}`, ...data }; local.digests.push(row); return row; },
      update: async ({ where, data }: any) => { Object.assign(local.digests.find((row) => row.id === where.id), data); },
    },
    aiProposal: { create: async ({ data }: any) => { const row = { id: `p${local.proposals.length + 1}`, ...data }; local.proposals.push(row); return row; } },
  });
  const db = {
    projectDigest: { findFirst: async () => null },
    task: { findMany: async () => [{ id: T }] },
    epic: { findMany: async () => [] },
    projectMember: { findMany: async () => [{ userId: U }] },
    $transaction: async (callback: (tx: any) => Promise<unknown>) => {
      const local = structuredClone(state);
      const result = await callback(makeLocalTx(local));
      state.digests.splice(0, state.digests.length, ...local.digests);
      state.proposals.splice(0, state.proposals.length, ...local.proposals);
      return result;
    },
  };
  const proposalService = {
    createReplanInTransaction: async (tx: any, input: any) => {
      arrivals++;
      if (arrivals === 2) release();
      await barrier;
      if (winner) throw new Error("CONFLICT_STATE");
      winner = input.sessionId;
      return { proposalId: (await tx.aiProposal.create({ data: { projectId: P, sessionId: input.sessionId, createdBy: U } })).id, supersededProposalIds: [] };
    },
  };
  const makeFlow = (sessionId: string) => createLeadFlow({
    db,
    facts: { target: async () => facts, caller: async () => facts },
    proposalService,
    binding: {
      ...binding(sessionId, async () => {}),
      sessions: { open: async () => { state.sessions.push({ id: sessionId, projectId: P, userId: U, feature: "LEAD_DIGEST", env: "test", outcome: "OPEN" }); return sessionId; }, close: async () => { throw new Error("public close must not be used"); } },
    },
    context: { assembleWith: async () => ({ sections: [], provenance: [] }) } as any,
  });

  const [first, second] = await Promise.allSettled([
    makeFlow("s1").createDigest({ userId: U, role: "DEV_LEAD" }, P),
    makeFlow("s2").createDigest({ userId: U, role: "DEV_LEAD" }, P),
  ]);
  assert.equal([first, second].filter((result) => result.status === "fulfilled").length, 1);
  assert.equal([first, second].filter((result) => result.status === "rejected" && result.reason?.message === "CONFLICT_STATE").length, 1);
  assert.equal(state.digests.length, 1);
  assert.equal(state.proposals.length, 1);
  assert.equal(state.sessions.length, 2);
  assert.deepEqual(state.sessions.map((session) => session.outcome), ["OPEN", "OPEN"]);
  assert.equal(state.proposals[0].sessionId, winner);
});
