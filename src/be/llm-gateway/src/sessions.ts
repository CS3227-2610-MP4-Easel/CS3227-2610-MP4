import type { PrismaClient } from "@prisma/client";
import type { FilteredTransactionClient } from "@agile/db";
import { SESSION_CAPS, type Feature, type Sessions } from "@agile/contracts";
import { LIMITS, SESSION_FEATURE } from "./config.js";
import { systemClock, type Clock } from "./clock.js";
import type { GatewaySettings } from "./settings.js";

/** Features map this to 429 `RATE_LIMITED` with `Retry-After`. */
export class SessionCapReached extends Error {
  constructor(public readonly retryAfterSeconds: number) {
    super("RATE_LIMITED");
    this.name = "SessionCapReached";
  }
}

export type GatewaySessions = Sessions & {
  regenerate(sessionId: string, userId: string): Promise<void>;
  openOrReuse(input: { feature: Feature; userId: string; projectId: string | null }): Promise<string>;
};

export type TransactionSessionCloseInput = {
  sessionId: string;
  proposalId: string;
  projectId: string;
  feature: "LEAD_DIGEST";
  ownerId: string;
  outcome: "ACCEPTED" | "REJECTED";
  actorId: string;
};

export type TransactionSessionCloser = {
  closeInTransaction(tx: FilteredTransactionClient, input: TransactionSessionCloseInput): Promise<void>;
};

/**
 * Internal proposal/session bridge. The public Sessions contract remains
 * non-transactional; proposal mutations inject this adapter when they need
 * session outcome and proposal/domain writes to commit together.
 */
export function createTransactionSessionCloser(options: { env?: string } = {}): TransactionSessionCloser {
  const env = options.env ?? process.env.APP_TIER ?? "test";
  return {
    async closeInTransaction(tx, input) {
      if (!UUID.test(input.sessionId) || !UUID.test(input.proposalId) || !UUID.test(input.projectId) || !UUID.test(input.ownerId) || !UUID.test(input.actorId)) throw new Error("INVALID_SESSION");
      const proposal = await (tx as any).aiProposal.findFirst({ where: { id: input.proposalId, projectId: input.projectId, sessionId: input.sessionId, kind: "REPLAN", createdBy: input.ownerId }, select: { id: true } });
      if (!proposal) throw new Error("CONFLICT_STATE");
      const session = await (tx as any).aiSession.findFirst({ where: { id: input.sessionId } });
      if (!session || session.env !== env || session.feature !== input.feature || session.projectId !== input.projectId || session.userId !== input.ownerId) throw new Error("CONFLICT_STATE");
      if (session.outcome !== "OPEN") throw new Error("CONFLICT_STATE");
      const result = await (tx as any).aiSession.updateMany({ where: { id: input.sessionId, outcome: "OPEN" }, data: { outcome: input.outcome, endedAt: new Date() } });
      if (result.count !== 1) throw new Error("CONFLICT_STATE");
    },
  };
}

const CLOSED_OUTCOMES = ["ACCEPTED", "EDITED", "REJECTED", "ABANDONED"] as const;
type ClosedOutcome = (typeof CLOSED_OUTCOMES)[number];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Singapore has no daylight saving, so its day starts at 16:00 UTC.
const SINGAPORE_OFFSET_MS = 8 * 3_600_000;
const DAY_MS = 86_400_000;

/** Server-issued AI sessions (AD-19, contracts §5.3). Every timestamp comes from `clock`, every query is limited to this tier. */
export function createSessions({ db, settings, clock = systemClock }: { db: PrismaClient; settings: Pick<GatewaySettings, "tier">; clock?: Clock }): GatewaySessions {
  const env = settings.tier;
  const idleCutoff = (now: Date) => new Date(now.getTime() - LIMITS.sessionIdleMs);
  const abandon = (where: { id?: string; userId?: string }, now: Date) =>
    db.aiSession.updateMany({ where: { ...where, env, outcome: "OPEN", lastActivityAt: { lt: idleCutoff(now) } }, data: { outcome: "ABANDONED", endedAt: now } });

  async function assertUsable(sessionId: string, userId: string, feature: Feature): Promise<void> {
    const row = UUID.test(sessionId) ? await db.aiSession.findUnique({ where: { id: sessionId } }) : null;
    // A session serves its own feature and the feature mapped to it. Own keys only, so inherited names such as "constructor" never select a mapping.
    const admitted = !!row && (row.feature === feature || (Object.hasOwn(SESSION_FEATURE, feature) && row.feature === SESSION_FEATURE[feature]));
    if (!row || row.env !== env || row.userId !== userId || !admitted) throw new Error("NOT_FOUND");
    if (row.outcome !== "OPEN") throw new Error("CONFLICT_STATE");
    const now = clock.now();
    if (row.lastActivityAt < idleCutoff(now)) {
      await abandon({ id: sessionId }, now);
      throw new Error("CONFLICT_STATE");
    }
  }

  async function open({ feature, userId, projectId }: { feature: Feature; userId: string; projectId: string | null }): Promise<string> {
    const now = clock.now();
    await abandon({ userId }, now);
    const dayStart = new Date(Math.floor((now.getTime() + SINGAPORE_OFFSET_MS) / DAY_MS) * DAY_MS - SINGAPORE_OFFSET_MS);
    const startedToday = await db.aiSession.count({ where: { userId, env, startedAt: { gte: dayStart } } });
    if (startedToday >= SESSION_CAPS.maxNewSessionsPerUserPerDay) throw new SessionCapReached(Math.max(1, Math.ceil((dayStart.getTime() + DAY_MS - now.getTime()) / 1000)));
    const openRows = await db.aiSession.findMany({ where: { userId, env, feature, outcome: "OPEN" }, orderBy: { lastActivityAt: "asc" }, select: { lastActivityAt: true } });
    if (openRows.length >= SESSION_CAPS.maxOpenSessionsPerFeature) {
      throw new SessionCapReached(Math.max(1, Math.ceil((openRows[0].lastActivityAt.getTime() + LIMITS.sessionIdleMs - now.getTime()) / 1000)));
    }
    const created = await db.aiSession.create({ data: { feature, userId, projectId, env, startedAt: now, lastActivityAt: now }, select: { id: true } });
    return created.id;
  }

  return {
    open,

    async openOrReuse({ feature, userId, projectId }) {
      const candidates = await db.aiSession.findMany({ where: { userId, env, feature, projectId: projectId ?? null, outcome: "OPEN" }, orderBy: { lastActivityAt: "desc" }, select: { id: true } });
      for (const { id } of candidates) {
        try { await assertUsable(id, userId, feature); return id; } catch (error) {
          // Only "gone or idle meanwhile" means look at the next; anything else is a real failure.
          if (!(error instanceof Error && (error.message === "NOT_FOUND" || error.message === "CONFLICT_STATE"))) throw error;
        }
      }
      return open({ feature, userId, projectId });
    },

    assertUsable,

    async touch(sessionId) {
      if (!UUID.test(sessionId)) return;
      await db.aiSession.updateMany({ where: { id: sessionId, outcome: "OPEN" }, data: { lastActivityAt: clock.now() } });
    },

    async close(sessionId, outcome, actorId) {
      if (!CLOSED_OUTCOMES.includes(outcome as ClosedOutcome)) throw new Error("INVALID_OUTCOME");
      // Who may close is the calling endpoint's policy (spec SD11); here the actor must only be a user id.
      if (!UUID.test(actorId)) throw new Error("INVALID_ACTOR");
      const exists = UUID.test(sessionId) ? await db.aiSession.count({ where: { id: sessionId, env } }) : 0;
      if (!exists) throw new Error("NOT_FOUND");
      await db.aiSession.updateMany({ where: { id: sessionId, outcome: "OPEN" }, data: { outcome: outcome as ClosedOutcome, endedAt: clock.now() } });
    },

    async regenerate(sessionId, userId) {
      const row = UUID.test(sessionId) ? await db.aiSession.findUnique({ where: { id: sessionId }, select: { feature: true } }) : null;
      if (!row) throw new Error("NOT_FOUND");
      await assertUsable(sessionId, userId, row.feature);
      // One conditional update, so concurrent regenerations cannot pass the cap.
      const { count } = await db.aiSession.updateMany({
        where: { id: sessionId, outcome: "OPEN", regenerateCount: { lt: SESSION_CAPS.maxRegenerations } },
        data: { regenerateCount: { increment: 1 }, lastActivityAt: clock.now() },
      });
      if (count === 0) throw new SessionCapReached(LIMITS.regenerateRetryAfterSeconds);
    },
  };
}
