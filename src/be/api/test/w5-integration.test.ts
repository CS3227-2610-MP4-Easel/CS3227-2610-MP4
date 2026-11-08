import assert from "node:assert/strict";
import { test } from "node:test";
import { resetContextRegistries } from "@agile/ai-context/testing";
import { createApiApp } from "../src/app.js";
import { createCoreComposition } from "../src/core-composition.js";
import { createAppDependencies } from "../src/deps.js";

const memberId = "11111111-1111-4111-8111-111111111111";
const outsiderId = "22222222-2222-4222-8222-222222222222";
const projectId = "33333333-3333-4333-8333-333333333333";

function app(existingProject = false) {
  resetContextRegistries();
  const calls = { project: 0, membership: 0 };
  const db = {
    project: { findFirst: async () => { calls.project++; return existingProject ? { id: projectId, status: "ACTIVE" } : null; } },
    projectMember: { findFirst: async () => { calls.membership++; return null; }, findMany: async () => [] },
    checkpoint: { findMany: async () => [] }, taskEvent: { findMany: async () => [] }, task: { findMany: async () => [] },
  };
  const runtime = {
    db,
    resolvePrincipal: async (header: string | undefined) => {
      if (header === "Bearer member" || header === "Bearer outsider") return { firebaseUid: header.slice(7), tokenClaims: {} };
      throw new Error("UNAUTHENTICATED");
    },
    lookupRegisteredUser: async (firebaseUid: string) => ({ firebaseUid, userId: firebaseUid === "member" ? memberId : outsiderId, role: "PM" as const }),
    lookupUserByEmail: async () => ({ userId: outsiderId }),
    lookupUserRole: async () => "DEV_LEAD" as const,
    lookupArchivedMembership: async (userId: string, id: string) => userId === memberId && id === projectId,
  };
  const composition = createCoreComposition(runtime as never);
  return { api: createApiApp(createAppDependencies(runtime as never, composition), composition.routes), calls };
}

test("E1-E7 E17-E18 full app authenticates before parsing and conceals cross-project add-member targets", async () => {
  const { api, calls } = app(true);
  const path = `http://localhost/api/projects/${projectId}/members`;
  const unauthenticated = await api.request(path, { method: "POST", headers: { "content-type": "application/json" }, body: "{" });
  assert.equal(unauthenticated.status, 401, "invalid protected input must not disclose validation before authentication");

  const outsider = await api.request(path, { method: "POST", headers: { authorization: "Bearer outsider", "content-type": "application/json" }, body: "{" });
  assert.equal(outsider.status, 404, "a hidden project and an outsider are indistinguishable");
  assert.equal(calls.project, 1, "the target project is resolved before membership rejects the outsider");
  assert.equal(calls.membership, 1, "the 404 is membership denial, not a missing-resource shortcut");
});

test("E34-E35 full app preserves archived-member conflict precedence over malformed input", async () => {
  const response = await app().api.request(`http://localhost/api/projects/${projectId}/members`, {
    method: "POST", headers: { authorization: "Bearer member", "content-type": "application/json" }, body: "{",
  });
  assert.equal(response.status, 409);
  assert.equal((await response.json() as { error: { code: string } }).error.code, "CONFLICT_STATE");
});
