import type { UserRole } from "@agile/contracts";

export type AppTier = "local" | "dev" | "preview" | "prod" | "test";

/** Data settings are null on previews other than dev (AD-53); routes needing them then return 500 `INTERNAL`. */
export type AuthSettings = {
  tier: AppTier;
  firebaseProjectId: string | null;
  registrationCodes: Record<UserRole, string> | null;
  rateKeySecret: string | null;
};

type TierResource = { tier: AppTier; branch: string; vercelProject: string; vercelAlias: string; firebaseProjectId: string | null; neonHost: string | null; neonProject: string | null; soclaasBaseUrl: string | null; env: string };
const VERCEL_PROJECT_ID = "prj_U7YYwCGOdx4pThKCPYdkXH1a9Smd";
const RESOURCES: readonly TierResource[] = [
  { tier: "local", branch: "local", vercelProject: VERCEL_PROJECT_ID, vercelAlias: "local", firebaseProjectId: "agile-platform-local", neonHost: "localhost", neonProject: "local", soclaasBaseUrl: "mock://soclaas", env: "local" },
  { tier: "dev", branch: "development", vercelProject: VERCEL_PROJECT_ID, vercelAlias: "development", firebaseProjectId: "agile-platform-dev", neonHost: "dev.neon.tech", neonProject: "agile-platform-dev", soclaasBaseUrl: "https://dev.soclaas.example", env: "dev" },
  { tier: "preview", branch: "pull-request", vercelProject: VERCEL_PROJECT_ID, vercelAlias: "preview", firebaseProjectId: null, neonHost: null, neonProject: null, soclaasBaseUrl: null, env: "preview" },
  { tier: "prod", branch: "main", vercelProject: VERCEL_PROJECT_ID, vercelAlias: "production", firebaseProjectId: "agile-platform-prod", neonHost: "prod.neon.tech", neonProject: "agile-platform-prod", soclaasBaseUrl: "https://prod.soclaas.example", env: "prod" },
  { tier: "test", branch: "test", vercelProject: VERCEL_PROJECT_ID, vercelAlias: "test", firebaseProjectId: "agile-platform-test", neonHost: "localhost", neonProject: "test", soclaasBaseUrl: "mock://soclaas", env: "test" },
];

/** Checks only non-secret deployment identity fields; values are never included in failures. */
export function validateTierResources(env: Record<string, string | undefined>): void {
  const tier = env.APP_TIER as AppTier | undefined;
  const expected = RESOURCES.find((resource) => resource.tier === tier);
  if (!expected) invalid("APP_TIER");
  const fields: Array<[string, string | null | undefined]> = [
    ["FIREBASE_PROJECT_ID", expected.firebaseProjectId], ["VERCEL_PROJECT_ID", expected.vercelProject],
    ["VERCEL_ENV", expected.env === "dev" || expected.env === "prod" ? "preview" : expected.env],
    ["VERCEL_GIT_COMMIT_REF", expected.branch], ["NEON_HOST", expected.neonHost],
    ["NEON_PROJECT", expected.neonProject], ["SOCLAAS_BASE_URL", expected.soclaasBaseUrl],
  ];
  for (const [name, value] of fields) if (value !== null && env[name] !== value) invalid(name);
}

/** Pure over an env map; throws naming the failing setting, never its value (N4). */
export function loadAuthSettings(env: Record<string, string | undefined>): AuthSettings {
  const tier = env.APP_TIER;
  if (!TIERS.includes(tier as AppTier)) invalid("APP_TIER");
  if (RESOURCE_FIELDS.some((name) => env[name] !== undefined)) validateTierResources(env);
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
