import assert from "node:assert/strict";
import { test } from "node:test";
import type { ContextSections } from "@agile/contracts";
import { assertStaticSectionsFit, estimateTokens, FEATURES, fitSections, PLACEHOLDER_BOUNDARY, securitySuffix, wrapSection } from "../src/index.js";

type Section = ContextSections[number];
const section = (name: string, kind: Section["kind"], priority: number, budgetTokens: number, text: string): Section => ({ name, kind, priority, budgetTokens, text, trusted: kind === "STATIC" });
const B = "0123456789abcdef";
/** As `fitSections` renders: non-static sections in these tests are untrusted, so they are wrapped. */
const render = (s: Section) => (s.kind === "STATIC" ? `## ${s.name}\n${s.text}` : wrapSection(s.name, s.text, B));
const MODEL = "llama3.1:8b"; // 4 code points per token
const SUFFIX = securitySuffix(B);
const textOf = (user: string, name: string) => user.slice(user.indexOf(`## ${name}\n<data-${B}>\n`) + `## ${name}\n<data-${B}>\n`.length, user.indexOf(`\n</data-${B}>`));

test("E28 a non-static section over its budget is cut to the largest fitting code-point prefix", () => {
  const emoji = "😀".repeat(200);
  const fitted = fitSections("DEV_STANDUP", MODEL, [section("rules", "STATIC", 0, 50, "Be brief."), section("items", "DYNAMIC", 1, 20, emoji)], B);
  assert.equal(fitted.truncated, true);
  assert.ok(fitted.sectionTokens.items <= 20);
  const kept = textOf(fitted.user, "items");
  assert.ok(kept.length > 0 && [...kept].every((c) => c === "😀"), "no split surrogate");
  assert.equal(estimateTokens(wrapSection("items", `${kept}😀`, B), MODEL) > 20, true, "one more code point would not fit");
  assert.equal(fitted.sectionTokens.items, estimateTokens(render(section("items", "DYNAMIC", 1, 20, kept)), MODEL));
});

test("E28 a section whose header alone exceeds its budget is dropped", () => {
  const fitted = fitSections("DEV_STANDUP", MODEL, [section("a-very-long-section-name", "DYNAMIC", 1, 1, "x")], B);
  assert.equal(fitted.sectionTokens["a-very-long-section-name"], 0);
  assert.equal(fitted.user, SUFFIX);
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
  const fitted = fitSections("DEV_STANDUP", MODEL, sections, B);
  assert.equal(fitted.sectionTokens.c, 0, "later of the two priority-3 sections dropped first");
  assert.ok(fitted.sectionTokens.b > 0);
  assert.ok(fitted.sectionTokens.a > 0);
  assert.equal(fitted.system, "## rules\nRules.");
  assert.equal(fitted.user, `${wrapSection("a", big, B)}\n\n${wrapSection("b", big, B)}\n\n${SUFFIX}`);
  assert.equal(fitted.truncated, true);
  assert.equal(fitted.estimatedPromptTokens, estimateTokens(fitted.system, MODEL) + estimateTokens(fitted.user, MODEL));
});

test("E29 sections are ordered by priority then list order and nothing is cut when within budget", () => {
  const fitted = fitSections("DEV_STANDUP", MODEL, [section("late", "DYNAMIC", 2, 100, "two"), section("s2", "STATIC", 1, 100, "B"), section("s1", "STATIC", 0, 100, "A"), section("early", "RETRIEVED", 1, 100, "one")], B);
  assert.equal(fitted.system, "## s1\nA\n\n## s2\nB");
  assert.equal(fitted.user, `${wrapSection("early", "one", B)}\n\n${wrapSection("late", "two", B)}\n\n${SUFFIX}`);
  assert.equal(fitted.truncated, false);
});

test("E30 static sections over budget throw before anything else", () => {
  const over = [section("ok", "STATIC", 0, 100, "fine"), section("rules", "STATIC", 1, 2, "x".repeat(100))];
  assert.throws(() => assertStaticSectionsFit("DEV_STANDUP", over), { message: "STATIC_SECTION_OVER_BUDGET:rules" });
  assert.throws(() => fitSections("DEV_STANDUP", MODEL, over, B), { message: "STATIC_SECTION_OVER_BUDGET:rules" });
  const total = [section("one", "STATIC", 0, 3000, "x".repeat(4 * 2500)), section("two", "STATIC", 1, 3000, "x".repeat(4 * 2500))];
  assert.throws(() => assertStaticSectionsFit("DEV_STANDUP", total), { message: "STATIC_SECTION_OVER_BUDGET:two" });
  assert.doesNotThrow(() => assertStaticSectionsFit("DEV_STANDUP", [section("rules", "STATIC", 0, 100, "short")]));
});

test("E23 F5 the suffix is the whole user message when no untrusted section is sent", () => {
  assert.equal(fitSections("DEV_STANDUP", MODEL, [section("rules", "STATIC", 0, 50, "Be brief.")], B).user, SUFFIX);
  assert.equal(fitSections("DEV_STANDUP", MODEL, [section("rules", "STATIC", 0, 50, "Be brief."), section("items", "DYNAMIC", 1, 5, "x")], B).user, SUFFIX);
});

test("E24 F5 truncation cuts the text inside the wrapper, never the wrapper", () => {
  const rules = section("rules", "STATIC", 0, 50, "Be brief.");
  const overhead = wrapSection("s", "", B).length; // 54 code points
  const fit = (text: string) => fitSections("DEV_STANDUP", MODEL, [rules, section("s", "DYNAMIC", 1, 20, text)], B);
  const room = 4 * 20 - overhead;

  const unwrappedFits = fit("t".repeat(60));
  assert.ok(estimateTokens(`## s\n${"t".repeat(60)}`, MODEL) <= 20, "the text alone would fit");
  assert.equal(unwrappedFits.truncated, true);
  assert.equal(textOf(unwrappedFits.user, "s"), "t".repeat(room));
  assert.ok(unwrappedFits.user.includes(`\n</data-${B}>`), "closing tag intact");

  const exact = fit("t".repeat(room));
  assert.equal(exact.truncated, false);
  assert.equal(exact.sectionTokens.s, 20);
  const oneMore = fit("t".repeat(room + 1));
  assert.equal(oneMore.truncated, true);
  assert.equal(oneMore.sectionTokens.s, estimateTokens(wrapSection("s", "t".repeat(room), B), MODEL));
});

test("E25 F5 a section whose empty wrapped form is over budget is dropped", () => {
  const fitted = fitSections("DEV_STANDUP", MODEL, [section("rules", "STATIC", 0, 50, "Be brief."), section("s", "DYNAMIC", 1, 10, "x")], B);
  assert.equal(fitted.sectionTokens.s, 0);
  assert.equal(fitted.truncated, true);
});

test("E26 F5 the estimate counts the strings as sent and never exceeds the limit; the suffix is not a section", () => {
  const big = "y".repeat(4 * 1300);
  const fitted = fitSections("DEV_STANDUP", MODEL, [section("rules", "STATIC", 0, 500, "Rules."), section("a", "DYNAMIC", 1, 2000, big), section("b", "DYNAMIC", 2, 2000, big), section("c", "DYNAMIC", 3, 2000, big)], B);
  assert.equal(fitted.estimatedPromptTokens, estimateTokens(fitted.system, MODEL) + estimateTokens(fitted.user, MODEL));
  assert.ok(fitted.estimatedPromptTokens <= FEATURES.DEV_STANDUP.maxPromptTokens);
  assert.deepEqual(Object.keys(fitted.sectionTokens).sort(), ["a", "b", "c", "rules"]);
  const sectionSum = Object.values(fitted.sectionTokens).reduce((a, b) => a + b, 0);
  assert.ok(sectionSum + estimateTokens(SUFFIX, MODEL) <= fitted.estimatedPromptTokens, "the suffix is counted in the estimate, not in a section");
});

test("E27 F5 the static budget includes the suffix", () => {
  const max = FEATURES.DEV_STANDUP.maxPromptTokens;
  const suffixTokens = estimateTokens(securitySuffix(PLACEHOLDER_BOUNDARY), MODEL);
  const fill = 4 * (max - suffixTokens) - "## rules\n".length;
  assert.doesNotThrow(() => assertStaticSectionsFit("DEV_STANDUP", [section("rules", "STATIC", 0, max, "x".repeat(fill))], MODEL));
  assert.throws(() => assertStaticSectionsFit("DEV_STANDUP", [section("rules", "STATIC", 0, max, "x".repeat(fill + 4))], MODEL), { message: "STATIC_SECTION_OVER_BUDGET:security-suffix" });
});
