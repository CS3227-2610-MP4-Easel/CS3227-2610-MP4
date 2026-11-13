import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ErrorEnvelopeSchema,
  PageQuerySchema,
  SprintPageSchema,
  ProposalPageSchema,
  SprintCloseBodySchema,
  ReplanApprovalBodySchema,
  ReplanRejectionBodySchema,
  ProjectSchema,
  ProjectInputSchema,
  PlanProposalSchema,
  ReplanProposalSchema,
  FactsSchema,
  DigestSchema,
  StandupSchema,
  UsageSessionSchema,
  ProgressSchema,
  UploadResponseSchema,
  SummaryResponseSchema,
  PlanApprovalSchema,
  PlanCreateBodySchema,
  ProposalVersionBodySchema,
  EmptyBodySchema,
  ReplanApprovalSchema,
  LeadOverviewSchema,
  UsageSummarySchema,
  UserInputSchema,
} from "../src/index.js";

test("E1 rejects unknown request keys", () => {
  const result = UserInputSchema.safeParse({ displayName: "Lee", role: "DEVELOPER", extra: true });
  assert.equal(result.success, false);
});

test("E2 rejects server-managed fields instead of stripping them", () => {
  const result = ProjectInputSchema.safeParse({ name: "Project", id: "client-controlled" });
  assert.equal(result.success, false);
});

test("N2 enforces pagination bounds", () => {
  assert.equal(PageQuerySchema.safeParse({ page: 0, size: 100 }).success, true);
  assert.equal(PageQuerySchema.safeParse({ page: 0, size: 101 }).success, false);
  assert.equal(PageQuerySchema.safeParse({ page: 10000, size: 1 }).success, true);
  assert.equal(PageQuerySchema.safeParse({ page: 10001, size: 1 }).success, false);
  assert.equal(ProjectSchema.safeParse({ id: "not-a-uuid" }).success, false);
  assert.equal(UserInputSchema.safeParse({ displayName: "Lee", role: "ADMIN" }).success, false);
});

test("W14 page envelopes and mutation bodies enforce their shared bounds", () => {
  const id = "00000000-0000-0000-0000-000000000001";
  const sprint = { id, projectId: id, name: "Sprint 1", startDate: "2026-11-01", endDate: "2026-11-14", status: "PLANNED", completedPoints: null, version: 1 };
  const proposal = { id, projectId: id, kind: "REPLAN", status: "PENDING", suggestions: [], explanation: "Explanation", flagged: false, createdAt: "2026-11-02T00:00:00Z", version: 1 };
  assert.equal(SprintPageSchema.safeParse({ items: [sprint], page: 10000, size: 100, total: 1 }).success, true);
  assert.equal(SprintPageSchema.safeParse({ items: [sprint], page: 10001, size: 100, total: 1 }).success, false);
  assert.equal(ProposalPageSchema.safeParse({ items: [proposal], page: 0, size: 1, total: 1 }).success, true);
  assert.equal(SprintCloseBodySchema.safeParse({ version: 1, carryOver: [{ taskId: id, to: "BACKLOG" }, { taskId: id, to: id }] }).success, true);
  assert.equal(SprintCloseBodySchema.safeParse({ version: 1, carryOver: [{ taskId: id, to: "not-a-target" }] }).success, false);
  assert.equal(SprintCloseBodySchema.safeParse({ version: 1, carryOver: Array.from({ length: 1001 }, () => ({ taskId: id, to: "BACKLOG" })) }).success, false);
  assert.equal(ReplanApprovalBodySchema.safeParse({ version: 1, suggestionIds: Array.from({ length: 100 }, () => id) }).success, true);
  assert.equal(ReplanApprovalBodySchema.safeParse({ version: 1, suggestionIds: Array.from({ length: 101 }, () => id) }).success, false);
  const suggestion = { id, type: "MOVE_CHECKPOINT_DATE", checkpointId: id, newTargetDate: "2026-11-15", rationale: "Keep the checkpoint date aligned." };
  assert.equal(ReplanProposalSchema.safeParse({ id, projectId: id, kind: "REPLAN", status: "PENDING", suggestions: Array.from({ length: 101 }, () => suggestion), explanation: "Explanation", flagged: false, createdAt: "2026-11-02T00:00:00Z", version: 1 }).success, true);
  assert.equal(ReplanApprovalSchema.safeParse({ proposalId: id, status: "APPROVED", applied: Array.from({ length: 101 }, () => id), sessionOutcome: "ACCEPTED" }).success, true);
  assert.equal(ReplanRejectionBodySchema.safeParse({ version: 1 }).success, true);
  assert.equal(ReplanRejectionBodySchema.safeParse({ version: 1, suggestionIds: [] }).success, false);
});

test("error envelope preserves stable error codes and request id", () => {
  const parsed = ErrorEnvelopeSchema.parse({
    error: {
      code: "VALIDATION_FAILED",
      message: "The request body is not valid.",
      details: [{ field: "name", message: "Required" }],
      requestId: "00000000-0000-0000-0000-000000000000",
    },
  });
  assert.equal(parsed.error.code, "VALIDATION_FAILED");
});

test("F2 normative AI response schemas cover proposal, facts, digest, standup, and usage fields", () => {
  const id = "00000000-0000-0000-0000-000000000001";
  const instant = "2026-11-02T00:00:00Z";
  const facts = {
    asOf: instant, pointsTotal: 8, pointsDone: 3, pointsRemaining: 5, unestimatedTasks: 0,
    velocity: [{ sprintId: id, name: "Sprint 1", completedPoints: 3 }], avgVelocity: null,
    projectedCompletionDate: null, checkpoints: [], overload: [],
  };
  assert.equal(FactsSchema.safeParse(facts).success, true);
  assert.equal(DigestSchema.safeParse({ id, projectId: id, facts, explanation: null, degraded: false, flagged: false, proposalId: null, cached: false, createdAt: instant }).success, true);
  assert.equal(StandupSchema.safeParse({ id, projectId: id, developerId: id, date: "2026-11-02", content: { yesterday: [], today: [], blockers: [] }, degraded: false, flagged: false, cached: false, outcome: null, feedback: null, createdAt: instant, updatedAt: instant, version: 1 }).success, true);
  assert.equal(UsageSessionSchema.safeParse({ id, feature: "DEV_STANDUP", startedAt: instant, endedAt: null, outcome: "OPEN", regenerateCount: 0, feedback: null, calls: 0, promptTokens: 0, completionTokens: 0, costMicroUsd: 0, elapsedSeconds: null }).success, true);
  assert.equal(PlanProposalSchema.safeParse({ id, projectId: id, kind: "PLAN", status: "PENDING", approach: "Approach", checkpoints: [], epics: [], retrieved: [], flagged: false, createdBy: id, createdAt: instant, updatedAt: instant, version: 1 }).success, true);
  assert.equal(ReplanProposalSchema.safeParse({ id, projectId: id, kind: "REPLAN", status: "PENDING", suggestions: [], explanation: "Explanation", flagged: false, createdAt: instant, version: 1 }).success, true);
  assert.equal(ProgressSchema.safeParse({ pointsTotal: 0, pointsDone: 0, percent: 0, unestimatedTasks: 0, velocity: [] }).success, true);
  assert.equal(UploadResponseSchema.safeParse({ received: 0, created: 0, updated: 0, unchanged: 0, rejected: [], needsSummary: [] }).success, true);
  assert.equal(SummaryResponseSchema.safeParse({ summaries: [], failed: [] }).success, true);
  assert.equal(PlanApprovalSchema.safeParse({ proposalId: id, status: "APPROVED", created: { checkpoints: 1, epics: 3, tasks: 9 } }).success, true);
  assert.equal(PlanApprovalSchema.safeParse({ proposalId: id, status: "APPROVED", created: { checkpoints: [], epics: [], tasks: [] } }).success, false);
  assert.equal(ReplanApprovalSchema.safeParse({ proposalId: id, status: "APPROVED", applied: [], sessionOutcome: "ACCEPTED" }).success, true);
  assert.equal(LeadOverviewSchema.safeParse([{ project: { id, name: "Project", brief: null, status: "ACTIVE", createdBy: id, createdAt: instant, updatedAt: instant, version: 1 }, facts: { pointsTotal: 0, pointsDone: 0, pointsRemaining: 0, projectedCompletionDate: null }, latestDigest: { status: "NONE" } }]).success, true);
  assert.equal(UsageSummarySchema.safeParse([]).success, true);
});

test("E47 plan body schemas are strict and count code points", () => {
  const idea = (n: number, ch = "a") => ({ idea: ch.repeat(n) });
  assert.equal(PlanCreateBodySchema.safeParse(idea(19)).success, false);
  assert.equal(PlanCreateBodySchema.safeParse(idea(20)).success, true);
  assert.equal(PlanCreateBodySchema.safeParse(idea(2000)).success, true);
  assert.equal(PlanCreateBodySchema.safeParse(idea(2001)).success, false);
  assert.equal(PlanCreateBodySchema.safeParse(idea(20, "😀")).success, true);
  assert.equal(PlanCreateBodySchema.safeParse(idea(2000, "😀")).success, true);
  assert.equal(PlanCreateBodySchema.safeParse(idea(19, "😀")).success, false);
  assert.equal(PlanCreateBodySchema.safeParse(idea(2001, "😀")).success, false);
  assert.equal(PlanCreateBodySchema.safeParse({ idea: "😀".repeat(10) }).success, false);
  assert.equal(PlanCreateBodySchema.safeParse(idea(8001)).success, false);
  for (const n of [19, 2001]) {
    const r = PlanCreateBodySchema.safeParse(idea(n));
    assert.equal(r.success, false);
    if (!r.success) {
      assert.equal(r.error.issues[0].message, "Must be 20 to 2000 characters.");
      assert.equal(r.error.issues[0].message.includes("a".repeat(19)), false);
    }
  }
  const extra = PlanCreateBodySchema.safeParse({ ...idea(20), extra: 1 });
  assert.equal(extra.success, false);
  if (!extra.success) assert.equal(extra.error.issues[0].code, "unrecognized_keys");
  assert.equal(ProposalVersionBodySchema.safeParse({ version: 1 }).success, true);
  assert.equal(ProposalVersionBodySchema.safeParse({ version: 2147483647 }).success, true);
  assert.equal(ProposalVersionBodySchema.safeParse({ version: 0 }).success, false);
  assert.equal(ProposalVersionBodySchema.safeParse({ version: 1.5 }).success, false);
  assert.equal(ProposalVersionBodySchema.safeParse({ version: -1 }).success, false);
  assert.equal(ProposalVersionBodySchema.safeParse({}).success, false);
  assert.equal(ProposalVersionBodySchema.safeParse({ version: 2147483648 }).success, false);
  const vExtra = ProposalVersionBodySchema.safeParse({ version: 1, extra: 1 });
  assert.equal(vExtra.success, false);
  if (!vExtra.success) assert.equal(vExtra.error.issues[0].code, "unrecognized_keys");
  assert.equal(EmptyBodySchema.safeParse({}).success, true);
  const eExtra = EmptyBodySchema.safeParse({ extra: 1 });
  assert.equal(eExtra.success, false);
  if (!eExtra.success) assert.equal(eExtra.error.issues[0].code, "unrecognized_keys");
  const pid = "00000000-0000-0000-0000-000000000001";
  const approve = (created: unknown) => PlanApprovalSchema.safeParse({ proposalId: pid, status: "APPROVED", created }).success;
  assert.equal(approve({ checkpoints: 1, epics: [], tasks: 9 }), false);
  assert.equal(approve({ checkpoints: -1, epics: 3, tasks: 9 }), false);
  assert.equal(approve({ checkpoints: 1.5, epics: 3, tasks: 9 }), false);
  assert.equal(approve({ checkpoints: 1, epics: 3, tasks: 9, extra: 1 }), false);
});
