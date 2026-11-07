export type AppTier = "local" | "dev" | "preview" | "prod" | "test";

export type TierTarget = {
  tier: AppTier;
  env: AppTier;
  vercelEnv: "local" | "preview" | "production" | "test";
  branch: string;
  neonHost: string | null;
  neonProject: string | null;
  databaseName: string | null;
};

const TARGETS: Record<AppTier, TierTarget> = {
  local: { tier: "local", env: "local", vercelEnv: "local", branch: "local", neonHost: "localhost", neonProject: "local", databaseName: "agile_platform" },
  dev: { tier: "dev", env: "dev", vercelEnv: "preview", branch: "development", neonHost: "dev.neon.tech", neonProject: "agile-platform-dev", databaseName: "agile_platform" },
  preview: { tier: "preview", env: "preview", vercelEnv: "preview", branch: "any", neonHost: null, neonProject: null, databaseName: null },
  prod: { tier: "prod", env: "prod", vercelEnv: "production", branch: "main", neonHost: "prod.neon.tech", neonProject: "agile-platform-prod", databaseName: "agile_platform" },
  test: { tier: "test", env: "test", vercelEnv: "test", branch: "test", neonHost: "localhost", neonProject: "test", databaseName: "agile_platform" },
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

export function validateDatabaseTarget(env: Record<string, string | undefined>, tier: string | undefined, databaseUrl = env.DATABASE_URL): TierTarget {
  const target = getTierTarget(tier);
  if (target.databaseName === null) throw new Error("database credentials are not permitted for preview");
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const parsed = parseDatabaseTarget(databaseUrl);
  if (parsed.host !== target.neonHost || parsed.databaseName !== target.databaseName) throw new Error("DATABASE_URL does not match APP_TIER target");
  if (env.NEON_HOST !== target.neonHost || env.NEON_PROJECT !== target.neonProject) throw new Error("Neon observations do not match APP_TIER target");
  return target;
}
