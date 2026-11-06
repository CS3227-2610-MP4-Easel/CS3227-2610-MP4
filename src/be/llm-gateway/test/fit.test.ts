import assert from "node:assert/strict";
import { test } from "node:test";
import type { ContextSections } from "@agile/contracts";
import { assertStaticSectionsFit, estimateTokens, fitSections } from "../src/index.js";

type Section = ContextSections[number];
const section = (name: string, kind: Section["kind"], priority: number, budgetTokens: number, text: string): Section => ({ name, kind, priority, budgetTokens, text, trusted: kind === "STATIC" });
const render = (s: Section) => `## ${s.name}\n${s.text}`;
const MODEL = "llama3.1:8b"; // 4 code points per token

test("E28 a non-static section over its budget is cut to the largest fitting code-point prefix", () => {
  const emoji = "😀".repeat(200);
  const fitted = fitSections("DEV_STANDUP", MODEL, [section("rules", "STATIC", 0, 50, "Be brief."), section("items", "DYNAMIC", 1, 20, emoji)]);
  assert.equal(fitted.truncated, true);
  assert.ok(fitted.sectionTokens.items <= 20);
  const kept = fitted.user.slice("## items\n".length);
  assert.ok([...kept].every((c) => c === "😀"), "no split surrogate");
  assert.equal(estimateTokens(`## items\n${kept}😀`, MODEL) > 20, true, "one more code point would not fit");
  assert.equal(fitted.sectionTokens.items, estimateTokens(render(section("items", "DYNAMIC", 1, 20, kept)), MODEL));
});

test("E28 a section whose header alone exceeds its budget is dropped", () => {
  const fitted = fitSections("DEV_STANDUP", MODEL, [section("a-very-long-section-name", "DYNAMIC", 1, 1, "x")]);
  assert.equal(fitted.sectionTokens["a-very-long-section-name"], 0);
  assert.equal(fitted.user, "");
  assert.equal(fitted.truncated, true);
});

test("E29 over maxPromptTokens drops the highest priority number first, later one on ties; statics untouched", () => {
  const big = "y".repeat(4 * 1500); // about 1500 tokens each; DEV_STANDUP maxPromptTokens is 4000
  const sections = [
    section("rules", "STATIC", 0, 500, "Rules."),
    section("a", "RETRIEVED", 2, 2000, big),
    section("b", "DYNAMIC", 3, 2000, big),
    section("c", "DYNAMIC", 3, 2000, big),
  ];
  const fitted = fitSections("DEV_STANDUP", MODEL, sections);
  assert.equal(fitted.sectionTokens.c, 0, "later of the two priority-3 sections dropped first");
  assert.ok(fitted.sectionTokens.b > 0);
  assert.ok(fitted.sectionTokens.a > 0);
  assert.equal(fitted.system, "## rules\nRules.");
  assert.equal(fitted.user, `## a\n${big}\n\n## b\n${big}`);
  assert.equal(fitted.truncated, true);
  assert.equal(fitted.estimatedPromptTokens, estimateTokens(fitted.system, MODEL) + estimateTokens(fitted.user, MODEL));
});

test("E29 sections are ordered by priority then list order and nothing is cut when within budget", () => {
  const fitted = fitSections("DEV_STANDUP", MODEL, [section("late", "DYNAMIC", 2, 100, "two"), section("s2", "STATIC", 1, 100, "B"), section("s1", "STATIC", 0, 100, "A"), section("early", "RETRIEVED", 1, 100, "one")]);
  assert.equal(fitted.system, "## s1\nA\n\n## s2\nB");
  assert.equal(fitted.user, "## early\none\n\n## late\ntwo");
  assert.equal(fitted.truncated, false);
});

test("E30 static sections over budget throw before anything else", () => {
  const over = [section("ok", "STATIC", 0, 100, "fine"), section("rules", "STATIC", 1, 2, "x".repeat(100))];
  assert.throws(() => assertStaticSectionsFit("DEV_STANDUP", over), { message: "STATIC_SECTION_OVER_BUDGET:rules" });
  assert.throws(() => fitSections("DEV_STANDUP", MODEL, over), { message: "STATIC_SECTION_OVER_BUDGET:rules" });
  const total = [section("one", "STATIC", 0, 3000, "x".repeat(4 * 2500)), section("two", "STATIC", 1, 3000, "x".repeat(4 * 2500))];
  assert.throws(() => assertStaticSectionsFit("DEV_STANDUP", total), { message: "STATIC_SECTION_OVER_BUDGET:two" });
  assert.doesNotThrow(() => assertStaticSectionsFit("DEV_STANDUP", [section("rules", "STATIC", 0, 100, "short")]));
});
