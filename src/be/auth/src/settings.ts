import type { UserRole } from "@agile/contracts";
import { getTierTarget, validatePreviewEnvironment } from "@agile/db";

export type AppTier = "local" | "dev" | "preview" | "prod" | "test";

/** Data settings are null on previews other than dev (AD-53); routes needing them then return 500 `INTERNAL`. */
export type AuthSettings = {
  tier: AppTier;
  firebaseProjectId: string | null;
  registrationCodes: Record<UserRole, string> | null;
  rateKeySecret: string | null;
};

/** Checks only non-secret deployment identity fields; values are never included in failures. */
export function validateTierResources(env: Record<string, string | undefined>): void {
  const expected = getTierTarget(env.APP_TIER);
  const fields: Array<[string, string | null | undefined]> = [
    ["FIREBASE_PROJECT_ID", expected.firebaseProjectId], ["VERCEL_PROJECT_ID", expected.vercelProject],
    ["VERCEL_ENV", expected.vercelEnv],
    ["VERCEL_GIT_COMMIT_REF", expected.branch], ["NEON_HOST", expected.neonHost],
    ["NEON_PROJECT", expected.neonProject], ["SOCLAAS_BASE_URL", expected.soclaasBaseUrl],
  ];
  if (expected.tier === "preview") {
    for (const [name] of fields) if (name !== "VERCEL_PROJECT_ID" && name !== "VERCEL_ENV" && name !== "VERCEL_GIT_COMMIT_REF" && env[name] !== undefined) invalid(name);
  }
  for (const [name, value] of fields) {
    if (name === "VERCEL_GIT_COMMIT_REF" && expected.tier === "preview") {
      if (env[name] === "development" || env[name] === "main") invalid(name);
      continue;
    }
    if (value !== null && env[name] !== value) invalid(name);
  }
}

/** Pure over an env map; throws naming the failing setting, never its value (N4). */
export function loadAuthSettings(env: Record<string, string | undefined>): AuthSettings {
  const tier = env.APP_TIER;
  if (!TIERS.includes(tier as AppTier)) invalid("APP_TIER");
  if (tier === "preview") validatePreviewEnvironment(env);
  if (tier === "dev" || tier === "prod" || RESOURCE_FIELDS.some((name) => env[name] !== undefined)) validateTierResources(env);
  // The Admin SDK accepts unsigned tokens when the emulator variable is set, so it is banned on every tier.
  if (env.FIREBASE_AUTH_EMULATOR_HOST !== undefined) invalid("FIREBASE_AUTH_EMULATOR_HOST");
  if (tier === "preview" && DATA_SETTINGS.every((name) => env[name] === undefined)) return { tier, firebaseProjectId: null, registrationCodes: null, rateKeySecret: null };

  const firebaseProjectId = env.FIREBASE_PROJECT_ID;
  if (!firebaseProjectId) invalid("FIREBASE_PROJECT_ID");
  const seen = new Set<string>();
  const registrationCodes = {} as Record<UserRole, string>;
  for (const [role, name] of CODE_SETTINGS) {
    const code = env[name];
    if (code === undefined || code.length < 13 || code.length > 128 || seen.has(code)) invalid(name);
    if (tier === "prod" && DEMO_CODES.includes(code)) invalid(name);
    seen.add(code);
    registrationCodes[role] = code;
  }
  const rateKeySecret = env.RATE_KEY_SECRET;
  if (rateKeySecret === undefined || rateKeySecret.length < 32) invalid("RATE_KEY_SECRET");
  return { tier: tier as AppTier, firebaseProjectId, registrationCodes, rateKeySecret };
}

const TIERS: readonly AppTier[] = ["local", "dev", "preview", "prod", "test"];
const CODE_SETTINGS = [["PM", "REGISTRATION_CODE_PM"], ["DEV_LEAD", "REGISTRATION_CODE_DEV_LEAD"], ["DEVELOPER", "REGISTRATION_CODE_DEVELOPER"]] as const;
const DATA_SETTINGS = ["FIREBASE_PROJECT_ID", ...CODE_SETTINGS.map(([, name]) => name), "RATE_KEY_SECRET"];
const DEMO_CODES = ["PROJ_MANAGER_DEMO", "DEV_LEAD_DEMO", "DEVELOPER_DEMO"];
const RESOURCE_FIELDS = ["VERCEL_PROJECT_ID", "VERCEL_ENV", "VERCEL_GIT_COMMIT_REF", "NEON_HOST", "NEON_PROJECT", "SOCLAAS_BASE_URL"];

/** Names the setting only; the value may be a secret (N4). */
function invalid(name: string): never { throw new Error(`Invalid setting ${name}`); }
