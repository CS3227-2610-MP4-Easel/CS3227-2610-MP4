import { getAiContext, type AiContextWith } from "@agile/ai-context";
import type { Facts } from "./facts.js";
import { hashFacts } from "./hash.js";
import { DigestOutputSchema, type DigestOutput } from "./schemas.js";
import { LEAD_STATIC_SECTIONS } from "./sections.js";
import type { LeadGatewayBinding } from "./gateway-binding.js";

type Db = any;
type FactService = { target(projectId: string): Promise<Facts>; caller(callerId: string, projectId: string): Promise<Facts> };
type FlowDeps = { db: Db; facts: FactService; binding: LeadGatewayBinding; context?: AiContextWith; now?: () => Date };
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
  function validOutput(output: DigestOutput, facts: Facts): boolean {
    const ids = output.suggestions.map((suggestion) => suggestion.id);
    if (new Set(ids).size !== ids.length) return false;
    const checkpoints = new Set(facts.checkpoints.map((checkpoint) => checkpoint.id));
    const users = new Set(facts.overload.map((user) => user.userId));
    return output.suggestions.every((suggestion) => {
      if (suggestion.type === "MOVE_CHECKPOINT_DATE") return checkpoints.has(suggestion.checkpointId);
      if (suggestion.type === "REASSIGN_TASK") return users.has(suggestion.assigneeId);
      return suggestion.checkpointId === null || checkpoints.has(suggestion.checkpointId);
    });
  }
  async function factsFor(callerId: string | undefined, projectId: string) { return callerId ? deps.facts.caller(callerId, projectId) : deps.facts.target(projectId); }
  async function createDigest(caller: { userId: string; role: "DEV_LEAD" }, projectId: string) {
    const facts = await factsFor(caller.userId, projectId); const factsHash = hashFacts(facts);
    const cached = await deps.db.projectDigest.findFirst({ where: { projectId, factsHash, degraded: false }, orderBy: { createdAt: "desc" } });
    if (cached) return { ...cached, cached: true, proposalId: cached.proposalId ?? null };
    let sessionId: string | null = null;
    try { sessionId = await deps.binding.sessions.open({ feature: "LEAD_DIGEST", userId: caller.userId, projectId }); } catch { const saved = await persist(projectId, caller.userId, facts, factsHash, null, null, false, true); return { ...degraded(facts, saved.digest.id), id: saved.digest.id, projectId }; }
    let output: DigestOutput | null = null; let flagged = false;
    try {
      const assembled = await context.assembleWith(caller, "LEAD_DIGEST", projectId, {});
      const result = await deps.binding.gateway.run({ feature: "LEAD_DIGEST", caller, sessionId, projectId, sections: [...LEAD_STATIC_SECTIONS, ...assembled.sections], output: { kind: "json", schema: DigestOutputSchema }, inputHash: factsHash });
      if (result.ok) { const parsed = DigestOutputSchema.safeParse(result.value); if (parsed.success && validOutput(parsed.data, facts)) { output = parsed.data; flagged = result.flagged; } }
    } catch { /* failure is represented by the degraded digest below */ }
    const saved = await persist(projectId, caller.userId, facts, factsHash, output, sessionId, flagged, !output);
    await deps.binding.sessions.close(sessionId, output ? "ACCEPTED" : "REJECTED", caller.userId);
    return output ? { ...saved.digest, id: saved.digest.id, projectId, facts, explanation: output.explanation, degraded: false, flagged, proposalId: saved.proposalId, cached: false, createdAt: saved.digest.createdAt.toISOString?.() ?? String(saved.digest.createdAt) } : { ...degraded(facts, saved.digest.id, flagged), id: saved.digest.id, projectId };
  }
  return {
    facts: (projectId: string, callerId?: string) => callerId ? deps.facts.caller(callerId, projectId) : deps.facts.target(projectId),
    createDigest,
    async latestDigest(projectId: string) { const row = await deps.db.projectDigest.findFirst({ where: { projectId }, orderBy: [{ facts: "desc" }, { createdAt: "desc" }, { id: "desc" }] }); return row ? { ...row, cached: false } : null; },
  };
}
