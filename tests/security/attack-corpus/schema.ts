import { readFileSync } from "node:fs";

export const CORPUS_VERSION = 1 as const;

export const THREATS = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10", "T11"] as const;
export type Threat = (typeof THREATS)[number];

export const LAYERS = ["INPUT", "OUTPUT", "CONTEXT", "SUGGESTION", "AUTH", "PROCESS"] as const;
export type Layer = (typeof LAYERS)[number];
export const BOUNDARIES = ["INPUT_GUARD", "OUTPUT_GUARD", "CONTEXT_ASSEMBLY", "SUGGESTION_ASSEMBLY", "AUTH_ROUTE", "PROCESS_RUNNER"] as const;
export type Boundary = (typeof BOUNDARIES)[number];

type BaseFixture<K extends string> = { kind: K };
export type InputTextFixture = BaseFixture<"INPUT_TEXT"> & { text: string; maxChars?: number };
export type OutputTextFixture = BaseFixture<"OUTPUT_TEXT"> & { text: string; maxChars: number };
export type OutputJsonFixture = BaseFixture<"OUTPUT_JSON"> & { text: string; schemaName: string };
export type ContextRow = { id: string; projectId: string; text: string };
export type ContextRowsFixture = BaseFixture<"CONTEXT_ROWS"> & { rows: ContextRow[] };
export type SuggestionRow = { id: string; projectId: string; text: string };
export type SuggestionRowsFixture = BaseFixture<"SUGGESTION_ROWS"> & { rows: SuggestionRow[] };
export type AuthRequestFixture = BaseFixture<"AUTH_REQUEST"> & {
  operationId: string;
  callerProjectId: string;
  resourceProjectId: string;
  resourceId: string;
  authState: "UNAUTHENTICATED" | "UNREGISTERED" | "REGISTERED";
  role: "PM" | "DEV_LEAD" | "DEVELOPER" | "SYNTHETIC_WRONG_ROLE";
  code?: string;
  body: Record<string, unknown>;
};
export type ProcessTextFixture = BaseFixture<"PROCESS_TEXT"> & { text: string };

export type Fixture = InputTextFixture | OutputTextFixture | OutputJsonFixture | ContextRowsFixture | SuggestionRowsFixture | AuthRequestFixture | ProcessTextFixture;

export type Criterion =
  | { type: "REDACTED"; field: string; absent: string[]; flagged: boolean }
  | { type: "ABSENT"; field: string; absent: string[] }
  | { type: "REJECTED"; status: number; code: string; reason: string }
  | { type: "HTTP_ERROR"; status: number; code: string; headers?: Record<string, string> }
  | { type: "FLAGGED"; field: string; equals: boolean }
  | { type: "NO_LOGGED_SECRET"; forbidden: string[] }
  | { type: "RATE_LIMITED"; status: 429; code: "RATE_LIMITED"; retryAfterSeconds: number }
  | { type: "NO_EXECUTION"; forbiddenPrimitives: ("network" | "process" | "filesystem")[] }
  | { type: "TEXT_ONLY"; field: string; escaped: boolean };

export type CorpusCase = {
  id: string;
  threat: Threat;
  layer: Layer;
  boundary: Boundary;
  description: string;
  fixture: Fixture;
  expected: { criterion: Criterion };
};

const MAX_TEXT = 8_192;
const MAX_ROWS = 100;
const MAX_DEPTH = 8;
const MAX_ARRAY = 100;
const MAX_KEY = 64;
const MAX_BYTES = 64 * 1024;
const CASE_KEYS = new Set(["id", "threat", "layer", "boundary", "description", "fixture", "expected"]);
const CRITERION_TYPES = new Set(["REDACTED", "ABSENT", "REJECTED", "HTTP_ERROR", "FLAGGED", "NO_LOGGED_SECRET", "RATE_LIMITED", "NO_EXECUTION", "TEXT_ONLY"]);
const FIXTURE_KINDS = new Set(["INPUT_TEXT", "OUTPUT_TEXT", "OUTPUT_JSON", "CONTEXT_ROWS", "SUGGESTION_ROWS", "AUTH_REQUEST", "PROCESS_TEXT"]);

function fail(path: string, message: string): never {
  throw new Error(`Invalid corpus at ${path}: ${message}`);
}

function object(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) fail(path, "expected object");
  return value as Record<string, unknown>;
}

function keys(value: Record<string, unknown>, allowed: readonly string[], path: string): void {
  const accepted = new Set(allowed);
  for (const key of Object.keys(value)) {
    if (!accepted.has(key)) fail(`${path}.${key}`, "unknown field");
    if ([...key].length > MAX_KEY) fail(`${path}.${key}`, `key exceeds ${MAX_KEY} characters`);
  }
}

function string(value: unknown, path: string, max = MAX_TEXT): string {
  if (typeof value !== "string") fail(path, "expected string");
  if ([...value].length > max) fail(path, `text exceeds ${max} code points`);
  return value;
}

function oneOf<T extends string>(value: unknown, values: readonly T[], path: string): T {
  if (typeof value !== "string" || !values.includes(value as T)) fail(path, `expected one of ${values.join(", ")}`);
  return value as T;
}

function bounded(value: unknown, path: string, depth: number, seen: Set<unknown>): void {
  if (depth > MAX_DEPTH) fail(path, `nesting exceeds ${MAX_DEPTH}`);
  if (typeof value === "string") { string(value, path); return; }
  if (typeof value !== "object" || value === null) return;
  if (seen.has(value)) fail(path, "cyclic value");
  seen.add(value);
  if (Array.isArray(value)) {
    if (value.length > MAX_ARRAY) fail(path, `array exceeds ${MAX_ARRAY} items`);
    value.forEach((item, index) => bounded(item, `${path}[${index}]`, depth + 1, seen));
  } else {
    const record = value as Record<string, unknown>;
    keys(record, Object.keys(record), path);
    for (const [key, item] of Object.entries(record)) bounded(item, `${path}.${key}`, depth + 1, seen);
  }
  seen.delete(value);
}

function validateFixture(value: unknown, path: string): Fixture {
  const fixture = object(value, path);
  const kind = oneOf(fixture.kind, [...FIXTURE_KINDS] as string[], `${path}.kind`);
  switch (kind) {
    case "INPUT_TEXT":
      keys(fixture, ["kind", "text", "maxChars"], path);
      string(fixture.text, `${path}.text`);
      if (fixture.maxChars !== undefined && (!Number.isInteger(fixture.maxChars) || fixture.maxChars < 1 || fixture.maxChars > MAX_TEXT)) fail(`${path}.maxChars`, "must be a bounded positive integer");
      return fixture as InputTextFixture;
    case "OUTPUT_TEXT":
      keys(fixture, ["kind", "text", "maxChars"], path);
      string(fixture.text, `${path}.text`);
      if (!Number.isInteger(fixture.maxChars) || fixture.maxChars < 1 || fixture.maxChars > MAX_TEXT) fail(`${path}.maxChars`, "must be a bounded positive integer");
      return fixture as OutputTextFixture;
    case "OUTPUT_JSON":
      keys(fixture, ["kind", "text", "schemaName"], path);
      string(fixture.text, `${path}.text`);
      string(fixture.schemaName, `${path}.schemaName`, 128);
      return fixture as OutputJsonFixture;
    case "CONTEXT_ROWS":
    case "SUGGESTION_ROWS": {
      keys(fixture, ["kind", "rows"], path);
      if (!Array.isArray(fixture.rows) || fixture.rows.length > MAX_ROWS) fail(`${path}.rows`, `must contain at most ${MAX_ROWS} rows`);
      fixture.rows.forEach((row, index) => {
        const record = object(row, `${path}.rows[${index}]`);
        keys(record, ["id", "projectId", "text"], `${path}.rows[${index}]`);
        string(record.id, `${path}.rows[${index}].id`, 128);
        string(record.projectId, `${path}.rows[${index}].projectId`, 128);
        string(record.text, `${path}.rows[${index}].text`);
      });
      return fixture as ContextRowsFixture | SuggestionRowsFixture;
    }
    case "AUTH_REQUEST":
      keys(fixture, ["kind", "operationId", "callerProjectId", "resourceProjectId", "resourceId", "authState", "role", "code", "body"], path);
      for (const field of ["operationId", "callerProjectId", "resourceProjectId", "resourceId"]) string(fixture[field], `${path}.${field}`, 128);
      oneOf(fixture.authState, ["UNAUTHENTICATED", "UNREGISTERED", "REGISTERED"], `${path}.authState`);
      oneOf(fixture.role, ["PM", "DEV_LEAD", "DEVELOPER", "SYNTHETIC_WRONG_ROLE"], `${path}.role`);
      if (fixture.code !== undefined) string(fixture.code, `${path}.code`, 128);
      object(fixture.body, `${path}.body`);
      bounded(fixture.body, `${path}.body`, 0, new Set());
      return fixture as AuthRequestFixture;
    case "PROCESS_TEXT":
      keys(fixture, ["kind", "text"], path);
      string(fixture.text, `${path}.text`);
      return fixture as ProcessTextFixture;
  }
}

function validateCriterion(value: unknown, path: string): Criterion {
  const criterion = object(value, path);
  const type = oneOf(criterion.type, [...CRITERION_TYPES] as string[], `${path}.type`);
  switch (type) {
    case "REDACTED": keys(criterion, ["type", "field", "absent", "flagged"], path); break;
    case "ABSENT": keys(criterion, ["type", "field", "absent"], path); break;
    case "REJECTED": keys(criterion, ["type", "status", "code", "reason"], path); break;
    case "HTTP_ERROR": keys(criterion, ["type", "status", "code", "headers"], path); break;
    case "FLAGGED": keys(criterion, ["type", "field", "equals"], path); break;
    case "NO_LOGGED_SECRET": keys(criterion, ["type", "forbidden"], path); break;
    case "RATE_LIMITED": keys(criterion, ["type", "status", "code", "retryAfterSeconds"], path); break;
    case "NO_EXECUTION": keys(criterion, ["type", "forbiddenPrimitives"], path); break;
    case "TEXT_ONLY": keys(criterion, ["type", "field", "escaped"], path); break;
  }
  bounded(criterion, path, 0, new Set());
  if (type === "RATE_LIMITED" && (!Number.isInteger(criterion.retryAfterSeconds) || Number(criterion.retryAfterSeconds) <= 0)) fail(`${path}.retryAfterSeconds`, "must be positive");
  return criterion as Criterion;
}

export function validateCorpus(value: unknown): CorpusCase[] {
  if (!Array.isArray(value)) fail("$", "manifest must be an array");
  if (value.length === 0) fail("$", "manifest must not be empty");
  const serialized = JSON.stringify(value);
  if (serialized.length > MAX_BYTES) fail("$", `serialized manifest exceeds ${MAX_BYTES} bytes`);
  const ids = new Set<string>();
  const threats = new Set<Threat>();
  const cases = value.map((item, index) => {
    const path = `$[${index}]`;
    const record = object(item, path);
    keys(record, [...CASE_KEYS], path);
    const id = string(record.id, `${path}.id`, 128);
    if (ids.has(id)) fail(`${path}.id`, `duplicate ID ${id}`);
    ids.add(id);
    const threat = oneOf(record.threat, THREATS, `${path}.threat`);
    threats.add(threat);
    const layer = oneOf(record.layer, LAYERS, `${path}.layer`);
    const boundary = oneOf(record.boundary, BOUNDARIES, `${path}.boundary`);
    const description = string(record.description, `${path}.description`, 512);
    const fixture = validateFixture(record.fixture, `${path}.fixture`);
    const expected = object(record.expected, `${path}.expected`);
    keys(expected, ["criterion"], `${path}.expected`);
    const criterion = validateCriterion(expected.criterion, `${path}.expected.criterion`);
    bounded(record, path, 0, new Set());
    return { id, threat, layer, boundary, description, fixture, expected: { criterion } };
  });
  for (const threat of THREATS) if (!threats.has(threat)) fail("$", `missing threat ${threat}`);
  return cases;
}

export function loadCorpus(): CorpusCase[] {
  const raw = readFileSync(new URL("./cases.json", import.meta.url), "utf8");
  return validateCorpus(JSON.parse(raw) as unknown);
}

