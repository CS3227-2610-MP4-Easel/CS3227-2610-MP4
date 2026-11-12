import { getAiContext } from "@agile/ai-context";
import { createTransactionSessionCloser, getLlmGateway, getSessions } from "@agile/llm-gateway";
import { createFacts } from "./facts.js";
import { createLeadFlow } from "./flow.js";
import type { LeadGatewayBinding } from "./gateway-binding.js";
import type { LeadProposalService } from "./flow.js";
import { registerLeadMock } from "./mocks.js";
import { createLeadSources, registerLeadSources, type LeadSourceDb } from "./context-sources.js";
const cached = new WeakMap<object, { runtime: ReturnType<typeof createLeadFlow>; proposalService?: LeadProposalService }>();
export function createLeadRuntime(db: LeadSourceDb & Record<string, any>, coreFacts = createFacts(db as any), binding?: LeadGatewayBinding, options: { registerSources?: boolean; proposalService?: LeadProposalService } = {}) {
  const existing = cached.get(db);
  if (existing && (!options.proposalService || existing.proposalService === options.proposalService)) return existing.runtime;
  if (existing?.proposalService && options.proposalService && existing.proposalService !== options.proposalService) throw new Error("LEAD_RUNTIME_DEPENDENCY_CONFLICT");
  const runtimeBinding = binding ?? { gateway: getLlmGateway(), sessions: getSessions(), sessionCloser: createTransactionSessionCloser() };
  if (existing && !existing.proposalService && options.proposalService) {
    const runtime = createLeadFlow({ db, facts: coreFacts as any, binding: runtimeBinding, proposalService: options.proposalService, context: getAiContext() });
    cached.set(db, { runtime, proposalService: options.proposalService });
    return runtime;
  }
  if (options.registerSources !== false) { registerLeadSources(createLeadSources(db, (projectId) => coreFacts.target(projectId))); registerLeadMock(); }
  const runtime = createLeadFlow({ db, facts: coreFacts as any, binding: runtimeBinding, proposalService: options.proposalService, context: getAiContext() });
  cached.set(db, { runtime, proposalService: options.proposalService });
  return runtime;
}
export function getLeadRuntime(db?: LeadSourceDb & Record<string, any>): ReturnType<typeof createLeadFlow> { const entry = db ? cached.get(db) : undefined; if (!entry) throw new Error("LEAD_RUNTIME_NOT_INITIALIZED"); return entry.runtime; }
export function initLeadRuntime(db: LeadSourceDb & Record<string, any>, binding?: LeadGatewayBinding, options: { registerSources?: boolean; proposalService?: LeadProposalService } = {}) { return createLeadRuntime(db, undefined, binding, options); }
