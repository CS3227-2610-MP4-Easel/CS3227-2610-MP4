import assert from "node:assert/strict";
import { test } from "node:test";
import { createApiApp, type AuthDependencies } from "../src/index.js";
import { createPlanningRoutes } from "../src/routes/planning.js";
import { expandOutputSchema } from "../../pm/src/schemas.js";

const id = "00000000-0000-4000-8000-000000000001";
const deps: AuthDependencies = {
  resolvePrincipal: async () => ({ firebaseUid: "f", tokenClaims: {} }),
  lookupRegisteredUser: async () => ({ firebaseUid: "f", userId: "u", role: "PM" }),
  beginTransaction: async () => ({ commit: async () => {}, rollback: async () => {} }),
  resolveResource: async () => ({ kind: "TASK", projectId: id, state: "ACTIVE" }),
  requireMember: async () => undefined,
  evaluatePredicate: async () => undefined,
};

test("W7c E1 E2 E3 task create and patch validate points at the route", async () => {
  const calls: any[] = [];
  const record = async (_actor: unknown, _id: unknown, input: unknown) => { calls.push(input); return {}; };
  const app = createApiApp(deps, createPlanningRoutes({ epics: {} as any, sprints: {} as any, tasks: { create: record, patch: record } as any }));
  for (const [method, path, base] of [["POST", `/api/projects/${id}/tasks`, { epicId: id, title: "Task" }], ["PATCH", `/api/tasks/${id}`, { version: 1 }]] as const) {
    const request = (storyPoints: unknown) => app.request(`http://localhost${path}`, { method, headers: { authorization: "Bearer ok", "content-type": "application/json" }, body: JSON.stringify({ ...base, storyPoints }) });
    for (const value of [0, -1, -0, 21, 1.5, "5", "20", true, 2147483648]) {
      const before = calls.length;
      const response = await request(value);
      assert.equal(response.status, 422, `${method} ${value}`);
      const result = await response.json() as any;
      assert.equal(result.error.code, "VALIDATION_FAILED");
      assert.ok(result.error.details.some((d: any) => d.field === "storyPoints" && d.message === "Must be a whole number from 1 to 20."));
      assert.equal(calls.length, before);
    }
    for (const value of [1, 20, 20.0, 1e1, null, undefined]) {
      const response = await request(value);
      assert.equal(response.status, method === "POST" ? 201 : 200, `${method} ${value}`);
      assert.equal(calls.at(-1).storyPoints, value);
    }
  }
});

test("W7c E3 expand output requires points", () => {
  const task = { title: "Task", description: "d", acceptanceCriteria: ["ok"] };
  for (const storyPoints of [null, undefined]) assert.equal(expandOutputSchema.safeParse({ tasks: [{ ...task, storyPoints }] }).success, false);
});
