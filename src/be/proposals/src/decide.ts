import { NotMember, type Core, type PlanApproval, type PlanProposal, type Sessions } from "@agile/contracts";
import { countPlan, type PlanInput } from "@agile/core";
import type { FilteredDbClient } from "@agile/db";
import type { Prisma } from "@prisma/client";
import { ProposalError } from "./errors.js";
import { lockProposal } from "./locks.js";
import { getProposalView } from "./view.js";

export type DecideDeps = { db: FilteredDbClient; core: Pick<Core, "applyPlan">; sessions: Pick<Sessions, "close"> };

type Stored = { checkpoints?: unknown; applied?: unknown } & Record<string, unknown>;

/** The session close runs after the commit; a failure is logged with the session id only and never fails the request. */
async function closeSession(sessions: Pick<Sessions, "close">, sessionId: string, outcome: string, actorId: string): Promise<void> {
  try {
    await sessions.close(sessionId, outcome, actorId);
  } catch {
    console.warn("pm_session_close_failed", { sessionId });
  }
}

export async function approveProposal(deps: DecideDeps, input: { proposalId: string; version: number; actorId: string }): Promise<PlanApproval> {
  const { db, core, sessions } = deps;
  const outcome = await db.$transaction(async (tx) => {
    const proposal = await lockProposal(tx, input.proposalId);
    if (!proposal) throw new ProposalError("NOT_FOUND");
    const payload = (proposal.payload ?? {}) as Stored;
    if (proposal.status === "APPROVED") {
      return { sessionId: proposal.sessionId, result: { proposalId: proposal.id, status: "APPROVED" as const, created: payload.applied as PlanApproval["created"] } };
    }
    if (proposal.status !== "PENDING") throw new ProposalError("CONFLICT_STATE");
    if (proposal.version !== input.version) throw new ProposalError("CONFLICT_VERSION");
    const epics = await tx.proposalEpic.findMany({ where: { proposalId: proposal.id }, orderBy: { index: "asc" } });
    if (epics.length === 0 || epics.some((epic) => epic.expansionStatus !== "DONE")) throw new ProposalError("CONFLICT_STATE");

    const plan = {
      checkpoints: (Array.isArray(payload.checkpoints) ? payload.checkpoints : []) as PlanInput["checkpoints"],
      epics: epics.map((epic) => ({ title: epic.title, description: epic.description, checkpointName: epic.checkpointName, tasks: (epic.tasks ?? []) as PlanInput["epics"][number]["tasks"] })),
    } as PlanInput;
    const applied = countPlan(plan);
    await tx.aiProposal.update({
      where: { id: proposal.id },
      data: { status: "APPROVED", appliedBy: input.actorId, appliedAt: new Date(), payload: { ...payload, applied } as Prisma.InputJsonValue, version: proposal.version + 1 },
      select: { id: true },
    });
    try {
      await core.applyPlan(tx, proposal.projectId, plan, input.actorId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (error instanceof NotMember) throw new ProposalError("NOT_FOUND");
      if (message === "INVALID_PLAN" || message === "CONFLICT_STATE") throw new ProposalError("CONFLICT_STATE");
      if (message === "FORBIDDEN_ROLE") throw new ProposalError("FORBIDDEN_ROLE");
      throw error; // rolls the transaction back
    }
    return { sessionId: proposal.sessionId, result: { proposalId: proposal.id, status: "APPROVED" as const, created: applied } };
  }, { timeout: 20_000 });
  await closeSession(sessions, outcome.sessionId, "ACCEPTED", input.actorId);
  return outcome.result;
}

export async function rejectProposal(deps: Omit<DecideDeps, "core">, input: { proposalId: string; version: number; actorId: string }): Promise<PlanProposal> {
  const { db, sessions } = deps;
  const sessionId = await db.$transaction(async (tx) => {
    const proposal = await lockProposal(tx, input.proposalId);
    if (!proposal) throw new ProposalError("NOT_FOUND");
    if (proposal.status !== "PENDING") throw new ProposalError("CONFLICT_STATE");
    if (proposal.version !== input.version) throw new ProposalError("CONFLICT_VERSION");
    await tx.aiProposal.update({ where: { id: proposal.id }, data: { status: "REJECTED", version: proposal.version + 1 }, select: { id: true } });
    return proposal.sessionId;
  });
  await closeSession(sessions, sessionId, "REJECTED", input.actorId);
  const view = await getProposalView(db, input.proposalId, input.actorId);
  if (!view) throw new ProposalError("NOT_FOUND");
  return view;
}
