import assert from "node:assert/strict";
import { test } from "node:test";
import { createApiApp } from "../src/app.js";
import { createAppDependencies } from "../src/deps.js";
import { createLeadRoutes } from "../src/routes/lead.js";
import { DigestSchema, FactsSchema } from "@agile/contracts";

const projectId = "00000000-0000-4000-8000-000000000001";
const facts = { asOf: "2026-11-09T00:00:00.000Z", pointsTotal: 0, pointsDone: 0, pointsRemaining: 0, unestimatedTasks: 0, velocity: [], avgVelocity: null, projectedCompletionDate: null, checkpoints: [], overload: [] };
const digest = { id: "00000000-0000-4000-8000-000000000002", projectId, facts, explanation: null, degraded: true, flagged: false, proposalId: null, cached: false, createdAt: "2026-11-09T00:00:00.000Z" };
const auth = (role: "PM" | "DEV_LEAD" | "DEVELOPER" = "DEV_LEAD") => ({
  resolvePrincipal: async () => ({ firebaseUid: "firebase", tokenClaims: {} }),
  lookupRegisteredUser: async () => ({ firebaseUid: "firebase", userId: "00000000-0000-4000-8000-000000000003", role }),
  resolveResource: async () => ({ kind: "PROJECT" as const, projectId, state: "ACTIVE" as const }),
  requireMember: async () => {},
  evaluatePredicate: async () => {},
});
const routes = (runtime: any) => createLeadRoutes({ runtime: () => runtime });

test("endpoint 42 returns caller-member facts and endpoint 45 forces cached false", async () => {
  const runtime = { facts: async (_id: string, callerId?: string) => { assert.equal(callerId, "00000000-0000-4000-8000-000000000003"); return facts; }, createDigest: async () => digest, latestDigest: async () => ({ ...digest, cached: true }) };
  const app = createApiApp(createAppDependencies(auth(), { resolveResource: async () => ({ kind: "PROJECT", projectId, state: "ACTIVE" }), requireMember: async () => {} }), routes(runtime));
  const factsResponse = await app.request(`http://localhost/api/projects/${projectId}/facts`, { headers: { authorization: "Bearer token" } });
  const latestResponse = await app.request(`http://localhost/api/lead/projects/${projectId}/digests/latest`, { headers: { authorization: "Bearer token" } });
  assert.equal(factsResponse.status, 200);
  assert.equal(FactsSchema.safeParse(await factsResponse.json()).success, true);
  assert.equal(latestResponse.status, 200);
  assert.equal((await latestResponse.json()).cached, false);
});

test("endpoint 44 accepts only JSON {} and maps typed AI_BUSY with Retry-After", async () => {
  let calls = 0;
  const runtime = { facts: async () => facts, latestDigest: async () => null, createDigest: async () => { calls += 1; throw Object.assign(new Error("AI_BUSY"), { code: "AI_BUSY", retryAfterSeconds: 1.5 }); } };
  const app = createApiApp(createAppDependencies(auth(), { resolveResource: async () => ({ kind: "PROJECT", projectId, state: "ACTIVE" }), requireMember: async () => {} }), routes(runtime));
  const badType = await app.request(`http://localhost/api/lead/projects/${projectId}/digests`, { method: "POST", headers: { authorization: "Bearer token", "content-type": "text/plain" }, body: "{}" });
  const badBody = await app.request(`http://localhost/api/lead/projects/${projectId}/digests`, { method: "POST", headers: { authorization: "Bearer token", "content-type": "application/json" }, body: "{\"unexpected\":true}" });
  assert.equal(badType.status, 415);
  assert.equal(badBody.status, 422);
  assert.equal(calls, 0);
  const busy = await app.request(`http://localhost/api/lead/projects/${projectId}/digests`, { method: "POST", headers: { authorization: "Bearer token", "content-type": "application/json" }, body: "{}" });
  assert.equal(busy.status, 429);
  assert.equal(busy.headers.get("retry-after"), "1.5");
});

test("endpoint 45 maps missing latest digest to 404", async () => {
  const runtime = { facts: async () => facts, createDigest: async () => digest, latestDigest: async () => null };
  const app = createApiApp(createAppDependencies(auth(), { resolveResource: async () => ({ kind: "PROJECT", projectId, state: "ACTIVE" }), requireMember: async () => {} }), routes(runtime));
  const response = await app.request(`http://localhost/api/lead/projects/${projectId}/digests/latest`, { headers: { authorization: "Bearer token" } });
  assert.equal(response.status, 404);
});

test("wrong role is rejected by the policy gate before the handler", async () => {
  let called = false;
  const runtime = { facts: async () => { called = true; return facts; }, createDigest: async () => digest, latestDigest: async () => digest };
  const app = createApiApp(createAppDependencies(auth("DEVELOPER"), { resolveResource: async () => ({ kind: "PROJECT", projectId, state: "ACTIVE" }), requireMember: async () => {} }), routes(runtime));
  const response = await app.request(`http://localhost/api/lead/projects/${projectId}/digests/latest`, { headers: { authorization: "Bearer token" } });
  assert.equal(response.status, 403);
  assert.equal(called, false);
});
