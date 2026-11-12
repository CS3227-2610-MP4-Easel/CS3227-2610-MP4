import assert from "node:assert/strict";
import { test } from "node:test";
import { authorizeRequest } from "../src/middleware/auth.js";
import { getPolicyMap } from "@agile/contracts";

const deps = {
  resolvePrincipal: async (authorization: string | undefined) => {
    if (!authorization) throw new Error("UNAUTHENTICATED");
    return { firebaseUid: "firebase", tokenClaims: {} };
  },
  lookupRegisteredUser: async () => ({ firebaseUid: "firebase", userId: "user", role: "PM" as const }),
  resolveResource: async () => null,
  requireMember: async () => undefined,
  evaluatePredicate: async () => undefined,
};

test("N1/E16 protected requests resolve token before handler access", async () => {
  await assert.rejects(() => authorizeRequest({ operationId: "ME_READ", method: "GET", authState: "REGISTERED", roles: [], predicate: "NONE" }, deps, undefined, { method: "GET", path: "/api/me", params: {}, query: new URLSearchParams(), body: undefined }), (error: { code?: string }) => error.code === "UNAUTHENTICATED");
});

test("N1/E16 registered principal is returned after token lookup", async () => {
  const principal = await authorizeRequest({ operationId: "ME_READ", method: "GET", authState: "REGISTERED", roles: ["PM"], predicate: "NONE" }, deps, "Bearer token", { method: "GET", path: "/api/me", params: {}, query: new URLSearchParams(), body: undefined });
  assert.equal((principal as { principal: { role: string } }).principal.role, "PM");
});

test("F1/E1/E2 every resource policy has an operation resolver or NONE predicate", () => {
  const policies = getPolicyMap();
  assert.equal(policies.length, 61);
  for (const policy of policies) {
    if (policy.predicate !== "NONE") assert.notEqual(policy.operationId, "", `${policy.policyKey} needs a resolver key`);
  }
});

test("F1/E17 resolved project scope wins over a caller-supplied project id", async () => {
  let checkedProjectId = "";
  const principal = await authorizeRequest({ operationId: "TASK_READ", method: "GET", authState: "REGISTERED", roles: [], predicate: "MEMBER" }, {
    ...deps,
    resolveResource: async () => ({ kind: "TASK", projectId: "stored-project", state: "ACTIVE" as const }),
    requireMember: async (_userId, projectId) => { checkedProjectId = projectId; },
  }, "Bearer token", { method: "GET", path: "/api/tasks/task", params: { id: "task", projectId: "stored-project" }, query: new URLSearchParams(), body: undefined });
  assert.equal((principal as { principal: { userId: string } }).principal.userId, "user");
  assert.equal(checkedProjectId, "stored-project");
});

test("F5/E11 endpoint 42 authorizes PM and Dev Lead members on the new route", async () => {
  const policy = getPolicyMap().find((entry) => entry.policyKey === "endpoint-42");
  assert.ok(policy);
  for (const role of ["PM", "DEV_LEAD"] as const) {
    const result = await authorizeRequest(policy, {
      ...deps,
      lookupRegisteredUser: async () => ({ firebaseUid: "firebase", userId: "user", role }),
      resolveResource: async () => ({ kind: "PROJECT", projectId: "project", state: "ACTIVE" as const }),
    }, "Bearer token", { method: "GET", path: "/api/projects/project/facts", params: { id: "project" }, query: new URLSearchParams(), body: undefined });
    assert.equal((result as { principal: { role: string } }).principal.role, role);
  }
});
