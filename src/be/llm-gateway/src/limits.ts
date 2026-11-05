import type { PrismaClient } from "@prisma/client";
import type { Hit } from "@agile/auth";
import { LIMITS } from "./config.js";
import { systemClock, type Clock } from "./clock.js";
import type { GatewaySettings } from "./settings.js";

export type LimitCheck = { ok: true } | { ok: false; retryAfterSeconds: number };

const DAY_MS = 86_400_000;
const startOfUtcDay = (now: Date) => new Date(Math.floor(now.getTime() / DAY_MS) * DAY_MS);
const refuse = (until: Date, now: Date): LimitCheck => ({ ok: false, retryAfterSeconds: Math.max(1, Math.ceil((until.getTime() - now.getTime()) / 1000)) });

/** A valid instant in `value.blockedUntil`, else null (missing row, null or malformed value). */
function blockedUntil(state: { value: unknown } | null): Date | null {
  const raw = (state?.value as { blockedUntil?: unknown } | null)?.blockedUntil;
  if (typeof raw !== "string") return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** The budget block (AD-64, spec SD7): while a block is in force, refuse without summing; otherwise sum the tier's UTC-day cost,
 * in-flight reservations included, and block for 15 minutes or until UTC midnight when it reaches the spend cap. */
export async function checkBudget({ db, settings, clock = systemClock, stateKey = "budget" }: { db: PrismaClient; settings: Pick<GatewaySettings, "tier">; clock?: Clock; stateKey?: string }): Promise<LimitCheck> {
  const now = clock.now();
  const until = blockedUntil(await db.llmGatewayState.findUnique({ where: { key: stateKey } }));
  if (until && until > now) return refuse(until, now);
  const dayStart = startOfUtcDay(now);
  const { _sum } = await db.llmCall.aggregate({ _sum: { costMicrousd: true }, where: { env: settings.tier, createdAt: { gte: dayStart, lt: new Date(dayStart.getTime() + DAY_MS) } } });
  if (Number(_sum.costMicrousd ?? 0n) < LIMITS.spendCapMicroUsd) return { ok: true };
  const next = new Date(Math.min(now.getTime() + LIMITS.budgetBlockMs, dayStart.getTime() + DAY_MS));
  const value = { blockedUntil: next.toISOString() };
  await db.llmGatewayState.upsert({ where: { key: stateKey }, create: { key: stateKey, value }, update: { value } });
  return refuse(next, now);
}

/** The four AD-59 windows, in order, stopping at the first refusal; keys already hit stay counted. */
export async function checkWindows(hit: Hit, userId: string): Promise<LimitCheck> {
  const { userMin, userDay, globalMin, globalDay } = LIMITS.windows;
  for (const [key, { windowSeconds, limit }] of [[`user:${userId}:min`, userMin], [`user:${userId}:day`, userDay], ["global:min", globalMin], ["global:day", globalDay]] as const) {
    const { allowed, retryAfterSeconds } = await hit(key, windowSeconds, limit);
    if (!allowed) return { ok: false, retryAfterSeconds };
  }
  return { ok: true };
}
