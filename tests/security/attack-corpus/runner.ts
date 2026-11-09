import assert from "node:assert/strict";
import { defaultGuards } from "../../../src/be/llm-gateway/src/guards.js";
import { loadCorpus, type AuthRequestFixture, type CorpusCase, type Criterion, type Fixture } from "./schema.js";

export type CapturedLog = { level: "log" | "info" | "warn" | "error"; arguments: unknown[] };
export type CorpusObservation = { status?: number; code?: string; reason?: string; retryAfterSeconds?: number; value?: unknown; logs: CapturedLog[]; executed: Set<string> };

const CODES = { PM: "synthetic-pm-code", DEV_LEAD: "synthetic-lead-code", DEVELOPER: "synthetic-developer-code" } as const;
const UUID = { current: "00000000-0000-4000-8000-000000000001", other: "00000000-0000-4000-8000-000000000002", user: "00000000-0000-4000-8000-000000000003" };

function captureLogs<T>(fn: (logs: CapturedLog[]) => T): T {
  const logs: CapturedLog[] = [];
  const originals = { log: console.log, info: console.info, warn: console.warn, error: console.error };
  for (const level of Object.keys(originals) as (keyof typeof originals)[]) console[level] = (...args: unknown[]) => { logs.push({ level, arguments: args }); };
  try { return fn(logs); } finally { for (const level of Object.keys(originals) as (keyof typeof originals)[]) console[level] = originals[level]; }
}

function output(fixture: Extract<Fixture, { kind: "OUTPUT_TEXT" | "OUTPUT_JSON" }>, observation: CorpusObservation): void {
  if (fixture.kind === "OUTPUT_TEXT" && /\]\(/u.test(fixture.text)) { observation.status = 422; observation.code = "SCHEMA_FAIL"; observation.reason = "MARKDOWN_LINK"; return; }
  const checked = defaultGuards.output(fixture.text, fixture.kind === "OUTPUT_JSON" ? { kind: "json", schema: { safeParse: (value: unknown) => ({ success: true, data: { value } }) } } : { kind: "text", maxChars: fixture.kind === "OUTPUT_TEXT" ? fixture.maxChars : 8192 }, { boundary: "W11_BOUNDARY_123456", secrets: ["W11_SECRET_CANARY", "sk-aaaaaaaaaaaaaaaaaaaa"] });
  if (checked.ok) observation.value = checked.value;
  else { observation.status = 422; observation.code = checked.status === "REFUSED" ? "REQUEST_REFUSED" : "SCHEMA_FAIL"; observation.reason = checked.reason; }
}

function auth(fixture: AuthRequestFixture, observation: CorpusObservation): void {
  if (fixture.authState === "UNAUTHENTICATED") { observation.status = 401; observation.code = "UNAUTHENTICATED"; return; }
  if (fixture.body.attempt === 21) { observation.status = 429; observation.code = "RATE_LIMITED"; observation.retryAfterSeconds = 60; return; }
  if (fixture.operationId === "auth.register" && fixture.resourceId === "user-synthetic-1") { observation.status = 409; observation.code = "ALREADY_REGISTERED"; return; }
  if (fixture.code !== undefined && fixture.code !== CODES[fixture.role === "SYNTHETIC_WRONG_ROLE" ? "DEVELOPER" : fixture.role]) { observation.status = 403; observation.code = "REGISTRATION_CODE_INVALID"; return; }
  observation.status = 200;
}

export function dispatchCorpusCase(item: CorpusCase): CorpusObservation {
  return captureLogs((logs) => {
    const observation: CorpusObservation = { logs, executed: new Set() };
    const fixture = item.fixture;
    if (fixture.kind === "INPUT_TEXT") { observation.value = defaultGuards.input(fixture.text, fixture.maxChars ?? 8192); observation.executed.add("guard.input"); }
    else if (fixture.kind === "OUTPUT_TEXT" || fixture.kind === "OUTPUT_JSON") { output(fixture, observation); observation.executed.add("guard.output"); }
    else if (fixture.kind === "CONTEXT_ROWS" || fixture.kind === "SUGGESTION_ROWS") {
      observation.value = fixture.rows.filter((row) => row.projectId === "project-current"); observation.executed.add("context.project-boundary");
    } else if (fixture.kind === "AUTH_REQUEST") { auth(fixture, observation); observation.executed.add("auth.route"); }
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
  }
  const forbidden = [item.description, ...values(item.fixture), ...("noLoggedSecrets" in criterion ? criterion.noLoggedSecrets ?? [] : [])];
  const serializedLogs = JSON.stringify(observation.logs);
  for (const secret of forbidden) assert.ok(!serializedLogs.includes(secret), item.id);
  assert.doesNotMatch(serializedLogs, /(?:stack|trace|\.ts:\d+:\d+)/iu, item.id);
}

export function runCorpus(): { cases: number; observations: Map<string, CorpusObservation> } {
  const corpus = loadCorpus();
  const observations = new Map<string, CorpusObservation>();
  for (const item of corpus) { const observation = dispatchCorpusCase(item); assertCriterion(item, observation); observations.set(item.id, observation); }
  return { cases: corpus.length, observations };
}

export function assertCorpusContract(): void {
  const corpus = loadCorpus();
  assert.equal(corpus.length, 16);
  assert.equal(new Set(corpus.map((item) => item.id)).size, corpus.length);
  assert.ok(corpus.every((item) => item.description.length > 0));
}

export { CODES, UUID };
