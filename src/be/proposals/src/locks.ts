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

/** Takes the bound AI session lock and re-reads the session. */
export async function lockSession(tx: FilteredTransactionClient, sessionId: string) {
  try {
    await tx.aiSession.update({ where: { id: sessionId }, data: { lastActivityAt: new Date() }, select: { id: true } });
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }
  return tx.aiSession.findFirst({ where: { id: sessionId } });
}

/** Locks a referenced domain row without changing its logical value. */
export async function lockDomainRow(tx: FilteredTransactionClient, kind: "checkpoint" | "epic" | "task", id: string, projectId: string) {
  const model = (tx as unknown as Record<string, unknown>)[kind] as { updateMany?: (args: Record<string, unknown>) => Promise<{ count: number }>; update?: (args: Record<string, unknown>) => Promise<unknown>; findFirst(args: Record<string, unknown>): Promise<unknown | null> };
  if (model.updateMany) {
    const result = await model.updateMany({ where: { id, projectId }, data: { updatedAt: new Date() } });
    if (result.count === 0) return null;
  } else {
    if (!await model.findFirst({ where: { id, projectId } })) return null;
    await model.update?.({ where: { id }, data: { updatedAt: new Date() } });
  }
  return model.findFirst({ where: { id, projectId } });
}
