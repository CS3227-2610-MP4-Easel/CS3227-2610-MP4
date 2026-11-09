import assert from "node:assert/strict";
import { test } from "node:test";
import { Hono } from "hono";
import { z } from "zod/v3";
import { policyForRoute, type ApiContext, type RouteDefinition } from "@agile/contracts";
import { apiApp, createApiApp, errorResponse, registerRoute, registeredRoutes, type ApiEnv, type AuthDependencies } from "../src/index.js";

const policy = policyForRoute("endpoint-23");
const events: string[] = [];
const tx = { commit: async () => { events.push("commit"); }, rollback: async () => { events.push("rollback"); } };
const deps = (overrides: Partial<AuthDependencies> = {}): AuthDependencies => ({
  resolvePrincipal: async (authorization) => { if (authorization !== "Bearer ok") throw new Error("UNAUTHENTICATED"); return { firebaseUid: "f", tokenClaims: {} }; },
  lookupRegisteredUser: async () => ({ firebaseUid: "f", userId: "u", role: "PM" }),
  beginTransaction: async () => tx,
  resolveResource: async () => ({ kind: "TASK", projectId: "p", state: "ACTIVE" }),
  requireMember: async () => undefined,
  evaluatePredicate: async () => undefined,
  ...overrides,
});
const route = (handler: RouteDefinition["handler"]): RouteDefinition => ({ operationId: policy.operationId, method: policy.method, path: policy.path, policyKey: policy.policyKey, responseSchema: {}, bodySchema: z.object({ title: z.string() }).strict(), handler });
const appWith = (handler: RouteDefinition["handler"], d: AuthDependencies = deps()) => { const app = new Hono<ApiEnv>(); app.use("*", async (c, next) => { c.set("requestId", "rid"); await next(); }); app.onError((error, c) => errorResponse(error, c.get("requestId"))); registerRoute(app, route(handler), d); return app; };
const patch = (app: Hono<ApiEnv>, body: unknown, token = "Bearer ok") => app.request("http://localhost/api/tasks/t1", { method: "PATCH", headers: { authorization: token, "content-type": "application/json" }, body: JSON.stringify(body) });

test("registerRoute refuses a non-public route without authorization dependencies", () => {
  assert.throws(() => registerRoute(new Hono<ApiEnv>(), route(async () => new Response())), /authorization dependencies are required/);
});

test("registerRoute refuses duplicates and metadata that differs from the policy map", () => {
  const app = new Hono<ApiEnv>();
  registerRoute(app, route(async () => new Response()), deps());
  assert.throws(() => registerRoute(app, route(async () => new Response()), deps()), /duplicate/);
  assert.throws(() => registerRoute(new Hono<ApiEnv>(), { ...route(async () => new Response()), path: "/api/tasks/other" }, deps()), /metadata mismatch/);
  assert.throws(() => registerRoute(new Hono<ApiEnv>(), { ...route(async () => new Response()), policyKey: "endpoint-999" }, deps()), /missing policy/);
});

test("protected malformed request without a valid token is 401 and never reaches the handler", async () => {
  let ran = false;
  const response = await patch(appWith(async () => { ran = true; return new Response(); }), { nope: 1 }, "Bearer bad");
  assert.equal(response.status, 401);
  assert.equal(ran, false);
});

test("handler receives parsed input and principal; success commits the authorization transaction", async () => {
  events.length = 0;
  let seen: unknown;
  const response = await patch(appWith(async (context) => { seen = { input: context.input, principal: context.principal?.userId, id: context.request.params.id }; return Response.json({ ok: true }); }), { title: "x" });
  assert.equal(response.status, 200);
  assert.deepEqual(seen, { input: { params: { id: "t1" }, query: {}, body: { title: "x" } }, principal: "u", id: "t1" });
  assert.deepEqual(events, ["commit"]);
});

test("invalid body is 422 and rolls back; thrown handler errors and 4xx responses roll back", async () => {
  events.length = 0;
  assert.equal((await patch(appWith(async () => new Response()), { title: 1 })).status, 422);
  assert.equal((await patch(appWith(async () => { throw new Error("boom"); }), { title: "x" })).status, 500);
  assert.equal((await patch(appWith(async () => new Response(null, { status: 409 })), { title: "x" })).status, 409);
  assert.deepEqual(events, ["rollback", "rollback", "rollback"]);
});

test("the shipped app contains only routes registered through the policy gate", () => {
  const registered = new Set(registeredRoutes(apiApp).map((r) => `${r.method} ${r.path.replace(/\{(\w+)\}/g, ":$1")}`));
  const mounted = apiApp.routes.filter((r) => r.method !== "ALL").map((r) => `${r.method} ${r.path}`);
  assert.ok(mounted.length > 0);
  for (const entry of mounted) assert.ok(registered.has(entry), `${entry} bypasses registerRoute`);
  assert.equal(registeredRoutes(createApiApp()).length, registeredRoutes(apiApp).length);
});

const tokenPolicy = policyForRoute("endpoint-3");
const tokenApp = (route: Partial<RouteDefinition>, d: AuthDependencies = deps()) => {
  const app = new Hono<ApiEnv>();
  app.use("*", async (c, next) => { c.set("requestId", "rid"); await next(); });
  app.onError((error, c) => errorResponse(error, c.get("requestId")));
  registerRoute(app, { operationId: tokenPolicy.operationId, method: tokenPolicy.method, path: tokenPolicy.path, policyKey: tokenPolicy.policyKey, responseSchema: {}, handler: async () => new Response(null, { status: 204 }), ...route }, d);
  return app;
};
const postRegister = (app: Hono<ApiEnv>, token = "Bearer ok") => app.request("http://localhost/api/auth/register", { method: "POST", headers: { authorization: token, "content-type": "application/json" }, body: "{}" });

test("before runs ahead of authorization and its response ends the request", async () => {
  let resolved = false;
  const app = tokenApp({ before: async () => new Response(null, { status: 429 }) }, deps({ resolvePrincipal: async () => { resolved = true; return { firebaseUid: "f", tokenClaims: {} }; } }));
  const response = await postRegister(app);
  assert.equal(response.status, 429);
  assert.equal(resolved, false);
});

test("before returning nothing continues to the handler", async () => {
  let seen = false;
  const app = tokenApp({ before: async () => { seen = true; } });
  const response = await postRegister(app);
  assert.equal(seen, true);
  assert.equal(response.status, 204);
});

test("E48 before-hook response carries X-Request-Id", async () => {
  const app = tokenApp({ before: async () => Response.json({ error: "x" }, { status: 413 }) });
  const response = await postRegister(app);
  assert.equal(response.status, 413);
  assert.equal(response.headers.get("x-request-id"), "rid");
});

test("TOKEN route handler receives identity, not principal", async () => {
  let context: ApiContext | undefined;
  const app = tokenApp({ handler: async (c) => { context = c; return new Response(null, { status: 204 }); } }, deps({ resolvePrincipal: async () => ({ firebaseUid: "f", tokenClaims: { email: "a@b.test" } }) }));
  await postRegister(app);
  assert.deepEqual(context?.identity, { firebaseUid: "f", email: "a@b.test" });
  assert.equal(context?.principal, undefined);
});

test("REGISTERED route handler receives principal, not identity", async () => {
  let context: ApiContext | undefined;
  const app = appWith(async (c) => { context = c; return Response.json({}); });
  await patch(app, { title: "x" });
  assert.deepEqual(context?.principal, { firebaseUid: "f", userId: "u", role: "PM" });
  assert.equal(context?.identity, undefined);
});

const limited = (handler: RouteDefinition["handler"] = async () => Response.json({ ok: true })) => { const app = new Hono<ApiEnv>(); app.use("*", async (c, next) => { c.set("requestId", "rid"); await next(); }); app.onError((error, c) => errorResponse(error, c.get("requestId"))); registerRoute(app, { ...route(handler), bodyLimitBytes: 16 }, deps()); return app; };
const streamedPatch = (app: Hono<ApiEnv>, text: string, token = "Bearer ok", type = "application/json") => app.request("http://localhost/api/tasks/t1", { method: "PATCH", headers: { authorization: token, "content-type": type }, duplex: "half", body: new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode(text)); controller.close(); } }) } as RequestInit);

test("N1 bodyLimitBytes: 17 bytes without Content-Length is 413, 16 bytes is accepted", async () => {
  assert.equal(`{"title":"xxxx"}`.length, 16);
  assert.equal((await streamedPatch(limited(), `{"title":"xxxx"} `)).status, 413);
  assert.equal((await streamedPatch(limited(), `{"title":"xxxx"}`)).status, 200);
});
test("N1 bodyLimitBytes: a bad token with an oversized body is 401 and the body is never read", async () => {
  const request = new Request("http://localhost/api/tasks/t1", { method: "PATCH", headers: { authorization: "Bearer bad", "content-type": "application/json" }, body: "x".repeat(17) });
  const response = await limited().request(request);
  assert.equal(response.status, 401);
  assert.equal(request.bodyUsed, false);
});
test("bodyLimitBytes: invalid JSON and a wrong content type are 400", async () => {
  assert.equal((await streamedPatch(limited(), "{nope")).status, 400);
  assert.equal((await streamedPatch(limited(), `{"title":"x"}`, "Bearer ok", "text/plain")).status, 400);
});
test("a route without bodyLimitBytes accepts a large body as before", async () => {
  const response = await patch(appWith(async () => Response.json({ ok: true })), { title: "x".repeat(5000) });
  assert.equal(response.status, 200);
});
