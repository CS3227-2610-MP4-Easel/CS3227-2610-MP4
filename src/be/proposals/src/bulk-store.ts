import type { PlanProposal } from "@agile/contracts";
import type { FilteredDbClient } from "@agile/db";
import { ProposalError } from "./errors.js";
import { guardEdit, isLive } from "./edit-common.js";
import { EXPAND_LEASE_MS, planContextEpic, type EpicTask, type PlanContextEpic } from "./expand-store.js";
import { lockEpic, lockProposal } from "./locks.js";
import { getProposalView } from "./view.js";

export type PlanClaim = { index: number; title: string; description: string; checkpointName: string | null; claimedVersion: number };
export type PlanClaimResult = { kind: "NONE"; proposal: PlanProposal } | { kind: "CLAIMED"; projectId: string; sessionId: string; approach: string; targets: PlanClaim[]; done: PlanContextEpic[] };

export async function claimPlanEpics(db: FilteredDbClient, i: { proposalId: string; actorId: string; version: number; now?: Date }): Promise<PlanClaimResult> {
  const now = i.now ?? new Date();
  const result = await db.$transaction(async tx => {
    const proposal = await guardEdit(tx, i);
    const rows = await tx.proposalEpic.findMany({ where: { proposalId: i.proposalId }, orderBy: { index: "asc" } });
    if (rows.some(row => isLive(row, now))) throw new ProposalError("CONFLICT_STATE");
    const targets = rows.filter(row => row.expansionStatus !== "DONE");
    if (!targets.length) return null;
    const payload = (proposal.payload ?? {}) as { approach?: string; epicVersionWatermark?: number; [key: string]: unknown };
    const first = Math.max(payload.epicVersionWatermark ?? 0, ...rows.map(row => row.version)) + 1;
    const last = first + targets.length - 1;
    if (last > 2_147_483_646) throw new ProposalError("CONFLICT_STATE");
    await tx.aiProposal.update({ where: { id: i.proposalId }, data: { payload: { ...payload, epicVersionWatermark: last } }, select: { id: true } });
    const claims: PlanClaim[] = [];
    for (const [k, target] of targets.entries()) {
      const row = await lockEpic(tx, i.proposalId, target.index);
      if (!row) throw new ProposalError("CONFLICT_STATE");
      const claimedVersion = first + k;
      await tx.proposalEpic.update({ where: { proposalId_index: { proposalId: i.proposalId, index: row.index } }, data: { expansionStatus: "IN_PROGRESS", leaseExpiresAt: new Date(now.getTime() + EXPAND_LEASE_MS), error: null, version: claimedVersion } });
      claims.push({ index: row.index, title: row.title, description: row.description, checkpointName: row.checkpointName, claimedVersion });
    }
    return { kind: "CLAIMED" as const, projectId: proposal.projectId, sessionId: proposal.sessionId, approach: typeof payload.approach === "string" ? payload.approach : "", targets: claims, done: rows.filter(row => row.expansionStatus === "DONE").map(planContextEpic) };
  });
  if (result) return result;
  const proposal = await getProposalView(db, i.proposalId, i.actorId);
  if (!proposal) throw new ProposalError("NOT_FOUND");
  return { kind: "NONE", proposal };
}

export async function storePlanEpics(db: FilteredDbClient, i: { proposalId: string; results: { index: number; claimedVersion: number; tasks: EpicTask[] }[]; flagged: boolean }): Promise<{ stored: number; skipped: number }> {
  return db.$transaction(async tx => {
    const proposal = await lockProposal(tx, i.proposalId);
    if (!proposal || proposal.status !== "PENDING") throw new ProposalError("CONFLICT_STATE");
    let stored = 0;
    for (const result of [...i.results].sort((a, b) => a.index - b.index)) {
      const current = await tx.proposalEpic.findFirst({ where: { proposalId: i.proposalId, index: result.index } });
      if (!current || current.expansionStatus !== "IN_PROGRESS" || current.version !== result.claimedVersion) continue;
      const row = await lockEpic(tx, i.proposalId, result.index);
      if (!row || row.expansionStatus !== "IN_PROGRESS" || row.version !== result.claimedVersion) continue;
      await tx.proposalEpic.update({ where: { proposalId_index: { proposalId: i.proposalId, index: result.index } }, data: { tasks: result.tasks, expansionStatus: "DONE", error: null, leaseExpiresAt: null, version: row.version + 1 } });
      stored++;
    }
    if (!stored) throw new ProposalError("CONFLICT_STATE");
    if (i.flagged) await tx.aiProposal.update({ where: { id: i.proposalId }, data: { flagged: true }, select: { id: true } });
    return { stored, skipped: i.results.length - stored };
  });
}

export async function failPlanEpics(db: FilteredDbClient, i: { proposalId: string; claims: { index: number; claimedVersion: number }[]; error: string }): Promise<number> {
  return db.$transaction(async tx => {
    const proposal = await lockProposal(tx, i.proposalId);
    if (!proposal || proposal.status !== "PENDING") return 0;
    let failed = 0;
    for (const claim of [...i.claims].sort((a, b) => a.index - b.index)) {
      const current = await tx.proposalEpic.findFirst({ where: { proposalId: i.proposalId, index: claim.index } });
      if (!current || current.expansionStatus !== "IN_PROGRESS" || current.version !== claim.claimedVersion) continue;
      const row = await lockEpic(tx, i.proposalId, claim.index);
      if (!row || row.expansionStatus !== "IN_PROGRESS" || row.version !== claim.claimedVersion) continue;
      await tx.proposalEpic.update({ where: { proposalId_index: { proposalId: i.proposalId, index: claim.index } }, data: { expansionStatus: "FAILED", error: i.error, leaseExpiresAt: null, version: row.version + 1 } });
      failed++;
    }
    return failed;
  });
}
