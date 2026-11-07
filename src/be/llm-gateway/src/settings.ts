import type { Feature } from "@agile/contracts";
import { validatePreviewEnvironment } from "@agile/db";
import { FEATURES, MODELS, SOCLAAS_BASE_URL } from "./config.js";
import { OUTPUT_LIMITS } from "./output-check.js";

export type AppTier = "local" | "dev" | "preview" | "prod" | "test";
export type LlmMode = "mock" | "live";

export type GatewaySettings = {
  tier: AppTier;
  llmMode: LlmMode;
  aiEnabled: boolean;
  /** Null in mock mode, so the key is never held when it cannot be used. */
  apiKey: string | null;
  baseUrl: string;
  modelOverrides: Partial<Record<Feature, string>>;
};

/** Pure over an env map; throws naming the failing setting, never its value (N2). */
export function loadGatewaySettings(env: Record<string, string | undefined>): GatewaySettings {
  const tier = env.APP_TIER;
  if (!TIERS.includes(tier as AppTier)) invalid("APP_TIER");
  if (tier === "preview") validatePreviewEnvironment(env);

  const mode = env.LLM_MODE;
  if (mode !== undefined && mode !== "mock" && mode !== "live") invalid("LLM_MODE");
  // test and preview never call the live service (AD-26, AD-53); prod never serves canned output (SD14).
  if (mode === undefined && (tier === "dev" || tier === "prod")) invalid("LLM_MODE");
  if (mode === "live" && (tier === "test" || tier === "preview")) invalid("LLM_MODE");
  if (mode === "mock" && tier === "prod") invalid("LLM_MODE");
  const llmMode: LlmMode = mode ?? "mock";

  const enabled = env.AI_ENABLED;
  if (enabled !== undefined && enabled !== "true" && enabled !== "false") invalid("AI_ENABLED");

  let apiKey: string | null = null;
  if (llmMode === "live") {
    const key = env.SOCLAAS_API_KEY;
    if (!key || key.length < OUTPUT_LIMITS.minSecretLength || /\s/.test(key)) invalid("SOCLAAS_API_KEY");
    apiKey = key;
  }

  // Only the exact SoCLaaS URL, so a poisoned setting cannot send the key elsewhere (SD14).
  const baseUrl = env.SOCLAAS_BASE_URL ?? SOCLAAS_BASE_URL;
  if (baseUrl !== SOCLAAS_BASE_URL) invalid("SOCLAAS_BASE_URL");

  const modelOverrides: Partial<Record<Feature, string>> = {};
  for (const feature of Object.keys(FEATURES) as Feature[]) {
    const name = `LLM_MODEL_${feature}`;
    const model = env[name];
    if (model === undefined) continue;
    if (!Object.hasOwn(MODELS, model)) invalid(name);
    modelOverrides[feature] = model;
  }

  return { tier: tier as AppTier, llmMode, aiEnabled: enabled !== "false", apiKey, baseUrl, modelOverrides };
}

/** The model a feature uses after the settings override. */
export function modelFor(settings: Pick<GatewaySettings, "modelOverrides">, feature: Feature): string {
  return settings.modelOverrides[feature] ?? FEATURES[feature].model;
}

/** What the output guard must never let through: the SoCLaaS key in live mode (spec SD8); the gateway's own settings drop the key. */
export function gatewaySecrets(settings: Pick<GatewaySettings, "llmMode" | "apiKey">): string[] {
  return settings.llmMode === "live" && settings.apiKey ? [settings.apiKey] : [];
}

const TIERS: readonly AppTier[] = ["local", "dev", "preview", "prod", "test"];

/** Names the setting only; the value may be a secret. */
function invalid(name: string): never { throw new Error(`Invalid setting ${name}`); }
