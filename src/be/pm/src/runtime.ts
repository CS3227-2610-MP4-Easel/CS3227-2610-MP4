import { applyPlan } from "@agile/core";
import { createDbClient, type FilteredDbClient } from "@agile/db";
import { getAiContext } from "@agile/ai-context";
import { addEpic, approveProposal, claimEpic, claimPlanEpics, createProposal, deleteEpic, editEpic, failEpic, failPlanEpics, getProposalView, listProposals, precheckRegenerate, rejectProposal, replaceCheckpoints, storeEpic, storePlanEpics } from "@agile/proposals";
import { gatewayParts } from "./gateway-binding.js";
import { createPlanFlow, type PlanFlow } from "./plan-flow.js";
import { loadPmSettings } from "./settings.js";
import { registerSimilarItems } from "./similar-items.js";

let cached: PlanFlow | undefined;
let db: FilteredDbClient | undefined;
let registered = false;

/** Runs `register` at most once successfully: the flag is set only after it returns, so a failed build can be retried without a duplicate registration. */
export function ensureSimilarItemsRegistered(register: () => void): void {
  if (registered) return;
  register();
  registered = true;
}

export function resetPmRuntimeForTests(): void {
  cached = undefined;
  db = undefined;
  registered = false;
}

/** Built on first use and memoised: the filtered client (created once, reused by a retry), the gateway, sessions and context, the bound proposals functions; registers the similar-items source once. This file never calls `run`. */
export function getPmRuntime(deps: { createDbClient: () => FilteredDbClient; gatewayParts: typeof gatewayParts } = { createDbClient, gatewayParts }): PlanFlow {
  if (cached) return cached;
  const client = (db ??= deps.createDbClient());
  const { gateway, sessions } = deps.gatewayParts();
  const core = { applyPlan: (tx: unknown, projectId: string, plan: unknown, actorId: string) => applyPlan(tx as never, projectId, plan, actorId) };
  const settings = loadPmSettings(process.env);
  const flow = createPlanFlow({
    gateway, sessions, aiContext: getAiContext(),
    onExpandAll: ({ targets, written, skipped }) => console.info("PM_PROPOSAL_EXPAND_ALL", { targets, written, skipped }),
    proposals: {
      claimPlanEpics: (i) => claimPlanEpics(client, i),
    storePlanEpics: (i) => storePlanEpics(client, i),
    failPlanEpics: (i) => failPlanEpics(client, i),
    createProposal: (i) => createProposal(client, i),
      getProposalView: (proposalId, viewerId) => getProposalView(client, proposalId, viewerId),
      claimEpic: (i) => claimEpic(client, i),
      storeEpic: (i) => storeEpic(client, i),
      failEpic: (i) => failEpic(client, i),
      editEpic: (i) => editEpic(client, i),
      replaceCheckpoints: (i) => replaceCheckpoints(client, i),
      addEpic: (i) => addEpic(client, i),
      deleteEpic: (i) => deleteEpic(client, i),
      precheckRegenerate: (i) => precheckRegenerate(client, i),
      listProposals: (i) => listProposals(client, i),
      approveProposal: (i) => approveProposal({ db: client, core, sessions }, i),
      rejectProposal: (i) => rejectProposal({ db: client, sessions }, i),
    },
  });
  ensureSimilarItemsRegistered(() => registerSimilarItems({ db: client, settings }));
  cached = flow;
  return cached;
}
