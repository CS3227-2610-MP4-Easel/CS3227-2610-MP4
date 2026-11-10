import { NotMember, type UserRole } from "@agile/contracts";

type Actor = { userId: string; role: UserRole };
type Row = Record<string, any>;
type SprintDb = { sprint: { findMany(args: Row): Promise<Row[]> } };
type SprintAccess = { requireMember(userId: string, projectId: string): Promise<void> };
const date = (value: Date | string) => value instanceof Date ? value.toISOString().slice(0, 10) : value;

export function createSprints(db: SprintDb, access: SprintAccess) {
  return {
    async list(actor: Actor, projectId: string) {
      if (!actor.userId) throw new Error("FORBIDDEN_ROLE");
      try { await access.requireMember(actor.userId, projectId); } catch (error) { if (error instanceof NotMember) throw new Error("NOT_FOUND"); throw error; }
      const rows = await db.sprint.findMany({ where: { projectId }, orderBy: [{ startDate: "asc" }, { id: "asc" }] });
      return rows.map(row => ({ id: row.id, projectId: row.projectId, name: row.name, startDate: date(row.startDate), endDate: date(row.endDate), status: row.status, completedPoints: row.completedPoints ?? null, version: row.version }));
    },
  };
}
