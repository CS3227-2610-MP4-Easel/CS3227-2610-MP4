import { NotMember, type LlmGateway, type LlmResult, type PlanApproval, type PlanProposal } from "@agile/contracts";
import { sanitiseInput, SessionCapReached, type GatewaySessions } from "@agile/llm-gateway";
import type { AiContextWith } from "@agile/ai-context";
import { expandOutputSchema, outlineOutputSchema } from "./schemas.js";
import { buildExpandSections, buildOutlineSections, inputHash } from "./sections.js";

type PlanEpic = PlanProposal["epics"][number];

// Mirrors of the `@agile/proposals` types: the W6 source scan forbids any workspace import except contracts, ai-context and the gateway in a file that calls `gateway.run`.
export type EpicTask = { title: string; description: string; acceptanceCriteria: string[]; storyPoints: 1 | 2 | 3 | 5 | 8 | 13 };
export type ClaimResult =
  | { kind: "DONE"; epic: PlanEpic }
  | { kind: "CLAIMED"; projectId: string; sessionId: string; approach: string; epic: { title: string; description: string; checkpointName: string | null }; claimedVersion: number };
export type CreateProposalInput = {
  projectId: string; creatorId: string; sessionId: string; flagged: boolean; approach: string;
  checkpoints: { name: string; targetDate: string }[];
  retrieved: { source: "EPIC" | "TASK"; projectId: string; id: string }[];
  epics: { title: string; description: string; checkpointName: string | null }[];
};
/** `ProposalError` from `@agile/proposals`, recognised by name so this file imports nothing from it. */
type ProposalErrorLike = Error & { code: "NOT_FOUND" | "CONFLICT_STATE" | "CONFLICT_VERSION" | "FORBIDDEN_ROLE" | "INVALID_PLAN" };
const isProposalError = (e: unknown): e is ProposalErrorLike => e instanceof Error && e.name === "ProposalError" && typeof (e as { code?: unknown }).code === "string";

export class PlanFlowError extends Error {
  constructor(readonly code: string, readonly status: number, message: string, readonly retryAfterSeconds?: number, readonly details?: { reason: string }) {
    super(message);
    this.name = "PlanFlowError";
  }
}

/** The proposals functions already bound to a database client, core and sessions, so this file never sees a database client. */
export type ProposalsApi = {
  createProposal(i: CreateProposalInput): Promise<string>;
  getProposalView(proposalId: string, viewerId: string): Promise<PlanProposal | null>;
  claimEpic(i: { proposalId: string; index: number; actorId: string; now?: Date }): Promise<ClaimResult>;
  storeEpic(i: { proposalId: string; index: number; claimedVersion: number; tasks: EpicTask[]; flagged: boolean }): Promise<PlanEpic>;
  failEpic(i: { proposalId: string; index: number; claimedVersion: number; error: string }): Promise<boolean>;
  approveProposal(i: { proposalId: string; version: number; actorId: string }): Promise<PlanApproval>;
  rejectProposal(i: { proposalId: string; version: number; actorId: string }): Promise<PlanProposal>;
};
export type PlanFlowDeps = { proposals: ProposalsApi; gateway: LlmGateway; sessions: GatewaySessions; aiContext: AiContextWith; clock?: { now(): Date } };
export type PlanFlow = ReturnType<typeof createPlanFlow>;
export type Caller = { userId: string; role: "PM" };

const SESSION_EXPIRED_MESSAGE = "The AI session expired; start a new plan.";
const notFound = () => new PlanFlowError("NOT_FOUND", 404, "Not found.");

/** Application time zone date (Asia/Singapore, UTC+8, no daylight saving) as YYYY-MM-DD. */
function singaporeToday(now: Date): string {
  return new Date(now.getTime() + 8 * 3_600_000).toISOString().slice(0, 10);
}

/** Maps a failed gateway result; `code` is what an expand records on its row. */
function mapFailure(result: Extract<LlmResult, { ok: false }>): { error: PlanFlowError; code: string } {
  switch (result.code) {
    case "BLOCKED_INPUT": return { error: new PlanFlowError("VALIDATION_FAILED", 422, "The request could not be used."), code: "BLOCKED_INPUT" };
    case "REQUEST_REFUSED": return { error: new PlanFlowError("REQUEST_REFUSED", 422, "The AI declined this request."), code: "REQUEST_REFUSED" };
    // The gateway result carries no reason field, so LOCAL_LIMIT is always reported.
    case "AI_BUSY": return { error: new PlanFlowError("AI_BUSY", 429, "The AI is busy; try again shortly.", result.retryAfterSeconds ?? 60, { reason: "LOCAL_LIMIT" }), code: "AI_BUSY" };
    case "AI_UNAVAILABLE": return { error: new PlanFlowError("AI_UNAVAILABLE", 503, "The AI is unavailable."), code: "AI_UNAVAILABLE" };
    case "AI_DISABLED": return { error: new PlanFlowError("AI_DISABLED", 503, "The AI is disabled."), code: "AI_DISABLED" };
    default: return { error: new PlanFlowError("INTERNAL", 500, "Internal error."), code: "INTERNAL" };
  }
}

/** Maps a thrown error; anything unexpected is returned unchanged (T11 turns it into a 500). */
function mapThrown(e: unknown): { error: Error; code: string } {
  if (e instanceof PlanFlowError) return { error: e, code: "INTERNAL" };
  if (e instanceof NotMember) return { error: notFound(), code: "INTERNAL" };
  if (e instanceof Error && e.message === "NOT_FOUND") return { error: notFound(), code: "INTERNAL" };
  if (e instanceof Error && e.message === "CONFLICT_STATE" && !isProposalError(e)) return { error: new PlanFlowError("CONFLICT_STATE", 409, SESSION_EXPIRED_MESSAGE), code: "SESSION_EXPIRED" };
  return { error: e instanceof Error ? e : new Error("UNKNOWN"), code: "INTERNAL" };
}

function mapProposalError(e: unknown): never {
  if (isProposalError(e)) {
    switch (e.code) {
      case "NOT_FOUND": throw notFound();
      case "FORBIDDEN_ROLE": throw new PlanFlowError("FORBIDDEN_ROLE", 403, "Not allowed.");
      case "CONFLICT_VERSION": throw new PlanFlowError("CONFLICT_VERSION", 409, "The proposal changed; reload it.");
      default: throw new PlanFlowError("CONFLICT_STATE", 409, "The proposal or project is no longer in a state that allows this.");
    }
  }
  throw e;
}

async function runModel(gateway: LlmGateway, call: Parameters<LlmGateway["run"]>[0]): Promise<Extract<LlmResult, { ok: true }>> {
  const result = await gateway.run(call);
  if (!result.ok) throw new FailedResult(result);
  return result;
}

class FailedResult extends Error {
  constructor(readonly result: Extract<LlmResult, { ok: false }>) { super(result.code); }
}

function classify(e: unknown): { error: Error; code: string } {
  return e instanceof FailedResult ? mapFailure(e.result) : mapThrown(e);
}

export function createPlanFlow(deps: PlanFlowDeps) {
  const { proposals, gateway, sessions, aiContext } = deps;
  const clock = deps.clock ?? { now: () => new Date() };

  async function createPlan(i: { caller: Caller; projectId: string; idea: string }): Promise<PlanProposal> {
    const { caller, projectId, idea } = i;
    if (sanitiseInput(idea).blocked) throw new PlanFlowError("VALIDATION_FAILED", 422, "The idea could not be used.");
    let sessionId: string;
    try {
      sessionId = await sessions.open({ feature: "PM_PLAN_OUTLINE", userId: caller.userId, projectId });
    } catch (e) {
      if (e instanceof SessionCapReached) throw new PlanFlowError("RATE_LIMITED", 429, "Too many AI sessions.", e.retryAfterSeconds);
      throw e;
    }
    let stored = false;
    try {
      const today = singaporeToday(clock.now());
      const assembled = await aiContext.assembleWith(caller, "PM_PLAN_OUTLINE", projectId, { query: idea });
      const sections = buildOutlineSections({ today, idea, assembled: assembled.sections });
      const result = await runModel(gateway, {
        feature: "PM_PLAN_OUTLINE", caller, sessionId, projectId, sections,
        output: { kind: "json", schema: outlineOutputSchema(today) }, inputHash: inputHash("PM_PLAN_OUTLINE", sections),
      });
      const value = result.value as { approach: string; checkpoints: { name: string; targetDate: string }[]; epics: { title: string; description: string; checkpointName: string | null }[] };
      const retrieved = assembled.provenance.filter((p) => p.section === "similar-items").map((p) => ({ source: p.type as "EPIC" | "TASK", projectId: p.projectId, id: p.id }));
      let proposalId: string;
      try {
        proposalId = await proposals.createProposal({
          projectId, creatorId: caller.userId, sessionId, flagged: result.flagged,
          approach: value.approach, checkpoints: value.checkpoints, retrieved, epics: value.epics,
        });
      } catch (e) {
        if (isProposalError(e) && e.code === "CONFLICT_STATE") throw new PlanFlowError("CONFLICT_STATE", 409, "The project is no longer available.");
        throw e;
      }
      // The proposal is stored: from here the session must stay OPEN, so failures do not reach the ABANDONED close below.
      stored = true;
      try {
        const view = await proposals.getProposalView(proposalId, caller.userId);
        if (view) return view;
      } catch { /* reported as INTERNAL below */ }
      throw new PlanFlowError("INTERNAL", 500, "Internal error.");
    } catch (e) {
      if (stored) throw e;
      try { await sessions.close(sessionId, "ABANDONED", caller.userId); } catch { /* the original failure matters more */ }
      throw e instanceof PlanFlowError ? e : classify(e).error;
    }
  }

  async function getProposal(i: { caller: Caller; proposalId: string }): Promise<PlanProposal> {
    try {
      const view = await proposals.getProposalView(i.proposalId, i.caller.userId);
      if (!view) throw notFound();
      return view;
    } catch (e) {
      if (e instanceof PlanFlowError) throw e;
      return mapProposalError(e);
    }
  }

  async function expandEpic(i: { caller: Caller; proposalId: string; index: number }): Promise<PlanEpic> {
    const { caller, proposalId, index } = i;
    let claim: ClaimResult;
    try {
      claim = await proposals.claimEpic({ proposalId, index, actorId: caller.userId, now: clock.now() });
    } catch (e) {
      return mapProposalError(e);
    }
    if (claim.kind === "DONE") return claim.epic;
    let result: Extract<LlmResult, { ok: true }>;
    try {
      const assembled = await aiContext.assembleWith(caller, "PM_PLAN_EXPAND", claim.projectId, { query: `${claim.epic.title} ${claim.epic.description}` });
      const sections = buildExpandSections({ approach: claim.approach, epic: claim.epic, assembled: assembled.sections });
      result = await runModel(gateway, {
        feature: "PM_PLAN_EXPAND", caller, sessionId: claim.sessionId, projectId: claim.projectId, sections,
        output: { kind: "json", schema: expandOutputSchema }, inputHash: inputHash("PM_PLAN_EXPAND", sections),
      });
    } catch (e) {
      const { error, code } = classify(e);
      try { await proposals.failEpic({ proposalId, index, claimedVersion: claim.claimedVersion, error: code }); } catch { /* the mapped error matters more */ }
      throw error;
    }
    try {
      const tasks = (result.value as { tasks: EpicTask[] }).tasks;
      return await proposals.storeEpic({ proposalId, index, claimedVersion: claim.claimedVersion, tasks, flagged: result.flagged });
    } catch (e) {
      // CONFLICT_STATE: the result was discarded because the proposal is no longer PENDING; leave the row as it is.
      if (!(isProposalError(e) && e.code === "CONFLICT_STATE")) {
        try { await proposals.failEpic({ proposalId, index, claimedVersion: claim.claimedVersion, error: "INTERNAL" }); } catch { /* best effort */ }
      }
      return mapProposalError(e);
    }
  }

  async function approve(i: { caller: Caller; proposalId: string; version: number }): Promise<PlanApproval> {
    try {
      return await proposals.approveProposal({ proposalId: i.proposalId, version: i.version, actorId: i.caller.userId });
    } catch (e) {
      return mapProposalError(e);
    }
  }

  async function reject(i: { caller: Caller; proposalId: string; version: number }): Promise<PlanProposal> {
    try {
      return await proposals.rejectProposal({ proposalId: i.proposalId, version: i.version, actorId: i.caller.userId });
    } catch (e) {
      return mapProposalError(e);
    }
  }

  return { createPlan, getProposal, expandEpic, approve, reject };
}
