import assert from "node:assert/strict";
import { test } from "node:test";
import { createProposalService } from "../src/index.js";

const projectId = "00000000-0000-4000-8000-000000000001";
const ownerId = "00000000-0000-4000-8000-000000000002";
const sessionId = "00000000-0000-4000-8000-000000000003";
const proposalId = "00000000-0000-4000-8000-000000000004";
const firstSuggestionId = "00000000-0000-4000-8000-000000000005";
const secondSuggestionId = "00000000-0000-4000-8000-000000000006";
const checkpointId = "00000000-0000-4000-8000-000000000007";

function fixture() {
  const state: any = {
    project: { id: projectId, status: "ACTIVE", version: 1 },
    session: { id: sessionId, projectId, userId: ownerId, feature: "LEAD_DIGEST", env: "test", outcome: "OPEN", lastActivityAt: new Date("2026-11-13T00:00:00.000Z") },
    proposal: {
      id: proposalId, projectId, kind: "REPLAN", status: "PENDING", version: 1, sessionId, createdBy: ownerId, flagged: false,
      createdAt: new Date("2026-11-13T00:00:00.000Z"), payload: {
        explanation: "Move the checkpoint and preserve the approval order.",
        suggestions: [
          { id: firstSuggestionId, type: "MOVE_CHECKPOINT_DATE", checkpointId, newTargetDate: "2026-12-01", rationale: "Align delivery date" },
          { id: secondSuggestionId, type: "MOVE_CHECKPOINT_DATE", checkpointId, newTargetDate: "2026-12-02", rationale: "Allow one more day" },
        ],
      },
    },
    applies: [] as unknown[],
  };
  const tx: any = {
    project: {
      update: async () => state.project,
      findFirst: async () => state.project,
    },
    aiSession: {
      findFirst: async () => state.session,
      update: async ({ data }: any) => { state.session = { ...state.session, ...data }; return state.session; },
      updateMany: async ({ data }: any) => { state.session = { ...state.session, ...data }; return { count: 1 }; },
    },
    aiProposal: {
      findFirst: async () => state.proposal,
      findMany: async () => [state.proposal],
      count: async () => 1,
      update: async ({ data }: any) => {
        const next = { ...data };
        if (next.version?.increment !== undefined) next.version = state.proposal.version + next.version.increment;
        if (next.payload === undefined) next.payload = state.proposal.payload;
        state.proposal = { ...state.proposal, ...next };
        return state.proposal;
      },
      create: async ({ data }: any) => { state.proposal = { ...data, id: "00000000-0000-4000-8000-000000000008", version: 1, createdAt: new Date() }; return state.proposal; },
    },
    checkpoint: { findFirst: async () => ({ id: checkpointId, projectId }), update: async () => ({}) },
    epic: { findFirst: async () => null, update: async () => ({}) },
    task: { findFirst: async () => null, update: async () => ({}) },
    projectMember: { findFirst: async () => ({ projectId, userId: ownerId }) },
    user: { findFirst: async () => ({ id: ownerId, role: "DEV_LEAD" }) },
    taskEvent: { create: async () => ({}) },
  };
  const db: any = { ...tx, $transaction: async (callback: (transaction: any) => Promise<unknown>) => callback(tx) };
  const closer = {
    closeInTransaction: async (_transaction: unknown, input: { outcome: string }) => { state.session.outcome = input.outcome; },
  };
  const core = {
    applyReplan: async (_transaction: unknown, _project: string, input: any) => { state.applies.push(input.suggestions); },
  };
  return { state, db, closer, core };
}

test("approve passes the requested full suggestions in order and stores immutable applied ids", async () => {
  const f = fixture();
  const service = createProposalService({ db: f.db, core: f.core, sessionCloser: f.closer });
  const result = await service.approve({ proposalId, version: 1, actorId: ownerId, suggestionIds: [secondSuggestionId, firstSuggestionId] });
  assert.deepEqual(result, { proposalId, status: "APPROVED", applied: [secondSuggestionId, firstSuggestionId] });
  assert.deepEqual(f.state.applies, [[f.state.proposal.payload.suggestions[1], f.state.proposal.payload.suggestions[0]]]);
  assert.deepEqual(f.state.proposal.payload.appliedSuggestionIds, [secondSuggestionId, firstSuggestionId]);
  assert.equal(f.state.session.outcome, "ACCEPTED");
});

test("approved replay returns stored ids without applying a new subset", async () => {
  const f = fixture();
  const service = createProposalService({ db: f.db, core: f.core, sessionCloser: f.closer });
  await service.approve({ proposalId, version: 1, actorId: ownerId, suggestionIds: [firstSuggestionId] });
  const replay = await service.approve({ proposalId, version: 999, actorId: ownerId, suggestionIds: [secondSuggestionId] });
  assert.deepEqual(replay, { proposalId, status: "APPROVED", applied: [firstSuggestionId] });
  assert.equal(f.state.applies.length, 1);
});
