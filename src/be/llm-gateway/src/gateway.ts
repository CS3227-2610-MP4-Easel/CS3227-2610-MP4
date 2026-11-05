import { createHash } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import type { Hit } from "@agile/auth";
import { LlmCallSchema, type LlmCall, type LlmGateway, type LlmResult } from "@agile/contracts";
import { isInTransaction } from "@agile/db";
import { admitBreaker, recordOutcome } from "./breaker.js";
import { assertStaticSectionsFit, costMicroUsd, fitSections, reservation } from "./budget.js";
import { systemClock, type Clock } from "./clock.js";
import { FEATURES, LIMITS, MODELS } from "./config.js";
import { defaultGuards, type GuardPipeline } from "./guards.js";
import { checkBudget, checkWindows } from "./limits.js";
import { mockRegistry, UpstreamError, type LlmProvider, type MockRespond, type ProviderResult, type UpstreamKind } from "./providers.js";
import { modelFor, type GatewaySettings } from "./settings.js";
import type { GatewaySessions } from "./sessions.js";

export type GatewayDeps = {
  settings: GatewaySettings;
  /** Unfiltered client for the gateway's own tables (spec SD12). */
  db: PrismaClient;
  hit: Hit;
  sessions: Pick<GatewaySessions, "assertUsable" | "touch">;
  provider: LlmProvider;
  guards?: GuardPipeline;
  clock?: Clock;
  /** Mock responses checked at admission in mock mode; defaults to the process-wide registry. */
  mockResponses?: ReadonlyMap<string, MockRespond>;
  /** Prefix for the breaker and budget state keys, so integration tests can isolate their state rows. */
  stateKeyPrefix?: string;
};

type FinalStatus = "OK" | "SCHEMA_FAIL" | "UPSTREAM_ERROR" | "TIMEOUT" | "RATE_LIMITED" | "REFUSED";
type Attempt = { ok: true; result: ProviderResult } | { ok: false; kind: UpstreamKind | "OTHER" };

const STATUS_FOR_KIND: Record<UpstreamKind | "OTHER", FinalStatus> = { HTTP_429: "RATE_LIMITED", HTTP_5XX: "UPSTREAM_ERROR", NETWORK: "UPSTREAM_ERROR", TIMEOUT: "TIMEOUT", OTHER: "UPSTREAM_ERROR" };
const CODE_FOR_STATUS = { SCHEMA_FAIL: "AI_UNAVAILABLE", UPSTREAM_ERROR: "AI_UNAVAILABLE", TIMEOUT: "AI_UNAVAILABLE", RATE_LIMITED: "AI_UNAVAILABLE", REFUSED: "REQUEST_REFUSED" } as const;
const LOGGED_STATUSES = new Set<string>(["UPSTREAM_ERROR", "TIMEOUT", "RATE_LIMITED"]);
const sha256 = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");

/** The one path every model call takes (contracts §5.1, spec api.md § run). */
export function createLlmGateway(deps: GatewayDeps): LlmGateway {
  const { settings, db, hit, sessions, provider, guards = defaultGuards, clock = systemClock, mockResponses = mockRegistry, stateKeyPrefix = "" } = deps;
  const breaker = { db, clock, key: `${stateKeyPrefix}breaker` };

  async function admit(call: LlmCall): Promise<LlmResult | null> {
    if (FEATURES[call.feature].role !== call.caller.role) return { ok: false, code: "ROLE_DENIED" };
    await sessions.assertUsable(call.sessionId, call.caller.userId, call.feature);
    const session = await db.aiSession.findUnique({ where: { id: call.sessionId }, select: { projectId: true } });
    if (!session || session.projectId !== call.projectId) throw new Error("NOT_FOUND");
    if (!settings.aiEnabled) return { ok: false, code: "AI_DISABLED" };
    if (settings.llmMode === "mock" && !mockResponses.has(call.feature)) throw new Error("NO_MOCK_RESPONSE");
    assertStaticSectionsFit(call.feature, call.sections, modelFor(settings, call.feature));
    const budget = await checkBudget({ db, settings, clock, stateKey: `${stateKeyPrefix}budget` });
    if (!budget.ok) return { ok: false, code: "AI_BUSY", retryAfterSeconds: budget.retryAfterSeconds };
    const windows = await checkWindows(hit, call.caller.userId);
    if (!windows.ok) return { ok: false, code: "AI_BUSY", retryAfterSeconds: windows.retryAfterSeconds };
    if (!(await admitBreaker(breaker))) return { ok: false, code: "AI_UNAVAILABLE" };
    return null;
  }

  /** One attempt, then at most one retry for a 429 (after 2 s) or a 5xx/network error, only with 8 s left of the 25 s deadline. */
  async function attempts(request: Omit<Parameters<LlmProvider["complete"]>[0], "timeoutMs">): Promise<{ last: Attempt; count: number }> {
    const tryOnce = async (timeoutMs: number): Promise<Attempt> => {
      try {
        return { ok: true, result: await provider.complete({ ...request, timeoutMs }) };
      } catch (error) {
        return { ok: false, kind: error instanceof UpstreamError ? error.kind : "OTHER" };
      }
    };
    const start = clock.now().getTime();
    let last = await tryOnce(LIMITS.attemptTimeoutMs);
    if (last.ok || last.kind === "TIMEOUT" || last.kind === "OTHER") return { last, count: 1 };
    const elapsed = clock.now().getTime() - start;
    const wait = last.kind === "HTTP_429" ? LIMITS.backoff429Ms : 0;
    const left = LIMITS.deadlineMs - elapsed - wait;
    if (left < LIMITS.minRetryMs) return { last, count: 1 };
    if (wait) await clock.sleep(wait);
    last = await tryOnce(left);
    return { last, count: 2 };
  }

  return {
    async run(input) {
      const parsed = LlmCallSchema.safeParse(input);
      const outputSchema = parsed.success && parsed.data.output.kind === "json" ? parsed.data.output.schema : undefined;
      if (!parsed.success || (parsed.data.output.kind === "json" && typeof (outputSchema as { safeParse?: unknown } | undefined)?.safeParse !== "function")) {
        throw new Error("INVALID_LLM_CALL");
      }
      // Zod may copy the schema object; the caller's own output schema is used for validation.
      const call = { ...parsed.data, output: input.output } as LlmCall;
      if (isInTransaction()) throw new Error("LLM_CALL_IN_TRANSACTION");

      const refused = await admit(call);
      if (refused) return refused;

      const now = clock.now();
      await db.llmCall.updateMany({ where: { status: "IN_FLIGHT", leaseExpiresAt: { lt: now } }, data: { status: "TIMEOUT", leaseExpiresAt: null } });

      const model = modelFor(settings, call.feature);
      const feature = FEATURES[call.feature];
      const base = {
        sessionId: call.sessionId, userId: call.caller.userId, role: call.caller.role, projectId: call.projectId, env: settings.tier, feature: call.feature, model,
        inputHash: call.inputHash, experiment: { resultCache: false, llmMode: settings.llmMode },
      };

      let flagged = false;
      const sections = [];
      for (const section of call.sections) {
        if (section.trusted) { sections.push(section); continue; }
        const guarded = guards.input(section.text);
        if ("blocked" in guarded) {
          const prefixHash = sha256(fitSections(call.feature, model, call.sections.filter((s) => s.kind === "STATIC")).system);
          const row = await db.llmCall.create({
            data: { ...base, createdAt: now, promptVersion: prefixHash.slice(0, 12), prefixHash, status: "BLOCKED_INPUT", attempts: 0, estimatedPromptTokens: 0, sectionTokens: {}, flagged, truncated: false, costMicrousd: 0n, latencyMs: 0 },
            select: { id: true },
          });
          return { ok: false, code: "BLOCKED_INPUT", callId: row.id };
        }
        flagged ||= guarded.flagged;
        sections.push({ ...section, text: guarded.text });
      }

      const fitted = fitSections(call.feature, model, sections);
      const prefixHash = sha256(fitted.system);
      const reserved = reservation(call.feature, model);
      const { id: callId } = await db.llmCall.create({
        data: {
          ...base, createdAt: now, promptVersion: prefixHash.slice(0, 12), prefixHash, status: "IN_FLIGHT", leaseExpiresAt: new Date(now.getTime() + LIMITS.leaseMs),
          attempts: 0, estimatedPromptTokens: fitted.estimatedPromptTokens, sectionTokens: fitted.sectionTokens, flagged, truncated: fitted.truncated, costMicrousd: BigInt(reserved),
        },
        select: { id: true },
      });

      const effort = MODELS[model]?.reasoningEfforts.includes(feature.reasoningEffort) ? feature.reasoningEffort : undefined;
      const { last, count } = await attempts({
        model, call, maxTokens: feature.maxTokens, temperature: feature.temperature,
        messages: [{ role: "system", content: fitted.system }, { role: "user", content: fitted.user }],
        ...(effort === undefined ? {} : { reasoningEffort: effort }),
      });

      let status: FinalStatus;
      let value: unknown;
      if (!last.ok) status = STATUS_FOR_KIND[last.kind];
      else {
        const checked = guards.output(last.result.text, call.output);
        if (checked.ok) { status = "OK"; value = checked.value; } else status = checked.status;
      }
      const promptTokens = last.ok ? last.result.promptTokens : null;
      const completionTokens = last.ok ? last.result.completionTokens : null;
      const cost = promptTokens !== null && completionTokens !== null ? costMicroUsd(model, promptTokens, completionTokens) : reserved;
      const finished = clock.now();
      const { count: finalised } = await db.llmCall.updateMany({
        where: { id: callId, status: "IN_FLIGHT" },
        data: {
          status, promptTokens, completionTokens, totalTokens: promptTokens !== null && completionTokens !== null ? promptTokens + completionTokens : null,
          costMicrousd: BigInt(cost), latencyMs: finished.getTime() - now.getTime(), attempts: count, leaseExpiresAt: null,
        },
      });
      // The lease sweep got there first: the row is already TIMEOUT and this result is discarded.
      if (finalised === 0) return { ok: false, code: "AI_UNAVAILABLE", callId };

      if (status === "OK") await sessions.touch(call.sessionId);
      await recordOutcome(breaker, status);
      if (LOGGED_STATUSES.has(status)) console.warn("llm_call_failed", { callId, status });
      if (status !== "OK") return { ok: false, code: CODE_FOR_STATUS[status], callId };
      return { ok: true, value, callId, flagged, truncated: fitted.truncated, cacheHit: false, promptTokens: promptTokens ?? 0, completionTokens: completionTokens ?? 0, costMicroUsd: cost };
    },
  };
}
