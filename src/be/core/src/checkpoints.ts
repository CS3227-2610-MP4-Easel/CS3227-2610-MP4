import { NotMember, type UserRole } from "@agile/contracts";
import { inMutationTransaction, type MutationTransaction } from "@agile/db";
import { lockProjectForMutation } from "./core.js";

type Actor = { userId: string; role: UserRole };
type Row = Record<string, any>;
export type CheckpointAccess = { requireMember(userId: string, projectId: string, tx?: unknown): Promise<void>; archivedMembership(userId: string, projectId: string, tx?: unknown): Promise<boolean> };
type CheckpointDb = MutationTransaction & { project?: { findFirst(args: Row): Promise<Row | null> }; checkpoint?: { findMany(args: Row): Promise<Row[]>; create(args: Row): Promise<Row> } };
const iso = (value: Date | string) => value instanceof Date ? value.toISOString() : value;
const checkpoint = (row: Row) => ({ id: row.id, projectId: row.projectId, name: row.name, targetDate: row.targetDate instanceof Date ? row.targetDate.toISOString().slice(0, 10) : row.targetDate, createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt), version: row.version });
const requireProjectAccess = async (access: CheckpointAccess, actor: Actor, projectId: string, write = false, tx?: unknown) => {
  try { await access.requireMember(actor.userId, projectId, tx); } catch (error) {
    if (!(error instanceof NotMember)) throw error;
    if (await access.archivedMembership(actor.userId, projectId, tx) && write) throw new Error("CONFLICT_STATE");
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
      return inMutationTransaction(db, (tx) => lockProjectForMutation(tx as any, projectId), async (tx) => requireProjectAccess(access, actor, projectId, true, tx), async (tx: any) => checkpoint(await tx.checkpoint.create({ data: { projectId, name: input.name, targetDate: new Date(`${input.targetDate}T00:00:00.000Z`) } })));
    },
    /** Endpoint 15: soft delete under the version guard; epics that pointed at it are unlinked (and their versions bumped). */
    async remove(actor: Actor, id: string, input: { version: number }) {
      if (!actor.userId || (actor.role !== "PM" && actor.role !== "DEV_LEAD")) throw new Error("FORBIDDEN_ROLE");
      await inMutationTransaction(db, async () => {}, async () => {}, async (tx: any) => {
        const current = await tx.checkpoint.findFirst({ where: { id } });
        if (!current) throw new Error("NOT_FOUND");
        await lockProjectForMutation(tx, current.projectId);
        await requireProjectAccess(access, actor, current.projectId, true, tx);
        if (current.version !== input.version) throw new Error("CONFLICT_VERSION");
        if (!(await tx.checkpoint.updateMany({ where: { id, version: input.version }, data: { deletedAt: new Date(), version: { increment: 1 } } })).count) throw new Error("CONFLICT_VERSION");
        await tx.epic.updateMany({ where: { projectId: current.projectId, checkpointId: id, deletedAt: null }, data: { checkpointId: null, version: { increment: 1 } } });
      });
    },
    async patch(actor: Actor, id: string, input: { name?: string; targetDate?: string; version: number }) {
      if (!actor.userId || (actor.role !== "PM" && actor.role !== "DEV_LEAD")) throw new Error("FORBIDDEN_ROLE");
      if (input.targetDate !== undefined && !validDate(input.targetDate)) throw new Error("VALIDATION_FAILED");
      return inMutationTransaction(db, async () => {}, async () => {}, async (tx: any) => {
        const current = await tx.checkpoint.findFirst({ where: { id } });
        if (!current) throw new Error("NOT_FOUND");
        await lockProjectForMutation(tx, current.projectId);
        await requireProjectAccess(access, actor, current.projectId, true, tx);
        if (current.version !== input.version) throw new Error("CONFLICT_VERSION");
        const data: Row = {};
        if (input.name !== undefined && input.name !== current.name) data.name = input.name;
        if (input.targetDate !== undefined && input.targetDate !== checkpoint(current).targetDate) data.targetDate = new Date(`${input.targetDate}T00:00:00.000Z`);
        if (!Object.keys(data).length) return checkpoint(current);
        data.version = { increment: 1 };
        if (!(await tx.checkpoint.updateMany({ where: { id, version: input.version }, data })).count) throw new Error("CONFLICT_VERSION");
        return checkpoint(await tx.checkpoint.findFirst({ where: { id } }));
      });
    },
  };
}

export type CheckpointsService = ReturnType<typeof createCheckpoints>;
