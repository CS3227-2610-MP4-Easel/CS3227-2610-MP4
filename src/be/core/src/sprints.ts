import { NotMember, type UserRole } from "@agile/contracts";
import { inMutationTransaction, type MutationTransaction } from "@agile/db";
import { lockProjectForMutation } from "./core.js";
import { writeTaskEvent } from "./task-events.js";
import { createDerived, type Derived } from "./derived.js";

type Actor = { userId: string; role: UserRole };
type Row = Record<string, any>;

export type SprintAccess = {
  requireMember(userId: string, projectId: string, tx?: unknown): Promise<void>;
  archivedMembership(userId: string, projectId: string, tx?: unknown): Promise<boolean>;
};

export type SprintDb = MutationTransaction & {
  project?: { update(args: Row): Promise<Row> };
  sprint?: {
    findFirst(args: Row): Promise<Row | null>;
    findMany(args: Row): Promise<Row[]>;
    count(args: Row): Promise<number>;
    create(args: Row): Promise<Row>;
    updateMany(args: Row): Promise<{ count: number }>;
  };
  task?: { findMany(args: Row): Promise<Row[]>; updateMany(args: Row): Promise<{ count: number }> };
  taskEvent?: { create(args: Row): Promise<unknown> };
};

export type SprintInput = { name: string; startDate: string; endDate: string };
export type SprintPatch = Partial<SprintInput> & { version: number };
export type SprintClose = { version: number; carryOver: Array<{ taskId: string; to: "BACKLOG" | string }> };
export type SprintQuery = { page: number; size: number };

const iso = (value: Date | string | null | undefined) => value == null ? value ?? null : value instanceof Date ? value.toISOString() : value;
const dateOnly = (value: Date | string | null | undefined) => value == null ? value ?? null : value instanceof Date ? value.toISOString().slice(0, 10) : value;
const sprint = (row: Row) => ({ id: row.id, projectId: row.projectId, name: row.name, startDate: dateOnly(row.startDate), endDate: dateOnly(row.endDate), status: row.status, completedPoints: row.completedPoints ?? null, version: row.version });
const actorCanWrite = (actor: Actor) => { if (!actor.userId || actor.role !== "DEV_LEAD") throw new Error("FORBIDDEN_ROLE"); };
const validDate = (value: unknown): value is string => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};
const validName = (value: unknown) => typeof value === "string" && value.trim().length > 0 && value.length <= 200;
const validPage = (query: SprintQuery) => Number.isInteger(query.page) && query.page >= 0 && query.page <= 10_000 && Number.isInteger(query.size) && query.size >= 1 && query.size <= 100;
const asDate = (value: string) => new Date(`${value}T00:00:00.000Z`);

const access = async (gate: SprintAccess, actor: Actor, projectId: string, write = false, tx?: unknown) => {
  try { await gate.requireMember(actor.userId, projectId, tx); } catch (error) {
    if (!(error instanceof NotMember)) throw error;
    if (write && await gate.archivedMembership(actor.userId, projectId, tx)) throw new Error("CONFLICT_STATE");
    throw new Error("NOT_FOUND");
  }
};

const ensureDates = (startDate: string, endDate: string) => {
  if (!validDate(startDate) || !validDate(endDate) || startDate > endDate) throw new Error("VALIDATION_FAILED");
};

async function ensureNoOverlap(tx: any, projectId: string, startDate: string, endDate: string, excludeId?: string) {
  const overlap = await tx.sprint?.findFirst({ where: { projectId, deletedAt: null, ...(excludeId ? { id: { not: excludeId } } : {}), startDate: { lte: asDate(endDate) }, endDate: { gte: asDate(startDate) } } });
  if (overlap) throw new Error("VALIDATION_FAILED");
}

async function readSprint(tx: any, id: string, projectId?: string, includeDeleted = false) {
  const row = await tx.sprint?.findFirst({ where: { id, ...(projectId ? { projectId } : {}), ...(includeDeleted ? {} : { deletedAt: null }) } });
  if (!row) throw new Error("NOT_FOUND");
  if (includeDeleted && row.deletedAt) throw new Error("CONFLICT_STATE");
  return row;
}

function requireVersion(row: Row, version: number | undefined) {
  if (version !== undefined && row.version !== version) throw new Error("CONFLICT_VERSION");
}

function requirePlanned(row: Row) { if (row.status !== "PLANNED") throw new Error("CONFLICT_STATE"); }

export function createSprintService(db: SprintDb, gate: SprintAccess, derived: Derived = createDerived(db)) {
  const mutation = async <T>(actor: Actor, projectId: string, work: (tx: any) => Promise<T>) => {
    actorCanWrite(actor);
    await access(gate, actor, projectId, true);
    return inMutationTransaction(db, (tx) => lockProjectForMutation(tx as any, projectId), (tx) => access(gate, actor, projectId, true, tx), work);
  };

  const service = {
    async list(actor: Actor, projectId: string, query: SprintQuery = { page: 0, size: 20 }) {
      if (!actor.userId || !validPage(query)) throw new Error("VALIDATION_FAILED");
      await access(gate, actor, projectId);
      const where = { projectId, deletedAt: null };
      const [items, total] = await Promise.all([
        db.sprint!.findMany({ where, orderBy: [{ startDate: "asc" }, { id: "asc" }], skip: query.page * query.size, take: query.size }),
        db.sprint!.count({ where }),
      ]);
      return { items: items.map(sprint), page: query.page, size: query.size, total };
    },

    async create(actor: Actor, projectId: string, input: SprintInput) {
      return mutation(actor, projectId, async (tx) => {
        if (!validName(input.name)) throw new Error("VALIDATION_FAILED");
        ensureDates(input.startDate, input.endDate);
        await ensureNoOverlap(tx, projectId, input.startDate, input.endDate);
        return sprint(await tx.sprint.create({ data: { projectId, name: input.name, startDate: asDate(input.startDate), endDate: asDate(input.endDate) } }));
      });
    },

    async patch(actor: Actor, sprintId: string, input: SprintPatch) {
      actorCanWrite(actor);
      return inMutationTransaction(db, async (tx: any) => {
        const current = await readSprint(tx, sprintId, undefined, true);
        await lockProjectForMutation(tx, current.projectId);
      }, async (tx: any) => {
        const current = await readSprint(tx, sprintId, undefined, true);
        await access(gate, actor, current.projectId, true, tx);
      }, async (tx: any) => {
        const current = await readSprint(tx, sprintId, undefined, true);
        requireVersion(current, input.version);
        requirePlanned(current);
        const name = input.name ?? current.name;
        const startDate = input.startDate ?? dateOnly(current.startDate);
        const endDate = input.endDate ?? dateOnly(current.endDate);
        if (!validName(name) || typeof startDate !== "string" || typeof endDate !== "string") throw new Error("VALIDATION_FAILED");
        ensureDates(startDate, endDate);
        await ensureNoOverlap(tx, current.projectId, startDate, endDate, sprintId);
        const updated = await tx.sprint.updateMany({ where: { id: sprintId, version: input.version, deletedAt: null, status: "PLANNED" }, data: { name, startDate: asDate(startDate), endDate: asDate(endDate), version: { increment: 1 } } });
        if (!updated.count) throw new Error("CONFLICT_VERSION");
        return sprint(await readSprint(tx, sprintId));
      });
    },

    async start(actor: Actor, sprintId: string, input: number | { version: number }) {
      actorCanWrite(actor);
      const version = typeof input === "number" ? input : input.version;
      return inMutationTransaction(db, async (tx: any) => {
        const current = await readSprint(tx, sprintId, undefined, true);
        await lockProjectForMutation(tx, current.projectId);
      }, async (tx: any) => {
        const current = await readSprint(tx, sprintId, undefined, true);
        await access(gate, actor, current.projectId, true, tx);
      }, async (tx: any) => {
        const current = await readSprint(tx, sprintId, undefined, true);
        requireVersion(current, version);
        requirePlanned(current);
        const active = await tx.sprint.findFirst({ where: { projectId: current.projectId, status: "ACTIVE", deletedAt: null, id: { not: sprintId } } });
        if (active) throw new Error("CONFLICT_STATE");
        const updated = await tx.sprint.updateMany({ where: { id: sprintId, version, status: "PLANNED", deletedAt: null }, data: { status: "ACTIVE", version: { increment: 1 } } });
        if (!updated.count) throw new Error("CONFLICT_VERSION");
        return sprint(await readSprint(tx, sprintId));
      });
    },

    async close(actor: Actor, sprintId: string, input: SprintClose) {
      actorCanWrite(actor);
      return inMutationTransaction(db, async (tx: any) => {
        const current = await readSprint(tx, sprintId, undefined, true);
        await lockProjectForMutation(tx, current.projectId);
      }, async (tx: any) => {
        const current = await readSprint(tx, sprintId, undefined, true);
        await access(gate, actor, current.projectId, true, tx);
      }, async (tx: any) => {
        const current = await readSprint(tx, sprintId, undefined, true);
        requireVersion(current, input.version);
        if (current.status !== "ACTIVE") throw new Error("CONFLICT_STATE");
        if (!Array.isArray(input.carryOver) || input.carryOver.length > 1000) throw new Error("VALIDATION_FAILED");
        const sourceTasks = await tx.task.findMany({ where: { projectId: current.projectId, sprintId, deletedAt: null }, select: { id: true, status: true, storyPoints: true, sprintId: true, version: true } });
        const openTasks = sourceTasks.filter((task: Row) => task.status !== "DONE");
        const ids = input.carryOver.map((item) => item?.taskId);
        if (ids.some((id) => typeof id !== "string") || new Set(ids).size !== ids.length || new Set(ids).size !== openTasks.length || openTasks.some((task: Row) => !ids.includes(task.id))) throw new Error("VALIDATION_FAILED");
        const targets = new Map<string, Row | null>();
        for (const item of input.carryOver) {
          if (item.to === "BACKLOG") { targets.set(item.taskId, null); continue; }
          if (typeof item.to !== "string" || item.to === sprintId || targets.has(item.taskId)) throw new Error("VALIDATION_FAILED");
          const target = await tx.sprint.findFirst({ where: { id: item.to, projectId: current.projectId } });
          if (!target) throw new Error("VALIDATION_FAILED");
          if (target.deletedAt) throw new Error("CONFLICT_STATE");
          if (target.status !== "PLANNED") throw new Error("CONFLICT_STATE");
          targets.set(item.taskId, target);
        }
        for (const task of openTasks) {
          const target = targets.get(task.id);
          const sprintIdValue = target?.id ?? null;
          const changed = await tx.task.updateMany({ where: { id: task.id, projectId: current.projectId, version: task.version, sprintId }, data: { sprintId: sprintIdValue, version: { increment: 1 } } });
          if (!changed.count) throw new Error("CONFLICT_VERSION");
          await writeTaskEvent(tx, { taskId: task.id, projectId: current.projectId, actorId: actor.userId, type: "SPRINT_CHANGED", fromValue: sprintId, toValue: sprintIdValue });
        }
        const completedPoints = sourceTasks.filter((task: Row) => task.status === "DONE").reduce((total: number, task: Row) => total + (task.storyPoints ?? 0), 0);
        const closed = await tx.sprint.updateMany({ where: { id: sprintId, version: input.version, status: "ACTIVE", deletedAt: null }, data: { status: "CLOSED", completedPoints, version: { increment: 1 } } });
        if (!closed.count) throw new Error("CONFLICT_VERSION");
        return sprint(await readSprint(tx, sprintId));
      });
    },

    async remove(actor: Actor, sprintId: string, input?: number | { version: number }): Promise<void> {
      actorCanWrite(actor);
      const version = typeof input === "number" ? input : input?.version;
      return inMutationTransaction(db, async (tx: any) => {
        const current = await readSprint(tx, sprintId, undefined, true);
        await lockProjectForMutation(tx, current.projectId);
      }, async (tx: any) => {
        const current = await readSprint(tx, sprintId, undefined, true);
        await access(gate, actor, current.projectId, true, tx);
      }, async (tx: any) => {
        const current = await readSprint(tx, sprintId, undefined, true);
        requireVersion(current, version);
        requirePlanned(current);
        const assignedTasks = await tx.task?.findMany({ where: { projectId: current.projectId, sprintId, deletedAt: null }, select: { id: true, version: true, sprintId: true } }) ?? [];
        for (const task of assignedTasks) {
          const cleared = await tx.task.updateMany({ where: { id: task.id, projectId: current.projectId, sprintId, version: task.version }, data: { sprintId: null, version: { increment: 1 } } });
          if (!cleared.count) throw new Error("CONFLICT_VERSION");
          await writeTaskEvent(tx, { taskId: task.id, projectId: current.projectId, actorId: actor.userId, type: "SPRINT_CHANGED", fromValue: sprintId, toValue: null });
        }
        const deleted = await tx.sprint.updateMany({ where: { id: sprintId, deletedAt: null, status: "PLANNED", ...(version === undefined ? {} : { version }) }, data: { deletedAt: new Date(), version: { increment: 1 } } });
        if (!deleted.count) throw new Error(version === undefined ? "CONFLICT_STATE" : "CONFLICT_VERSION");
      });
    },

    async progress(actor: Actor, projectId: string) {
      if (!actor.userId) throw new Error("FORBIDDEN_ROLE");
      await access(gate, actor, projectId);
      const [progress, velocity] = await Promise.all([derived.progress(projectId), derived.velocity(projectId, 3)]);
      return { ...progress, velocity };
    },

    async velocity(actor: Actor, projectId: string, limit = 3) {
      if (!actor.userId) throw new Error("FORBIDDEN_ROLE");
      await access(gate, actor, projectId);
      return derived.velocity(projectId, limit);
    },
  };
  return Object.assign(service, { delete: service.remove });
}

export const createSprints = createSprintService;
export type SprintService = ReturnType<typeof createSprintService>;
