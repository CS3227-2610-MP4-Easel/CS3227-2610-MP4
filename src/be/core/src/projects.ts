import type { UserRole } from "@agile/contracts";
import { inMutationTransaction, type MutationTransaction } from "@agile/db";

type Actor = { userId: string; role: UserRole };
type Row = Record<string, any>;
type ProjectDb = MutationTransaction & {
  project?: { create(args: Row): Promise<Row>; findFirst(args: Row): Promise<Row | null>; findMany(args: Row): Promise<Row[]>; count(args: Row): Promise<number> };
  projectMember?: { create(args: Row): Promise<Row>; findFirst(args: Row): Promise<Row | null>; findMany(args: Row): Promise<Row[]> };
  user?: { findFirst(args: Row): Promise<Row | null> };
};

const iso = (value: Date | string) => value instanceof Date ? value.toISOString() : value;
const project = (row: Row) => ({ id: row.id, name: row.name, brief: row.brief, status: row.status, createdBy: row.createdBy, createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt), version: row.version });
const detail = (row: Row) => ({ ...project(row), progress: { pointsTotal: 0, pointsDone: 0, percent: 0, unestimatedTasks: 0 } });
const member = (row: Row) => ({ userId: row.userId, displayName: row.displayName ?? row.user?.displayName, role: row.role ?? row.user?.role, addedAt: iso(row.addedAt) });
const forbidden = () => { throw new Error("FORBIDDEN_ROLE"); };
const invalid = () => { throw new Error("VALIDATION_FAILED"); };
const active = async (tx: any, projectId: string) => {
  const row = await tx.project.findFirst({ where: { id: projectId }, select: { status: true } });
  if (!row) throw new Error("NOT_FOUND");
  if (row.status !== "ACTIVE") throw new Error("CONFLICT_STATE");
};

/** Project and membership operations; callers provide the filtered request client only. */
export function createProjects(db: ProjectDb) {
  return {
    async create(actor: Actor, input: { name: string; brief?: string | null }) {
      if (!actor.userId || actor.role !== "PM") forbidden();
      return inMutationTransaction(db, async () => {}, async () => {}, async (tx: any) => {
        const created = await tx.project.create({ data: { name: input.name, brief: input.brief ?? null, status: "ACTIVE", createdBy: actor.userId } });
        await tx.projectMember.create({ data: { projectId: created.id, userId: actor.userId, addedBy: actor.userId } });
        return project(created);
      });
    },
    async list(actor: Actor, query: { page: number; size: number }) {
      if (!actor.userId) forbidden();
      const where = { members: { some: { userId: actor.userId } } };
      const [items, total] = await Promise.all([
        db.project!.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: query.page * query.size, take: query.size }),
        db.project!.count({ where }),
      ]);
      return { items: items.map(detail), page: query.page, size: query.size, total };
    },
    async detail(actor: Actor, projectId: string) {
      if (!actor.userId) forbidden();
      const row = await db.project!.findFirst({ where: { id: projectId } });
      if (!row) throw new Error("NOT_FOUND");
      return detail(row);
    },
    async members(actor: Actor, projectId: string) {
      if (!actor.userId) forbidden();
      const rows = await db.projectMember!.findMany({ where: { projectId }, orderBy: [{ addedAt: "asc" }, { userId: "asc" }], include: { user: { select: { displayName: true, role: true } } } });
      return rows.map(member);
    },
    async addMember(actor: Actor, projectId: string, input: { email: string }) {
      if (!actor.userId || (actor.role !== "PM" && actor.role !== "DEV_LEAD")) forbidden();
      const email = input.email.trim().toLowerCase();
      return inMutationTransaction(db, async () => {}, async (tx: any) => active(tx, projectId), async (tx: any) => {
        const user = await tx.user.findFirst({ where: { email }, select: { id: true, displayName: true, role: true } });
        if (!user || (actor.role === "PM" && user.role !== "DEV_LEAD") || (actor.role === "DEV_LEAD" && user.role !== "DEVELOPER")) invalid();
        const existing = await tx.projectMember.findFirst({ where: { projectId, userId: user.id }, include: { user: { select: { displayName: true, role: true } } } });
        if (existing) return { member: member(existing), created: false };
        try {
          const created = await tx.projectMember.create({ data: { projectId, userId: user.id, addedBy: actor.userId }, include: { user: { select: { displayName: true, role: true } } } });
          return { member: member(created), created: true };
        } catch (error) {
          if ((error as { code?: string }).code !== "P2002") throw error;
          const raced = await tx.projectMember.findFirst({ where: { projectId, userId: user.id }, include: { user: { select: { displayName: true, role: true } } } });
          if (!raced) throw error;
          return { member: member(raced), created: false };
        }
      });
    },
  };
}

export type ProjectsService = ReturnType<typeof createProjects>;
