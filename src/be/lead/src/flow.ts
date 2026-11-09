import { getAiContext, type AiContextWith } from "@agile/ai-context";
import type { Facts } from "./facts.js";
import { hashFacts } from "./hash.js";
import { DigestOutputSchema, type DigestOutput } from "./schemas.js";
import { LEAD_STATIC_SECTIONS } from "./sections.js";
import type { LeadGatewayBinding } from "./gateway-binding.js";

type Db = any;
type FactService = { target(projectId: string): Promise<Facts>; caller(callerId: string, projectId: string): Promise<Facts> };
type Caller = { userId: string; role: "DEV_LEAD" };
type FlowDeps = { db: Db; facts: FactService; binding: LeadGatewayBinding; context?: AiContextWith; now?: () => Date; requireMember?: (userId: string, projectId: string) => Promise<void> };
const degraded = (facts: Facts, id?: string, flagged = false) => ({ id: id ?? "", projectId: "", facts, explanation: null, degraded: true, flagged, proposalId: null, cached: false, createdAt: new Date().toISOString() });

export function createLeadFlow(deps: FlowDeps) {
  const context = deps.context ?? getAiContext(); const now = deps.now ?? (() => new Date());
  async function persist(projectId: string, actorId: string, facts: Facts, factsHash: string, output: DigestOutput | null, sessionId: string | null, flagged: boolean, degradedFlag: boolean) {
    return deps.db.$transaction(async (tx: Db) => {
      const digest = await tx.projectDigest.create({ data: { projectId, facts, factsHash, explanation: output?.explanation ?? null, degraded: degradedFlag, flagged, sessionId } });
      let proposalId: string | null = null;
      if (output && output.suggestions.length) {
        const proposal = await tx.aiProposal.create({ data: { projectId, kind: "REPLAN", status: "PENDING", payload: { suggestions: output.suggestions, explanation: output.explanation }, sessionId, createdBy: actorId, flagged }, select: { id: true } });
        proposalId = proposal.id; await tx.projectDigest.update({ where: { id: digest.id }, data: { proposalId } });
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
    const cached = await deps.db.projectDigest.findFirst({ where: { projectId, factsHash, degraded: false }, orderBy: { createdAt: "desc" } });
    if (cached) return { ...cached, cached: true, proposalId: cached.proposalId ?? null };
    let sessionId: string | null = null;
    try { sessionId = await deps.binding.sessions.open({ feature: "LEAD_DIGEST", userId: caller.userId, projectId }); } catch { const saved = await persist(projectId, caller.userId, facts, factsHash, null, null, false, true); return { ...degraded(facts, saved.digest.id), id: saved.digest.id, projectId }; }
    let output: DigestOutput | null = null; let flagged = false; let persistSessionId: string | null = sessionId;
    try {
      const assembled = await context.assembleWith(caller, "LEAD_DIGEST", projectId, {});
      const result = await deps.binding.gateway.run({ feature: "LEAD_DIGEST", caller, sessionId, projectId, sections: [...LEAD_STATIC_SECTIONS, ...assembled.sections], output: { kind: "json", schema: DigestOutputSchema }, inputHash: factsHash });
      flagged = Boolean((result as { flagged?: unknown }).flagged);
      if (!result.ok && !(result as { callId?: unknown }).callId) persistSessionId = null;
      if (result.ok) { const parsed = DigestOutputSchema.safeParse(result.value); if (parsed.success && await validOutput(parsed.data, facts, projectId)) output = parsed.data; }
    } catch { persistSessionId = null; /* failure is represented by the degraded digest below */ }
    let saved: Awaited<ReturnType<typeof persist>>;
    let outcome: "ACCEPTED" | "REJECTED" = "REJECTED";
    try {
      saved = await persist(projectId, caller.userId, facts, factsHash, output, persistSessionId, flagged, !output);
      outcome = output ? "ACCEPTED" : "REJECTED";
    } finally {
      await deps.binding.sessions.close(sessionId, outcome, caller.userId);
    }
    return output ? { ...saved.digest, id: saved.digest.id, projectId, facts, explanation: output.explanation, degraded: false, flagged, proposalId: saved.proposalId, cached: false, createdAt: saved.digest.createdAt.toISOString?.() ?? String(saved.digest.createdAt) } : { ...degraded(facts, saved.digest.id, flagged), id: saved.digest.id, projectId };
  }
  return {
    facts: (projectId: string, callerId?: string) => callerId ? deps.facts.caller(callerId, projectId) : deps.facts.target(projectId),
    createDigest,
    async latestDigest(caller: Caller, projectId: string) {
      if (deps.requireMember) await deps.requireMember(caller.userId, projectId);
      else if (!(await deps.db.projectMember?.findFirst?.({ where: { projectId, userId: caller.userId }, select: { userId: true } }))) throw new Error("NOT_MEMBER");
      // JSON facts.asOf is not indexable in the current schema; bound the candidate read, then apply the full tie-break order.
      const rows = await deps.db.projectDigest.findMany({ where: { projectId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 100 });
      rows.sort((a: any, b: any) => String(b.facts?.asOf ?? "").localeCompare(String(a.facts?.asOf ?? "")) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() || String(b.id).localeCompare(String(a.id)));
      const row = rows[0]; return row ? { ...row, cached: false } : null;
    },
  };
}
