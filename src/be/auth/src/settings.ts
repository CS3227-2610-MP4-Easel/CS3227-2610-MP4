import type { UserRole } from "@agile/contracts";

export type AppTier = "local" | "dev" | "preview" | "prod" | "test";

/** Data settings are null on previews other than dev (AD-53); routes needing them then return 500 `INTERNAL`. */
export type AuthSettings = {
  tier: AppTier;
  firebaseProjectId: string | null;
  registrationCodes: Record<UserRole, string> | null;
  rateKeySecret: string | null;
};

/** Pure over an env map; throws naming the failing setting, never its value (N4). */
export function loadAuthSettings(env: Record<string, string | undefined>): AuthSettings {
  const tier = env.APP_TIER;
  if (!TIERS.includes(tier as AppTier)) invalid("APP_TIER");
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

/** Names the setting only; the value may be a secret (N4). */
function invalid(name: string): never { throw new Error(`Invalid setting ${name}`); }
