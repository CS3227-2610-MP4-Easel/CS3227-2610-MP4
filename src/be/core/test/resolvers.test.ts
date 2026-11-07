import assert from "node:assert/strict";
import { test } from "node:test";
import { createCoreResourceResolvers } from "../src/index.js";

const projectId = "00000000-0000-4000-8000-000000000001";
const taskId = "00000000-0000-4000-8000-000000000002";

test("project operations resolve a stored active project", async () => {
  const resolvers = createCoreResourceResolvers({ project: { findFirst: async () => ({ id: projectId, status: "ACTIVE" }) } });
  assert.deepEqual(await resolvers.PROJECT_READ({ params: { projectId } }), { kind: "PROJECT", projectId, state: "ACTIVE" });
});

test("task operations resolve their stored project and hide cross-project ids", async () => {
  const resolvers = createCoreResourceResolvers({ task: { findFirst: async () => ({ id: taskId, projectId, project: { status: "ACTIVE" }, assigneeId: null }) } });
  assert.deepEqual(await resolvers.TASK_READ({ params: { id: taskId } }), { kind: "TASK", projectId, state: "ACTIVE" });
  assert.equal(await resolvers.TASK_READ({ params: { id: "not-a-uuid" } }), null);
});

test("membership mutations resolve the project and target role", async () => {
  const resolvers = createCoreResourceResolvers({ project: { findFirst: async () => ({ id: projectId, status: "ACTIVE" }) } });
  assert.deepEqual(await resolvers.PROJECT_MEMBER_ADD({ params: { projectId }, body: { role: "DEV_LEAD" } }), { kind: "MEMBERSHIP", projectId, targetRole: "DEV_LEAD", state: "ACTIVE" });
});
