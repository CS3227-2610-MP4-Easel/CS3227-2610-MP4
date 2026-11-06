import type { ContextSections, Feature } from "@agile/contracts";
import { FALLBACK_PRICE, FALLBACK_TOKEN_RATIO, FEATURES, MODELS } from "./config.js";
import { securitySuffix, wrapSection } from "./guards.js";

type Section = ContextSections[number];

export type FittedPrompt = { system: string; user: string; sectionTokens: Record<string, number>; estimatedPromptTokens: number; truncated: boolean };

/** Stands in for the boundary where only the length matters: the system message and the static budget check. */
export const PLACEHOLDER_BOUNDARY = "0".repeat(16);

const codePoints = (text: string) => [...text];
/** Untrusted non-static sections are wrapped in the call's boundary (spec api.md § Wrapping); static and trusted ones are not. */
const render = (section: Section, text: string, boundary: string) =>
  section.kind !== "STATIC" && !section.trusted ? wrapSection(section.name, text, boundary) : `## ${section.name}\n${text}`;
const ratio = (model: string) => MODELS[model]?.tokenRatio ?? FALLBACK_TOKEN_RATIO;
/** The suffix is always last in the user message and never cut. */
const withSuffix = (content: string, boundary: string) => (content ? `${content}\n\n${securitySuffix(boundary)}` : securitySuffix(boundary));

/** Characters over the model's ratio, counted in code points (AD-17). */
export function estimateTokens(text: string, model: string): number {
  return Math.ceil(codePoints(text).length / ratio(model));
}

/** Integer arithmetic, so a whole number of µ$ is never rounded up by float error (E32). */
export function costMicroUsd(model: string, promptTokens: number, completionTokens: number): number {
  const { priceIn, priceOut } = MODELS[model] ?? FALLBACK_PRICE;
  return Math.ceil((promptTokens * priceIn + completionTokens * priceOut) / 1_000_000);
}

/** The worst-case cost an in-flight call holds against the spend cap. */
export function reservation(feature: Feature, model: string): number {
  return costMicroUsd(model, FEATURES[feature].maxPromptTokens, FEATURES[feature].maxTokens);
}

type Placed = Section & { index: number };
const byOrder = (a: Placed, b: Placed) => a.priority - b.priority || a.index - b.index;
const joinSections = (list: Placed[], boundary: string) => [...list].sort(byOrder).map((s) => render(s, s.text, boundary)).join("\n\n");

/**
 * Static sections are never cut or dropped, and neither is the security suffix: throws for the first static over its own budget,
 * the last static when the statics alone are over the total, or `security-suffix` when only the suffix tips it over.
 */
export function assertStaticSectionsFit(feature: Feature, sections: ContextSections, model: string = FEATURES[feature].model): void {
  const statics = sections.map((s, index) => ({ ...s, index })).filter((s) => s.kind === "STATIC");
  for (const s of statics) {
    if (estimateTokens(render(s, s.text, PLACEHOLDER_BOUNDARY), model) > s.budgetTokens) throw new Error(`STATIC_SECTION_OVER_BUDGET:${s.name}`);
  }
  const max = FEATURES[feature].maxPromptTokens;
  const system = estimateTokens(joinSections(statics, PLACEHOLDER_BOUNDARY), model);
  if (system > max) throw new Error(`STATIC_SECTION_OVER_BUDGET:${statics[statics.length - 1].name}`);
  if (system + estimateTokens(withSuffix("", PLACEHOLDER_BOUNDARY), model) > max) throw new Error("STATIC_SECTION_OVER_BUDGET:security-suffix");
}

/** Cuts each non-static section to its budget, then drops the lowest-priority ones until the prompt as sent fits (spec api.md § Wrapping). */
export function fitSections(feature: Feature, model: string, sections: ContextSections, boundary: string): FittedPrompt {
  assertStaticSectionsFit(feature, sections, model);
  let truncated = false;
  const fitted = sections.map((s, index) => {
    const tokens = estimateTokens(render(s, s.text, boundary), model);
    if (s.kind === "STATIC" || tokens <= s.budgetTokens) return { ...s, index, tokens };
    truncated = true;
    if (estimateTokens(render(s, "", boundary), model) > s.budgetTokens) return { ...s, index, tokens: 0, dropped: true };
    const text = longestFittingPrefix(s, model, boundary);
    return { ...s, index, text, tokens: estimateTokens(render(s, text, boundary), model) };
  }).map((s) => ({ dropped: false, ...s }));

  const kept = (static_: boolean) => fitted.filter((s) => !s.dropped && (s.kind === "STATIC") === static_);
  const system = joinSections(kept(true), boundary);
  const userOf = () => withSuffix(joinSections(kept(false), boundary), boundary);
  // The loop counts the strings as sent (separators and suffix included), so the result never exceeds the limit (E26).
  while (estimateTokens(system, model) + estimateTokens(userOf(), model) > FEATURES[feature].maxPromptTokens) {
    // Highest priority number first; on a tie, the later section in the list.
    const victim = fitted.filter((s) => s.kind !== "STATIC" && !s.dropped).sort((a, b) => b.priority - a.priority || b.index - a.index)[0];
    victim.dropped = true;
    truncated = true;
  }

  const user = userOf();
  const sectionTokens = Object.fromEntries(fitted.map((s) => [s.name, s.dropped ? 0 : s.tokens]));
  return { system, user, sectionTokens, estimatedPromptTokens: estimateTokens(system, model) + estimateTokens(user, model), truncated };
}

/** Binary search over code points, so astral characters are never split; the wrapper stays whole. */
function longestFittingPrefix(section: Section, model: string, boundary: string): string {
  const points = codePoints(section.text);
  let low = 0;
  let high = points.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (estimateTokens(render(section, points.slice(0, mid).join(""), boundary), model) <= section.budgetTokens) low = mid;
    else high = mid - 1;
  }
  return points.slice(0, low).join("");
}
