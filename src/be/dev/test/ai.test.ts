import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { assertStaticSectionsFit, mockRegistry } from "@agile/llm-gateway";
import type { LlmCall } from "@agile/contracts";
import { SUMMARY_STATIC, STANDUP_STATIC, SUMMARY_PROMPT_VERSION, STANDUP_PROMPT_VERSION, withStatics } from "../src/ai/prompts.js";
import { SummaryOutputSchema, StandupOutputSchema } from "../src/ai/schemas.js";
import { registerDevMocks } from "../src/ai/mocks.js";
import { standupInputHash, sectionsInputHash } from "../src/ai/hash.js";
import { DevError, LOCAL_LIMIT_DETAILS } from "../src/errors.js";

const sec = (name: string, text: string) => ({ name, kind: "DYNAMIC" as const, priority: 1, budgetTokens: 100, trusted: false, text });
const call = (sections: LlmCall["sections"]) => ({ sections }) as LlmCall;

test("E65 schema accepts out-of-range, repeated and blank n entries", () => {
  const out = { items: [{ n: 0, oneLiner: "a" }, { n: 4, oneLiner: "a" }, { n: 1, oneLiner: "a" }, { n: 1, oneLiner: "b" }, { n: 2, oneLiner: "  " }] };
  assert.ok(SummaryOutputSchema.safeParse(out).success);
});

test("F3 schema rejects newline, 301 chars and 11 entries", () => {
  assert.ok(!SummaryOutputSchema.safeParse({ items: [{ n: 1, oneLiner: "a\nb" }] }).success);
  assert.ok(!SummaryOutputSchema.safeParse({ items: [{ n: 1, oneLiner: "a".repeat(301) }] }).success);
  assert.ok(!SummaryOutputSchema.safeParse({ items: Array.from({ length: 11 }, (_, i) => ({ n: i, oneLiner: "a" })) }).success);
  assert.ok(StandupOutputSchema.safeParse({ yesterday: [], today: ["x"], blockers: [] }).success);
  assert.ok(!StandupOutputSchema.safeParse({ yesterday: [], today: [], blockers: ["a\r"] }).success);
});

test("E72 summary mock returns one entry per row", () => {
  registerDevMocks();
  const out = JSON.parse(mockRegistry.get("DEV_SUMMARY")!(call([sec("activity-items", "n=1 a\nn=2 b\n\nn=3 c")])));
  assert.deepEqual(out.items.map((i: { n: number }) => i.n), [1, 2, 3]);
  assert.ok(SummaryOutputSchema.safeParse(out).success);
  assert.ok(StandupOutputSchema.safeParse(JSON.parse(mockRegistry.get("DEV_STANDUP")!(call([])))).success);
});

test("F4 statics fit the budget and versions are 12 hex chars", () => {
  assert.doesNotThrow(() => assertStaticSectionsFit("DEV_SUMMARY", SUMMARY_STATIC));
  assert.doesNotThrow(() => assertStaticSectionsFit("DEV_STANDUP", STANDUP_STATIC));
  assert.match(SUMMARY_PROMPT_VERSION, /^[0-9a-f]{12}$/);
  assert.match(STANDUP_PROMPT_VERSION, /^[0-9a-f]{12}$/);
  assert.equal(withStatics(SUMMARY_STATIC, [sec("x", "y")]).length, 2);
});

test("F4 standupInputHash is stable and sensitive to each input", () => {
  const s = [sec("a", "t")];
  const p = [{ section: "a", type: "TASK", id: "1" }];
  const base = standupInputHash("2026-11-09", s, p);
  assert.equal(base, standupInputHash("2026-11-09", [sec("a", "t")], [{ ...p[0]! }]));
  assert.notEqual(base, standupInputHash("2026-11-10", s, p));
  assert.notEqual(base, standupInputHash("2026-11-09", [sec("a", "u")], p));
  assert.notEqual(base, standupInputHash("2026-11-09", s, [{ section: "a", type: "TASK", id: "2" }]));
  assert.notEqual(sectionsInputHash(s), sectionsInputHash([sec("a", "u")]));
});

test("F4 DevError carries code and status without text", () => {
  const e = new DevError("AI_BUSY", 503, 5);
  assert.equal(e.message, "AI_BUSY");
  assert.equal(e.status, 503);
});

test("F3 schemas enforce list and line boundaries", () => {
  const ok = Array.from({ length: 12 }, () => "a".repeat(300));
  assert.ok(StandupOutputSchema.safeParse({ yesterday: ok, today: ok, blockers: ok }).success);
  const many = Array.from({ length: 13 }, () => "a");
  for (const k of ["yesterday", "today", "blockers"]) {
    assert.ok(!StandupOutputSchema.safeParse({ yesterday: [], today: [], blockers: [], [k]: many }).success);
    assert.ok(!StandupOutputSchema.safeParse({ yesterday: [], today: [], blockers: [], [k]: ["a".repeat(301)] }).success);
  }
  assert.ok(SummaryOutputSchema.safeParse({ items: Array.from({ length: 10 }, (_, i) => ({ n: i + 1, oneLiner: "a" })) }).success);
});

test("F3 schemas reject every line break and accept non-ASCII text", () => {
  for (const bad of ["a\u{2028}b", "a\u{2029}b", "a\rb", "a\nb"]) {
    assert.ok(!SummaryOutputSchema.safeParse({ items: [{ n: 1, oneLiner: bad }] }).success);
    assert.ok(!StandupOutputSchema.safeParse({ yesterday: [bad], today: [], blockers: [] }).success);
  }
  const fine = "caf\u{e9} \u{2713}";
  assert.ok(SummaryOutputSchema.safeParse({ items: [{ n: 1, oneLiner: fine }] }).success);
  assert.ok(StandupOutputSchema.safeParse({ yesterday: [fine], today: [], blockers: [] }).success);
});

test("F4 prompt versions hash the static texts and differ", () => {
  const v = (s: typeof SUMMARY_STATIC) => createHash("sha256").update(s.map((x) => x.text).join("\n")).digest("hex").slice(0, 12);
  assert.equal(SUMMARY_PROMPT_VERSION, v(SUMMARY_STATIC));
  assert.equal(STANDUP_PROMPT_VERSION, v(STANDUP_STATIC));
  assert.notEqual(SUMMARY_PROMPT_VERSION, STANDUP_PROMPT_VERSION);
});

test("F4 hashes change with section name, provenance and order", () => {
  const a = sec("a", "t"), b = sec("b", "u");
  const p = [{ section: "a", type: "TASK", id: "1" }];
  const base = standupInputHash("2026-11-09", [a, b], p);
  assert.notEqual(sectionsInputHash([a]), sectionsInputHash([sec("z", "t")]));
  assert.notEqual(standupInputHash("2026-11-09", [a], p), standupInputHash("2026-11-09", [sec("z", "t")], p));
  assert.notEqual(base, standupInputHash("2026-11-09", [a, b], [{ section: "b", type: "TASK", id: "1" }]));
  assert.notEqual(base, standupInputHash("2026-11-09", [a, b], [{ section: "a", type: "ITEM", id: "1" }]));
  assert.notEqual(base, standupInputHash("2026-11-09", [b, a], p));
  assert.notEqual(base, standupInputHash("2026-11-09", [a, b], [...p, { section: "a", type: "TASK", id: "2" }]));
});

test("F3 statics, withStatics order, empty mock and DevError details", () => {
  assert.deepEqual(withStatics(SUMMARY_STATIC, [sec("x", "y")]).map((s) => s.name), ["summary-rules", "x"]);
  for (const [s, name] of [[SUMMARY_STATIC, "summary-rules"], [STANDUP_STATIC, "standup-rules"]] as const) {
    assert.equal(s.length, 1);
    assert.deepEqual([s[0]!.name, s[0]!.kind, s[0]!.trusted, s[0]!.priority, s[0]!.budgetTokens], [name, "STATIC", true, 0, 300]);
  }
  registerDevMocks();
  assert.deepEqual(JSON.parse(mockRegistry.get("DEV_SUMMARY")!(call([sec("other", "x")]))), { items: [] });
  const e = new DevError("RATE_LIMITED", 429, 7, LOCAL_LIMIT_DETAILS);
  assert.deepEqual([e.code, e.retryAfterSeconds, e.name, e.details], ["RATE_LIMITED", 7, "DevError", LOCAL_LIMIT_DETAILS]);
  assert.deepEqual(LOCAL_LIMIT_DETAILS, [{ field: "reason", message: "LOCAL_LIMIT" }]);
  assert.ok(Object.isFrozen(LOCAL_LIMIT_DETAILS) && Object.isFrozen(LOCAL_LIMIT_DETAILS[0]));
});
