import { NotMember, type UserRole } from "@agile/contracts";
import { inMutationTransaction, type MutationTransaction } from "@agile/db";

type Actor = { userId: string; role: UserRole };
type Row = Record<string, any>;
export type ProjectAccess = {
  /** Active-member proof from core's filtered-client membership service. */
  requireMember(userId: string, projectId: string, tx?: unknown): Promise<void>;
  /** Internal seam: only true for a member of an archived project, which the filtered client hides. */
  archivedMembership(userId: string, projectId: string, tx?: unknown): Promise<boolean>;
};
type ProjectDb = MutationTransaction & {
  project?: { create(args: Row): Promise<Row>; findFirst(args: Row): Promise<Row | null>; findMany(args: Row): Promise<Row[]>; count(args: Row): Promise<number> };
  projectMember?: { create(args: Row): Promise<Row>; findFirst(args: Row): Promise<Row | null>; findMany(args: Row): Promise<Row[]> };
  user?: { findFirst(args: Row): Promise<Row | null> };
};

const iso = (value: Date | string) => value instanceof Date ? value.toISOString() : value;
const project = (row: Row) => ({ id: row.id, name: row.name, brief: row.brief, status: row.status, createdBy: row.createdBy, createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt), version: row.version });
const detail = (row: Row) => { let pointsTotal = 0; let pointsDone = 0; let unestimatedTasks = 0; for (const task of row.tasks ?? []) { if (task.storyPoints == null) { unestimatedTasks++; continue; } pointsTotal += task.storyPoints; if (task.status === "DONE") pointsDone += task.storyPoints; } return { ...project(row), progress: { pointsTotal, pointsDone, percent: pointsTotal === 0 ? 0 : (pointsDone / pointsTotal) * 100, unestimatedTasks } }; };
const member = (row: Row) => ({ userId: row.userId, displayName: row.displayName ?? row.user?.displayName, role: row.role ?? row.user?.role, addedAt: iso(row.addedAt) });
const forbidden = () => { throw new Error("FORBIDDEN_ROLE"); };
const invalid = () => { throw new Error("VALIDATION_FAILED"); };
const requireProjectAccess = async (access: ProjectAccess, actor: Actor, projectId: string, write = false, tx?: unknown) => {
  try {
    await access.requireMember(actor.userId, projectId, tx);
  } catch (error) {
    if (!(error instanceof NotMember)) throw error;
    if (await access.archivedMembership(actor.userId, projectId, tx)) {
      if (write) throw new Error("CONFLICT_STATE");
    }
    throw new Error("NOT_FOUND");
  }
};

/** Project and membership operations; callers provide the filtered request client only. */
export function createProjects(db: ProjectDb, access: ProjectAccess) {
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
        db.project!.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: query.page * query.size, take: query.size, include: { tasks: { select: { storyPoints: true, status: true } } } }),
        db.project!.count({ where }),
      ]);
      return { items: items.map(detail), page: query.page, size: query.size, total };
    },
    async detail(actor: Actor, projectId: string) {
      if (!actor.userId) forbidden();
      await requireProjectAccess(access, actor, projectId);
      const row = await db.project!.findFirst({ where: { id: projectId }, include: { tasks: { select: { storyPoints: true, status: true } } } });
      if (!row) throw new Error("NOT_FOUND");
      return detail(row);
    },
    async members(actor: Actor, projectId: string) {
      if (!actor.userId) forbidden();
      await requireProjectAccess(access, actor, projectId);
      const rows = await db.projectMember!.findMany({ where: { projectId }, orderBy: [{ addedAt: "asc" }, { userId: "asc" }], include: { user: { select: { displayName: true, role: true } } } });
      return rows.map(member);
    },
    async addMember(actor: Actor, projectId: string, input: { email: string }) {
      if (!actor.userId || (actor.role !== "PM" && actor.role !== "DEV_LEAD")) forbidden();
      const email = input.email.trim().toLowerCase();
      await requireProjectAccess(access, actor, projectId, true);
      let targetId: string | undefined;
      try {
        return await inMutationTransaction(db, async () => {}, async (tx) => requireProjectAccess(access, actor, projectId, true, tx), async (tx: any) => {
          const user = await tx.user.findFirst({ where: { email }, select: { id: true, displayName: true, role: true } });
          if (!user || (actor.role === "PM" && user.role !== "DEV_LEAD") || (actor.role === "DEV_LEAD" && user.role !== "DEVELOPER")) invalid();
          targetId = user.id;
          const existing = await tx.projectMember.findFirst({ where: { projectId, userId: user.id }, include: { user: { select: { displayName: true, role: true } } } });
          if (existing) return { member: member(existing), created: false };
          const created = await tx.projectMember.create({ data: { projectId, userId: user.id, addedBy: actor.userId }, include: { user: { select: { displayName: true, role: true } } } });
          return { member: member(created), created: true };
        });
      } catch (error) {
        if ((error as { code?: string }).code !== "P2002" || !targetId) throw error;
        // P2002 aborts this RepeatableRead snapshot; only the post-rollback client can observe the winner.
        await requireProjectAccess(access, actor, projectId, true);
        const raced = await db.projectMember!.findFirst({ where: { projectId, userId: targetId }, include: { user: { select: { displayName: true, role: true } } } });
        if (!raced) throw error;
        return { member: member(raced), created: false };
      }
    },
  };
}

export type ProjectsService = ReturnType<typeof createProjects>;
