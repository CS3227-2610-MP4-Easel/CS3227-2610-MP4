import assert from "node:assert/strict";
import { test } from "node:test";
import { Hono } from "hono";
import { policyForRoute, type RouteDefinition } from "@agile/contracts";
import type { FilteredDbClient } from "@agile/db";
import { createLookupRegisteredUser, createResolvePrincipal, InvalidToken, VerifierUnavailable, type TokenVerifier } from "@agile/auth";
import { createAppDependencies, errorResponse, registerRoute, type ApiEnv } from "../src/index.js";

type Row = { id: string; firebaseUid: string; role: "PM" | "DEV_LEAD" | "DEVELOPER" };
const tokens: Record<string, { uid: string; email: string | null }> = { "Bearer good": { uid: "uid-1", email: "a@b.test" }, "Bearer norow": { uid: "uid-2", email: "c@d.test" } };
const fakeVerifier = (behaviour: "ok" | "invalid" | "down" = "ok"): TokenVerifier => ({
  verify: async (token) => {
    if (behaviour === "invalid") throw new InvalidToken();
    if (behaviour === "down") throw new VerifierUnavailable();
    const found = tokens[`Bearer ${token}`];
    if (!found) throw new InvalidToken();
    return found;
  },
});
const fakeDb = (rows: Row[] = [{ id: "user-1", firebaseUid: "uid-1", role: "PM" }], failing = false) => ({
  user: { findUnique: async ({ where }: { where: { firebaseUid: string } }) => { if (failing) throw new Error("db down"); return rows.find((r) => r.firebaseUid === where.firebaseUid) ?? null; } },
}) as unknown as FilteredDbClient;

const registeredPolicy = policyForRoute("endpoint-6");
const appFor = (verifier: TokenVerifier, db: FilteredDbClient, handler: RouteDefinition["handler"] = async () => Response.json({ ok: true })) => {
  const app = new Hono<ApiEnv>();
  app.use("*", async (c, next) => { c.set("requestId", "rid"); await next(); });
  app.onError((error, c) => errorResponse(error, c.get("requestId")));
  registerRoute(app, { operationId: registeredPolicy.operationId, method: registeredPolicy.method, path: registeredPolicy.path, policyKey: registeredPolicy.policyKey, responseSchema: {}, handler },
    createAppDependencies({ resolvePrincipal: createResolvePrincipal(verifier), lookupRegisteredUser: createLookupRegisteredUser(db) }));
  return app;
};
const get = (app: Hono<ApiEnv>, authorization?: string) => app.request("http://localhost/api/projects", { headers: authorization ? { authorization } : {} });
const body = async (response: Response) => (await response.json()) as { error: { code: string; message: string } };

test("E2 verifier rejection is 401 with one message", async () => {
  const messages = new Set<string>();
  for (const [verifier, header] of [[fakeVerifier("invalid"), "Bearer good"], [fakeVerifier(), "Bearer unknown"], [fakeVerifier(), undefined]] as const) {
    const response = await get(appFor(verifier, fakeDb()), header);
    assert.equal(response.status, 401);
    const { error } = await body(response);
    assert.equal(error.code, "UNAUTHENTICATED");
    messages.add(error.message);
  }
  assert.equal(messages.size, 1);
});

test("E5 token without row is 403 USER_NOT_REGISTERED", async () => {
  let ran = false;
  const response = await get(appFor(fakeVerifier(), fakeDb(), async () => { ran = true; return Response.json({}); }), "Bearer norow");
  assert.equal(response.status, 403);
  assert.equal((await body(response)).error.code, "USER_NOT_REGISTERED");
  assert.equal(ran, false);
});

test("E29 VerifierUnavailable is 500", async () => {
  const response = await get(appFor(fakeVerifier("down"), fakeDb()), "Bearer good");
  assert.equal(response.status, 500);
  assert.equal((await body(response)).error.code, "INTERNAL_ERROR");
});

test("E46 lookup database failure is 500", async () => {
  const response = await get(appFor(fakeVerifier(), fakeDb([], true)), "Bearer good");
  assert.equal(response.status, 500);
  assert.equal((await body(response)).error.code, "INTERNAL_ERROR");
});
