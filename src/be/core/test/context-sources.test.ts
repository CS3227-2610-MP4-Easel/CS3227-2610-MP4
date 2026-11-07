import assert from "node:assert/strict";
import { test } from "node:test";
import { createCoreContextSources, registerCoreContextSources } from "../src/index.js";

const projectId = "00000000-0000-4000-8000-000000000001";
const userId = "00000000-0000-4000-8000-000000000002";
const args = { caller: { userId, role: "DEVELOPER" as const }, projectId, options: {} };

test("E19 registration adapter registers exactly four W5 core source ids", () => {
  const ids: string[] = [];
  registerCoreContextSources({}, (id) => { ids.push(id); });
  assert.deepEqual(ids, ["core.projectBrief", "core.checkpoints", "core.taskEvents", "core.blockedTasks"]);
});

test("E31-E33 and E38 sources are project/user scoped, ordered, capped, and omit oversized values", async () => {
  const sources = createCoreContextSources({
    project: { findFirst: async () => ({ id: projectId, brief: "b".repeat(4301) }) },
    checkpoint: { findMany: async () => [{ id: "c1", name: "soon", targetDate: "2026-12-01" }] },
    taskEvent: { findMany: async (query) => { assert.deepEqual(query.where, { projectId, actorId: userId }); return [{ id: 2, taskId: "t", actorId: userId, type: "STATUS_CHANGED", at: "2026-12-01T00:00:00.000Z" }]; } },
    task: { findMany: async (query) => { assert.deepEqual(query.where, { projectId, assigneeId: userId, blocked: true }); return [{ id: "t", assigneeId: userId, title: "x".repeat(801), blockedReason: "wait" }]; } },
  });
  assert.deepEqual(await sources.projectBrief(args), []);
  assert.equal((await sources.checkpoints(args))[0].ref.type, "CHECKPOINT");
  assert.equal((await sources.taskEvents(args))[0].ownerId, userId);
  assert.deepEqual(await sources.blockedTasks(args), []);
});
