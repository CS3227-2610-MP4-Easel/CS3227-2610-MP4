import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { createDbClient, incrementRateCounter, type FilteredDbClient } from "@agile/db";
import { createLookupRegisteredUser, createResolvePrincipal, type RegisteredPrincipal, type TokenPrincipal } from "./principal.js";
import { createHit, type Hit } from "./rate-limit.js";
import { loadAuthSettings, type AuthSettings } from "./settings.js";
import { createFirebaseTokenVerifier, type TokenVerifier } from "./token-verifier.js";

export type AuthRuntime = {
  settings: AuthSettings;
  hit: Hit;
  db: FilteredDbClient;
  resolvePrincipal(authorization: string | undefined): Promise<TokenPrincipal>;
  lookupRegisteredUser(firebaseUid: string): Promise<RegisteredPrincipal>;
};

/** Validates settings (throws on unsafe ones, N4) and builds everything auth needs from one `PrismaClient`, so there is one pool.
 * The client does not connect until its first query. Without Firebase settings (a mock preview, E50) identity calls fail with 500. */
export function createAuthRuntime(env: Record<string, string | undefined>, overrides: { verifier?: TokenVerifier; base?: PrismaClient } = {}): AuthRuntime {
  const settings = loadAuthSettings(env);
  const base = overrides.base ?? new PrismaClient({ adapter: new PrismaPg({ connectionString: env.DATABASE_URL }) });
  const db = createDbClient(base);
  const hit = createHit((key, windowSeconds) => incrementRateCounter(base, key, windowSeconds));
  if (!settings.firebaseProjectId) {
    const notConfigured = async (): Promise<never> => { throw new Error("AUTH_NOT_CONFIGURED"); };
    return { settings, hit, db, resolvePrincipal: notConfigured, lookupRegisteredUser: notConfigured };
  }
  const verifier = overrides.verifier ?? createFirebaseTokenVerifier(settings.firebaseProjectId);
  return { settings, hit, db, resolvePrincipal: createResolvePrincipal(verifier), lookupRegisteredUser: createLookupRegisteredUser(db) };
}

let cached: AuthRuntime | undefined;

/** The process-wide runtime from `process.env`, created on first use; serverless entry points call it at module load. */
export function getAuthRuntime(): AuthRuntime { return (cached ??= createAuthRuntime(process.env)); }
