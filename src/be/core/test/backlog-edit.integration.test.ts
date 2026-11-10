import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { NotMember } from "@agile/contracts";
import { createCheckpoints } from "../src/checkpoints.js";
import { createEpics } from "../src/epics.js";
import { createSprints } from "../src/sprints.js";
import { createTasks } from "../src/tasks.js";

test("backlog edits are versioned, project-scoped and preserve unrelated records", async () => {
  if (!process.env.W1_INTEGRATION_DATABASE_URL) throw new Error("integration database required");
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.W1_INTEGRATION_DATABASE_URL }) });
  const token = randomUUID();
  const user = await db.user.create({ data: { firebaseUid: token, email: `${token}@example.test`, displayName: "Backlog test", role: "PM" } });
  const projects: string[] = [];
  try {
    const project = await db.project.create({ data: { name: "test", createdBy: user.id } });
    const other = await db.project.create({ data: { name: "other", createdBy: user.id } });
    projects.push(project.id, other.id);
    await db.projectMember.create({ data: { projectId: project.id, userId: user.id, addedBy: user.id } });
    const cp = await db.checkpoint.create({ data: { projectId: project.id, name: "Old", targetDate: new Date("2026-11-11") } });
    const foreign = await db.checkpoint.create({ data: { projectId: other.id, name: "Other", targetDate: new Date("2026-12-11") } });
    const epic = await db.epic.create({ data: { projectId: project.id, title: "Old epic", position: 0, checkpointId: cp.id } });
    const task = await db.task.create({ data: { projectId: project.id, epicId: epic.id, title: "task", createdBy: user.id } });
    const access = { requireMember: async (id: string, projectId: string, tx?: unknown) => { const client = (tx ?? db) as typeof db; if (!await client.projectMember.findFirst({ where: { userId: id, projectId } })) throw new NotMember(); }, archivedMembership: async () => false };
    const actor = { userId: user.id, role: "PM" as const };
    const checkpoints = createCheckpoints(db as any, access);
    const epics = createEpics(db as any, access);
    const updated = await checkpoints.patch(actor, cp.id, { version: 1, name: "New", targetDate: "2027-01-01" });
    assert.equal(updated.version, 2); assert.equal(updated.name, "New"); assert.equal(updated.targetDate, "2027-01-01");
    await assert.rejects(() => checkpoints.patch(actor, cp.id, { version: 1, name: "stale" }), /CONFLICT_VERSION/);
    const changed = await epics.patch(actor, epic.id, { version: 1, checkpointId: null, description: "details" });
    assert.equal(changed.version, 2); assert.equal(changed.checkpointId, null); assert.equal(changed.taskCount, 1);
    await assert.rejects(() => epics.patch(actor, epic.id, { version: 2, checkpointId: foreign.id }), /VALIDATION_FAILED/);
    await assert.rejects(() => epics.patch({ userId: user.id, role: "DEVELOPER" }, epic.id, { version: 2, title: "bad" }), /FORBIDDEN_ROLE/);
    assert.equal((await db.epic.findUniqueOrThrow({ where: { id: epic.id } })).version, 2);
    assert.equal((await db.task.findUniqueOrThrow({ where: { id: task.id } })).epicId, epic.id);
    await db.sprint.createMany({ data: [ { projectId: project.id, name: "later", startDate: new Date("2026-12-01"), endDate: new Date("2026-12-15") }, { projectId: project.id, name: "earlier", startDate: new Date("2026-11-01"), endDate: new Date("2026-11-15") }, { projectId: other.id, name: "foreign", startDate: new Date("2026-10-01"), endDate: new Date("2026-10-15") } ] });
    const races = await Promise.allSettled([epics.patch(actor, epic.id, { version: 2, title: "first" }), epics.patch(actor, epic.id, { version: 2, title: "second" })]);
    assert.equal(races.filter(r => r.status === "fulfilled").length, 1);
    assert.equal(races.filter(r => r.status === "rejected" && /CONFLICT_VERSION/.test(String(r.reason))).length, 1);
    const localSprint = await db.sprint.findFirstOrThrow({ where: { projectId: project.id, name: "earlier" } });
    const foreignSprint = await db.sprint.findFirstOrThrow({ where: { projectId: other.id } });
    const tasks = createTasks(db as any, access);
    for (const patch of [{ assigneeId: randomUUID() }, { sprintId: foreignSprint.id }, { sprintId: localSprint.id }]) {
      await assert.rejects(() => tasks.patch(actor, task.id, { ...patch, version: 1 }), /VALIDATION_FAILED/);
      assert.equal((await db.task.findUniqueOrThrow({ where: { id: task.id } })).version, 1);
      assert.equal(await db.taskEvent.count({ where: { taskId: task.id } }), 0);
    }
    const assigned = await tasks.patch(actor, task.id, { assigneeId: user.id, sprintId: localSprint.id, storyPoints: 3, version: 1 });
    assert.equal(assigned.version, 2); assert.equal(await db.taskEvent.count({ where: { taskId: task.id } }), 3);
    const cleared = await tasks.patch(actor, task.id, { assigneeId: null, sprintId: null, version: 2 });
    assert.equal(cleared.assigneeId, null); assert.equal(cleared.sprintId, null);
    assert.equal(await db.taskEvent.count({ where: { taskId: task.id } }), 5);
    const sprints = createSprints(db as any, access);
    assert.deepEqual((await sprints.list(actor, project.id)).map(x => x.name), ["earlier", "later"]);
    await assert.rejects(() => sprints.list(actor, other.id), /NOT_FOUND/);
  } finally {
    await db.taskEvent.deleteMany({ where: { projectId: { in: projects } } });
    await db.task.deleteMany({ where: { projectId: { in: projects } } });
    await db.epic.deleteMany({ where: { projectId: { in: projects } } });
    await db.checkpoint.deleteMany({ where: { projectId: { in: projects } } });
    await db.sprint.deleteMany({ where: { projectId: { in: projects } } });
    await db.projectMember.deleteMany({ where: { projectId: { in: projects } } });
    await db.project.deleteMany({ where: { id: { in: projects } } });
    await db.user.delete({ where: { id: user.id } });
    await db.$disconnect();
  }
});
