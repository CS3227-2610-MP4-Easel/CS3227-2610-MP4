import { NotMember, defaultStandupDate, standupActivityWindowFor, type Feature, type LlmGateway, type UserRole } from "@agile/contracts";
import type { AiContextWith } from "@agile/ai-context";
import { DevError, LOCAL_LIMIT_DETAILS } from "../errors.js";
import { sha256Hex, sectionsInputHash } from "../ai/hash.js";
import { SUMMARY_PROMPT_VERSION, SUMMARY_STATIC, withStatics } from "../ai/prompts.js";
import { SummaryOutputSchema } from "../ai/schemas.js";
import { currentSummaries, insertSummaries, loadOwnItems, type Key } from "../store/summaries.js";
import type { DevWriteDeps } from "../store/writable.js";

type CacheHitInput = { feature: Feature; caller: { userId: string; role: UserRole }; sessionId: string | null; projectId: string | null; inputHash: string; promptVersion: string };

export type SummaryFlowDeps = {
  db: unknown; write: DevWriteDeps; key: Key; now(): Date;
  ai: Pick<AiContextWith, "assembleWith">; gateway: LlmGateway; sessions: { openOrReuse(i: { feature: "DEV_SUMMARY"; userId: string; projectId: string }): Promise<string> };
  recordCacheHit(i: CacheHitInput): Promise<void>; sanitiseFlag(text: string): boolean;
};

type Result = { summaries: { itemId: string; oneLiner: string; cached: boolean }[]; failed: string[] };

export async function generateSummaries(deps: SummaryFlowDeps, caller: { userId: string; role: "DEVELOPER" }, projectId: string, itemIds: string[]): Promise<Result> {
  const items = await loadOwnItems(deps.db, caller.userId, projectId, itemIds);
  const current = await currentSummaries(deps.db, items, deps.key);
  const now = deps.now();
  const windowStart = standupActivityWindowFor(defaultStandupDate(now), now).from;
  const cached = items.filter((i) => current.has(i.id));
  const left = items.filter((i) => !current.has(i.id) && i.occurredAt >= windowStart);
  const fresh = new Map<string, string>();
  const cacheHit = () => deps.recordCacheHit({ feature: "DEV_SUMMARY", caller, sessionId: null, projectId, inputHash: sha256Hex(JSON.stringify(cached.map((i) => [i.id, i.contentHash]))), promptVersion: SUMMARY_PROMPT_VERSION });
  const finish = (): Result => ({
    summaries: items.flatMap((i): Result["summaries"] => { const c = current.get(i.id); if (c) return [{ itemId: i.id, oneLiner: c.oneLiner, cached: true }]; const f = fresh.get(i.id); return f === undefined ? [] : [{ itemId: i.id, oneLiner: f, cached: false }]; }),
    failed: items.filter((i) => !current.has(i.id) && !fresh.has(i.id)).map((i) => i.id),
  });

  if (!left.length) {
    if (cached.length) await cacheHit();
    return finish();
  }

  let sessionId: string;
  try { sessionId = await deps.sessions.openOrReuse({ feature: "DEV_SUMMARY", userId: caller.userId, projectId }); } catch (error) {
    if (error instanceof Error && error.name === "SessionCapReached") throw new DevError("RATE_LIMITED", 429, (error as { retryAfterSeconds?: number }).retryAfterSeconds);
    throw error;
  }
  let assembled;
  try { assembled = await deps.ai.assembleWith(caller, "DEV_SUMMARY", projectId, { itemIds: left.map((i) => i.id) }); } catch (error) {
    if (error instanceof NotMember) throw new Error("NOT_FOUND");
    throw error;
  }
  const sections = withStatics(SUMMARY_STATIC, assembled.sections);
  let result;
  try {
    result = await deps.gateway.run({ feature: "DEV_SUMMARY", caller, sessionId, projectId, sections, output: { kind: "json", schema: SummaryOutputSchema }, inputHash: sectionsInputHash(sections) });
  } catch (error) {
    if (error instanceof Error && error.message === "LLM_CALL_FAILED") throw new DevError("AI_UNAVAILABLE", 503);
    throw error;
  }
  if (!result.ok) {
    switch (result.code) {
      case "AI_BUSY": throw new DevError("AI_BUSY", 429, result.retryAfterSeconds, LOCAL_LIMIT_DETAILS);
      case "AI_UNAVAILABLE": throw new DevError("AI_UNAVAILABLE", 503);
      case "AI_DISABLED": throw new DevError("AI_DISABLED", 503);
      case "BLOCKED_INPUT": throw new DevError("VALIDATION_FAILED", 422);
      case "ROLE_DENIED": throw new DevError("INTERNAL_ERROR", 500);
      default: return finish();
    }
  }

  const entries = (result.value as { items?: { n: number; oneLiner: string }[] } | null)?.items ?? [];
  const used = new Set<number>();
  const rows = [];
  for (const entry of entries) {
    const text = typeof entry.oneLiner === "string" ? entry.oneLiner.trim() : "";
    if (!Number.isInteger(entry.n) || entry.n < 1 || entry.n > left.length || used.has(entry.n) || !text) continue;
    used.add(entry.n);
    const item = left[entry.n - 1]!;
    fresh.set(item.id, text);
    rows.push({ itemId: item.id, contentHash: item.contentHash, oneLiner: text, flagged: item.flagged || deps.sanitiseFlag(text), callId: result.callId });
  }
  await insertSummaries(deps.write, caller.userId, projectId, rows, deps.key);
  if (cached.length) await cacheHit();
  return finish();
}
