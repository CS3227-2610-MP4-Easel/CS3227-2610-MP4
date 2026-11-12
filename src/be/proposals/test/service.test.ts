import assert from "node:assert/strict";
import { test } from "node:test";
import { ProposalError, createProposalService } from "../src/index.js";

const projectId = "00000000-0000-4000-8000-000000000001";
const otherProjectId = "00000000-0000-4000-8000-000000000011";
const ownerId = "00000000-0000-4000-8000-000000000002";
const otherOwnerId = "00000000-0000-4000-8000-000000000012";
const sessionId = "00000000-0000-4000-8000-000000000003";
const proposalId = "00000000-0000-4000-8000-000000000004";
const firstSuggestionId = "00000000-0000-4000-8000-000000000005";
const secondSuggestionId = "00000000-0000-4000-8000-000000000006";
const checkpointId = "00000000-0000-4000-8000-000000000007";

type FixtureOptions = { failCore?: boolean; failCloser?: boolean; members?: string[]; projectStatus?: "ACTIVE" | "ARCHIVED"; session?: Partial<{ userId: string; projectId: string; feature: string; env: string; outcome: string }> };

function fixture(options: FixtureOptions = {}) {
  const state: any = {
    project: { id: projectId, status: options.projectStatus ?? "ACTIVE", version: 1 },
    session: { id: sessionId, projectId, userId: ownerId, feature: "LEAD_DIGEST", env: "test", outcome: "OPEN", lastActivityAt: new Date("2026-11-13T00:00:00.000Z"), ...options.session },
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
  const members = new Set(options.members ?? [ownerId, otherOwnerId]);
  const missing = () => { throw Object.assign(new Error("missing"), { code: "P2025" }); };
  const matches = (where: any, expected: any) => Object.entries(where ?? {}).every(([key, value]) => expected[key] === value);
  const tx: any = {
    project: {
      update: async ({ where }: any) => { if (where.id !== projectId) missing(); return state.project; },
      findFirst: async ({ where }: any) => where.id === projectId ? state.project : null,
    },
    aiSession: {
      findFirst: async ({ where }: any) => matches(where, state.session) ? state.session : null,
      update: async ({ where, data }: any) => { if (where.id !== state.session.id) missing(); state.session = { ...state.session, ...data }; return state.session; },
      updateMany: async ({ where, data }: any) => { if (!matches(where, state.session)) return { count: 0 }; state.session = { ...state.session, ...data }; return { count: 1 }; },
    },
    aiProposal: {
      findFirst: async ({ where }: any) => matches(where, state.proposal) ? state.proposal : null,
      findMany: async () => [state.proposal],
      count: async () => 1,
      update: async ({ where, data }: any) => {
        if (where.id !== state.proposal.id) missing();
        const next = { ...data };
        if (next.version?.increment !== undefined) next.version = state.proposal.version + next.version.increment;
        if (next.payload === undefined) next.payload = state.proposal.payload;
        state.proposal = { ...state.proposal, ...next };
        return state.proposal;
      },
      create: async ({ data }: any) => { state.proposal = { ...data, id: "00000000-0000-4000-8000-000000000008", version: 1, createdAt: new Date() }; return state.proposal; },
    },
    checkpoint: { findFirst: async ({ where }: any) => where.projectId === projectId && where.id === checkpointId ? ({ id: checkpointId, projectId }) : null, update: async () => ({}) },
    epic: { findFirst: async () => null, update: async () => ({}) },
    task: { findFirst: async () => null, update: async () => ({}) },
    projectMember: { findFirst: async ({ where }: any) => where.projectId === projectId && members.has(where.userId) ? ({ projectId, userId: where.userId }) : null },
    taskEvent: { create: async () => ({}) },
  };
  const db: any = {
    ...tx,
    $transaction: async (callback: (transaction: any) => Promise<unknown>) => {
      const snapshot = structuredClone({ project: state.project, session: state.session, proposal: state.proposal, applies: state.applies });
      try { return await callback(tx); } catch (error) {
        Object.assign(state, structuredClone(snapshot));
        throw error;
      }
    },
  };
  const closer = {
    closeInTransaction: async (_transaction: unknown, input: { outcome: string }) => {
      if (options.failCloser) throw new Error("session close failed");
      state.session.outcome = input.outcome;
    },
  };
  const core = {
    applyReplan: async (_transaction: unknown, _project: string, input: any) => {
      if (options.failCore) throw new Error("domain write failed");
      state.applies.push(input.suggestions);
    },
  };
  return { state, db, closer, core };
}

const code = (promise: Promise<unknown>) => promise.then(() => "OK", (error: unknown) => error instanceof ProposalError ? error.code : `OTHER:${String(error)}`);

test("approve passes selected full suggestions in request order and stores immutable applied ids", async () => {
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

test("E23 core failure rolls back proposal, domain and session state", async () => {
  const f = fixture({ failCore: true });
  const before = structuredClone({ proposal: f.state.proposal, session: f.state.session, applies: f.state.applies });
  const service = createProposalService({ db: f.db, core: f.core, sessionCloser: f.closer });
  assert.equal(await code(service.approve({ proposalId, version: 1, actorId: ownerId, suggestionIds: [firstSuggestionId] })), "OTHER:Error: domain write failed");
  assert.deepEqual({ proposal: f.state.proposal, session: f.state.session, applies: f.state.applies }, before);
});

test("E23 session-close failure rolls back the approved proposal and domain mutation", async () => {
  const f = fixture({ failCloser: true });
  const before = structuredClone({ proposal: f.state.proposal, session: f.state.session, applies: f.state.applies });
  const service = createProposalService({ db: f.db, core: f.core, sessionCloser: f.closer });
  assert.equal(await code(service.approve({ proposalId, version: 1, actorId: ownerId, suggestionIds: [firstSuggestionId] })), "OTHER:Error: session close failed");
  assert.deepEqual({ proposal: f.state.proposal, session: f.state.session, applies: f.state.applies }, before);
});

test("E16-E17 hide a foreign project and outsider from proposal approval/listing", async () => {
  const foreign = fixture();
  const foreignService = createProposalService({ db: foreign.db, core: foreign.core, sessionCloser: foreign.closer });
  assert.equal(await code(foreignService.approve({ proposalId, projectId: otherProjectId, version: 1, actorId: ownerId, suggestionIds: [firstSuggestionId] })), "NOT_FOUND");

  const outsider = fixture({ members: [ownerId] });
  const outsiderService = createProposalService({ db: outsider.db, core: outsider.core, sessionCloser: outsider.closer });
  assert.equal(await code(outsiderService.list({ actorId: otherOwnerId, projectId, page: 0, size: 20 })), "NOT_FOUND");
});

test("endpoint 48 rejects a non-session owner without changing the proposal", async () => {
  const f = fixture();
  const service = createProposalService({ db: f.db, core: f.core, sessionCloser: f.closer });
  assert.equal(await code(service.reject({ proposalId, version: 1, actorId: otherOwnerId })), "NOT_FOUND");
  assert.equal(f.state.proposal.status, "PENDING");
  assert.equal(f.state.session.outcome, "OPEN");
});

test("wrong environment, feature or closed session cannot be bound to a replan", async (t) => {
  for (const session of [{ env: "prod" }, { feature: "PM_PLAN_OUTLINE" }, { outcome: "REJECTED" }]) {
    await t.test(JSON.stringify(session), async () => {
      const f = fixture({ session });
      const service = createProposalService({ db: f.db, core: f.core, sessionCloser: f.closer });
      assert.equal(await code(service.approve({ proposalId, version: 1, actorId: ownerId, suggestionIds: [firstSuggestionId] })), "CONFLICT_STATE");
    });
  }
});

test("terminal proposals and stale versions reject mutations", async () => {
  for (const status of ["REJECTED", "SUPERSEDED"] as const) {
    const f = fixture(); f.state.proposal.status = status;
    const service = createProposalService({ db: f.db, core: f.core, sessionCloser: f.closer });
    assert.equal(await code(service.approve({ proposalId, version: 1, actorId: ownerId, suggestionIds: [firstSuggestionId] })), "CONFLICT_STATE");
  }
  const stale = fixture();
  const staleService = createProposalService({ db: stale.db, core: stale.core, sessionCloser: stale.closer });
  assert.equal(await code(staleService.approve({ proposalId, version: 2, actorId: ownerId, suggestionIds: [firstSuggestionId] })), "CONFLICT_VERSION");
});
