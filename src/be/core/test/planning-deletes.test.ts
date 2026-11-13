import assert from "node:assert/strict";
import { test } from "node:test";
import { NotMember } from "@agile/contracts";
import { createCheckpoints } from "../src/checkpoints.js";
import { createEpics } from "../src/epics.js";
import { createTasks } from "../src/tasks.js";

const projectId = "00000000-0000-4000-8000-000000000001";
const userId = "00000000-0000-4000-8000-000000000002";
const id = "00000000-0000-4000-8000-000000000003";
const pm = { userId, role: "PM" as const };
const gate = (member = true, archived = false) => ({ requireMember: async () => { if (!member) throw new NotMember(); }, archivedMembership: async () => archived });
const db = (tx: Record<string, unknown>) => ({ $transaction: async (work: (t: any) => Promise<unknown>) => work({ project: { update: async () => ({}) }, ...tx }) }) as any;
const updated = (log: any[], name: string, count = 1) => async (args: any) => { log.push([name, args]); return { count }; };

test("checkpoint delete soft-deletes under the version guard and unlinks its epics", async () => {
  const log: any[] = [];
  const row = { id, projectId, version: 4 };
  await createCheckpoints(db({ checkpoint: { findFirst: async () => row, updateMany: updated(log, "checkpoint") }, epic: { updateMany: updated(log, "epic") } }), gate()).remove(pm, id, { version: 4 });
  assert.deepEqual(log.map(([name]) => name), ["checkpoint", "epic"]);
  assert.deepEqual(log[1][1].data, { checkpointId: null, version: { increment: 1 } });
  await assert.rejects(() => createCheckpoints(db({ checkpoint: { findFirst: async () => row } }), gate()).remove(pm, id, { version: 3 }), /CONFLICT_VERSION/);
  await assert.rejects(() => createCheckpoints(db({ checkpoint: { findFirst: async () => null } }), gate()).remove(pm, id, { version: 4 }), /NOT_FOUND/);
  await assert.rejects(() => createCheckpoints(db({}), gate()).remove({ userId, role: "DEVELOPER" }, id, { version: 4 }), /FORBIDDEN_ROLE/);
});

test("epic delete cascades to its tasks and is refused while it holds a DONE task", async () => {
  const log: any[] = [];
  const row = { id, projectId, version: 2 };
  await createEpics(db({ epic: { findFirst: async () => row, updateMany: updated(log, "epic") }, task: { count: async () => 0, updateMany: updated(log, "task") } }), gate()).remove(pm, id, { version: 2 });
  assert.deepEqual(log.map(([name]) => name), ["epic", "task"]);
  await assert.rejects(() => createEpics(db({ epic: { findFirst: async () => row }, task: { count: async () => 1 } }), gate()).remove(pm, id, { version: 2 }), /CONFLICT_STATE/);
  await assert.rejects(() => createEpics(db({ epic: { findFirst: async () => row }, task: { count: async () => 0 } }), gate()).remove(pm, id, { version: 1 }), /CONFLICT_VERSION/);
  await assert.rejects(() => createEpics(db({ epic: { findFirst: async () => row }, task: { count: async () => 0 } }), gate(false, true)).remove(pm, id, { version: 2 }), /CONFLICT_STATE/);
});

test("task delete refuses DONE tasks and tasks in a CLOSED sprint, and loses a version race", async () => {
  const log: any[] = [];
  const task = (over = {}) => ({ id, projectId, version: 5, status: "TODO", sprintId: null, ...over });
  await createTasks(db({ task: { findFirst: async () => task(), updateMany: updated(log, "task") } }), gate()).remove(pm, id, { version: 5 });
  assert.equal(log.length, 1);
  await assert.rejects(() => createTasks(db({ task: { findFirst: async () => task({ status: "DONE" }) } }), gate()).remove(pm, id, { version: 5 }), /CONFLICT_STATE/);
  await assert.rejects(() => createTasks(db({ task: { findFirst: async () => task({ sprintId: "s" }) }, sprint: { findFirst: async () => ({ status: "CLOSED" }) } }), gate()).remove(pm, id, { version: 5 }), /CONFLICT_STATE/);
  await assert.rejects(() => createTasks(db({ task: { findFirst: async () => task(), updateMany: updated([], "task", 0) } }), gate()).remove(pm, id, { version: 5 }), /CONFLICT_VERSION/);
});
