import type { Feature, UserRole } from "@agile/contracts";

/** Every gateway number lives here (spec SD4); changing one is a code change with a test. Values from spec conventions.md. */
export type FeatureConfig = { role: UserRole; model: string; maxTokens: number; maxPromptTokens: number; temperature: number; reasoningEffort: string; attemptTimeoutMs?: number; deadlineMs?: number; leaseMs?: number };
export type ModelRecord = { contextTokens: number; reasoningEfforts: readonly string[]; tokenRatio: number; priceIn: number; priceOut: number };

export const FEATURES: Record<Feature, FeatureConfig> = {
  PM_PLAN_OUTLINE: { role: "PM", model: "qwen3.5:9b", maxTokens: 2000, maxPromptTokens: 6000, temperature: 0.2, reasoningEffort: "none" },
  // Worst measured bulk call: 26,850 ms and 2,086 output tokens; limits are 2x.
  PM_PLAN_EXPAND: { role: "PM", model: "llama3.1:8b", maxTokens: 4_200, maxPromptTokens: 7_000, temperature: 0.2, reasoningEffort: "none", attemptTimeoutMs: 54_000, deadlineMs: 54_000, leaseMs: 75_000 },
  LEAD_DIGEST: { role: "DEV_LEAD", model: "llama3.1:8b", maxTokens: 1200, maxPromptTokens: 6000, temperature: 0.2, reasoningEffort: "none" },
  DEV_SUMMARY: { role: "DEVELOPER", model: "llama3.1:8b", maxTokens: 600, maxPromptTokens: 4000, temperature: 0.2, reasoningEffort: "none" },
  DEV_STANDUP: { role: "DEVELOPER", model: "llama3.1:8b", maxTokens: 800, maxPromptTokens: 4000, temperature: 0.2, reasoningEffort: "none" },
};

/** A session opened for the value admits calls of every feature that maps to it (spec SD3); other features map to themselves. */
export const SESSION_FEATURE: Partial<Record<Feature, Feature>> = { PM_PLAN_EXPAND: "PM_PLAN_OUTLINE" };

// Ratios are code points per token from the 2026-10-28 probe; prices are µ$ per million tokens from the integration guide.
export const MODELS: Record<string, ModelRecord> = {
  "llama3.1:8b": { contextTokens: 65_536, reasoningEfforts: [], tokenRatio: 4.0, priceIn: 20_000, priceOut: 30_000 },
  "qwen3.5:9b": { contextTokens: 65_536, reasoningEfforts: ["none"], tokenRatio: 3.7, priceIn: 100_000, priceOut: 150_000 },
  "gemma4:26b": { contextTokens: 131_072, reasoningEfforts: [], tokenRatio: 3.7, priceIn: 60_000, priceOut: 300_000 },
};

/** Highest prices in the guide, so a model without a record is never under-costed. */
export const FALLBACK_PRICE = { priceIn: 260_000, priceOut: 900_000 } as const;
/** Ratio used to estimate tokens for a model without a record. */
export const FALLBACK_TOKEN_RATIO = 3.7;

export const LIMITS = {
  windows: { userMin: { windowSeconds: 60, limit: 6 }, userDay: { windowSeconds: 86_400, limit: 200 }, globalMin: { windowSeconds: 60, limit: 25 }, globalDay: { windowSeconds: 86_400, limit: 2_000 } },
  spendCapMicroUsd: 20_000_000,
  budgetBlockMs: 15 * 60_000,
  breakerFailures: 5,
  breakerOpenMs: 60_000,
  leaseMs: 60_000,
  attemptTimeoutMs: 20_000,
  deadlineMs: 25_000,
  backoff429Ms: 2_000,
  minRetryMs: 8_000,
  sessionIdleMs: 30 * 60_000,
  regenerateRetryAfterSeconds: 1_800,
} as const;

export const SOCLAAS_BASE_URL = "https://soclaas-api.comp.nus.edu.sg/v1";
