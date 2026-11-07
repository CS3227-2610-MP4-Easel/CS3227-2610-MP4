import type { PlanProposal } from "@agile/contracts";
import type { FilteredDbClient, FilteredTransactionClient } from "@agile/db";
import { ProposalError } from "./errors.js";
import { toPlanEpic } from "./view.js";

type PlanEpic = PlanProposal["epics"][number];

export const EXPAND_LEASE_MS = 60_000;
export type EpicTask = { title: string; description: string; acceptanceCriteria: string[]; storyPoints: 1 | 2 | 3 | 5 | 8 | 13 };
export type ClaimResult =
  | { kind: "DONE"; epic: PlanEpic }
  | { kind: "CLAIMED"; projectId: string; sessionId: string; approach: string; epic: { title: string; description: string; checkpointName: string | null }; claimedVersion: number };

const isMissing = (error: unknown): boolean => (error as { code?: string } | null)?.code === "P2025";

/** Takes the proposal row lock (an update of updatedAt by id) and re-reads the row; null when there is no visible row. */
async function lockProposal(tx: FilteredTransactionClient, proposalId: string) {
  try {
    await tx.aiProposal.update({ where: { id: proposalId }, data: { updatedAt: new Date() }, select: { id: true } });
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }
  return tx.aiProposal.findFirst({ where: { id: proposalId } });
}

async function lockEpic(tx: FilteredTransactionClient, proposalId: string, index: number) {
  try {
    await tx.proposalEpic.update({ where: { proposalId_index: { proposalId, index } }, data: { updatedAt: new Date() }, select: { index: true } });
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }
  return tx.proposalEpic.findFirst({ where: { proposalId, index } });
}

export async function claimEpic(db: FilteredDbClient, input: { proposalId: string; index: number; actorId: string; now?: Date }): Promise<ClaimResult> {
  const now = input.now ?? new Date();
  return db.$transaction(async (tx) => {
    const proposal = await lockProposal(tx, input.proposalId);
    if (!proposal || proposal.createdBy !== input.actorId) throw new ProposalError("NOT_FOUND");
    const count = await tx.proposalEpic.count({ where: { proposalId: input.proposalId } });
    if (!Number.isInteger(input.index) || input.index < 0 || input.index >= count) throw new ProposalError("NOT_FOUND");
    if (proposal.status !== "PENDING") throw new ProposalError("CONFLICT_STATE");
    const row = await lockEpic(tx, input.proposalId, input.index);
    if (!row) throw new ProposalError("NOT_FOUND");
    if (row.expansionStatus === "DONE") return { kind: "DONE" as const, epic: toPlanEpic(row, now) };
    if (row.expansionStatus === "IN_PROGRESS" && row.leaseExpiresAt !== null && row.leaseExpiresAt.getTime() >= now.getTime()) throw new ProposalError("CONFLICT_STATE");
    const claimed = await tx.proposalEpic.update({
      where: { proposalId_index: { proposalId: input.proposalId, index: input.index } },
      data: { expansionStatus: "IN_PROGRESS", leaseExpiresAt: new Date(now.getTime() + EXPAND_LEASE_MS), error: null, version: row.version + 1 },
    });
    const payload = (proposal.payload ?? {}) as { approach?: unknown };
    return {
      kind: "CLAIMED" as const, projectId: proposal.projectId, sessionId: proposal.sessionId,
      approach: typeof payload.approach === "string" ? payload.approach : "",
      epic: { title: row.title, description: row.description, checkpointName: row.checkpointName }, claimedVersion: claimed.version,
    };
  });
}

type EpicRowResult = NonNullable<Awaited<ReturnType<typeof lockEpic>>>;

/** Both guards: proposal still PENDING, epic still IN_PROGRESS at the claimed version. */
async function guard(tx: FilteredTransactionClient, input: { proposalId: string; index: number; claimedVersion: number }): Promise<EpicRowResult | null> {
  const proposal = await lockProposal(tx, input.proposalId);
  if (!proposal || proposal.status !== "PENDING") return null;
  const row = await lockEpic(tx, input.proposalId, input.index);
  if (!row || row.expansionStatus !== "IN_PROGRESS" || row.version !== input.claimedVersion) return null;
  return row;
}

export async function storeEpic(db: FilteredDbClient, input: { proposalId: string; index: number; claimedVersion: number; tasks: EpicTask[]; flagged: boolean }): Promise<PlanEpic> {
  return db.$transaction(async (tx) => {
    const current = await guard(tx, input);
    if (!current) throw new ProposalError("CONFLICT_STATE");
    const row = await tx.proposalEpic.update({
      where: { proposalId_index: { proposalId: input.proposalId, index: input.index } },
      data: { tasks: input.tasks, expansionStatus: "DONE", error: null, leaseExpiresAt: null, version: current.version + 1 },
    });
    if (input.flagged) await tx.aiProposal.update({ where: { id: input.proposalId }, data: { flagged: true }, select: { id: true } });
    return toPlanEpic(row);
  });
}

export async function failEpic(db: FilteredDbClient, input: { proposalId: string; index: number; claimedVersion: number; error: string }): Promise<void> {
  await db.$transaction(async (tx) => {
    const current = await guard(tx, input);
    if (!current) return;
    await tx.proposalEpic.update({
      where: { proposalId_index: { proposalId: input.proposalId, index: input.index } },
      data: { expansionStatus: "FAILED", error: input.error, leaseExpiresAt: null, version: current.version + 1 },
    });
  });
}
