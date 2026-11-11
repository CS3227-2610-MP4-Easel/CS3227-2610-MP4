import type { UserRole } from "@agile/contracts";

type Row = Record<string, any>;

export type CoreContextRow = { projectId: string; ref: { type: "PROJECT" | "CHECKPOINT" | "TASK" | "TASK_EVENT"; id: string }; ownerId?: string; text: string };
/** Structurally compatible with ai-context's public SourceArgs, without importing that package. */
export type CoreContextSource = (args: { caller: { userId: string; role: UserRole }; projectId: string; options: Readonly<{ query?: string; itemIds?: string[]; window?: { from: Date; to: Date } }> }) => Promise<CoreContextRow[]>;
export type CoreContextRegister = (id: "core.projectBrief" | "core.checkpoints" | "core.taskEvents" | "core.blockedTasks", source: CoreContextSource) => void;

export type ContextSourceDb = {
  project?: { findFirst(args: Row): Promise<Row | null> };
  projectMember?: { findFirst(args: Row): Promise<Row | null> };
  checkpoint?: { findMany(args: Row): Promise<Row[]> };
  taskEvent?: { findMany(args: Row): Promise<Row[]> };
  task?: { findMany(args: Row): Promise<Row[]> };
};

const chars = (value: unknown, max: number): string | null => typeof value === "string" && [...value].length <= max ? value : null;
const source = async <T>(id: string, work: () => Promise<T>): Promise<T> => {
  try { return await work(); } catch { throw new Error(`CORE_SOURCE_FAILED:${id}`); }
};
const member = async (db: ContextSourceDb, userId: string, projectId: string) =>
  Boolean(await db.projectMember?.findFirst({ where: { userId, projectId, project: { status: "ACTIVE" } }, select: { projectId: true } }));

/** Source-side caps deliberately omit an over-limit row; ai-context should never receive a truncated value. */
export function createCoreContextSources(db: ContextSourceDb): Readonly<Record<"projectBrief" | "checkpoints" | "taskEvents" | "blockedTasks", CoreContextSource>> {
  return Object.freeze({
    projectBrief: async ({ caller, projectId }) => source("core.projectBrief", async () => {
      if (!await member(db, caller.userId, projectId)) return [];
      const row = await db.project?.findFirst({ where: { id: projectId }, select: { id: true, brief: true } });
      const rendered = chars(row?.brief, 4300);
      return row && row.id === projectId && rendered ? [{ projectId, ref: { type: "PROJECT", id: row.id }, text: rendered }] : [];
    }),
    checkpoints: async ({ caller, projectId }) => source("core.checkpoints", async () => {
      if (!await member(db, caller.userId, projectId)) return [];
      const rows = await db.checkpoint?.findMany({ where: { projectId }, orderBy: [{ targetDate: "asc" }, { id: "asc" }], take: 50, select: { id: true, projectId: true, name: true, targetDate: true } }) ?? [];
      return rows.filter((row) => row.projectId === projectId).flatMap((row) => {
        const targetDate = row.targetDate instanceof Date ? row.targetDate.toISOString().slice(0, 10) : row.targetDate;
        const rendered = chars(`${targetDate}: ${row.name}`, 300);
        return rendered ? [{ projectId, ref: { type: "CHECKPOINT" as const, id: row.id }, text: rendered }] : [];
      });
    }),
    taskEvents: async ({ caller, projectId, options }) => source("core.taskEvents", async () => {
      if (!await member(db, caller.userId, projectId)) return [];
      const window = options.window ? { at: { gte: options.window.from, lt: options.window.to } } : {};
      const rows = await db.taskEvent?.findMany({ where: { projectId, actorId: caller.userId, ...window }, orderBy: [{ at: "desc" }, { id: "desc" }], take: 200, select: { id: true, projectId: true, taskId: true, actorId: true, type: true, fromValue: true, toValue: true, at: true } }) ?? [];
      return rows.filter((row) => row.projectId === projectId && row.actorId === caller.userId).flatMap((row) => {
        const at = row.at instanceof Date ? row.at.toISOString() : row.at;
        const rendered = chars(`${at} ${row.type} ${row.fromValue ?? ""} -> ${row.toValue ?? ""}`, 400);
        return rendered ? [{ projectId, ref: { type: "TASK_EVENT" as const, id: String(row.id) }, ownerId: row.actorId, text: rendered }] : [];
      });
    }),
    // Blocked now, whenever created: the standup window does not apply to a current blocker.
    blockedTasks: async ({ caller, projectId }) => source("core.blockedTasks", async () => {
      if (!await member(db, caller.userId, projectId)) return [];
      const rows = await db.task?.findMany({ where: { projectId, assigneeId: caller.userId, blocked: true }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 50, select: { id: true, projectId: true, assigneeId: true, title: true, blockedReason: true, createdAt: true } }) ?? [];
      return rows.filter((row) => row.projectId === projectId && row.assigneeId === caller.userId).flatMap((row) => {
        const rendered = chars(`${row.title}: ${row.blockedReason ?? ""}`, 800);
        return rendered ? [{ projectId, ref: { type: "TASK" as const, id: row.id }, ownerId: row.assigneeId, text: rendered }] : [];
      });
    }),
  });
}

/** Composition root supplies ai-context's registration function, keeping core independent of that package. */
export function registerCoreContextSources(db: ContextSourceDb, register: CoreContextRegister): void {
  const sources = createCoreContextSources(db);
  register("core.projectBrief", sources.projectBrief);
  register("core.checkpoints", sources.checkpoints);
  register("core.taskEvents", sources.taskEvents);
  register("core.blockedTasks", sources.blockedTasks);
}
