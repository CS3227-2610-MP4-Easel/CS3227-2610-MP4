import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import type { LlmGateway } from "@agile/contracts";
import { getAuthRuntime, type Hit } from "@agile/auth";
import { validateRuntimeDatabaseTarget } from "@agile/db";
import { createLlmGateway } from "./gateway.js";
import { createMockProvider, createSoclaasProvider } from "./providers.js";
import { createSessions, type GatewaySessions } from "./sessions.js";
import { gatewaySecrets, loadGatewaySettings } from "./settings.js";
import { createCacheHits, type CacheHitInput } from "./usage.js";

type Runtime = { gateway: LlmGateway; sessions: GatewaySessions; cacheHits: { recordCacheHit(input: CacheHitInput): Promise<void> } };
let cached: Runtime | undefined;

export type GatewayRuntimeOverrides = {
  createClient?: (connectionString: string) => PrismaClient;
  hit?: Hit;
};

function unavailablePreviewRuntime(): Runtime {
  const unavailable = async (): Promise<never> => { throw new Error("AI_NOT_CONFIGURED"); };
  return {
    gateway: { run: async () => ({ ok: false, code: "AI_DISABLED" }) },
    sessions: new Proxy({} as GatewaySessions, { get() { return unavailable; } }),
    cacheHits: { recordCacheHit: unavailable },
  };
}

/** Built once from `process.env`: settings validated, one client for the gateway's tables, auth's limiter, the provider per `LLM_MODE`. */
export function createLlmGatewayRuntime(env: Record<string, string | undefined>, overrides: GatewayRuntimeOverrides = {}): Runtime {
  const settings = loadGatewaySettings(env);
  validateRuntimeDatabaseTarget(env);
  if (settings.tier === "preview") return unavailablePreviewRuntime();
  const connectionString = env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required to create the gateway client");
  const db = overrides.createClient?.(connectionString) ?? new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  const sessions = createSessions({ db, settings: { tier: settings.tier } });
  const provider = settings.llmMode === "live" ? createSoclaasProvider({ baseUrl: settings.baseUrl, apiKey: settings.apiKey as string }) : createMockProvider();
  // Only the SoCLaaS provider holds the key; the gateway's copy of the settings does not, so it cannot be logged by accident.
  // The output guard gets it separately, to reject an answer that echoes it.
  const secrets = gatewaySecrets(settings);
  return { sessions, cacheHits: createCacheHits({ db, settings }), gateway: createLlmGateway({ settings: { ...settings, apiKey: null }, db, hit: overrides.hit ?? getAuthRuntime().hit, sessions, provider, secrets }) };
}

function runtime() {
  if (cached) return cached;
  cached = createLlmGatewayRuntime(process.env);
  return cached;
}

/** Feature route modules call these at module load, so a bad setting stops startup as W4's settings do. */
export function getLlmGateway(): LlmGateway { return runtime().gateway; }
export function getSessions(): GatewaySessions { return runtime().sessions; }
/** AD-18: one `CACHE_HIT` row per served cache hit; never touches limits. */
export function recordCacheHit(input: CacheHitInput): Promise<void> { return runtime().cacheHits.recordCacheHit(input); }
