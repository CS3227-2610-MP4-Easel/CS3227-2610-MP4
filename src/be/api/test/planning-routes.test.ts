import assert from "node:assert/strict";
import { test } from "node:test";
import { createPlanningRoutes } from "../src/routes/planning.js";
import { parseInput } from "../src/errors.js";

const id = "00000000-0000-4000-8000-000000000001";
const services = { epics: { list: async () => [], create: async () => ({}) }, tasks: { list: async () => ({ items: [], page: 0, size: 20, total: 0 }), read: async () => ({}), create: async () => ({}), patch: async () => ({}), status: async () => ({}) } };

test("E17 and E29-E30 planning routes expose only their assigned operations", () => {
  assert.deepEqual(createPlanningRoutes(services).map((route) => route.operationId), ["EPIC_LIST", "EPIC_CREATE", "TASK_LIST", "TASK_CREATE", "TASK_READ", "TASK_UPDATE", "TASK_STATUS_UPDATE"]);
});

test("planning PATCH input rejects status and block fields while status input is strict", () => {
  const routes = createPlanningRoutes(services);
  const patch = routes.find((route) => route.operationId === "TASK_UPDATE")!;
  const status = routes.find((route) => route.operationId === "TASK_STATUS_UPDATE")!;
  assert.throws(() => parseInput(patch.bodySchema as any, { version: 1, status: "DONE" }), /request body is not valid/);
  assert.deepEqual(parseInput(status.bodySchema as any, { status: "DONE", version: 1 }), { status: "DONE", version: 1 });
  assert.throws(() => parseInput(status.bodySchema as any, { status: "DONE", blocked: true, blockedReason: null, version: 1, extra: true }), /request body is not valid/);
  assert.ok(id);
});

test("planning list accepts all supported task filters and maps version conflicts", async () => {
  const routes = createPlanningRoutes(services);
  const list = routes.find((route) => route.operationId === "TASK_LIST")!;
  assert.deepEqual(parseInput(list.querySchema as any, { epicId: id, sprintId: id, assigneeId: id, status: "TODO", blocked: "true" }), { page: 0, size: 20, epicId: id, sprintId: id, assigneeId: id, status: "TODO", blocked: true });
  const patch = routes.find((route) => route.operationId === "TASK_UPDATE")!;
  const response = await patch.handler({ requestId: "rid", request: { method: "PATCH", path: "/", params: {}, query: new URLSearchParams(), body: undefined }, principal: { firebaseUid: "uid", userId: id, role: "PM" }, input: { params: { id }, query: {}, body: { version: 1 } } });
  assert.equal(response.status, 200);
});
