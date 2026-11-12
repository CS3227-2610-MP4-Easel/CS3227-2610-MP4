import type { PlanProposal } from "@agile/contracts";
import type { FilteredDbClient, FilteredTransactionClient } from "@agile/db";
import { ProposalError } from "./errors.js";
import { guardEdit, isLive } from "./edit-common.js";
import { lockEpic, lockProposal } from "./locks.js";
import { toPlanEpic } from "./view.js";

type PlanEpic = PlanProposal["epics"][number];
export const EXPAND_LEASE_MS = 75_000;
export type EpicTask = { title: string; description: string; acceptanceCriteria: string[]; storyPoints: number };
export type PlanContextEpic = { index: number; title: string; description: string; checkpointName: string | null; tasks: EpicTask[] | null };
export function planContextEpic(row: { index: number; title: string; description: string; checkpointName: string | null; tasks: unknown }): PlanContextEpic {
  return { index: row.index, title: row.title, description: row.description, checkpointName: row.checkpointName, tasks: Array.isArray(row.tasks) && row.tasks.length ? row.tasks as EpicTask[] : null };
}
export type ClaimResult =
  | { kind: "DONE"; epic: PlanEpic }
  | { kind: "CLAIMED"; projectId: string; sessionId: string; approach: string; epic: { title: string; description: string; checkpointName: string | null }; claimedVersion: number; others: PlanContextEpic[] };

export async function claimEpic(db: FilteredDbClient, input: { proposalId: string; index: number; actorId: string; now?: Date; mode?: "EXPAND" | "REGENERATE"; expectedProposalVersion?: number }): Promise<ClaimResult> {
  const now = input.now ?? new Date();
  return db.$transaction(async (tx) => {
    const proposal = await lockProposal(tx, input.proposalId);
    if (!proposal || proposal.createdBy !== input.actorId) throw new ProposalError("NOT_FOUND");
    if (input.expectedProposalVersion !== undefined && proposal.version !== input.expectedProposalVersion) throw new ProposalError("CONFLICT_VERSION");
    const count = await tx.proposalEpic.count({ where: { proposalId: input.proposalId } });
    if (!Number.isInteger(input.index) || input.index < 0 || input.index >= count) throw new ProposalError("NOT_FOUND");
    if (proposal.status !== "PENDING") throw new ProposalError("CONFLICT_STATE");
    const row = await lockEpic(tx, input.proposalId, input.index);
    if (!row) throw new ProposalError("NOT_FOUND");
    if (row.expansionStatus === "DONE" && input.mode !== "REGENERATE") return { kind: "DONE" as const, epic: toPlanEpic(row, now) };
    if (isLive(row, now)) throw new ProposalError("CONFLICT_STATE");
    const payload = (proposal.payload ?? {}) as { approach?: string; epicVersionWatermark?: number; [key: string]: unknown };
    const rows = await tx.proposalEpic.findMany({ where: { proposalId: input.proposalId }, orderBy: { index: "asc" } });
    const version = Math.max(payload.epicVersionWatermark ?? 0, ...rows.map((r) => r.version)) + 1;
    if (version > 2_147_483_646) throw new ProposalError("CONFLICT_STATE");
    await tx.aiProposal.update({ where: { id: input.proposalId }, data: { payload: { ...payload, epicVersionWatermark: version } }, select: { id: true } });
    const claimed = await tx.proposalEpic.update({
      where: { proposalId_index: { proposalId: input.proposalId, index: input.index } },
      data: { expansionStatus: "IN_PROGRESS", leaseExpiresAt: new Date(now.getTime() + EXPAND_LEASE_MS), error: null, version },
    });
    return {
      kind: "CLAIMED" as const, projectId: proposal.projectId, sessionId: proposal.sessionId,
      approach: typeof payload.approach === "string" ? payload.approach : "",
      epic: { title: row.title, description: row.description, checkpointName: row.checkpointName }, claimedVersion: claimed.version,
      others: rows.filter(r => r.index !== input.index).map(planContextEpic),
    };
  });
}

type EpicRowResult = NonNullable<Awaited<ReturnType<typeof lockEpic>>>;
type ProposalRow = NonNullable<Awaited<ReturnType<typeof lockProposal>>>;
async function guard(tx: FilteredTransactionClient, input: { proposalId: string; index: number; claimedVersion: number }): Promise<{proposal: ProposalRow; row: EpicRowResult} | null> {
  const proposal = await lockProposal(tx, input.proposalId);
  if (!proposal || proposal.status !== "PENDING") return null;
  const row = await lockEpic(tx, input.proposalId, input.index);
  if (!row || row.expansionStatus !== "IN_PROGRESS" || row.version !== input.claimedVersion) return null;
  return {proposal, row};
}

export async function storeEpic(db: FilteredDbClient, input: { proposalId: string; index: number; claimedVersion: number; tasks: EpicTask[]; flagged: boolean; bumpProposalVersion?: boolean }): Promise<PlanEpic> {
  return db.$transaction(async (tx) => {
    const current = await guard(tx, input);
    if (!current) throw new ProposalError("CONFLICT_STATE");
    const row = await tx.proposalEpic.update({
      where: { proposalId_index: { proposalId: input.proposalId, index: input.index } },
      data: { tasks: input.tasks, expansionStatus: "DONE", error: null, leaseExpiresAt: null, version: current.row.version + 1 },
    });
    if (input.flagged || input.bumpProposalVersion) await tx.aiProposal.update({ where: { id: input.proposalId }, data: { ...(input.flagged ? {flagged: true} : {}), ...(input.bumpProposalVersion ? {version: current.proposal.version + 1} : {}) }, select: { id: true } });
    return toPlanEpic(row);
  });
}

export async function failEpic(db: FilteredDbClient, input: { proposalId: string; index: number; claimedVersion: number; error: string }): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const current = await guard(tx, input);
    if (!current) return false;
    await tx.proposalEpic.update({
      where: { proposalId_index: { proposalId: input.proposalId, index: input.index } },
      data: { expansionStatus: "FAILED", error: input.error, leaseExpiresAt: null, version: current.row.version + 1 },
    });
    return true;
  });
}

export async function precheckRegenerate(db: FilteredDbClient, input: { proposalId: string; index: number; actorId: string; version: number; now?: Date }): Promise<{sessionId: string; status: "PENDING" | "DONE" | "FAILED"}> {
  const now = input.now ?? new Date();
  return db.$transaction(async (tx) => {
    const proposal = await guardEdit(tx, input);
    const count = await tx.proposalEpic.count({where: {proposalId: input.proposalId}});
    if (!Number.isInteger(input.index) || input.index < 0 || input.index >= count) throw new ProposalError("NOT_FOUND");
    const row = await lockEpic(tx, input.proposalId, input.index);
    if (!row) throw new ProposalError("NOT_FOUND");
    if (isLive(row, now)) throw new ProposalError("CONFLICT_STATE");
    return {sessionId: proposal.sessionId, status: row.expansionStatus === "IN_PROGRESS" ? "PENDING" : row.expansionStatus};
  });
}
