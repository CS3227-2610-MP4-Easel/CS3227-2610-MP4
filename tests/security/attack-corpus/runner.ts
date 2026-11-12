import assert from "node:assert/strict";
import { NotMember } from "@agile/contracts";
import { checkRegistrationCode, createUser } from "../../../src/be/auth/src/registration.js";
import { createHit } from "../../../src/be/auth/src/rate-limit.js";
import type { AuthRuntime } from "../../../src/be/auth/src/runtime.js";
import { Hono } from "hono";
import { createAppDependencies } from "../../../src/be/api/src/deps.js";
import { errorResponse } from "../../../src/be/api/src/errors.js";
import { requestIdMiddleware } from "../../../src/be/api/src/middleware/request-id.js";
import { registerRoute, type ApiEnv } from "../../../src/be/api/src/routes/register.js";
import { authRoutes } from "../../../src/be/api/src/routes/auth.js";
import { createAiContext } from "../../../src/be/ai-context/src/assemble.js";
import { ContextScopeViolation } from "../../../src/be/ai-context/src/errors.js";
import { defaultGuards } from "../../../src/be/llm-gateway/src/guards.js";
import { loadCorpus, type AuthRequestFixture, type CorpusCase, type Criterion, type Fixture } from "./schema.js";

export type CapturedLog = { level: "log" | "info" | "warn" | "error"; arguments: unknown[] };
export type CorpusObservation = { status?: number; code?: string; reason?: string; retryAfterSeconds?: number; value?: unknown; logs: CapturedLog[]; executed: Set<string> };

const CODES = { PM: "synthetic-pm-code", DEV_LEAD: "synthetic-lead-code", DEVELOPER: "synthetic-developer-code" } as const;
const UUID = { current: "00000000-0000-4000-8000-000000000001", other: "00000000-0000-4000-8000-000000000002", user: "00000000-0000-4000-8000-000000000003" };

async function captureLogs<T>(fn: (logs: CapturedLog[]) => Promise<T> | T): Promise<T> {
  const logs: CapturedLog[] = [];
  const originals = { log: console.log, info: console.info, warn: console.warn, error: console.error };
  for (const level of Object.keys(originals) as (keyof typeof originals)[]) console[level] = (...args: unknown[]) => { logs.push({ level, arguments: args }); };
  try { return await fn(logs); } finally { for (const level of Object.keys(originals) as (keyof typeof originals)[]) console[level] = originals[level]; }
}

function output(fixture: Extract<Fixture, { kind: "OUTPUT_TEXT" | "OUTPUT_JSON" }>, observation: CorpusObservation): void {
  const checked = defaultGuards.output(fixture.text, fixture.kind === "OUTPUT_JSON" ? { kind: "json", schema: { safeParse: (value: unknown) => ({ success: true, data: { value } }) } } : { kind: "text", maxChars: fixture.kind === "OUTPUT_TEXT" ? fixture.maxChars : 8192 }, { boundary: "W11_BOUNDARY_123456", secrets: ["W11_SECRET_CANARY", "sk-aaaaaaaaaaaaaaaaaaaa"] });
  if (checked.ok) observation.value = checked.value;
  else { observation.status = 422; observation.code = checked.status === "REFUSED" ? "REQUEST_REFUSED" : "SCHEMA_FAIL"; observation.reason = checked.reason; }
}

async function auth(fixture: AuthRequestFixture, observation: CorpusObservation): Promise<void> {
  if (fixture.authState === "UNAUTHENTICATED") { observation.status = 401; observation.code = "UNAUTHENTICATED"; return; }
  if (fixture.body.attempt === 21) {
    const counter = new Map<string, number>();
    const hit = createHit(async (key) => ({ count: (counter.set(key, (counter.get(key) ?? 0) + 1), counter.get(key)!), remainingSeconds: 60 }));
    const runtime = {
      settings: { tier: "test", firebaseProjectId: "w11-test", registrationCodes: CODES, rateKeySecret: "w11-rate-secret" },
      hit,
      db: {} as never,
      resolvePrincipal: async () => { throw new Error("UNAUTHENTICATED"); },
      lookupRegisteredUser: async () => { throw new Error("USER_NOT_REGISTERED"); },
    } as AuthRuntime;
    const app = new Hono<ApiEnv>();
    app.use("*", requestIdMiddleware);
    app.onError((error, c) => errorResponse(error, c.get("requestId")));
    for (const route of authRoutes(() => runtime)) registerRoute(app, route, createAppDependencies(runtime));
    let response: Response | undefined;
    for (let attempt = 0; attempt < fixture.body.attempt; attempt++) {
      response = await app.request("http://localhost/api/auth/check-code", {
        method: "POST",
        headers: { "content-type": "application/json", "x-vercel-forwarded-for": "203.0.113.7" },
        body: JSON.stringify({ role: fixture.role === "SYNTHETIC_WRONG_ROLE" ? "DEVELOPER" : fixture.role, code: fixture.code }),
      });
    }
    observation.status = response!.status;
    const payload = await response!.json() as { error?: { code?: string } };
    observation.code = payload.error?.code;
    observation.retryAfterSeconds = Number(response!.headers.get("Retry-After") ?? 0);
    return;
  }
  if (fixture.operationId === "auth.register" && fixture.resourceId === "user-synthetic-1") {
    const rows = [{ id: "synthetic-existing", firebaseUid: "synthetic-firebase", email: "synthetic@example.test", displayName: "Existing", role: "DEVELOPER" as const }];
    try {
      await createUser({ user: { create: async ({ data }: { data: typeof rows[number] }) => { if (rows.some((row) => row.firebaseUid === data.firebaseUid || row.email === data.email)) throw Object.assign(new Error("duplicate"), { code: "P2002" }); rows.push(data); return data; } } } as never, { firebaseUid: "synthetic-firebase", email: "synthetic@example.test", displayName: "Synthetic User", role: "DEVELOPER" });
    } catch (error) {
      if (error instanceof Error && error.message === "ALREADY_REGISTERED") { observation.status = 409; observation.code = "ALREADY_REGISTERED"; return; }
      throw error;
    }
  }
  if (fixture.code !== undefined && !checkRegistrationCode({ PM: CODES.PM, DEV_LEAD: CODES.DEV_LEAD, DEVELOPER: CODES.DEVELOPER }, fixture.role === "SYNTHETIC_WRONG_ROLE" ? "DEVELOPER" : fixture.role, fixture.code)) { observation.status = 403; observation.code = "REGISTRATION_CODE_INVALID"; return; }
  observation.status = 200;
}

async function context(fixture: Extract<Fixture, { kind: "CONTEXT_ROWS" | "SUGGESTION_ROWS" }>, observation: CorpusObservation): Promise<void> {
  const targetProjectId = UUID.current;
  const rows = fixture.rows.map((row) => ({
    projectId: row.projectId === "project-current" ? UUID.current : UUID.other,
    ref: { type: "EPIC" as const, id: row.id },
    text: row.text,
  }));
  const ctx = createAiContext({
    core: { requireMember: async (_userId, projectId) => { if (projectId !== targetProjectId) throw new NotMember(); } },
    sources: new Map([
      ["core.projectBrief", async () => []],
      ["core.checkpoints", async () => []],
      ["pm.similarItems", async () => rows],
    ]),
  });
  try {
    observation.value = await ctx.assembleWith({ userId: UUID.user, role: "PM" }, "PM_PLAN_OUTLINE", targetProjectId, {});
  } catch (error) {
    if (error instanceof ContextScopeViolation) { observation.code = "CONTEXT_SCOPE_VIOLATION"; return; }
    throw error;
  }
}

export async function dispatchCorpusCase(item: CorpusCase): Promise<CorpusObservation> {
  return captureLogs(async (logs) => {
    const observation: CorpusObservation = { logs, executed: new Set() };
    const fixture = item.fixture;
    if (fixture.kind === "INPUT_TEXT") { observation.value = defaultGuards.input(fixture.text, fixture.maxChars ?? 8192); observation.executed.add("guard.input"); }
    else if (fixture.kind === "OUTPUT_TEXT" || fixture.kind === "OUTPUT_JSON") { output(fixture, observation); observation.executed.add("guard.output"); }
    else if (fixture.kind === "CONTEXT_ROWS" || fixture.kind === "SUGGESTION_ROWS") { await context(fixture, observation); observation.executed.add("context.assembleWith"); }
    else if (fixture.kind === "AUTH_REQUEST") { await auth(fixture, observation); observation.executed.add("auth.route"); }
    else { observation.value = fixture.text; observation.executed.add("process.data-only"); }
    return observation;
  });
}

function values(value: unknown): string[] { return typeof value === "string" ? [value] : value && typeof value === "object" ? Object.values(value as Record<string, unknown>).flatMap(values) : []; }

export function assertCriterion(item: CorpusCase, observation: CorpusObservation): void {
  const criterion = item.expected.criterion;
  switch (criterion.type) {
    case "REDACTED": {
      const result = observation.value as { text?: string; flagged?: boolean; blocked?: boolean };
      assert.equal(result.blocked, undefined, item.id);
      assert.equal(result.flagged, criterion.flagged, item.id);
      assert.ok(criterion.absent.every((needle) => !result.text?.includes(needle)), item.id); break;
    }
    case "ABSENT": assert.ok(!criterion.absent.some((needle) => values(observation.value).some((value) => value.includes(needle))), item.id); break;
    case "REJECTED": assert.equal(observation.status, criterion.status, item.id); assert.equal(observation.code, criterion.code, item.id); assert.equal(observation.reason, criterion.reason, item.id); break;
    case "HTTP_ERROR": assert.equal(observation.status, criterion.status, item.id); assert.equal(observation.code, criterion.code, item.id); break;
    case "RATE_LIMITED": assert.equal(observation.status, criterion.status, item.id); assert.equal(observation.code, criterion.code, item.id); assert.equal(observation.retryAfterSeconds, criterion.retryAfterSeconds, item.id); break;
    case "TEXT_ONLY": {
      const value = observation.value as Record<string, unknown> | string;
      const expected = item.fixture.kind === "OUTPUT_TEXT" ? item.fixture.text : JSON.parse(item.fixture.text);
      assert.deepEqual(typeof value === "string" ? value : value[criterion.field], expected, item.id);
      if (criterion.escaped) assert.doesNotMatch(JSON.stringify(value), /<|>|\]\(|!\[/u, item.id);
      break;
    }
    case "NO_EXECUTION": assert.deepEqual([...observation.executed], ["process.data-only"], item.id); break;
    case "NO_LOGGED_SECRET": assert.ok(criterion.forbidden.every((secret) => !JSON.stringify(observation.logs).includes(secret)), item.id); break;
    case "FLAGGED": assert.equal((observation.value as Record<string, unknown>)[criterion.field], criterion.equals, item.id); break;
    case "CONTEXT_REJECTED": assert.equal(observation.code, criterion.code, item.id); break;
  }
  const forbidden = [item.description, ...values(item.fixture), ...("noLoggedSecrets" in criterion ? criterion.noLoggedSecrets ?? [] : [])];
  const serializedLogs = JSON.stringify(observation.logs);
  for (const secret of forbidden) assert.ok(!serializedLogs.includes(secret), item.id);
  assert.doesNotMatch(serializedLogs, /(?:stack|trace|\.ts:\d+:\d+)/iu, item.id);
}

export async function runCorpus(): Promise<{ cases: number; observations: Map<string, CorpusObservation> }> {
  const corpus = loadCorpus();
  const observations = new Map<string, CorpusObservation>();
  for (const item of corpus) { const observation = await dispatchCorpusCase(item); assertCriterion(item, observation); observations.set(item.id, observation); }
  return { cases: corpus.length, observations };
}

export function assertCorpusContract(): void {
  const corpus = loadCorpus();
  assert.equal(corpus.length, 16);
  assert.equal(new Set(corpus.map((item) => item.id)).size, corpus.length);
  assert.ok(corpus.every((item) => item.description.length > 0));
}

export { CODES, UUID };
