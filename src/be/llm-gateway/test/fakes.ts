import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import type { Hit } from "@agile/auth";
import type { Feature, LlmCall } from "@agile/contracts";
import { loadGatewaySettings, UpstreamError, type Clock, type GatewaySettings, type LlmProvider, type ProviderRequest, type ProviderResult, type UpstreamKind } from "../src/index.js";

export const integrationUrl = process.env.W1_INTEGRATION_DATABASE_URL;

type Row = Record<string, unknown> & { id: string };
type Where = Record<string, unknown>;

/** Matches the `where` shapes the gateway uses: equality, `{ lt }` and `{ gte }` on dates. */
function matches(row: Row, where: Where): boolean {
  return Object.entries(where).every(([key, condition]) => {
    const value = row[key];
    if (condition && typeof condition === "object" && !(condition instanceof Date)) {
      const { lt, gte } = condition as { lt?: Date; gte?: Date };
      if (lt !== undefined || gte !== undefined) return value instanceof Date && (lt === undefined || value < lt) && (gte === undefined || value >= gte);
    }
    return value === condition;
  });
}

/** In-memory stand-in for the three gateway tables, honouring only what the gateway calls. */
export function fakeGatewayDb() {
  const calls: Row[] = [];
  const state = new Map<string, unknown>();
  const sessions = new Map<string, { projectId: string | null }>();
  const writes: string[] = [];
  const db = {
    llmCall: {
      create: async ({ data }: { data: Record<string, unknown> }) => { writes.push("llmCall.create"); const row = { id: randomUUID(), ...data }; calls.push(row); return { id: row.id }; },
      updateMany: async ({ where, data }: { where: Where; data: Record<string, unknown> }) => {
        writes.push("llmCall.updateMany");
        const hits = calls.filter((row) => matches(row, where));
        for (const row of hits) Object.assign(row, data);
        return { count: hits.length };
      },
      aggregate: async ({ where }: { where: Where }) => ({ _sum: { costMicrousd: calls.filter((row) => matches(row, where)).reduce((sum, row) => sum + BigInt((row.costMicrousd as bigint | undefined) ?? 0n), 0n) } }),
    },
    llmGatewayState: {
      findUnique: async ({ where }: { where: { key: string } }) => (state.has(where.key) ? { key: where.key, value: state.get(where.key) } : null),
      // Like Prisma: `create` for a new key, `update` for an existing one; values are copied so tests can compare snapshots.
      upsert: async ({ where, create, update }: { where: { key: string }; create: { value: unknown }; update: { value: unknown } }) => {
        writes.push("llmGatewayState.upsert");
        state.set(where.key, structuredClone(state.has(where.key) ? update.value : create.value));
        return {};
      },
    },
    aiSession: {
      findUnique: async ({ where }: { where: { id: string } }) => sessions.get(where.id) ?? null,
    },
  };
  return { db: db as unknown as PrismaClient, calls, state, sessions, writes };
}

/** Sessions that pass for the ids in `usable`; `touched` records `touch` calls. */
export function fakeSessions(usable: Map<string, { userId: string; feature: Feature }>) {
  const touched: string[] = [];
  return {
    touched,
    sessions: {
      assertUsable: async (sessionId: string, userId: string, feature: Feature) => {
        const session = usable.get(sessionId);
        if (!session || session.userId !== userId || session.feature !== feature) throw new Error("NOT_FOUND");
      },
      touch: async (sessionId: string) => { touched.push(sessionId); },
    },
  };
}

/** `hit` that allows everything except the keys in `refuse`, recording each call. */
export function fakeHit(refuse: Record<string, number> = {}) {
  const keys: string[] = [];
  const hit: Hit = async (key) => { keys.push(key); return key in refuse ? { allowed: false, retryAfterSeconds: refuse[key] } : { allowed: true, retryAfterSeconds: 0 }; };
  return { hit, keys };
}

export type Step = { text: string; tokens?: [number | null, number | null]; after?: number; during?: () => Promise<void> } | { fail: UpstreamKind; after?: number } | { hang: true };

/** A provider that plays one step per attempt; time passes on the fake clock and a hang ends at `timeoutMs`. */
export function fakeProvider(clock: Clock, steps: Step[]) {
  const requests: ProviderRequest[] = [];
  let last: Step = { text: "" };
  const provider: LlmProvider = {
    async complete(request): Promise<ProviderResult> {
      requests.push(request);
      // Steps play in order; once used up, the last one repeats.
      const step = steps.length ? (last = steps.shift() as Step) : last;
      if ("hang" in step) { await clock.sleep(request.timeoutMs); throw new UpstreamError("TIMEOUT"); }
      if (step.after) await clock.sleep(step.after);
      if ("fail" in step) throw new UpstreamError(step.fail, step.fail === "HTTP_429" ? 429 : step.fail === "HTTP_5XX" ? 503 : null);
      if (step.during) await step.during();
      const [promptTokens, completionTokens] = step.tokens ?? [100, 20];
      return { text: step.text, promptTokens, completionTokens };
    },
  };
  return { provider, requests };
}

export const testSettings = (overrides: Partial<GatewaySettings> = {}): GatewaySettings => ({ ...loadGatewaySettings({ APP_TIER: "test", LLM_MODE: "mock" }), ...overrides });

export const textCall = (overrides: Partial<LlmCall> = {}): LlmCall => ({
  feature: "DEV_STANDUP",
  caller: { userId: "00000000-0000-4000-8000-0000000000a1", role: "DEVELOPER" },
  sessionId: "00000000-0000-4000-8000-0000000000b1",
  projectId: "00000000-0000-4000-8000-0000000000c1",
  sections: [
    { name: "rules", kind: "STATIC", priority: 0, budgetTokens: 200, text: "Write a standup.", trusted: true },
    { name: "items", kind: "DYNAMIC", priority: 1, budgetTokens: 400, text: "Fixed the login bug.", trusted: false },
  ],
  output: { kind: "text", maxChars: 500 },
  inputHash: "hash-1",
  ...overrides,
});

/** A clock whose `sleep` moves time forward instantly, so time rules are tested without waiting. */
export function fakeClock(start = "2026-11-05T02:00:00.000Z"): Clock & { advance(ms: number): void; set(iso: string): void } {
  let now = new Date(start).getTime();
  return {
    now: () => new Date(now),
    sleep: async (ms) => { now += ms; },
    advance: (ms) => { now += ms; },
    set: (iso) => { now = new Date(iso).getTime(); },
  };
}

export type Fixtures = { user(): Promise<string>; project(createdBy: string): Promise<string> };

/** A real client for integration tests; users and projects are created with random ids and deleted afterwards, gateway rows first. */
export async function withIntegrationDb(run: (base: PrismaClient, fixtures: Fixtures) => Promise<void>): Promise<void> {
  const base = new PrismaClient({ adapter: new PrismaPg({ connectionString: integrationUrl }) });
  const tag = randomUUID();
  const userIds: string[] = [];
  const projectIds: string[] = [];
  const fixtures: Fixtures = {
    user: async () => {
      const created = await base.user.create({ data: { firebaseUid: `${tag}-${randomUUID()}`, email: `${randomUUID()}@${tag}.test`, displayName: "Gateway test", role: "DEVELOPER" } });
      userIds.push(created.id);
      return created.id;
    },
    project: async (createdBy) => {
      const created = await base.project.create({ data: { name: `Gateway test ${tag}`, createdBy } });
      projectIds.push(created.id);
      return created.id;
    },
  };
  try {
    await run(base, fixtures);
  } finally {
    await base.llmCall.deleteMany({ where: { userId: { in: userIds } } });
    await base.aiSession.deleteMany({ where: { userId: { in: userIds } } });
    await base.project.deleteMany({ where: { id: { in: projectIds } } });
    await base.user.deleteMany({ where: { id: { in: userIds } } });
    await base.$disconnect();
  }
}
