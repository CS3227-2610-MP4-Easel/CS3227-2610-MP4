import { NotMember, type UserRole } from "@agile/contracts";
import { inMutationTransaction, type MutationTransaction } from "@agile/db";

type Actor = { userId: string; role: UserRole };
type Row = Record<string, any>;
export type EpicAccess = { requireMember(userId: string, projectId: string, tx?: unknown): Promise<void>; archivedMembership(userId: string, projectId: string, tx?: unknown): Promise<boolean> };
type EpicDb = MutationTransaction & { project?: { update(args: Row): Promise<Row> }; checkpoint?: { findFirst(args: Row): Promise<Row | null> }; epic?: { findMany(args: Row): Promise<Row[]>; count(args: Row): Promise<number>; aggregate(args: Row): Promise<Row>; create(args: Row): Promise<Row> } };
const iso = (value: Date | string) => value instanceof Date ? value.toISOString() : value;
const output = (row: Row) => ({ id: row.id, projectId: row.projectId, checkpointId: row.checkpointId ?? null, title: row.title, description: row.description ?? null, position: row.position, taskCount: row._count?.tasks ?? row.taskCount ?? 0, pointsTotal: row.tasks?.reduce((total: number, task: Row) => total + (task.storyPoints ?? 0), 0) ?? row.pointsTotal ?? 0, createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt), version: row.version });
const access = async (gate: EpicAccess, actor: Actor, projectId: string, write = false, tx?: unknown) => {
  try { await gate.requireMember(actor.userId, projectId, tx); } catch (error) {
    if (!(error instanceof NotMember)) throw error;
    if (write && await gate.archivedMembership(actor.userId, projectId, tx)) throw new Error("CONFLICT_STATE");
    throw new Error("NOT_FOUND");
  }
};

/** Prisma has no `lock` query option. A no-op version update uses its supported atomic update and holds the row lock for the transaction. */
export async function lockProjectForEpicPosition(tx: { project: { update(args: Row): Promise<Row> } }, projectId: string): Promise<void> {
  await tx.project.update({ where: { id: projectId }, data: { version: { increment: 0 } } });
}

export function createEpics(db: EpicDb, gate: EpicAccess) {
  return {
    async list(actor: Actor, projectId: string, query: { page: number; size: number } = { page: 0, size: 20 }) {
      if (!actor.userId) throw new Error("FORBIDDEN_ROLE");
      await access(gate, actor, projectId);
      const where = { projectId };
      const [items, total] = await Promise.all([db.epic!.findMany({ where, orderBy: [{ position: "asc" }, { id: "asc" }], skip: query.page * query.size, take: query.size, include: { _count: { select: { tasks: true } }, tasks: { select: { storyPoints: true } } } }), db.epic!.count({ where })]);
      return { items: items.map(output), page: query.page, size: query.size, total };
    },
    async create(actor: Actor, projectId: string, input: { title: string; description?: string | null; checkpointId?: string | null }) {
      if (!actor.userId || (actor.role !== "PM" && actor.role !== "DEV_LEAD")) throw new Error("FORBIDDEN_ROLE");
      await access(gate, actor, projectId, true);
      return inMutationTransaction(db, async (tx: any) => lockProjectForEpicPosition(tx, projectId), async (tx) => access(gate, actor, projectId, true, tx), async (tx: any) => {
        if (input.checkpointId && !await tx.checkpoint?.findFirst({ where: { id: input.checkpointId, projectId } })) throw new Error("VALIDATION_FAILED");
        const position = ((await tx.epic.aggregate({ where: { projectId }, _max: { position: true } }))._max?.position ?? 0) + 1;
        return output(await tx.epic.create({ data: { projectId, title: input.title, description: input.description ?? null, checkpointId: input.checkpointId ?? null, position } }));
      });
    },
    async patch(actor: Actor, id: string, input: { title?: string; description?: string | null; checkpointId?: string | null; position?: number; version: number }) {
      if (!actor.userId || (actor.role !== "PM" && actor.role !== "DEV_LEAD")) throw new Error("FORBIDDEN_ROLE");
      return inMutationTransaction(db, async () => {}, async () => {}, async (tx: any) => {
        const include = { _count: { select: { tasks: true } }, tasks: { select: { storyPoints: true } } };
        const current = await tx.epic.findFirst({ where: { id }, include });
        if (!current) throw new Error("NOT_FOUND");
        await lockProjectForEpicPosition(tx, current.projectId);
        await access(gate, actor, current.projectId, true, tx);
        if (current.version !== input.version) throw new Error("CONFLICT_VERSION");
        if (input.checkpointId && !await tx.checkpoint.findFirst({ where: { id: input.checkpointId, projectId: current.projectId } })) throw new Error("VALIDATION_FAILED");
        const data: Row = {};
        for (const key of ["title", "description", "checkpointId", "position"] as const) if (input[key] !== undefined && input[key] !== current[key]) data[key] = input[key];
        if (!Object.keys(data).length) return output(current);
        data.version = { increment: 1 };
        if (!(await tx.epic.updateMany({ where: { id, version: input.version }, data })).count) throw new Error("CONFLICT_VERSION");
        return output(await tx.epic.findFirst({ where: { id }, include }));
      });
    },
  };
}
export type EpicsService = ReturnType<typeof createEpics>;
