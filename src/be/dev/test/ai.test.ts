import assert from "node:assert/strict";
import test from "node:test";
import { assertStaticSectionsFit, mockRegistry } from "@agile/llm-gateway";
import type { LlmCall } from "@agile/contracts";
import { SUMMARY_STATIC, STANDUP_STATIC, SUMMARY_PROMPT_VERSION, STANDUP_PROMPT_VERSION, withStatics } from "../src/ai/prompts.js";
import { SummaryOutputSchema, StandupOutputSchema } from "../src/ai/schemas.js";
import { registerDevMocks } from "../src/ai/mocks.js";
import { standupInputHash, sectionsInputHash } from "../src/ai/hash.js";
import { DevError } from "../src/errors.js";

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
