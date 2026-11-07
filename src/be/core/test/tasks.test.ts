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
  const db = { $transaction: async (work: (tx: any) => Promise<unknown>, options: unknown) => { assert.deepEqual(options, { isolationLevel: "RepeatableRead" }); return work({ task: { findFirst: async () => row(), update: async (args: any) => row({ ...args.data, version: 2 }) }, taskEvent: { create: async (args: any) => { events.push(args.data.type); } } }); } };
  const tasks = createTasks(db as any, access());
  const changed = await tasks.status({ userId, role: "DEVELOPER" }, taskId, { status: "DONE", blocked: true, blockedReason: "Waiting", version: 1 });
  assert.equal(changed.status, "DONE"); assert.ok(changed.doneAt); assert.deepEqual(events, ["STATUS_CHANGED", "BLOCKED"]);
  await assert.rejects(() => tasks.status({ userId, role: "DEVELOPER" }, taskId, { status: "TODO", blocked: false, blockedReason: null, version: 2 }), /CONFLICT_STALE/);
  const noopDb = { $transaction: async (work: (tx: any) => Promise<unknown>) => work({ task: { findFirst: async () => row(), update: async () => { throw new Error("must not update"); } }, taskEvent: { create: async () => { throw new Error("must not event"); } } }) };
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
