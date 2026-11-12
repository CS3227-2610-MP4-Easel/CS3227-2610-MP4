import assert from "node:assert/strict";
import { test } from "node:test";
import { createApiApp } from "../src/app.js";
import { createAppDependencies } from "../src/deps.js";
import { createSprintRoutes } from "../src/routes/sprints.js";

const projectId = "00000000-0000-4000-8000-000000000001";
const sprintId = "00000000-0000-4000-8000-000000000002";
const taskId = "00000000-0000-4000-8000-000000000003";
const sprint = { id: sprintId, projectId, name: "Sprint 1", startDate: "2026-11-01", endDate: "2026-11-07", status: "PLANNED", completedPoints: null, version: 1 };

const auth = (role: "PM" | "DEV_LEAD" | "DEVELOPER" = "DEV_LEAD") => ({
  resolvePrincipal: async () => ({ firebaseUid: "firebase", tokenClaims: {} }),
  lookupRegisteredUser: async () => ({ firebaseUid: "firebase", userId: "00000000-0000-4000-8000-000000000004", role }),
  resolveResource: async () => ({ kind: "PROJECT" as const, projectId, state: "ACTIVE" as const }),
  requireMember: async () => {},
  evaluatePredicate: async () => {},
});

function app(overrides: Partial<Record<string, (...args: any[]) => Promise<any>>> = {}, role: "PM" | "DEV_LEAD" | "DEVELOPER" = "DEV_LEAD") {
  const calls: string[] = [];
  const service = {
    list: async (...args: any[]) => { calls.push("list"); return { items: [sprint], page: args[2].page, size: args[2].size, total: 1 }; },
    create: async (...args: any[]) => { calls.push("create"); return sprint; },
    patch: async (...args: any[]) => { calls.push("patch"); return { ...sprint, version: 2 }; },
    start: async (...args: any[]) => { calls.push("start"); return { ...sprint, status: "ACTIVE", version: 2 }; },
    close: async (...args: any[]) => { calls.push("close"); return { ...sprint, status: "CLOSED", version: 2 }; },
    remove: async (...args: any[]) => { calls.push("remove"); },
    progress: async (...args: any[]) => { calls.push("progress"); return { pointsTotal: 3, pointsDone: 1, percent: 33, unestimatedTasks: 0, velocity: [] }; },
    ...overrides,
  };
  const routes = createSprintRoutes({ sprints: service });
  return { app: createApiApp(createAppDependencies(auth(role), { resolveResource: async () => ({ kind: "PROJECT", projectId, state: "ACTIVE" }), requireMember: async () => {} }), routes), calls };
}

test("W14 sprint routes expose endpoints 27-33 with bounded query/body schemas", () => {
  const routes = createSprintRoutes({ sprints: {} as never });
  assert.deepEqual(routes.map((route) => route.operationId), ["SPRINT_LIST", "SPRINT_CREATE", "SPRINT_UPDATE", "SPRINT_START", "SPRINT_CLOSE", "SPRINT_DELETE", "PROJECT_PROGRESS_READ"]);
  const list = routes[0];
  assert.deepEqual((list.querySchema as any).parse({}), { page: 0, size: 20 });
  assert.throws(() => (list.querySchema as any).parse({ size: 101 }));
  const close = routes.find((route) => route.operationId === "SPRINT_CLOSE")!;
  assert.throws(() => (close.bodySchema as any).parse({ version: 1, carryOver: [], extra: true }));
});

test("W14 sprint routes pass parsed paging and mutation inputs and return the contract statuses", async () => {
  const built = app();
  const headers = { authorization: "Bearer token", "content-type": "application/json" };
  let response = await built.app.request(`http://localhost/api/projects/${projectId}/sprints?page=2&size=5`, { headers });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { items: [sprint], page: 2, size: 5, total: 1 });
  response = await built.app.request(`http://localhost/api/projects/${projectId}/sprints`, { method: "POST", headers, body: JSON.stringify({ name: "Sprint 1", startDate: "2026-11-01", endDate: "2026-11-07" }) });
  assert.equal(response.status, 201);
  response = await built.app.request(`http://localhost/api/sprints/${sprintId}`, { method: "PATCH", headers, body: JSON.stringify({ version: 1, name: "Updated" }) });
  assert.equal(response.status, 200);
  response = await built.app.request(`http://localhost/api/sprints/${sprintId}/start`, { method: "POST", headers, body: JSON.stringify({ version: 1 }) });
  assert.equal(response.status, 200);
  response = await built.app.request(`http://localhost/api/sprints/${sprintId}/close`, { method: "POST", headers, body: JSON.stringify({ version: 1, carryOver: [{ taskId, to: "BACKLOG" }] }) });
  assert.equal(response.status, 200);
  response = await built.app.request(`http://localhost/api/sprints/${sprintId}?version=1`, { method: "DELETE", headers });
  assert.equal(response.status, 204);
  response = await built.app.request(`http://localhost/api/projects/${projectId}/progress`, { headers });
  assert.equal(response.status, 200);
  assert.deepEqual(built.calls, ["list", "create", "patch", "start", "close", "remove", "progress"]);
});

test("W14 sprint mutations are denied by policy before the service is called", async () => {
  const built = app({}, "DEVELOPER");
  const response = await built.app.request(`http://localhost/api/sprints/${sprintId}/start`, { method: "POST", headers: { authorization: "Bearer token", "content-type": "application/json" }, body: JSON.stringify({ version: 1 }) });
  assert.equal(response.status, 403);
  assert.deepEqual(built.calls, []);
});

test("W14 sprint service errors map to stable conflict responses with request ids", async () => {
  const built = app({ start: async () => { throw new Error("CONFLICT_VERSION"); } });
  const response = await built.app.request(`http://localhost/api/sprints/${sprintId}/start`, { method: "POST", headers: { authorization: "Bearer token", "content-type": "application/json" }, body: JSON.stringify({ version: 1 }) });
  assert.equal(response.status, 409);
  assert.equal((await response.json() as any).error.code, "CONFLICT_VERSION");
  assert.match(response.headers.get("x-request-id") ?? "", /^[0-9a-f-]{36}$/);
});
