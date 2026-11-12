import assert from "node:assert/strict";
import { test } from "node:test";
import { createApiApp } from "../src/app.js";
import { createAppDependencies } from "../src/deps.js";
import { createCoreComposition } from "../src/core-composition.js";
import { resetContextRegistries } from "@agile/ai-context/testing";

test("F6 route registration exposes only the W1 health handler", async () => {
  const response = await createApiApp().request("http://localhost/api/not-w1");
  assert.equal(response.status, 404);
});

test("production composition gives archived members 409 and non-members 404 before ADDER body parsing", async () => {
  resetContextRegistries();
  const archivedMember = "11111111-1111-4111-8111-111111111111";
  const outsider = "22222222-2222-4222-8222-222222222222";
  const projectId = "33333333-3333-4333-8333-333333333333";
  const db = {
    project: { findFirst: async () => null },
    projectMember: { findFirst: async () => null, findMany: async () => [] },
    checkpoint: { findMany: async () => [] }, taskEvent: { findMany: async () => [] }, task: { findMany: async () => [] },
  };
  const runtime = {
    db,
    resolvePrincipal: async (header: string | undefined) => ({ firebaseUid: header === "Bearer member" ? "member" : "outsider", tokenClaims: {} }),
    lookupRegisteredUser: async (firebaseUid: string) => ({ firebaseUid, userId: firebaseUid === "member" ? archivedMember : outsider, role: "PM" as const }),
    lookupUserByEmail: async () => ({ userId: "44444444-4444-4444-8444-444444444444" }),
    lookupUserRole: async () => "DEV_LEAD" as const,
    lookupArchivedMembership: async (userId: string, id: string) => userId === archivedMember && id === projectId,
  };
  const composition = createCoreComposition(runtime as never);
  const app = createApiApp(createAppDependencies(runtime as never, composition), composition.routes);
  const member = await app.request(`http://localhost/api/projects/${projectId}/members`, { method: "POST", headers: { authorization: "Bearer member", "content-type": "application/json" }, body: "{" });
  const nonMember = await app.request(`http://localhost/api/projects/${projectId}/members`, { method: "POST", headers: { authorization: "Bearer outsider", "content-type": "application/json" }, body: "{" });
  assert.equal(member.status, 409);
  assert.equal(nonMember.status, 404);
});
