import type { ContextSections, Feature } from "@agile/contracts";
import { FALLBACK_PRICE, FALLBACK_TOKEN_RATIO, FEATURES, MODELS } from "./config.js";

type Section = ContextSections[number];

export type FittedPrompt = { system: string; user: string; sectionTokens: Record<string, number>; estimatedPromptTokens: number; truncated: boolean };

const codePoints = (text: string) => [...text];
const render = (name: string, text: string) => `## ${name}\n${text}`;
const ratio = (model: string) => MODELS[model]?.tokenRatio ?? FALLBACK_TOKEN_RATIO;

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

/** Static sections are never cut or dropped; throws for the first one over its own budget, or the last one when only the total is over. */
export function assertStaticSectionsFit(feature: Feature, sections: ContextSections, model: string = FEATURES[feature].model): void {
  const statics = sections.filter((s) => s.kind === "STATIC");
  let total = 0;
  for (const s of statics) {
    const tokens = estimateTokens(render(s.name, s.text), model);
    if (tokens > s.budgetTokens) throw new Error(`STATIC_SECTION_OVER_BUDGET:${s.name}`);
    total += tokens;
  }
  if (total > FEATURES[feature].maxPromptTokens) throw new Error(`STATIC_SECTION_OVER_BUDGET:${statics[statics.length - 1].name}`);
}

/** Cuts each non-static section to its budget, then drops the lowest-priority ones until the prompt fits (spec conventions.md § Token budget). */
export function fitSections(feature: Feature, model: string, sections: ContextSections): FittedPrompt {
  assertStaticSectionsFit(feature, sections, model);
  let truncated = false;
  const fitted = sections.map((s, index) => {
    if (s.kind === "STATIC") return { ...s, index, tokens: estimateTokens(render(s.name, s.text), model) };
    const tokens = estimateTokens(render(s.name, s.text), model);
    if (tokens <= s.budgetTokens) return { ...s, index, tokens };
    truncated = true;
    if (estimateTokens(render(s.name, ""), model) > s.budgetTokens) return { ...s, index, tokens: 0, dropped: true };
    const text = longestFittingPrefix(s, model);
    return { ...s, index, text, tokens: estimateTokens(render(s.name, text), model) };
  }).map((s) => ({ dropped: false, ...s }));

  const total = () => fitted.reduce((sum, s) => sum + (s.dropped ? 0 : s.tokens), 0);
  while (total() > FEATURES[feature].maxPromptTokens) {
    // Highest priority number first; on a tie, the later section in the list.
    const victim = fitted.filter((s) => s.kind !== "STATIC" && !s.dropped).sort((a, b) => b.priority - a.priority || b.index - a.index)[0];
    victim.dropped = true;
    truncated = true;
  }

  const join = (list: typeof fitted) => list.filter((s) => !s.dropped).sort((a, b) => a.priority - b.priority || a.index - b.index).map((s) => render(s.name, s.text)).join("\n\n");
  const system = join(fitted.filter((s) => s.kind === "STATIC"));
  const user = join(fitted.filter((s) => s.kind !== "STATIC"));
  const sectionTokens = Object.fromEntries(fitted.map((s) => [s.name, s.dropped ? 0 : s.tokens]));
  return { system, user, sectionTokens, estimatedPromptTokens: estimateTokens(system, model) + estimateTokens(user, model), truncated };
}

/** Binary search over code points, so astral characters are never split. */
function longestFittingPrefix(section: Section, model: string): string {
  const points = codePoints(section.text);
  let low = 0;
  let high = points.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (estimateTokens(render(section.name, points.slice(0, mid).join("")), model) <= section.budgetTokens) low = mid;
    else high = mid - 1;
  }
  return points.slice(0, low).join("");
}
