import assert from "node:assert/strict";
import { test } from "node:test";
import { authorizeRequest } from "../src/middleware/auth.js";

const deps = {
  resolvePrincipal: async (authorization: string | undefined) => {
    if (!authorization) throw new Error("UNAUTHENTICATED");
    return { firebaseUid: "firebase", tokenClaims: {} };
  },
  lookupRegisteredUser: async () => ({ firebaseUid: "firebase", userId: "user", role: "PM" as const }),
  requireMember: async () => undefined,
  evaluatePredicate: async () => undefined,
};

test("N1/E16 protected requests resolve token before handler access", async () => {
  await assert.rejects(() => authorizeRequest({ authState: "REGISTERED", roles: [], predicate: "NONE" }, deps, undefined, { method: "GET", path: "/api/me", params: {}, query: new URLSearchParams(), body: undefined }), (error: { code?: string }) => error.code === "UNAUTHENTICATED");
});

test("N1/E16 registered principal is returned after token lookup", async () => {
  const principal = await authorizeRequest({ authState: "REGISTERED", roles: ["PM"], predicate: "NONE" }, deps, "Bearer token", { method: "GET", path: "/api/me", params: {}, query: new URLSearchParams(), body: undefined });
  assert.equal(principal?.role, "PM");
});
