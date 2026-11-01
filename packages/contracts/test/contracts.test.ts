import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ErrorEnvelopeSchema,
  PageQuerySchema,
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
  assert.equal(ProjectSchema.safeParse({ id: "not-a-uuid" }).success, false);
  assert.equal(UserInputSchema.safeParse({ displayName: "Lee", role: "ADMIN" }).success, false);
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
  assert.equal(PlanApprovalSchema.safeParse({ proposalId: id, status: "APPROVED", created: { checkpoints: [], epics: [], tasks: [] } }).success, true);
  assert.equal(ReplanApprovalSchema.safeParse({ proposalId: id, status: "APPROVED", applied: [] }).success, true);
  assert.equal(LeadOverviewSchema.safeParse([{ project: { id, name: "Project", brief: null, status: "ACTIVE", createdBy: id, createdAt: instant, updatedAt: instant, version: 1 }, facts: { pointsTotal: 0, pointsDone: 0, pointsRemaining: 0, projectedCompletionDate: null }, latestDigest: { status: "NONE" } }]).success, true);
  assert.equal(UsageSummarySchema.safeParse([]).success, true);
});
