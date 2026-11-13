import assert from "node:assert/strict";
import { test } from "node:test";
import { NotMember } from "@agile/contracts";
import { createTasks } from "../src/tasks.js";

const projectId = "00000000-0000-4000-8000-000000000001";
const userId = "00000000-0000-4000-8000-000000000002";
const epicId = "00000000-0000-4000-8000-000000000003";
const taskId = "00000000-0000-4000-8000-000000000004";
const now = new Date("2026-11-08T00:00:00.000Z");
const access = (member = true) => ({ requireMember: async () => { if (!member) throw new NotMember(); }, archivedMembership: async () => false });
const row = (extra: Record<string, unknown> = {}) => ({ id: taskId, projectId, epicId, sprintId: null, assigneeId: null, title: "Task", description: null, acceptanceCriteria: [], status: "TODO", blocked: false, blockedReason: null, storyPoints: null, doneAt: null, createdAt: now, updatedAt: now, version: 1, ...extra });

test("E8-E10 task create rejects foreign relations and a sprint without points", async () => {
  const db = { $transaction: async (work: (tx: any) => Promise<unknown>) => work({ epic: { findFirst: async () => null }, task: { create: async () => { throw new Error("must not write"); } } }) };
  await assert.rejects(() => createTasks(db as any, access()).create({ userId, role: "PM" }, projectId, { epicId, title: "Task" }), /VALIDATION_FAILED/);
});

test("E11-E16 status transitions set doneAt, order events, reject stale and leave no-op unchanged", async () => {
  const events: string[] = [];
  let reads = 0;
  const db = { $transaction: async (work: (tx: any) => Promise<unknown>, options: unknown) => { assert.deepEqual(options, { isolationLevel: "RepeatableRead" }); return work({ task: { findFirst: async () => ++reads % 2 ? row() : row({ status: "DONE", blocked: true, blockedReason: "Waiting", doneAt: now, version: 2 }), updateMany: async () => ({ count: 1 }) }, taskEvent: { create: async (args: any) => { events.push(args.data.type); } } }); } };
  const tasks = createTasks(db as any, access());
  const changed = await tasks.status({ userId, role: "DEVELOPER" }, taskId, { status: "DONE", blocked: true, blockedReason: "Waiting", version: 1 });
  assert.equal(changed.status, "DONE"); assert.ok(changed.doneAt); assert.deepEqual(events, ["STATUS_CHANGED", "BLOCKED"]);
  await assert.rejects(() => tasks.status({ userId, role: "DEVELOPER" }, taskId, { status: "TODO", blocked: false, blockedReason: null, version: 2 }), /CONFLICT_VERSION/);
  const noopDb = { $transaction: async (work: (tx: any) => Promise<unknown>) => work({ task: { findFirst: async () => row(), updateMany: async () => { throw new Error("must not update"); } }, taskEvent: { create: async () => { throw new Error("must not event"); } } }) };
  assert.equal((await createTasks(noopDb as any, access()).status({ userId, role: "DEVELOPER" }, taskId, { status: "TODO", blocked: false, blockedReason: null, version: 1 })).version, 1);
});

test("E14 E26 and E28 reject closed sprints and roll back if event recording fails", async () => {
  const closedDb = { $transaction: async (work: (tx: any) => Promise<unknown>) => work({ task: { findFirst: async () => row() }, epic: { findFirst: async () => ({ id: epicId }) }, sprint: { findFirst: async () => ({ id: "s", status: "CLOSED" }) }, projectMember: { findFirst: async () => null } }) };
  await assert.rejects(() => createTasks(closedDb as any, access()).patch({ userId, role: "PM" }, taskId, { sprintId: "00000000-0000-4000-8000-000000000005", version: 1 }), /CONFLICT_STATE/);
  const failingDb = { $transaction: async (work: (tx: any) => Promise<unknown>) => work({ task: { create: async () => row() }, epic: { findFirst: async () => ({ id: epicId }) }, taskEvent: { create: async () => { throw new Error("event failed"); } } }) };
  await assert.rejects(() => createTasks(failingDb as any, access()).create({ userId, role: "PM" }, projectId, { epicId, title: "Task" }), /event failed/);
});

test("E37 direct calls require the endpoint actor roles", async () => {
  await assert.rejects(() => createTasks({} as any, access()).create({ userId, role: "DEVELOPER" }, projectId, { epicId, title: "Task" }), /FORBIDDEN_ROLE/);
  await assert.rejects(() => createTasks({} as any, access()).status({ userId, role: "PM" }, taskId, { status: "DONE", blocked: false, blockedReason: null, version: 1 }), /FORBIDDEN_ROLE/);
});

test("task list validates every relation filter is in the requested project", async () => {
  const foreign = "00000000-0000-4000-8000-000000000005";
  const db = { epic: { findFirst: async () => null }, sprint: { findFirst: async () => null }, projectMember: { findFirst: async () => null }, task: { findMany: async () => [], count: async () => 0 } };
  const tasks = createTasks(db as any, access());
  for (const query of [{ epicId: foreign }, { sprintId: foreign }, { assigneeId: foreign }]) await assert.rejects(() => tasks.list({ userId, role: "DEVELOPER" }, projectId, { page: 0, size: 20, ...query }), /VALIDATION_FAILED/);
});

test("patch validates the effective post-patch points for a sprint and reports version conflicts", async () => {
  const sprintId = "00000000-0000-4000-8000-000000000005";
  const db = { $transaction: async (work: (tx: any) => Promise<unknown>) => work({ task: { findFirst: async () => row({ sprintId, storyPoints: 3 }), update: async () => { throw new Error("must not update"); } }, epic: { findFirst: async () => ({ id: epicId }) }, sprint: { findFirst: async () => ({ id: sprintId, status: "ACTIVE" }) }, projectMember: { findFirst: async () => null } }) };
  await assert.rejects(() => createTasks(db as any, access()).patch({ userId, role: "PM" }, taskId, { storyPoints: null, version: 1 }), /VALIDATION_FAILED/);
  const stale = { $transaction: async (work: (tx: any) => Promise<unknown>) => work({ task: { findFirst: async () => row({ version: 2 }) } }) };
  await assert.rejects(() => createTasks(stale as any, access()).patch({ userId, role: "PM" }, taskId, { version: 1 }), /CONFLICT_VERSION/);
});

test("patch rejects any write to a task whose current sprint is closed", async () => {
  const db = { $transaction: async (work: (tx: any) => Promise<unknown>) => work({
    task: { findFirst: async () => row({ sprintId: "sprint", title: "old" }), updateMany: async () => { throw new Error("must not update"); } },
    epic: { findFirst: async () => ({ id: epicId }) },
    sprint: { findFirst: async () => ({ id: "sprint", status: "CLOSED" }) },
    project: { update: async () => ({}) },
  }) };
  await assert.rejects(() => createTasks(db as any, access()).patch({ userId, role: "PM" }, taskId, { title: "new", version: 1 }), /CONFLICT_STATE/);
});

test("patch cannot clear a task from its current closed sprint", async () => {
  const db = { $transaction: async (work: (tx: any) => Promise<unknown>) => work({
    task: { findFirst: async () => row({ sprintId: "sprint" }), updateMany: async () => { throw new Error("must not update"); } },
    epic: { findFirst: async () => ({ id: epicId }) },
    sprint: { findFirst: async () => ({ id: "sprint", status: "CLOSED" }) },
    project: { update: async () => ({}) },
  }) };
  await assert.rejects(() => createTasks(db as any, access()).patch({ userId, role: "PM" }, taskId, { sprintId: null, version: 1 }), /CONFLICT_STATE/);
});

test("patch cannot move a task from a closed sprint to an active sprint", async () => {
  const db = { $transaction: async (work: (tx: any) => Promise<unknown>) => work({
    task: { findFirst: async () => row({ sprintId: "closed", storyPoints: 3 }), updateMany: async () => { throw new Error("must not update"); } },
    epic: { findFirst: async () => ({ id: epicId }) },
    sprint: { findFirst: async ({ where }: any) => ({ id: where.id, status: where.id === "closed" ? "CLOSED" : "ACTIVE" }) },
    project: { update: async () => ({}) },
  }) };
  await assert.rejects(() => createTasks(db as any, access()).patch({ userId, role: "PM" }, taskId, { sprintId: "active", version: 1 }), /CONFLICT_STATE/);
});

test("status preserves omitted block fields", async () => {
  let reads = 0;
  const db = { $transaction: async (work: (tx: any) => Promise<unknown>) => work({ task: { findFirst: async () => ++reads === 1 ? row({ blocked: true, blockedReason: "Waiting" }) : row({ status: "IN_PROGRESS", blocked: true, blockedReason: "Waiting", version: 2 }), updateMany: async () => ({ count: 1 }) }, taskEvent: { create: async () => undefined } }) };
  const result = await createTasks(db as any, access()).status({ userId, role: "DEVELOPER" }, taskId, { status: "IN_PROGRESS", version: 1 });
  assert.equal(result.blockedReason, "Waiting");
});

test("task patch atomically compares the version with updateMany before reading the committed row", async () => {
  const writes: any[] = [];
  let reads = 0;
  const db = { $transaction: async (work: (tx: any) => Promise<unknown>) => work({
    task: {
      findFirst: async () => ++reads === 1 ? row() : row({ title: "Changed", version: 2 }),
      updateMany: async (args: any) => { writes.push(args); return { count: 1 }; },
    },
    epic: { findFirst: async () => ({ id: epicId }) },
    taskEvent: { create: async () => undefined },
  }) };
  const result = await createTasks(db as any, access()).patch({ userId, role: "PM" }, taskId, { title: "Changed", version: 1 });
  assert.equal(result.version, 2);
  assert.deepEqual(writes, [{ where: { id: taskId, version: 1 }, data: { title: "Changed", version: { increment: 1 } } }]);
  assert.equal(reads, 2);
});


test("W7c E5 adding a task to a sprint requires points and accepts 17", async () => {
  const sprintId = "00000000-0000-4000-8000-000000000005";
  let currentPoints: number | null = 17;
  let updated = false;
  const db = { $transaction: async (work: (tx: any) => Promise<unknown>) => work({
    task: { findFirst: async () => row({ storyPoints: currentPoints, sprintId: updated ? sprintId : null, version: updated ? 2 : 1 }), updateMany: async () => { updated = true; return { count: 1 }; } },
    epic: { findFirst: async () => ({ id: epicId }) }, sprint: { findFirst: async () => ({ id: sprintId, status: "ACTIVE" }) }, taskEvent: { create: async () => undefined },
  }) };
  const tasks = createTasks(db as any, access());
  assert.equal((await tasks.patch({ userId, role: "PM" }, taskId, { sprintId, version: 1 })).sprintId, sprintId);
  currentPoints = null; updated = false;
  await assert.rejects(() => tasks.patch({ userId, role: "PM" }, taskId, { sprintId, version: 1 }), /VALIDATION_FAILED/);
  assert.equal(updated, false);
});
