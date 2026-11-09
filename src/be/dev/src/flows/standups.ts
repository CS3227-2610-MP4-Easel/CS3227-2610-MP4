import { NotMember, assertValidStandupDate, standupActivityWindowFor, type ContextSections, type LlmGateway, type LlmResult, type Standup } from "@agile/contracts";
import type { AiContextWith, Provenance } from "@agile/ai-context";
import type { CacheHitInput } from "../gateway-binding.js";
import { STANDUP_PROMPT_VERSION, STANDUP_STATIC, withStatics } from "../ai/prompts.js";
import { StandupOutputSchema } from "../ai/schemas.js";
import { sectionsInputHash, standupInputHash } from "../ai/hash.js";
import { DevError, LOCAL_LIMIT_DETAILS } from "../errors.js";
import { findStandup, toStandup, upsertStandup } from "../store/standups.js";
import { summaryFlagged } from "../store/summaries.js";
import type { DevWriteDeps } from "../store/writable.js";

export type StandupFlowDeps = {
  db: unknown; write: DevWriteDeps; now(): Date; ai: Pick<AiContextWith, "assembleWith">; gateway: LlmGateway;
  sessions: { open(i: { feature: "DEV_STANDUP"; userId: string; projectId: string }): Promise<string>; regenerate(sessionId: string, userId: string): Promise<void> };
  recordCacheHit(i: CacheHitInput): Promise<void>; sanitiseFlag(text: string): boolean;
  checkLine(line: string): boolean;
};

type Content = { yesterday: string[]; today: string[]; blockers: string[] };

const HIDDEN = "(line hidden: unsafe text)";
const isCap = (error: unknown) => error instanceof Error && error.name === "SessionCapReached";
const capError = (error: unknown) => new DevError("RATE_LIMITED", 429, (error as { retryAfterSeconds?: number }).retryAfterSeconds);

function cut(line: string): string {
  if (line.length <= 300) return line;
  const code = line.charCodeAt(299);
  return line.slice(0, code >= 0xd800 && code <= 0xdbff ? 299 : 300);
}

export async function generateStandup(deps: StandupFlowDeps, caller: { userId: string; role: "DEVELOPER" }, projectId: string, date: string | undefined): Promise<Standup> {
  const now = deps.now();
  let day: string;
  try { day = assertValidStandupDate(date, now); } catch (error) {
    if (error instanceof Error && error.message === "VALIDATION_FAILED") throw new DevError("VALIDATION_FAILED", 422);
    throw error;
  }
  const window = standupActivityWindowFor(day, now);
  let assembled: { sections: ContextSections; provenance: Provenance } = { sections: [], provenance: [] };
  try {
    if (window.from < window.to) assembled = await deps.ai.assembleWith(caller, "DEV_STANDUP", projectId, { window });
    else await deps.write.requireMember(caller.userId, projectId);
  } catch (error) {
    if (error instanceof NotMember || (error instanceof Error && error.message === "NOT_FOUND")) throw new Error("NOT_FOUND");
    throw error;
  }
  const inputHash = standupInputHash(day, assembled.sections, assembled.provenance);
  const row = await findStandup(deps.db, projectId, caller.userId, day);
  if (row && row.inputHash === inputHash) {
    try { await deps.recordCacheHit({ feature: "DEV_STANDUP", caller, sessionId: row.sessionId, projectId, inputHash, promptVersion: STANDUP_PROMPT_VERSION }); } catch { /* the stored row stands; not logged: no detail may leak */ }
    return toStandup(row, true);
  }

  const open = () => deps.sessions.open({ feature: "DEV_STANDUP", userId: caller.userId, projectId });
  let sessionId: string;
  try {
    if (!row) sessionId = await open();
    else {
      sessionId = row.sessionId;
      try { await deps.sessions.regenerate(row.sessionId, caller.userId); } catch (error) {
        if (!(error instanceof Error) || (error.message !== "NOT_FOUND" && error.message !== "CONFLICT_STATE")) throw error;
        sessionId = await open();
      }
    }
  } catch (error) {
    if (error instanceof Error && error.message === "AI_NOT_CONFIGURED") throw new DevError("AI_DISABLED", 503);
    if (isCap(error)) throw capError(error);
    throw error;
  }

  let content: Content = { yesterday: [], today: [], blockers: [] };
  let degraded = false;
  let modelFlagged = false;
  let hidden = false;
  if (assembled.sections.some((s) => s.text.trim() !== "")) {
    const sections = withStatics(STANDUP_STATIC, assembled.sections);
    let result: LlmResult | null = null;
    try {
      result = await deps.gateway.run({ feature: "DEV_STANDUP", caller, sessionId, projectId, sections, output: { kind: "json", schema: StandupOutputSchema }, inputHash: sectionsInputHash(sections) });
    } catch (error) {
      if (!(error instanceof Error) || error.message !== "LLM_CALL_FAILED") throw error;
    }
    const parsed = result?.ok ? StandupOutputSchema.safeParse(result.value) : null;
    if (result?.ok) modelFlagged = result.flagged;
    if (result?.ok && parsed?.success) content = parsed.data;
    else if (result && !result.ok && result.code === "AI_BUSY") throw new DevError("AI_BUSY", 429, result.retryAfterSeconds, LOCAL_LIMIT_DETAILS);
    else if (result && !result.ok && result.code === "ROLE_DENIED") throw new DevError("INTERNAL_ERROR", 500);
    else {
      degraded = true;
      const lines = (name: string) => (assembled.sections.find((s) => s.name === name)?.text ?? "").split("\n").filter((l) => l !== "").slice(0, 12).map((l) => {
        const line = cut(l);
        if (deps.checkLine(line)) return line;
        hidden = true;
        return HIDDEN;
      });
      content = { yesterday: lines("task-events"), today: [], blockers: lines("blocked-tasks") };
    }
  }

  const summaryIds = assembled.provenance.filter((p) => p.type === "ITEM_SUMMARY").map((p) => p.id);
  const flagged = modelFlagged || hidden || assembled.sections.some((s) => deps.sanitiseFlag(s.text)) || (await summaryFlagged(deps.db, caller.userId, summaryIds));
  const saved = await upsertStandup(deps.write, caller.userId, projectId, day, { content, inputHash, degraded, flagged, sessionId });
  return toStandup(saved, false);
}
