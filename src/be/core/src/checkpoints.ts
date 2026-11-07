import type { UserRole } from "@agile/contracts";
import { inMutationTransaction, type MutationTransaction } from "@agile/db";

type Actor = { userId: string; role: UserRole };
type Row = Record<string, any>;
type CheckpointDb = MutationTransaction & { project?: { findFirst(args: Row): Promise<Row | null> }; checkpoint?: { findMany(args: Row): Promise<Row[]>; create(args: Row): Promise<Row> } };
const iso = (value: Date | string) => value instanceof Date ? value.toISOString() : value;
const checkpoint = (row: Row) => ({ id: row.id, projectId: row.projectId, name: row.name, targetDate: row.targetDate instanceof Date ? row.targetDate.toISOString().slice(0, 10) : row.targetDate, createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt), version: row.version });
const active = async (tx: any, projectId: string) => {
  const row = await tx.project.findFirst({ where: { id: projectId }, select: { status: true } });
  if (!row) throw new Error("NOT_FOUND");
  if (row.status !== "ACTIVE") throw new Error("CONFLICT_STATE");
};

export function createCheckpoints(db: CheckpointDb) {
  return {
    async list(actor: Actor, projectId: string) {
      if (!actor.userId) throw new Error("FORBIDDEN_ROLE");
      return (await db.checkpoint!.findMany({ where: { projectId }, orderBy: [{ targetDate: "asc" }, { id: "asc" }] })).map(checkpoint);
    },
    async create(actor: Actor, projectId: string, input: { name: string; targetDate: string }) {
      if (!actor.userId || (actor.role !== "PM" && actor.role !== "DEV_LEAD")) throw new Error("FORBIDDEN_ROLE");
      return inMutationTransaction(db, async () => {}, async (tx: any) => active(tx, projectId), async (tx: any) => checkpoint(await tx.checkpoint.create({ data: { projectId, name: input.name, targetDate: new Date(`${input.targetDate}T00:00:00.000Z`) } })));
    },
  };
}

export type CheckpointsService = ReturnType<typeof createCheckpoints>;
