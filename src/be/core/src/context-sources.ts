import type { UserRole } from "@agile/contracts";

type Row = Record<string, any>;

export type CoreContextRow = { projectId: string; ref: { type: "PROJECT" | "CHECKPOINT" | "TASK" | "TASK_EVENT"; id: string }; ownerId?: string; text: string };
/** Structurally compatible with ai-context's public SourceArgs, without importing that package. */
export type CoreContextSource = (args: { caller: { userId: string; role: UserRole }; projectId: string; options: Readonly<{ query?: string; itemIds?: string[]; window?: { from: Date; to: Date } }> }) => Promise<CoreContextRow[]>;
export type CoreContextRegister = (id: "core.projectBrief" | "core.checkpoints" | "core.taskEvents" | "core.blockedTasks", source: CoreContextSource) => void;

export type ContextSourceDb = {
  project?: { findFirst(args: Row): Promise<Row | null> };
  checkpoint?: { findMany(args: Row): Promise<Row[]> };
  taskEvent?: { findMany(args: Row): Promise<Row[]> };
  task?: { findMany(args: Row): Promise<Row[]> };
};

const chars = (value: unknown, max: number): string | null => typeof value === "string" && [...value].length <= max ? value : null;
const text = (parts: Array<[string, unknown]>, max: number) => {
  const rendered = parts.filter(([, value]) => value !== null && value !== undefined && value !== "").map(([key, value]) => `${key}: ${String(value)}`).join("\n");
  return chars(rendered, max);
};

/** Source-side caps deliberately omit an over-limit row; ai-context should never receive a truncated value. */
export function createCoreContextSources(db: ContextSourceDb): Readonly<Record<"projectBrief" | "checkpoints" | "taskEvents" | "blockedTasks", CoreContextSource>> {
  return Object.freeze({
    projectBrief: async ({ projectId }) => {
      const row = await db.project?.findFirst({ where: { id: projectId }, select: { id: true, brief: true } });
      const rendered = chars(row?.brief, 4300);
      return row && rendered ? [{ projectId, ref: { type: "PROJECT", id: row.id }, text: rendered }] : [];
    },
    checkpoints: async ({ projectId }) => {
      const rows = await db.checkpoint?.findMany({ where: { projectId }, orderBy: [{ targetDate: "asc" }, { id: "asc" }], take: 50, select: { id: true, name: true, targetDate: true } }) ?? [];
      return rows.flatMap((row) => {
        const rendered = text([["name", row.name], ["target_date", row.targetDate instanceof Date ? row.targetDate.toISOString().slice(0, 10) : row.targetDate]], 300);
        return rendered ? [{ projectId, ref: { type: "CHECKPOINT" as const, id: row.id }, text: rendered }] : [];
      });
    },
    taskEvents: async ({ caller, projectId }) => {
      const rows = await db.taskEvent?.findMany({ where: { projectId, actorId: caller.userId }, orderBy: [{ at: "desc" }, { id: "desc" }], take: 200, select: { id: true, taskId: true, actorId: true, type: true, fromValue: true, toValue: true, at: true } }) ?? [];
      return rows.flatMap((row) => {
        const rendered = text([["task", row.taskId], ["event", row.type], ["from", row.fromValue], ["to", row.toValue], ["at", row.at instanceof Date ? row.at.toISOString() : row.at]], 400);
        return rendered ? [{ projectId, ref: { type: "TASK_EVENT" as const, id: String(row.id) }, ownerId: row.actorId, text: rendered }] : [];
      });
    },
    blockedTasks: async ({ caller, projectId }) => {
      const rows = await db.task?.findMany({ where: { projectId, assigneeId: caller.userId, blocked: true }, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], take: 50, select: { id: true, assigneeId: true, title: true, description: true, blockedReason: true } }) ?? [];
      return rows.flatMap((row) => {
        const rendered = text([["title", row.title], ["reason", row.blockedReason], ["description", row.description]], 800);
        return rendered ? [{ projectId, ref: { type: "TASK" as const, id: row.id }, ownerId: row.assigneeId, text: rendered }] : [];
      });
    },
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
