import assert from "node:assert/strict";
import { test } from "node:test";
import { createProjectsRoutes } from "../src/routes/projects.js";
import { CheckpointCreateBodySchema, createCheckpointsRoutes } from "../src/routes/checkpoints.js";
import { parseInput } from "../src/errors.js";

test("E18 route factories provide validated-input routes without a database dependency", async () => {
  const projectRoutes = createProjectsRoutes({ create: async () => ({ id: "project" }), list: async () => ({ items: [], page: 0, size: 20, total: 0 }), detail: async () => ({ id: "project" }), update: async () => ({ id: "project" }), members: async () => [], addMember: async () => ({ member: { userId: "user" }, created: true }), removeMember: async () => {} });
  const checkpointRoutes = createCheckpointsRoutes({ list: async () => [], create: async () => ({ id: "checkpoint" }), patch: async () => ({}) });
  assert.deepEqual(projectRoutes.map((route) => route.operationId), ["PM_PROJECT_CREATE", "PROJECT_LIST", "PROJECT_READ", "PM_PROJECT_UPDATE", "PROJECT_MEMBER_LIST", "PROJECT_MEMBER_ADD", "PROJECT_MEMBER_REMOVE"]);
  assert.deepEqual(checkpointRoutes.map((route) => route.operationId), ["CHECKPOINT_LIST", "CHECKPOINT_CREATE", "CHECKPOINT_UPDATE"]);
  assert.ok(projectRoutes.every((route) => typeof route.handler === "function"));
});

test("E5 repeated add sends the existing member with 200", async () => {
  const add = createProjectsRoutes({ create: async () => ({}), list: async () => ({}), detail: async () => ({}), update: async () => ({}), members: async () => [], addMember: async () => ({ member: { userId: "user" }, created: false }), removeMember: async () => {} }).find((route) => route.operationId === "PROJECT_MEMBER_ADD")!;
  const response = await add.handler({ requestId: "rid", request: { method: "POST", path: "/", params: {}, query: new URLSearchParams(), body: undefined }, principal: { firebaseUid: "uid", userId: "user", role: "PM" }, input: { params: { projectId: "00000000-0000-4000-8000-000000000001" }, query: {}, body: { email: "lead@example.test" } } });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { userId: "user" });
});

test("E18 impossible checkpoint dates are rejected as 422 input", () => {
  assert.throws(() => parseInput(CheckpointCreateBodySchema, { name: "M1", targetDate: "2026-02-31" }), (error: { code?: string }) => error.code === "VALIDATION_FAILED");
});
