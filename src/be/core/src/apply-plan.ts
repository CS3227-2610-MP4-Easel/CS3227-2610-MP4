import { randomUUID } from "node:crypto";
import { NotMember } from "@agile/contracts";
import type { FilteredTransactionClient } from "@agile/db";
import { countPlan, PlanInputSchema } from "./plan-input.js";

/**
 * Inserts a plan's checkpoints, epics, tasks and CREATED events in the caller's transaction.
 * Never catches: any throw must roll the caller's transaction back. Ids come only from here.
 */
export async function applyPlan(
  tx: FilteredTransactionClient,
  projectId: string,
  plan: unknown,
  actorId: string,
  deps: { count?: typeof countPlan } = {},
): Promise<void> {
  const parsed = PlanInputSchema.safeParse(plan);
  if (!parsed.success) throw new Error("INVALID_PLAN");
  const input = parsed.data;

  // Lock the project row; an archived or missing project is not visible to the filtered client.
  try {
    await tx.project.update({ where: { id: projectId }, data: { updatedAt: new Date() } });
  } catch (error) {
    if ((error as { code?: string }).code === "P2025") throw new Error("CONFLICT_STATE");
    throw error;
  }

  const [actor, membership] = await Promise.all([
    tx.user.findUnique({ where: { id: actorId }, select: { role: true } }),
    tx.projectMember.findUnique({ where: { projectId_userId: { projectId, userId: actorId } }, select: { userId: true } }),
  ]);
  if (!membership) throw new NotMember();
  if (!actor || actor.role !== "PM") throw new Error("FORBIDDEN_ROLE");

  const base = ((await tx.epic.aggregate({ where: { projectId }, _max: { position: true } }))._max.position ?? -1) + 1;

  const checkpointIds = new Map(input.checkpoints.map((checkpoint) => [checkpoint.name, randomUUID()]));
  const checkpoints = input.checkpoints.map((checkpoint) => ({
    id: checkpointIds.get(checkpoint.name) as string,
    projectId,
    name: checkpoint.name,
    targetDate: new Date(`${checkpoint.targetDate}T00:00:00Z`),
    version: 1,
  }));
  const epics: Array<{ id: string; projectId: string; checkpointId: string | null; title: string; description: string; position: number; version: number }> = [];
  const tasks: Array<{ id: string; projectId: string; epicId: string; title: string; description: string; acceptanceCriteria: string[]; storyPoints: number; createdBy: string; version: number }> = [];
  for (const [index, epic] of input.epics.entries()) {
    const epicId = randomUUID();
    epics.push({
      id: epicId,
      projectId,
      checkpointId: epic.checkpointName === null ? null : (checkpointIds.get(epic.checkpointName) ?? null),
      title: epic.title,
      description: epic.description,
      position: base + index,
      version: 1,
    });
    for (const task of epic.tasks) {
      tasks.push({ id: randomUUID(), projectId, epicId, title: task.title, description: task.description, acceptanceCriteria: task.acceptanceCriteria, storyPoints: task.storyPoints, createdBy: actorId, version: 1 });
    }
  }
  const events = tasks.map((task) => ({ taskId: task.id, projectId, actorId, type: "CREATED" as const, fromValue: null, toValue: "TODO" }));

  const inserted = {
    checkpoints: (await tx.checkpoint.createMany({ data: checkpoints })).count,
    epics: (await tx.epic.createMany({ data: epics })).count,
    tasks: (await tx.task.createMany({ data: tasks })).count,
    events: (await tx.taskEvent.createMany({ data: events })).count,
  };
  const expected = (deps.count ?? countPlan)(input);
  if (inserted.checkpoints !== expected.checkpoints || inserted.epics !== expected.epics || inserted.tasks !== expected.tasks || inserted.events !== expected.tasks) {
    throw new Error("INVALID_PLAN");
  }
}
