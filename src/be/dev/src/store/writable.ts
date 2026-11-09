import { NotMember } from "@agile/contracts";
import { lockProjectForMutation } from "@agile/core";
import { DevError } from "../errors.js";
import { inMutationTransaction, type MutationTransaction } from "@agile/db";

export type DevWriteDeps = { db: MutationTransaction; requireMember(userId: string, projectId: string): Promise<void> };

type ProjectReader = { project: { findFirst(args: { where: { id: string }; select: { status: true } }): Promise<{ status: string } | null> } };

// Archived beats non-member: the project state is checked before membership.
export async function assertDevWriteAllowed(tx: unknown, userId: string, projectId: string, requireMember: DevWriteDeps["requireMember"]): Promise<void> {
  const project = await (tx as ProjectReader).project.findFirst({ where: { id: projectId }, select: { status: true } });
  if (!project || project.status !== "ACTIVE") throw new Error("CONFLICT_STATE");
  try { await requireMember(userId, projectId); } catch (error) {
    if (error instanceof NotMember || (error instanceof Error && error.message === "NOT_FOUND")) throw new Error("NOT_FOUND");
    throw error;
  }
}

export async function inDevWrite<T>(deps: DevWriteDeps, userId: string, projectId: string, mutate: (tx: unknown) => Promise<T>): Promise<T> {
  const lock = async (tx: unknown) => {
    try { await lockProjectForMutation(tx as Parameters<typeof lockProjectForMutation>[0], projectId); } catch (error) {
      if ((error as { code?: string })?.code === "P2025") throw new Error("CONFLICT_STATE");
      throw error;
    }
  };
  try { return await inMutationTransaction(deps.db, lock, (tx) => assertDevWriteAllowed(tx, userId, projectId, deps.requireMember), mutate); } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code === "P2034" || code === "40001") throw new DevError("RATE_LIMITED", 429, 1);
    throw error;
  }
}
