import type { UserRole } from "@agile/contracts";
import { inMutationTransaction, type MutationTransaction } from "@agile/db";

type Actor = { userId: string; role: UserRole };
type Row = Record<string, any>;
export type CheckpointAccess = { requireMember(userId: string, projectId: string): Promise<void>; archivedMembership(userId: string, projectId: string): Promise<boolean> };
type CheckpointDb = MutationTransaction & { project?: { findFirst(args: Row): Promise<Row | null> }; checkpoint?: { findMany(args: Row): Promise<Row[]>; create(args: Row): Promise<Row> } };
const iso = (value: Date | string) => value instanceof Date ? value.toISOString() : value;
const checkpoint = (row: Row) => ({ id: row.id, projectId: row.projectId, name: row.name, targetDate: row.targetDate instanceof Date ? row.targetDate.toISOString().slice(0, 10) : row.targetDate, createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt), version: row.version });
const requireProjectAccess = async (access: CheckpointAccess, actor: Actor, projectId: string, write = false) => {
  try { await access.requireMember(actor.userId, projectId); } catch {
    if (await access.archivedMembership(actor.userId, projectId) && write) throw new Error("CONFLICT_STATE");
    throw new Error("NOT_FOUND");
  }
};
const validDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

export function createCheckpoints(db: CheckpointDb, access: CheckpointAccess) {
  return {
    async list(actor: Actor, projectId: string) {
      if (!actor.userId) throw new Error("FORBIDDEN_ROLE");
      await requireProjectAccess(access, actor, projectId);
      return (await db.checkpoint!.findMany({ where: { projectId }, orderBy: [{ targetDate: "asc" }, { id: "asc" }] })).map(checkpoint);
    },
    async create(actor: Actor, projectId: string, input: { name: string; targetDate: string }) {
      if (!actor.userId || (actor.role !== "PM" && actor.role !== "DEV_LEAD")) throw new Error("FORBIDDEN_ROLE");
      await requireProjectAccess(access, actor, projectId, true);
      if (!validDate(input.targetDate)) throw new Error("VALIDATION_FAILED");
      return inMutationTransaction(db, async () => {}, async () => requireProjectAccess(access, actor, projectId, true), async (tx: any) => checkpoint(await tx.checkpoint.create({ data: { projectId, name: input.name, targetDate: new Date(`${input.targetDate}T00:00:00.000Z`) } })));
    },
  };
}

export type CheckpointsService = ReturnType<typeof createCheckpoints>;
