import assert from "node:assert/strict";
import { test } from "node:test";
import { createCoreContextSources, registerCoreContextSources } from "../src/index.js";

const projectId = "00000000-0000-4000-8000-000000000001";
const userId = "00000000-0000-4000-8000-000000000002";
const args = { caller: { userId, role: "DEVELOPER" as const }, projectId, options: {} };
const window = { from: new Date("2026-12-01T00:00:00.000Z"), to: new Date("2026-12-02T00:00:00.000Z") };
const standupArgs = { ...args, options: { window } };

test("E19 registration adapter registers exactly four W5 core source ids", () => {
  const ids: string[] = [];
  registerCoreContextSources({}, (id) => { ids.push(id); });
  assert.deepEqual(ids, ["core.projectBrief", "core.checkpoints", "core.taskEvents", "core.blockedTasks"]);
});

test("E31-E33 and E38 sources are project/user scoped, ordered, capped, and omit oversized values", async () => {
  const sources = createCoreContextSources({
    projectMember: { findFirst: async () => ({ projectId }) },
    project: { findFirst: async () => ({ id: projectId, brief: "b".repeat(4301) }) },
    checkpoint: { findMany: async () => [{ id: "c1", projectId, name: "soon", targetDate: "2026-12-01" }] },
    taskEvent: { findMany: async (query) => { assert.deepEqual(query.where, { projectId, actorId: userId }); return [{ id: 2, projectId, taskId: "t", actorId: userId, type: "STATUS_CHANGED", at: "2026-12-01T00:00:00.000Z" }]; } },
    task: { findMany: async (query) => { assert.deepEqual(query.where, { projectId, assigneeId: userId, blocked: true }); return [{ id: "t", projectId, assigneeId: userId, title: "x".repeat(801), blockedReason: "wait" }]; } },
  });
  assert.deepEqual(await sources.projectBrief(args), []);
  assert.equal((await sources.checkpoints(args))[0].ref.type, "CHECKPOINT");
  assert.equal((await sources.taskEvents(args))[0].ownerId, userId);
  assert.deepEqual(await sources.blockedTasks(args), []);
});

test("project brief and checkpoints require membership and never emit out-of-scope rows", async () => {
  const sources = createCoreContextSources({
    projectMember: { findFirst: async ({ where }: any) => where.userId === userId ? { projectId } : null },
    project: { findFirst: async () => ({ id: "other", projectId: "other", brief: "secret" }) },
    checkpoint: { findMany: async () => [{ id: "c", projectId: "other", name: "secret", targetDate: "2026-12-01" }] },
  } as any);
  assert.deepEqual(await sources.projectBrief(args), []);
  assert.deepEqual(await sources.checkpoints(args), []);
});

test("storage failures have the source-specific core failure code", async () => {
  const sources = createCoreContextSources({ projectMember: { findFirst: async () => { throw new Error("database detail"); } } } as any);
  await assert.rejects(() => sources.projectBrief(args), /CORE_SOURCE_FAILED:core\.projectBrief/);
});

test("project brief queries only fields in the Project schema", async () => {
  let query: any;
  const sources = createCoreContextSources({ projectMember: { findFirst: async () => ({ projectId }) }, project: { findFirst: async (args) => { query = args; return { id: projectId, brief: "brief" }; } } });
  assert.deepEqual(await sources.projectBrief(args), [{ projectId, ref: { type: "PROJECT", id: projectId }, text: "brief" }]);
  assert.deepEqual(query.select, { id: true, brief: true });
});

test("core sources render storage fields and use their fixed sort order", async () => {
  const queries: any[] = [];
  const sources = createCoreContextSources({
    projectMember: { findFirst: async () => ({ projectId }) },
    checkpoint: { findMany: async (query) => { queries.push(query); return [{ id: "c", projectId, name: "Milestone", targetDate: "2026-12-01" }]; } },
    taskEvent: { findMany: async (query) => { queries.push(query); return [{ id: 2, projectId, taskId: "t", actorId: userId, type: "STATUS_CHANGED", fromValue: "TODO", toValue: "DONE", at: "2026-12-01T00:00:00.000Z" }]; } },
    task: { findMany: async (query) => { queries.push(query); return [{ id: "t", projectId, assigneeId: userId, title: "Blocked", blockedReason: "Waiting", description: "Details" }]; } },
  });
  assert.equal((await sources.checkpoints(args))[0].text, "2026-12-01: Milestone");
  assert.equal((await sources.taskEvents(standupArgs))[0].text, "2026-12-01T00:00:00.000Z STATUS_CHANGED TODO -> DONE");
  assert.equal((await sources.blockedTasks(standupArgs))[0].text, "Blocked: Waiting");
  assert.deepEqual(queries.map((query) => query.orderBy), [[{ targetDate: "asc" }, { id: "asc" }], [{ at: "desc" }, { id: "desc" }], [{ createdAt: "desc" }, { id: "desc" }]]);
  assert.deepEqual(queries[1].where.at, { gte: window.from, lt: window.to });
  assert.deepEqual(queries[2].where.createdAt, { gte: window.from, lt: window.to });
});
