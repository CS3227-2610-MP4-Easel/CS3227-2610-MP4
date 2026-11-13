import type { PrismaClient } from "@prisma/client";
import { UserRoleSchema, type Feature, type UserRole } from "@agile/contracts";
import { systemClock, type Clock } from "./clock.js";
import { modelFor, type GatewaySettings } from "./settings.js";

export type CacheHitInput = { feature: Feature; caller: { userId: string; role: UserRole }; sessionId: string | null; projectId: string | null; inputHash: string; promptVersion: string };

/** AD-18: a served cache hit leaves one zero-usage row; it never touches limits, budget or breaker. */
export function createCacheHits({ db, settings, clock = systemClock }: { db: PrismaClient; settings: Pick<GatewaySettings, "tier" | "llmMode" | "modelOverrides">; clock?: Clock }) {
  return {
    async recordCacheHit(input: CacheHitInput): Promise<void> {
      const hex = /^[0-9a-f]{1,128}$/;
      if (!UUID.test(input.caller.userId) || (input.projectId !== null && !UUID.test(input.projectId)) || !UserRoleSchema.safeParse(input.caller.role).success || !hex.test(input.inputHash) || !hex.test(input.promptVersion)) throw new Error("INVALID_CACHE_HIT");
      if (input.sessionId !== null) {
        const session = UUID.test(input.sessionId) ? await db.aiSession.findUnique({ where: { id: input.sessionId }, select: { env: true, userId: true, feature: true } }) : null;
        if (!session || session.env !== settings.tier || session.userId !== input.caller.userId || session.feature !== input.feature) throw new Error("NOT_FOUND");
      }
      await db.llmCall.create({
        data: {
          status: "CACHE_HIT", sessionId: input.sessionId, userId: input.caller.userId, role: input.caller.role, projectId: input.projectId, env: settings.tier,
          feature: input.feature, model: modelFor(settings, input.feature), promptVersion: input.promptVersion, prefixHash: input.promptVersion, inputHash: input.inputHash,
          attempts: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0, latencyMs: 0, costMicrousd: 0n, estimatedPromptTokens: 0, sectionTokens: {},
          flagged: false, truncated: false, experiment: { resultCache: false, llmMode: settings.llmMode }, createdAt: clock.now(),
        },
      });
    },
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
