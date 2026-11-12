import { getAiContext } from "@agile/ai-context";
import { getLlmGateway, getSessions } from "@agile/llm-gateway";
import { createFacts } from "./facts.js";
import { createLeadFlow } from "./flow.js";
import type { LeadGatewayBinding } from "./gateway-binding.js";
import type { LeadProposalService } from "./flow.js";
import { registerLeadMock } from "./mocks.js";
import { createLeadSources, registerLeadSources, type LeadSourceDb } from "./context-sources.js";
const cached = new WeakMap<object, ReturnType<typeof createLeadFlow>>();
export function createLeadRuntime(db: LeadSourceDb & Record<string, any>, coreFacts = createFacts(db as any), binding?: LeadGatewayBinding, options: { registerSources?: boolean; proposalService?: LeadProposalService } = {}) {
  const existing = cached.get(db);
  if (existing) return existing;
  if (options.registerSources !== false) { registerLeadSources(createLeadSources(db, (projectId) => coreFacts.target(projectId))); registerLeadMock(); }
  const runtime = createLeadFlow({ db, facts: coreFacts as any, binding: binding ?? { gateway: getLlmGateway(), sessions: getSessions() }, proposalService: options.proposalService, context: getAiContext() });
  cached.set(db, runtime);
  return runtime;
}
export function getLeadRuntime(db?: LeadSourceDb & Record<string, any>): ReturnType<typeof createLeadFlow> { const runtime = db ? cached.get(db) : undefined; if (!runtime) throw new Error("LEAD_RUNTIME_NOT_INITIALIZED"); return runtime; }
export function initLeadRuntime(db: LeadSourceDb & Record<string, any>, binding?: LeadGatewayBinding, options: { registerSources?: boolean; proposalService?: LeadProposalService } = {}) { const existing = cached.get(db); if (existing) return existing; return createLeadRuntime(db, undefined, binding, options); }
