import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { Hono } from "hono";
import { policyForRoute, type RouteDefinition } from "@agile/contracts";
import type { FilteredDbClient } from "@agile/db";
import { clientIpKey, createLookupRegisteredUser, createResolvePrincipal, InvalidToken, VerifierUnavailable, type AuthRuntime, type AuthSettings, type TokenVerifier } from "@agile/auth";
import { createAppDependencies, errorResponse, registerRoute, type ApiEnv } from "../src/index.js";
import { requestIdMiddleware } from "../src/middleware/request-id.js";
import { authRoutes } from "../src/routes/auth.js";

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

// Check-code (endpoint 2) through registerRoute with a fake runtime whose `hit` is an in-memory counter.
const secret = "s".repeat(32);
const codes = { PM: "pm-code-123456789", DEV_LEAD: "lead-code-12345678", DEVELOPER: "dev-code-123456789" };
const settings = (overrides: Partial<AuthSettings> = {}): AuthSettings => ({ tier: "test", firebaseProjectId: "w4-test", registrationCodes: codes, rateKeySecret: secret, ...overrides });
const fakeRuntime = (options: { settings?: AuthSettings; hitFails?: boolean } = {}) => {
  const counts = new Map<string, number>();
  const keys: string[] = [];
  const runtime: AuthRuntime = {
    settings: options.settings ?? settings(),
    hit: async (key, _windowSeconds, limit) => {
      if (options.hitFails) throw new Error("db down");
      keys.push(key);
      const count = (counts.get(key) ?? 0) + 1;
      counts.set(key, count);
      return count <= limit ? { allowed: true, retryAfterSeconds: 0 } : { allowed: false, retryAfterSeconds: 42 };
    },
    db: fakeDb(),
    resolvePrincipal: createResolvePrincipal(fakeVerifier()),
    lookupRegisteredUser: createLookupRegisteredUser(fakeDb()),
  };
  return { runtime, keys };
};
const authApp = (runtime: AuthRuntime) => {
  const app = new Hono<ApiEnv>();
  app.use("*", requestIdMiddleware);
  app.onError((error, c) => errorResponse(error, c.get("requestId")));
  for (const route of authRoutes(() => runtime)) registerRoute(app, route, createAppDependencies(runtime));
  return app;
};
const checkCode = async (app: Hono<ApiEnv>, payload: unknown, headers: Record<string, string> = {}) => {
  const response = await app.request("http://localhost/api/auth/check-code", { method: "POST", headers: { "content-type": "application/json", "x-vercel-forwarded-for": "203.0.113.7", ...headers }, body: typeof payload === "string" ? payload : JSON.stringify(payload) });
  assert.match(response.headers.get("X-Request-Id") ?? "", /^[0-9a-f-]{36}$/, "E48 every auth response has X-Request-Id");
  return response;
};

test("E20 correct pair is 200 valid true and counts", async () => {
  const { runtime, keys } = fakeRuntime();
  const response = await checkCode(authApp(runtime), { role: "PM", code: codes.PM });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { valid: true });
  assert.equal(keys.length, 1);
});

test("E21 wrong code is 403", async () => {
  const response = await checkCode(authApp(fakeRuntime().runtime), { role: "PM", code: codes.DEVELOPER });
  assert.equal(response.status, 403);
  assert.equal((await body(response)).error.code, "REGISTRATION_CODE_INVALID");
});

test("E42 leading space in code is 403", async () => {
  const response = await checkCode(authApp(fakeRuntime().runtime), { role: "PM", code: ` ${codes.PM}` });
  assert.equal(response.status, 403);
});

test("E16 malformed JSON or wrong content type is 400 and counted", async () => {
  const { runtime, keys } = fakeRuntime();
  const app = authApp(runtime);
  assert.equal((await checkCode(app, "{not json")).status, 400);
  assert.equal((await checkCode(app, JSON.stringify({ role: "PM", code: codes.PM }), { "content-type": "text/plain" })).status, 400);
  assert.equal(keys.length, 2);
});

test("E17 invalid body is 422, counted, no echo", async () => {
  const { runtime, keys } = fakeRuntime();
  const app = authApp(runtime);
  const marker = "MARKERq7z";
  for (const payload of [{ role: marker, code: codes.PM }, { role: "PM", code: marker + "x".repeat(120) }, { role: "PM", code: codes.PM, [marker]: 1 }, { role: "PM", code: "" }, { role: "PM", code: 5 }]) {
    const response = await checkCode(app, payload);
    assert.equal(response.status, 422);
    const text = await response.text();
    assert.equal(JSON.parse(text).error.code, "VALIDATION_FAILED");
    assert.ok(!text.includes(marker), text);
  }
  assert.equal(keys.length, 5);
});

test("E40 body over 4 KiB is 413", async () => {
  const app = authApp(fakeRuntime().runtime);
  const big = JSON.stringify({ role: "PM", code: "x".repeat(5000) });
  assert.equal((await checkCode(app, big, { "content-length": String(big.length) })).status, 413);
  const stream = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode(big)); controller.close(); } });
  const response = await app.request("http://localhost/api/auth/check-code", { method: "POST", headers: { "content-type": "application/json" }, body: stream, duplex: "half" } as RequestInit);
  assert.equal(response.status, 413);
  assert.equal((await body(response)).error.code, "PAYLOAD_TOO_LARGE");
});

test("E9 21st attempt is 429 with Retry-After", async () => {
  const app = authApp(fakeRuntime().runtime);
  for (let i = 0; i < 20; i++) assert.notEqual((await checkCode(app, { role: "PM", code: i % 2 ? codes.PM : "wrong-code" })).status, 429);
  const response = await checkCode(app, { role: "PM", code: codes.PM });
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("Retry-After"), "42");
  assert.equal((await body(response)).error.code, "RATE_LIMITED");
});

test("E11 absent or invalid IP header uses bucket unknown; x-forwarded-for ignored", async () => {
  const { runtime, keys } = fakeRuntime();
  const app = authApp(runtime);
  const valid = { role: "PM", code: codes.PM };
  await app.request("http://localhost/api/auth/check-code", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.1" }, body: JSON.stringify(valid) });
  await checkCode(app, valid, { "x-vercel-forwarded-for": "" });
  await checkCode(app, valid, { "x-vercel-forwarded-for": "not-an-ip" });
  const unknown = clientIpKey("check-code", null, secret);
  assert.deepEqual(keys, [unknown, unknown, unknown]);
});

test("E12 purpose, IP and key separate buckets", async () => {
  const { runtime, keys } = fakeRuntime();
  const app = authApp(runtime);
  for (let i = 0; i < 21; i++) await checkCode(app, { role: "PM", code: codes.PM });
  assert.equal((await checkCode(app, { role: "PM", code: codes.PM }, { "x-vercel-forwarded-for": "203.0.113.8" })).status, 200);
  assert.notEqual(keys[0], keys.at(-1));
  assert.notEqual(clientIpKey("check-code", "203.0.113.7", secret), clientIpKey("register", "203.0.113.7", secret));
});

test("E28 hit failure is 500 and not admitted", async () => {
  const response = await checkCode(authApp(fakeRuntime({ hitFails: true }).runtime), { role: "PM", code: codes.PM });
  assert.equal(response.status, 500);
  assert.equal((await body(response)).error.code, "INTERNAL_ERROR");
});

test("E38 no CORS header on check-code", async () => {
  const response = await checkCode(authApp(fakeRuntime().runtime), { role: "PM", code: codes.PM }, { origin: "https://evil.test" });
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), null);
});

test("E49 missing IP on dev logs client_ip_missing", async () => {
  const warn = mock.method(console, "warn", () => {});
  try {
    await checkCode(authApp(fakeRuntime({ settings: settings({ tier: "dev" }) }).runtime), { role: "PM", code: codes.PM }, { "x-vercel-forwarded-for": "" });
    assert.ok(warn.mock.calls.some((call) => call.arguments.includes("client_ip_missing")));
    const before = warn.mock.callCount();
    await checkCode(authApp(fakeRuntime().runtime), { role: "PM", code: codes.PM }, { "x-vercel-forwarded-for": "" });
    assert.equal(warn.mock.callCount(), before, "test tier does not warn");
  } finally { warn.mock.restore(); }
});

test("E50 unconfigured routes are 500", async () => {
  const unconfigured = settings({ tier: "preview", firebaseProjectId: null, registrationCodes: null, rateKeySecret: null });
  const response = await checkCode(authApp(fakeRuntime({ settings: unconfigured }).runtime), { role: "PM", code: codes.PM });
  assert.equal(response.status, 500);
  assert.equal((await body(response)).error.code, "INTERNAL_ERROR");
});
