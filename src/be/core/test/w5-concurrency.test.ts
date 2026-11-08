import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { createDerived, createTasks } from "../src/index.js";
import { integrationUrl } from "../../llm-gateway/test/fakes.js";

const projectId = "00000000-0000-4000-8000-000000000001";
const actorId = "00000000-0000-4000-8000-000000000002";
const epicId = "00000000-0000-4000-8000-000000000003";
const taskId = "00000000-0000-4000-8000-000000000004";
const row = { id: taskId, projectId, epicId, sprintId: null, assigneeId: null, title: "Task", description: null, acceptanceCriteria: [], status: "TODO", blocked: false, blockedReason: null, storyPoints: 3, doneAt: null, createdAt: new Date(0), updatedAt: new Date(0), version: 2 };
const access = { requireMember: async () => undefined, archivedMembership: async () => false };

test("E15 E27 E28 stale task writes and event faults leave the transaction with no committed mutation", async () => {
  let writes = 0;
  const db = {
    $transaction: async (work: (tx: unknown) => Promise<unknown>) => {
      const before = writes;
      try { return await work({ task: { findFirst: async () => row, update: async () => { writes++; return row; } }, epic: { findFirst: async () => ({ id: epicId }) }, taskEvent: { create: async () => { throw new Error("event failed"); } } }); }
      catch (error) { writes = before; throw error; }
    },
  };
  const tasks = createTasks(db as never, access);
  await assert.rejects(() => tasks.patch({ userId: actorId, role: "PM" }, taskId, { title: "changed", version: 1 }), /CONFLICT_VERSION/);
  await assert.rejects(() => tasks.patch({ userId: actorId, role: "PM" }, taskId, { storyPoints: 5, version: 2 }), /event failed/);
  assert.equal(writes, 0);
});

test("E33 derived progress is a single filtered snapshot, never a mix of separate aggregate reads", async () => {
  let reads = 0;
  const derived = createDerived({ task: { findMany: async (args: unknown) => { reads++; assert.deepEqual(args, { where: { projectId }, select: { storyPoints: true, status: true } }); return [{ storyPoints: 3, status: "DONE" }, { storyPoints: null, status: "TODO" }]; } } });
  assert.deepEqual(await derived.progress(projectId), { pointsTotal: 3, pointsDone: 3, percent: 100, unestimatedTasks: 1 });
  assert.equal(reads, 1);
});

const skipIntegration = !integrationUrl;

test("E28 real database transaction rolls task creation back when its event insert fails", { skip: skipIntegration }, async () => {
  const base = new PrismaClient({ adapter: new PrismaPg({ connectionString: integrationUrl! }) });
  const token = randomUUID();
  let userId = "";
  let integrationProjectId = "";
  try {
    const user = await base.user.create({ data: { firebaseUid: token, email: `${token}@example.test`, displayName: "Rollback test", role: "PM" } });
    userId = user.id;
    const project = await base.project.create({ data: { name: "Rollback test", createdBy: user.id } });
    integrationProjectId = project.id;
    await base.projectMember.create({ data: { projectId: project.id, userId: user.id, addedBy: user.id } });
    const epic = await base.epic.create({ data: { projectId: project.id, title: "Rollback epic", position: 1 } });
    const failingDb = {
      $transaction: async (work: (tx: unknown) => Promise<unknown>, options: unknown) => (base as any).$transaction(async (tx: any) => work(new Proxy(tx, {
        get(target, property, receiver) {
          if (property === "taskEvent") return new Proxy(target.taskEvent, { get(eventTarget, eventProperty, eventReceiver) { return eventProperty === "create" ? async () => { throw new Error("injected event failure"); } : Reflect.get(eventTarget, eventProperty, eventReceiver); } });
          return Reflect.get(target, property, receiver);
        },
      })), options),
    };
    await assert.rejects(() => createTasks(failingDb as never, access).create({ userId: user.id, role: "PM" }, project.id, { epicId: epic.id, title: "Must roll back" }), /injected event failure/);
    assert.equal(await base.task.count({ where: { projectId: project.id } }), 0);
    assert.equal(await base.taskEvent.count({ where: { projectId: project.id } }), 0);
  } finally {
    if (integrationProjectId) {
      await base.taskEvent.deleteMany({ where: { projectId: integrationProjectId } });
      await base.task.deleteMany({ where: { projectId: integrationProjectId } });
      await base.epic.deleteMany({ where: { projectId: integrationProjectId } });
      await base.projectMember.deleteMany({ where: { projectId: integrationProjectId } });
      await base.project.delete({ where: { id: integrationProjectId } });
    }
    if (userId) await base.user.delete({ where: { id: userId } });
    await base.$disconnect();
  }
});
