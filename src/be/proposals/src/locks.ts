import type { FilteredTransactionClient } from "@agile/db";

const isMissing = (error: unknown): boolean => (error as { code?: string } | null)?.code === "P2025";

/** Takes the proposal row lock (an update of updatedAt by id) and re-reads the row; null when there is no visible row. */
export async function lockProposal(tx: FilteredTransactionClient, proposalId: string) {
  try {
    await tx.aiProposal.update({ where: { id: proposalId }, data: { updatedAt: new Date() }, select: { id: true } });
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }
  return tx.aiProposal.findFirst({ where: { id: proposalId } });
}

/** Takes the epic row lock the same way. */
export async function lockEpic(tx: FilteredTransactionClient, proposalId: string, index: number) {
  try {
    await tx.proposalEpic.update({ where: { proposalId_index: { proposalId, index } }, data: { updatedAt: new Date() }, select: { index: true } });
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }
  return tx.proposalEpic.findFirst({ where: { proposalId, index } });
}
