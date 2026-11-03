import assert from "node:assert/strict";
import { test } from "node:test";
import { authorizeRequest } from "../src/middleware/auth.js";

test("E6/E9 member predicate hides missing or cross-project resources as NOT_FOUND", async () => {
  const deps = {
    resolvePrincipal: async () => ({ firebaseUid: "firebase", tokenClaims: {} }),
    lookupRegisteredUser: async () => ({ firebaseUid: "firebase", userId: "user", role: "PM" as const }),
    resolveResource: async () => ({ kind: "TASK", projectId: "project", state: "ACTIVE" as const }),
    requireMember: async () => { throw new Error("NOT_FOUND"); },
    evaluatePredicate: async () => undefined,
  };
  await assert.rejects(() => authorizeRequest({ operationId: "TASK_READ", method: "GET", authState: "REGISTERED", roles: [], predicate: "MEMBER" }, deps, "Bearer token", { method: "GET", path: "/api/tasks/task", params: { id: "task" }, query: new URLSearchParams(), body: undefined }), (error: { code?: string }) => error.code === "NOT_FOUND");
});

test("F1/E2a archived write returns CONFLICT_STATE before predicate or handler", async () => {
  let evaluated = false;
  await assert.rejects(() => authorizeRequest({ operationId: "TASK_UPDATE", method: "PATCH", authState: "REGISTERED", roles: ["PM"], predicate: "MEMBER" }, {
    resolvePrincipal: async () => ({ firebaseUid: "firebase", tokenClaims: {} }),
    lookupRegisteredUser: async () => ({ firebaseUid: "firebase", userId: "user", role: "PM" as const }),
    resolveResource: async () => ({ kind: "TASK", projectId: "project", state: "ARCHIVED" as const }),
    requireMember: async () => undefined,
    evaluatePredicate: async () => { evaluated = true; },
  }, "Bearer token", { method: "PATCH", path: "/api/tasks/task", params: { id: "task" }, query: new URLSearchParams(), body: undefined }), (error: { code?: string; status?: number }) => error.code === "CONFLICT_STATE" && error.status === 409);
  assert.equal(evaluated, false);
});

test("archived writes hide the project state from non-members", async () => {
  await assert.rejects(() => authorizeRequest({ operationId: "TASK_UPDATE", method: "PATCH", authState: "REGISTERED", roles: ["PM"], predicate: "MEMBER" }, {
    resolvePrincipal: async () => ({ firebaseUid: "firebase", tokenClaims: {} }),
    lookupRegisteredUser: async () => ({ firebaseUid: "firebase", userId: "outsider", role: "PM" as const }),
    resolveResource: async () => ({ kind: "TASK", projectId: "archived-project", state: "ARCHIVED" as const }),
    requireMember: async () => { throw new Error("NOT_FOUND"); },
    evaluatePredicate: async () => { throw new Error("must not run"); },
  }, "Bearer token", { method: "PATCH", path: "/api/tasks/task", params: { id: "task" }, query: new URLSearchParams(), body: undefined }), (error: { code?: string; status?: number }) => error.code === "NOT_FOUND" && error.status === 404);
});

test("F1/E3 predicate receives the resolved assignee and transaction handle", async () => {
  let received: { assigneeId?: string; tx?: unknown } | undefined;
  const tx = { id: "tx", commit: async () => undefined, rollback: async () => undefined };
  await authorizeRequest({ operationId: "TASK_STATUS_UPDATE", method: "POST", authState: "REGISTERED", roles: ["DEV_LEAD"], predicate: "MEMBER_OR_ASSIGNEE" }, {
    resolvePrincipal: async () => ({ firebaseUid: "firebase", tokenClaims: {} }),
    lookupRegisteredUser: async () => ({ firebaseUid: "firebase", userId: "user", role: "DEV_LEAD" as const }),
    resolveResource: async (_operationId, _request, passedTx) => { assert.equal(passedTx, tx); return { kind: "TASK", projectId: "project", assigneeId: "developer", state: "ACTIVE" as const }; },
    beginTransaction: async () => tx,
    requireMember: async () => undefined,
    evaluatePredicate: async (_predicate, _principal, _request, resolved, passedTx) => { received = { assigneeId: resolved?.assigneeId, tx: passedTx }; },
  }, "Bearer token", { method: "POST", path: "/api/tasks/task/status", params: { id: "task" }, query: new URLSearchParams(), body: undefined });
  assert.deepEqual(received, { assigneeId: "developer", tx });
});

test("F3/E20 malformed selector is rejected before any predicate or handler query", async () => {
  let evaluated = false;
  await assert.rejects(() => authorizeRequest({ operationId: "STANDUP_UPDATE", method: "PATCH", authState: "REGISTERED", roles: ["DEVELOPER"], predicate: "SELF" }, {
    resolvePrincipal: async () => ({ firebaseUid: "firebase", tokenClaims: {} }),
    lookupRegisteredUser: async () => ({ firebaseUid: "firebase", userId: "user", role: "DEVELOPER" as const }),
    resolveResource: async () => { throw new Error("NOT_FOUND"); },
    requireMember: async () => undefined,
    evaluatePredicate: async () => { evaluated = true; },
  }, "Bearer token", { method: "PATCH", path: "/api/dev/standups/standup", params: { standupId: "malformed" }, query: new URLSearchParams(), body: undefined }), (error: { code?: string; status?: number }) => error.code === "NOT_FOUND" && error.status === 404);
  assert.equal(evaluated, false);
});
