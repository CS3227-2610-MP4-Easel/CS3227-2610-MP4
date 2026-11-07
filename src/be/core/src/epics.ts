import { NotMember, type UserRole } from "@agile/contracts";
import { inMutationTransaction, type MutationTransaction } from "@agile/db";

type Actor = { userId: string; role: UserRole };
type Row = Record<string, any>;
export type EpicAccess = { requireMember(userId: string, projectId: string, tx?: unknown): Promise<void>; archivedMembership(userId: string, projectId: string, tx?: unknown): Promise<boolean> };
type EpicDb = MutationTransaction & { project?: { findFirst(args: Row): Promise<Row | null> }; checkpoint?: { findFirst(args: Row): Promise<Row | null> }; epic?: { findMany(args: Row): Promise<Row[]>; count(args: Row): Promise<number>; create(args: Row): Promise<Row> } };
const iso = (value: Date | string) => value instanceof Date ? value.toISOString() : value;
const output = (row: Row) => ({ id: row.id, projectId: row.projectId, checkpointId: row.checkpointId ?? null, title: row.title, description: row.description ?? null, position: row.position, taskCount: row._count?.tasks ?? row.taskCount ?? 0, pointsTotal: row._sum?.tasks?.storyPoints ?? row.pointsTotal ?? 0, createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt), version: row.version });
const access = async (gate: EpicAccess, actor: Actor, projectId: string, write = false, tx?: unknown) => {
  try { await gate.requireMember(actor.userId, projectId, tx); } catch (error) {
    if (!(error instanceof NotMember)) throw error;
    if (write && await gate.archivedMembership(actor.userId, projectId, tx)) throw new Error("CONFLICT_STATE");
    throw new Error("NOT_FOUND");
  }
};

export function createEpics(db: EpicDb, gate: EpicAccess) {
  return {
    async list(actor: Actor, projectId: string) {
      if (!actor.userId) throw new Error("FORBIDDEN_ROLE");
      await access(gate, actor, projectId);
      return (await db.epic!.findMany({ where: { projectId }, orderBy: [{ position: "asc" }, { id: "asc" }], include: { _count: { select: { tasks: true } }, _sum: { tasks: { select: { storyPoints: true } } } } })).map(output);
    },
    async create(actor: Actor, projectId: string, input: { title: string; description?: string | null; checkpointId?: string | null }) {
      if (!actor.userId || (actor.role !== "PM" && actor.role !== "DEV_LEAD")) throw new Error("FORBIDDEN_ROLE");
      await access(gate, actor, projectId, true);
      return inMutationTransaction(db, async (tx: any) => { await tx.project.findFirst({ where: { id: projectId }, lock: { mode: "ForUpdate" } }); }, async (tx) => access(gate, actor, projectId, true, tx), async (tx: any) => {
        if (input.checkpointId && !await tx.checkpoint?.findFirst({ where: { id: input.checkpointId, projectId } })) throw new Error("VALIDATION_FAILED");
        const position = await tx.epic.count({ where: { projectId } }) + 1;
        return output(await tx.epic.create({ data: { projectId, title: input.title, description: input.description ?? null, checkpointId: input.checkpointId ?? null, position } }));
      });
    },
  };
}
export type EpicsService = ReturnType<typeof createEpics>;
