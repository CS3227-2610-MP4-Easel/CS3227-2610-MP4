import { getAiContext, type AiContextWith } from "@agile/ai-context";
import type { Facts } from "./facts.js";
import { hashFacts } from "./hash.js";
import { DigestOutputSchema, type DigestOutput } from "./schemas.js";
import { LEAD_STATIC_SECTIONS } from "./sections.js";
import type { LeadGatewayBinding } from "./gateway-binding.js";
import type { Digest } from "@agile/contracts";

type Db = any;
type FactService = { target(projectId: string): Promise<Facts>; caller(callerId: string, projectId: string): Promise<Facts> };
type Caller = { userId: string; role: "DEV_LEAD" };
export type LeadProposalService = {
  createReplanInTransaction(tx: Db, input: {
    projectId: string;
    sessionId: string;
    creatorId: string;
    suggestions: DigestOutput["suggestions"];
    explanation: string;
    flagged: boolean;
  }): Promise<{ proposalId: string; supersededProposalIds: string[] }>;
};
export type LeadFlowDependencies = { db: Db; facts: FactService; binding: LeadGatewayBinding; proposalService?: LeadProposalService; context?: AiContextWith; now?: () => Date; requireMember?: (userId: string, projectId: string) => Promise<void> };
const degraded = (facts: Facts, id?: string, flagged = false) => ({ id: id ?? "", projectId: "", facts, explanation: null, degraded: true, flagged, proposalId: null, cached: false, createdAt: new Date().toISOString() });
const publicDigest = (digest: any, cached: boolean): Digest => ({ id: digest.id, projectId: digest.projectId, facts: digest.facts, explanation: digest.explanation ?? null, degraded: digest.degraded, flagged: digest.flagged, proposalId: digest.proposalId ?? null, cached, createdAt: digest.createdAt instanceof Date ? digest.createdAt.toISOString() : String(digest.createdAt) });

export function createLeadFlow(deps: LeadFlowDependencies) {
  const context = deps.context ?? getAiContext(); const now = deps.now ?? (() => new Date());
  async function persist(projectId: string, actorId: string, facts: Facts, factsHash: string, output: DigestOutput | null, sessionId: string | null, flagged: boolean, degradedFlag: boolean, admittedSessionId: string | null = sessionId) {
    return deps.db.$transaction(async (tx: Db) => {
      const digest = await tx.projectDigest.create({ data: { projectId, facts, factsAsOf: new Date(facts.asOf), factsHash, explanation: output?.explanation ?? null, degraded: degradedFlag, flagged, sessionId } });
      let proposalId: string | null = null;
      if (output && output.suggestions.length) {
        if (!sessionId || !deps.proposalService) throw new Error("PROPOSAL_SERVICE_NOT_INITIALIZED");
        const proposal = await deps.proposalService.createReplanInTransaction(tx, {
          projectId,
          sessionId,
          creatorId: actorId,
          suggestions: output.suggestions,
          explanation: output.explanation,
          flagged,
        });
        proposalId = proposal.proposalId;
        await tx.projectDigest.update({ where: { id: digest.id }, data: { proposalId } });
      } else if (admittedSessionId) {
        // A degraded/no-proposal session still closes atomically with its digest.
        if (!deps.binding.sessionCloser) throw new Error("TRANSACTION_SESSION_CLOSER_NOT_INITIALIZED");
        await deps.binding.sessionCloser.closeInTransaction(tx, {
          sessionId: admittedSessionId,
          proposalId: null,
          projectId,
          feature: "LEAD_DIGEST",
          ownerId: actorId,
          outcome: "REJECTED",
          actorId,
        });
      }
      return { digest, proposalId };
    });
  }
  async function validOutput(output: DigestOutput, facts: Facts, projectId: string): Promise<boolean> {
    const ids = output.suggestions.map((suggestion) => suggestion.id);
    if (new Set(ids).size !== ids.length) return false;
    const targets = output.suggestions.map((suggestion) => suggestion.type === "MOVE_CHECKPOINT_DATE" ? `${suggestion.type}:${suggestion.checkpointId}` : suggestion.type === "MOVE_EPIC_TO_CHECKPOINT" ? `${suggestion.type}:${suggestion.epicId}` : `${suggestion.type}:${suggestion.taskId}`);
    if (new Set(targets).size !== targets.length) return false;
    const checkpoints = new Set(facts.checkpoints.map((checkpoint) => checkpoint.id));
    const taskIds = [...new Set(output.suggestions.filter((suggestion) => suggestion.type === "REASSIGN_TASK").map((suggestion) => suggestion.taskId))];
    const epicIds = [...new Set(output.suggestions.filter((suggestion) => suggestion.type === "MOVE_EPIC_TO_CHECKPOINT").map((suggestion) => suggestion.epicId))];
    const assigneeIds = [...new Set(output.suggestions.filter((suggestion) => suggestion.type === "REASSIGN_TASK").map((suggestion) => suggestion.assigneeId))];
    const [tasks, epics, members] = await Promise.all([
      taskIds.length ? thisRows(deps.db.task, projectId, taskIds) : Promise.resolve([]),
      epicIds.length ? thisRows(deps.db.epic, projectId, epicIds) : Promise.resolve([]),
      assigneeIds.length ? thisRows(deps.db.projectMember, projectId, assigneeIds, "userId") : Promise.resolve([]),
    ]);
    if (taskIds.length !== tasks.length || epicIds.length !== epics.length || assigneeIds.length !== members.length) return false;
    return output.suggestions.every((suggestion) => {
      if (suggestion.type === "MOVE_CHECKPOINT_DATE") return checkpoints.has(suggestion.checkpointId);
      if (suggestion.type === "REASSIGN_TASK") return true;
      return suggestion.checkpointId === null || checkpoints.has(suggestion.checkpointId);
    });
  }
  async function thisRows(model: any, projectId: string, ids: string[], idField = "id"): Promise<any[]> {
    if (!model?.findMany) return [];
    return model.findMany({ where: { projectId, [idField]: { in: ids } }, select: { [idField]: true } });
  }
  async function factsFor(callerId: string | undefined, projectId: string) { return callerId ? deps.facts.caller(callerId, projectId) : deps.facts.target(projectId); }
  async function createDigest(caller: { userId: string; role: "DEV_LEAD" }, projectId: string) {
    const facts = await deps.facts.target(projectId); const factsHash = hashFacts(facts);
    const latest = await deps.db.projectDigest.findFirst({ where: { projectId }, orderBy: [{ factsAsOf: "desc" }, { createdAt: "desc" }, { id: "desc" }], take: 1 });
    const cached = latest && latest.factsHash === factsHash && latest.degraded === false ? latest : null;
    if (cached) return publicDigest(cached, true);
    let sessionId: string | null = null;
    try { sessionId = await deps.binding.sessions.open({ feature: "LEAD_DIGEST", userId: caller.userId, projectId }); } catch (error) {
      if (error instanceof Error && (error.name === "SessionCapReached" || error.message === "RATE_LIMITED")) {
        throw Object.assign(new Error("AI_BUSY"), { code: "AI_BUSY", retryAfterSeconds: (error as Error & { retryAfterSeconds?: number }).retryAfterSeconds ?? 1 });
      }
      const saved = await persist(projectId, caller.userId, facts, factsHash, null, null, false, true); return { ...degraded(facts, saved.digest.id), id: saved.digest.id, projectId };
    }
    let output: DigestOutput | null = null; let flagged = false; let persistSessionId: string | null = sessionId;
    try {
      const assembled = await context.assembleWith(caller, "LEAD_DIGEST", projectId, {}, { facts });
      const result = await deps.binding.gateway.run({ feature: "LEAD_DIGEST", caller, sessionId, projectId, sections: [...LEAD_STATIC_SECTIONS, ...assembled.sections], output: { kind: "json", schema: DigestOutputSchema }, inputHash: factsHash });
      flagged = Boolean((result as { flagged?: unknown }).flagged);
      if (!result.ok && !(result as { callId?: unknown }).callId) persistSessionId = null;
      if (result.ok) { const parsed = DigestOutputSchema.safeParse(result.value); if (parsed.success && await validOutput(parsed.data, facts, projectId)) output = parsed.data; }
    } catch { /* failure is represented by the degraded digest below */ }
    let saved: Awaited<ReturnType<typeof persist>>;
    saved = await persist(projectId, caller.userId, facts, factsHash, output, persistSessionId, flagged, !output, sessionId);
    return output ? publicDigest({ ...saved.digest, projectId, facts, explanation: output.explanation, degraded: false, flagged, proposalId: saved.proposalId }, false) : { ...degraded(facts, saved.digest.id, flagged), id: saved.digest.id, projectId };
  }
  return {
    facts: (projectId: string, callerId?: string) => callerId ? deps.facts.caller(callerId, projectId) : deps.facts.target(projectId),
    createDigest,
    async latestDigest(caller: Caller, projectId: string) {
      if (deps.requireMember) await deps.requireMember(caller.userId, projectId);
      else if (!(await deps.db.projectMember?.findFirst?.({ where: { projectId, userId: caller.userId }, select: { userId: true } }))) throw new Error("NOT_MEMBER");
      const row = await deps.db.projectDigest.findFirst({ where: { projectId }, orderBy: [{ factsAsOf: "desc" }, { createdAt: "desc" }, { id: "desc" }], take: 1 });
      return row ? publicDigest(row, false) : null;
    },
  };
}
