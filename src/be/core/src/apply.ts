import { z } from "zod/v3";
import { writeTaskEvent } from "./task-events.js";

type Row = Record<string, any>;
const uuid = z.string().uuid();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const storyPoints = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(5), z.literal(8), z.literal(13)]).nullable();
const task = z.object({ title: z.string().min(1).max(200), description: z.string().max(4000).optional(), acceptanceCriteria: z.array(z.string().max(300)).max(12).optional(), storyPoints, assigneeId: uuid.nullable().optional(), sprintId: uuid.nullable().optional() }).strict();
const epic = z.object({ title: z.string().min(1).max(200), description: z.string().max(4000).optional(), checkpointName: z.string().max(200).nullable().optional(), tasks: z.array(task).optional(), expansion: z.object({ status: z.string(), tasks: z.array(task).nullable() }).passthrough().optional() }).passthrough();
const planSchema = z.object({ id: uuid.optional(), projectId: uuid.optional(), version: z.number().int().positive().optional(), checkpoints: z.array(z.object({ name: z.string().min(1).max(200), targetDate: date }).strict()), epics: z.array(epic) }).passthrough();
const suggestion = z.discriminatedUnion("type", [
  z.object({ id: uuid, type: z.literal("MOVE_CHECKPOINT_DATE"), checkpointId: uuid, newTargetDate: date }).passthrough(),
  z.object({ id: uuid, type: z.literal("MOVE_EPIC_TO_CHECKPOINT"), epicId: uuid, checkpointId: uuid.nullable() }).passthrough(),
  z.object({ id: uuid, type: z.literal("REASSIGN_TASK"), taskId: uuid, assigneeId: uuid }).passthrough(),
]);
const replanSchema = z.object({ id: uuid.optional(), projectId: uuid.optional(), version: z.number().int().positive().optional(), suggestions: z.array(suggestion) }).passthrough();

export type ApplyDb = {
  user?: { findFirst(args: Row): Promise<Row | null> };
  project?: { findFirst(args: Row): Promise<Row | null> };
  projectMember?: { findFirst(args: Row): Promise<Row | null> };
  checkpoint?: { findFirst(args: Row): Promise<Row | null>; create(args: Row): Promise<Row>; update(args: Row): Promise<Row> };
  epic?: { findFirst(args: Row): Promise<Row | null>; create(args: Row): Promise<Row>; update(args: Row): Promise<Row>; count(args: Row): Promise<number> };
  task?: { findFirst(args: Row): Promise<Row | null>; create(args: Row): Promise<Row>; update(args: Row): Promise<Row> };
  sprint?: { findFirst(args: Row): Promise<Row | null> };
  taskEvent?: { create(args: Row): Promise<unknown> };
  aiProposal?: { findFirst(args: Row): Promise<Row | null>; update(args: Row): Promise<Row> };
};

async function actor(tx: ApplyDb, actorId: string) {
  const row = await tx.user?.findFirst({ where: { id: actorId }, select: { id: true, role: true } });
  if (!row || (row.role !== "PM" && row.role !== "DEV_LEAD")) throw new Error("FORBIDDEN_ROLE");
}
async function projectAccess(tx: ApplyDb, actorId: string, projectId: string) {
  const [project, member] = await Promise.all([
    tx.project?.findFirst({ where: { id: projectId }, select: { id: true, status: true } }),
    tx.projectMember?.findFirst({ where: { projectId, userId: actorId }, select: { projectId: true } }),
  ]);
  if (!project || project.status !== "ACTIVE") throw new Error("CONFLICT_STATE");
  if (!member) throw new Error("FORBIDDEN_ROLE");
}
async function proposal(tx: ApplyDb, id: string | undefined, projectId: string, kind: "PLAN" | "REPLAN", version?: number) {
  if (!id) return;
  const row = await tx.aiProposal?.findFirst({ where: { id }, select: { id: true, projectId: true, kind: true, status: true, version: true } });
  if (!row || row.projectId !== projectId || row.kind !== kind || row.status !== "PENDING" || (version !== undefined && row.version !== version)) throw new Error("CONFLICT_STATE");
}
async function applied(tx: ApplyDb, id: string | undefined, actorId: string, version?: number) {
  if (id) await tx.aiProposal?.update({ where: { id, ...(version === undefined ? {} : { version }) }, data: { status: "APPROVED", appliedBy: actorId, appliedAt: new Date(), version: { increment: 1 } } });
}

/** Apply functions receive a transaction from their caller and never start a second one. */
export function createApply() {
  return {
    async applyPlan(transaction: unknown, projectId: string, value: unknown, actorId: string): Promise<void> {
      const parsed = planSchema.safeParse(value);
      if (!parsed.success) throw new Error("VALIDATION_FAILED");
      const tx = transaction as ApplyDb;
      await actor(tx, actorId); await projectAccess(tx, actorId, projectId); await proposal(tx, parsed.data.id, projectId, "PLAN", parsed.data.version);
      const checkpoints = new Map<string, string>();
      for (const input of parsed.data.checkpoints) {
        const row = await tx.checkpoint?.create({ data: { projectId, name: input.name, targetDate: new Date(`${input.targetDate}T00:00:00.000Z`) } });
        if (!row) throw new Error("CONFLICT_STATE");
        checkpoints.set(input.name, row.id);
      }
      let position = await tx.epic?.count({ where: { projectId } }) ?? 0;
      for (const input of parsed.data.epics) {
        const checkpointId = input.checkpointName == null ? null : checkpoints.get(input.checkpointName);
        if (input.checkpointName != null && !checkpointId) throw new Error("VALIDATION_FAILED");
        const created = await tx.epic?.create({ data: { projectId, title: input.title, description: input.description ?? null, checkpointId, position: ++position } });
        if (!created) throw new Error("CONFLICT_STATE");
        const items = input.tasks ?? input.expansion?.tasks ?? [];
        for (const item of items) {
          if (item.assigneeId && !await tx.projectMember?.findFirst({ where: { projectId, userId: item.assigneeId } })) throw new Error("VALIDATION_FAILED");
          if (item.sprintId && !await tx.sprint?.findFirst?.({ where: { id: item.sprintId, projectId } } as Row)) throw new Error("VALIDATION_FAILED");
          const createdTask = await tx.task?.create({ data: { projectId, epicId: created.id, title: item.title, description: item.description ?? null, acceptanceCriteria: item.acceptanceCriteria ?? [], storyPoints: item.storyPoints, assigneeId: item.assigneeId ?? null, sprintId: item.sprintId ?? null, createdBy: actorId } });
          if (!createdTask || !tx.taskEvent) throw new Error("CONFLICT_STATE");
          await writeTaskEvent(tx as Required<Pick<ApplyDb, "taskEvent">>, { taskId: createdTask.id, projectId, actorId, type: "CREATED" });
        }
      }
      await applied(tx, parsed.data.id, actorId, parsed.data.version);
    },
    async applyReplan(transaction: unknown, projectId: string, value: unknown, actorId: string): Promise<void> {
      const parsed = replanSchema.safeParse(value);
      if (!parsed.success) throw new Error("VALIDATION_FAILED");
      const tx = transaction as ApplyDb;
      await actor(tx, actorId); await projectAccess(tx, actorId, projectId); await proposal(tx, parsed.data.id, projectId, "REPLAN", parsed.data.version);
      for (const item of parsed.data.suggestions) {
        if (item.type === "MOVE_CHECKPOINT_DATE") {
          if (!await tx.checkpoint?.findFirst({ where: { id: item.checkpointId, projectId } })) throw new Error("VALIDATION_FAILED");
          await tx.checkpoint!.update({ where: { id: item.checkpointId }, data: { targetDate: new Date(`${item.newTargetDate}T00:00:00.000Z`), version: { increment: 1 } } });
        } else if (item.type === "MOVE_EPIC_TO_CHECKPOINT") {
          if (!await tx.epic?.findFirst({ where: { id: item.epicId, projectId } })) throw new Error("VALIDATION_FAILED");
          if (item.checkpointId && !await tx.checkpoint?.findFirst({ where: { id: item.checkpointId, projectId } })) throw new Error("VALIDATION_FAILED");
          await tx.epic!.update({ where: { id: item.epicId }, data: { checkpointId: item.checkpointId, version: { increment: 1 } } });
        } else {
          const existing = await tx.task?.findFirst({ where: { id: item.taskId, projectId } });
          if (!existing || !await tx.projectMember?.findFirst({ where: { projectId, userId: item.assigneeId } })) throw new Error("VALIDATION_FAILED");
          await tx.task!.update({ where: { id: item.taskId }, data: { assigneeId: item.assigneeId, version: { increment: 1 } } });
          if (!tx.taskEvent) throw new Error("CONFLICT_STATE");
          await writeTaskEvent(tx as Required<Pick<ApplyDb, "taskEvent">>, { taskId: item.taskId, projectId, actorId, type: "ASSIGNEE_CHANGED", fromValue: existing.assigneeId ?? null, toValue: item.assigneeId });
        }
      }
      await applied(tx, parsed.data.id, actorId, parsed.data.version);
    },
  };
}

export type Apply = ReturnType<typeof createApply>;
