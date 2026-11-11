export type AppTier = "local" | "dev" | "preview" | "prod" | "test";

export type TierTarget = {
  tier: AppTier;
  env: AppTier;
  vercelEnv: "local" | "preview" | "production" | "test";
  branch: string;
  neonHost: string | null;
  neonProject: string | null;
  databaseName: string | null;
  vercelProject: string;
  vercelAlias: string;
  firebaseProjectId: string | null;
  soclaasBaseUrl: string | null;
};

const VERCEL_PROJECT = "prj_U7YYwCGOdx4pThKCPYdkXH1a9Smd";
const TARGETS: Record<AppTier, TierTarget> = {
  local: { tier: "local", env: "local", vercelEnv: "local", branch: "local", neonHost: "localhost", neonProject: "local", databaseName: "agile_platform", vercelProject: VERCEL_PROJECT, vercelAlias: "local", firebaseProjectId: "agile-platform-local", soclaasBaseUrl: "mock://soclaas" },
  dev: { tier: "dev", env: "dev", vercelEnv: "preview", branch: "development", neonHost: "ep-fragrant-union-aod4nxjd-pooler.c-2.ap-southeast-1.aws.neon.tech", neonProject: "falling-rice-06970921", databaseName: "neondb", vercelProject: VERCEL_PROJECT, vercelAlias: "development", firebaseProjectId: "agile-platform-dev", soclaasBaseUrl: "https://soclaas-api.comp.nus.edu.sg/v1" },
  preview: { tier: "preview", env: "preview", vercelEnv: "preview", branch: "any", neonHost: null, neonProject: null, databaseName: null, vercelProject: VERCEL_PROJECT, vercelAlias: "preview", firebaseProjectId: null, soclaasBaseUrl: null },
  prod: { tier: "prod", env: "prod", vercelEnv: "production", branch: "main", neonHost: "ep-summer-heart-b3767eul-pooler.c-4.ap-southeast-1.aws.neon.tech", neonProject: "super-sunset-36592949", databaseName: "neondb", vercelProject: VERCEL_PROJECT, vercelAlias: "production", firebaseProjectId: "agile-platform-prod", soclaasBaseUrl: "https://soclaas-api.comp.nus.edu.sg/v1" },
  test: { tier: "test", env: "test", vercelEnv: "test", branch: "test", neonHost: "localhost", neonProject: "test", databaseName: "agile_platform", vercelProject: VERCEL_PROJECT, vercelAlias: "test", firebaseProjectId: "agile-platform-test", soclaasBaseUrl: "mock://soclaas" },
};

export function getTierTarget(tier: string | undefined): TierTarget {
  if (!tier || !Object.prototype.hasOwnProperty.call(TARGETS, tier)) throw new Error("unsupported APP_TIER");
  return TARGETS[tier as AppTier];
}

export function parseDatabaseTarget(databaseUrl: string): { protocol: string; host: string; databaseName: string } {
  let parsed: URL;
  try { parsed = new URL(databaseUrl); } catch { throw new Error("DATABASE_URL is malformed"); }
  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") throw new Error("DATABASE_URL must use postgres protocol");
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (!parsed.hostname || !databaseName) throw new Error("DATABASE_URL target is incomplete");
  return { protocol: parsed.protocol, host: parsed.hostname, databaseName };
}

const PREVIEW_FORBIDDEN_NAMES = [
  "DATABASE_URL", "DIRECT_DATABASE_URL", "FIREBASE_PROJECT_ID",
  "REGISTRATION_CODE_PM", "REGISTRATION_CODE_DEV_LEAD", "REGISTRATION_CODE_DEVELOPER",
  "RATE_KEY_SECRET", "NEON_HOST", "NEON_PROJECT", "SOCLAAS_BASE_URL",
  "SOCLAAS_API_KEY", "VERCEL_TOKEN", "VERCEL_TEAM_ID",
] as const;

const W13_RECOVERY_PROJECT = "falling-rice-06970921";
const W13_RECOVERY_BRANCH = "w13-recovery-baseline";
const W13_RECOVERY_HOST = "ep-purple-shape-aohygd1w.c-2.ap-southeast-1.aws.neon.tech";
const W13_RECOVERY_DATABASE = "neondb";

function isApprovedW13RecoveryTarget(env: Record<string, string | undefined>, target: TierTarget, parsed: { host: string; databaseName: string }): boolean {
  return target.tier === "dev"
    && env.W13_RECOVERY_REHEARSAL === "1"
    && env.NEON_BRANCH === W13_RECOVERY_BRANCH
    && env.NEON_PROJECT === W13_RECOVERY_PROJECT
    && env.NEON_HOST === W13_RECOVERY_HOST
    && parsed.host === W13_RECOVERY_HOST
    && parsed.databaseName === W13_RECOVERY_DATABASE;
}

function expectedObservedHost(recoveryTarget: boolean, target: TierTarget): string | null {
  return recoveryTarget ? W13_RECOVERY_HOST : target.neonHost;
}

export function validatePreviewEnvironment(env: Record<string, string | undefined>): true {
  if (env.APP_TIER !== "preview") throw new Error("APP_TIER must be preview");
  const forbidden = PREVIEW_FORBIDDEN_NAMES.find((name) => env[name] !== undefined);
  if (forbidden) throw new Error(`preview must not receive ${forbidden}`);
  if (env.VERCEL_GIT_COMMIT_REF === "development" || env.VERCEL_GIT_COMMIT_REF === "main") {
    throw new Error("preview VERCEL_GIT_COMMIT_REF is protected");
  }
  return true;
}

export function validateRuntimeDatabaseTarget(env: Record<string, string | undefined>): TierTarget | null {
  const target = getTierTarget(env.APP_TIER);
  if (target.tier === "preview") {
    validatePreviewEnvironment(env);
    return null;
  }
  if (!env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const parsed = parseDatabaseTarget(env.DATABASE_URL);
  const recoveryTarget = isApprovedW13RecoveryTarget(env, target, parsed);
  const expectedHost = expectedObservedHost(recoveryTarget, target);
  if (parsed.host !== expectedHost || parsed.databaseName !== target.databaseName) throw new Error("DATABASE_URL does not match APP_TIER target");
  const hasHost = env.NEON_HOST !== undefined;
  const hasProject = env.NEON_PROJECT !== undefined;
  if (target.tier === "dev" || target.tier === "prod" || hasHost || hasProject) {
    if (env.NEON_HOST !== expectedHost || env.NEON_PROJECT !== (recoveryTarget ? W13_RECOVERY_PROJECT : target.neonProject)) throw new Error("Neon observations do not match APP_TIER target");
  }
  return target;
}

export function validateDatabaseTarget(env: Record<string, string | undefined>, tier: string | undefined, databaseUrl = env.DATABASE_URL): TierTarget {
  const target = getTierTarget(tier);
  if (target.databaseName === null) throw new Error("database credentials are not permitted for preview");
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const parsed = parseDatabaseTarget(databaseUrl);
  const recoveryTarget = isApprovedW13RecoveryTarget(env, target, parsed);
  const expectedHost = expectedObservedHost(recoveryTarget, target);
  if (parsed.host !== expectedHost || parsed.databaseName !== target.databaseName) throw new Error("DATABASE_URL does not match APP_TIER target");
  if (env.NEON_HOST !== expectedHost || env.NEON_PROJECT !== (recoveryTarget ? W13_RECOVERY_PROJECT : target.neonProject)) throw new Error("Neon observations do not match APP_TIER target");
  return target;
}
