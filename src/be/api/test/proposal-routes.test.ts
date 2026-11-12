import assert from "node:assert/strict";
import { test } from "node:test";
import { createApiApp } from "../src/app.js";
import { createAppDependencies } from "../src/deps.js";
import { createProposalRoutes } from "../src/routes/proposals.js";
import { ProposalError } from "@agile/proposals";

const projectId = "00000000-0000-4000-8000-000000000001";
const proposalId = "00000000-0000-4000-8000-000000000002";
const suggestionId = "00000000-0000-4000-8000-000000000003";
const proposal = { id: proposalId, projectId, kind: "REPLAN", status: "PENDING", suggestions: [], explanation: "Adjust the plan", flagged: false, createdAt: "2026-11-13T00:00:00.000Z", version: 1 };
const auth = (role: "PM" | "DEV_LEAD" | "DEVELOPER" = "DEV_LEAD") => ({
  resolvePrincipal: async () => ({ firebaseUid: "firebase", tokenClaims: {} }),
  lookupRegisteredUser: async () => ({ firebaseUid: "firebase", userId: "00000000-0000-4000-8000-000000000004", role }),
  resolveResource: async () => ({ kind: "PROJECT" as const, projectId, state: "ACTIVE" as const, ownerId: "00000000-0000-4000-8000-000000000004" }),
  requireMember: async () => {},
  evaluatePredicate: async () => {},
});

function build(overrides: Partial<Record<"list" | "approve" | "reject", (...args: any[]) => Promise<any>>> = {}, role: "PM" | "DEV_LEAD" | "DEVELOPER" = "DEV_LEAD") {
  const calls: string[] = [];
  const service = {
    list: async (...args: any[]) => { calls.push("list"); return { items: [proposal], page: args[0].page, size: args[0].size, total: 1 }; },
    approve: async (...args: any[]) => { calls.push("approve"); return { proposalId, status: "APPROVED", applied: [suggestionId], sessionOutcome: "ACCEPTED" }; },
    reject: async (...args: any[]) => { calls.push("reject"); return { ...proposal, status: "REJECTED", version: 2, sessionOutcome: "REJECTED" }; },
    ...overrides,
  };
  const routes = createProposalRoutes({ proposals: service });
  return { app: createApiApp(createAppDependencies(auth(role), { resolveResource: async () => ({ kind: "PROJECT", projectId, state: "ACTIVE", ownerId: auth(role).lookupRegisteredUser ? "00000000-0000-4000-8000-000000000004" : undefined } as any), requireMember: async () => {} }), routes), calls };
}

test("W14 proposal routes expose list, approve and reject with exact schemas", () => {
  const routes = createProposalRoutes({ proposals: {} as never });
  assert.deepEqual(routes.map((route) => route.operationId), ["LEAD_PROPOSAL_LIST", "LEAD_PROPOSAL_APPROVE", "LEAD_PROPOSAL_REJECT"]);
  assert.deepEqual((routes[0].querySchema as any).parse({}), { page: 0, size: 20 });
  assert.throws(() => (routes[0].querySchema as any).parse({ size: 101 }));
  assert.throws(() => (routes[1].bodySchema as any).parse({ version: 1, suggestionIds: [suggestionId], extra: true }));
});

test("W14 proposal routes pass actor, project and decision inputs", async () => {
  const built = build();
  const headers = { authorization: "Bearer token", "content-type": "application/json" };
  let response = await built.app.request(`http://localhost/api/lead/projects/${projectId}/proposals?page=1&size=10`, { headers });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { items: [proposal], page: 1, size: 10, total: 1 });
  response = await built.app.request(`http://localhost/api/lead/proposals/${proposalId}/approve`, { method: "POST", headers, body: JSON.stringify({ version: 1, suggestionIds: [suggestionId] }) });
  assert.equal(response.status, 200);
  response = await built.app.request(`http://localhost/api/lead/proposals/${proposalId}/reject`, { method: "POST", headers, body: JSON.stringify({ version: 1 }) });
  assert.equal(response.status, 200);
  assert.deepEqual(built.calls, ["list", "approve", "reject"]);
});

test("W14 proposal endpoint 48 remains role-gated and maps ProposalError without leaking details", async () => {
  const built = build({ reject: async () => { throw new ProposalError("CONFLICT_VERSION"); } });
  const headers = { authorization: "Bearer token", "content-type": "application/json" };
  const response = await built.app.request(`http://localhost/api/lead/proposals/${proposalId}/reject`, { method: "POST", headers, body: JSON.stringify({ version: 1 }) });
  assert.equal(response.status, 409);
  assert.equal((await response.json() as any).error.code, "CONFLICT_VERSION");
  const denied = build({}, "PM");
  const forbidden = await denied.app.request(`http://localhost/api/lead/proposals/${proposalId}/reject`, { method: "POST", headers, body: JSON.stringify({ version: 1 }) });
  assert.equal(forbidden.status, 403);
  assert.deepEqual(denied.calls, []);
});
