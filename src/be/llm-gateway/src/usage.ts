import type { PrismaClient } from "@prisma/client";
import type { Feature, UsageSession, UsageSummary } from "@agile/contracts";
import type { AppTier } from "./settings.js";

export type UsageSessionsQuery = { from?: Date; to?: Date; feature?: Feature; page: number; size: number };
export type UsagePage = { items: UsageSession[]; page: number; size: number; total: number };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const round2 = (value: number) => Math.round(value * 100) / 100;
const MAX_PAGE = 10_000;
function assertDates({ from, to }: { from?: Date; to?: Date }): void {
  for (const date of [from, to]) if (date !== undefined && Number.isNaN(date.getTime())) throw new RangeError("from and to must be valid dates");
}
/** The half-open range `[from, to)` on a timestamp column. */
const range = (from?: Date, to?: Date) => (from || to ? { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) } : undefined);

/** Endpoint 56: the caller's sessions in this tier, newest first, with per-session call sums (contracts §3.7). */
export async function usageSessions(db: PrismaClient, userId: string, query: UsageSessionsQuery, tier: AppTier): Promise<UsagePage> {
  const { page, size } = query;
  if (!Number.isInteger(page) || page < 0 || page > MAX_PAGE) throw new RangeError("page must be an integer from 0 to 10000");
  if (!Number.isInteger(size) || size < 1 || size > 100) throw new RangeError("size must be 1 to 100");
  assertDates(query);
  const where = { userId, env: tier, ...(query.feature ? { feature: query.feature } : {}), ...(range(query.from, query.to) ? { startedAt: range(query.from, query.to) } : {}) };
  const [total, sessions] = await Promise.all([
    db.aiSession.count({ where }),
    db.aiSession.findMany({ where, orderBy: [{ startedAt: "desc" }, { id: "desc" }], skip: page * size, take: size }),
  ]);
  const sums = sessions.length === 0 ? [] : await db.llmCall.groupBy({
    by: ["sessionId"], where: { env: tier, sessionId: { in: sessions.map((s) => s.id) } },
    _count: { _all: true }, _sum: { promptTokens: true, completionTokens: true, costMicrousd: true },
  });
  const bySession = new Map(sums.map((row) => [row.sessionId, row]));
  const items = sessions.map((session): UsageSession => {
    const sum = bySession.get(session.id);
    return {
      id: session.id, feature: session.feature, startedAt: session.startedAt.toISOString(), endedAt: session.endedAt?.toISOString() ?? null,
      outcome: session.outcome, regenerateCount: session.regenerateCount, feedback: session.feedback,
      calls: sum?._count._all ?? 0, promptTokens: sum?._sum.promptTokens ?? 0, completionTokens: sum?._sum.completionTokens ?? 0,
      costMicroUsd: Number(sum?._sum.costMicrousd ?? 0n),
      elapsedSeconds: session.endedAt ? (session.endedAt.getTime() - session.startedAt.getTime()) / 1000 : null,
    };
  });
  return { items, page, size, total };
}

/** Endpoint 57: one row per (feature, model) over this tier's calls in `[from, to)`, sorted by feature then model; no user data. */
export async function usageSummary(db: PrismaClient, query: { from?: Date; to?: Date }, tier: AppTier): Promise<UsageSummary> {
  assertDates(query);
  const where = { env: tier, ...(range(query.from, query.to) ? { createdAt: range(query.from, query.to) } : {}) };
  const [groups, rows] = await Promise.all([
    db.llmCall.groupBy({ by: ["feature", "model"], where, _count: { _all: true }, _sum: { promptTokens: true, completionTokens: true, costMicrousd: true } }),
    // The two means need per-row values, so they are computed here rather than in SQL (no raw SQL in this package).
    db.llmCall.findMany({ where, select: { feature: true, model: true, status: true, estimatedPromptTokens: true, promptTokens: true, latencyMs: true } }),
  ]);
  return groups
    .map((group) => {
      const mine = rows.filter((row) => row.feature === group.feature && row.model === group.model);
      const latencies = mine.flatMap((row) => (row.latencyMs === null ? [] : [row.latencyMs]));
      const errors = mine.flatMap((row) => (row.promptTokens ? [Math.abs(row.estimatedPromptTokens - row.promptTokens) / row.promptTokens * 100] : []));
      const mean = (values: number[]) => (values.length ? round2(values.reduce((a, b) => a + b, 0) / values.length) : 0);
      return {
        feature: group.feature, model: group.model, calls: group._count._all, promptTokens: group._sum.promptTokens ?? 0, completionTokens: group._sum.completionTokens ?? 0,
        costMicroUsd: Number(group._sum.costMicrousd ?? 0n), cacheHits: mine.filter((row) => row.status === "CACHE_HIT").length, avgLatencyMs: mean(latencies),
        schemaFailures: mine.filter((row) => row.status === "SCHEMA_FAIL").length, estimateErrorPercent: mean(errors),
      };
    })
    .sort((a, b) => a.feature.localeCompare(b.feature) || a.model.localeCompare(b.model));
}

/** `UPSTREAM_LIMIT` when the caller's own call in this tier ended on a SoCLaaS 429 (spec SD9); null otherwise. */
export async function failureReason(db: PrismaClient, callId: string, userId: string, tier: AppTier): Promise<"UPSTREAM_LIMIT" | null> {
  if (!UUID.test(callId)) return null;
  const row = await db.llmCall.findUnique({ where: { id: callId }, select: { userId: true, env: true, status: true } });
  return row && row.userId === userId && row.env === tier && row.status === "RATE_LIMITED" ? "UPSTREAM_LIMIT" : null;
}
