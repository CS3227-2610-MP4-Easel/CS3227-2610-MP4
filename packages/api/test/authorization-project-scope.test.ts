import assert from "node:assert/strict";
import { test } from "node:test";
import { authorizeRequest } from "../src/middleware/auth.js";

test("E6/E9 member predicate hides missing or cross-project resources as NOT_FOUND", async () => {
  const deps = {
    resolvePrincipal: async () => ({ firebaseUid: "firebase", tokenClaims: {} }),
    lookupRegisteredUser: async () => ({ firebaseUid: "firebase", userId: "user", role: "PM" as const }),
    requireMember: async () => { throw new Error("missing"); },
    evaluatePredicate: async () => undefined,
  };
  await assert.rejects(() => authorizeRequest({ authState: "REGISTERED", roles: [], predicate: "MEMBER" }, deps, "Bearer token", { method: "GET", path: "/api/projects/project", params: { projectId: "project" }, query: new URLSearchParams(), body: undefined }), (error: { code?: string }) => error.code === "NOT_FOUND");
});
