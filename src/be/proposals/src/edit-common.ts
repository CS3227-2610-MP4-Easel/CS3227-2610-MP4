import { PlanInputSchema } from "@agile/core";
import type { FilteredTransactionClient } from "@agile/db";
import { ProposalError } from "./errors.js";
import { lockProposal } from "./locks.js";

export const isLive = (row: { expansionStatus: string; leaseExpiresAt: Date | null }, now: Date): boolean =>
  row.expansionStatus === "IN_PROGRESS" && row.leaseExpiresAt !== null && row.leaseExpiresAt.getTime() >= now.getTime();
export type ProposalRow = NonNullable<Awaited<ReturnType<typeof lockProposal>>>;
export type EpicRowLike = { title: string; description: string; checkpointName: string | null; expansionStatus: string; tasks: unknown };
export type Checkpoint = { name: string; targetDate: string };
export async function guardEdit(tx: FilteredTransactionClient, i: { proposalId: string; actorId: string; version: number }): Promise<ProposalRow> {
  const proposal = await lockProposal(tx, i.proposalId);
  if (!proposal || proposal.createdBy !== i.actorId) throw new ProposalError("NOT_FOUND");
  if (proposal.status !== "PENDING") throw new ProposalError("CONFLICT_STATE");
  if (proposal.version !== i.version) throw new ProposalError("CONFLICT_VERSION");
  return proposal;
}
export function assertWholePlan(checkpoints: Checkpoint[], rows: EpicRowLike[]): void {
  const result = PlanInputSchema.safeParse({ checkpoints, epics: rows.map(row => ({ title: row.title, description: row.description, checkpointName: row.checkpointName, tasks: row.expansionStatus === "DONE" ? row.tasks : [{ title: "x", description: "", acceptanceCriteria: [], storyPoints: 1 }] })) });
  if (!result.success) throw new ProposalError("VALIDATION_FAILED", result.error.issues[0]?.path.join("."));
}
