import { applyPlan } from "@agile/core";
import { createDbClient } from "@agile/db";
import { getAiContext } from "@agile/ai-context";
import { getLlmGateway, getSessions } from "@agile/llm-gateway";
import { approveProposal, claimEpic, createProposal, failEpic, getProposalView, rejectProposal, storeEpic } from "@agile/proposals";
import { createPlanFlow, type PlanFlow } from "./plan-flow.js";
import { loadPmSettings } from "./settings.js";
import { registerSimilarItems } from "./similar-items.js";

let cached: PlanFlow | undefined;

/** Built on first use and memoised: the filtered client, the gateway, sessions and context, the bound proposals functions; registers the similar-items source once. This file never calls `run`. */
export function getPmRuntime(): PlanFlow {
  if (cached) return cached;
  const db = createDbClient();
  const gateway = getLlmGateway();
  const sessions = getSessions();
  const core = { applyPlan: (tx: unknown, projectId: string, plan: unknown, actorId: string) => applyPlan(tx as never, projectId, plan, actorId) };
  registerSimilarItems({ db, settings: loadPmSettings(process.env) });
  cached = createPlanFlow({
    gateway, sessions, aiContext: getAiContext(),
    proposals: {
      createProposal: (i) => createProposal(db, i),
      getProposalView: (proposalId, viewerId) => getProposalView(db, proposalId, viewerId),
      claimEpic: (i) => claimEpic(db, i),
      storeEpic: (i) => storeEpic(db, i),
      failEpic: (i) => failEpic(db, i),
      approveProposal: (i) => approveProposal({ db, core, sessions }, i),
      rejectProposal: (i) => rejectProposal({ db, sessions }, i),
    },
  });
  return cached;
}
