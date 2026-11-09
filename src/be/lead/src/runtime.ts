import { getAiContext } from "@agile/ai-context";
import { getLlmGateway, getSessions } from "@agile/llm-gateway";
import { createFacts } from "./facts.js";
import { createLeadFlow } from "./flow.js";
import { registerLeadMock } from "./mocks.js";
import { createLeadSources, registerLeadSources, type LeadSourceDb } from "./context-sources.js";
let cached: ReturnType<typeof createLeadFlow> | undefined;
export function createLeadRuntime(db: LeadSourceDb & Record<string, any>, coreFacts = createFacts(db as any)) { registerLeadSources(createLeadSources(db, (projectId) => coreFacts.target(projectId))); registerLeadMock(); return createLeadFlow({ db, facts: coreFacts as any, binding: { gateway: getLlmGateway(), sessions: getSessions() }, context: getAiContext() }); }
export function getLeadRuntime(): ReturnType<typeof createLeadFlow> { if (!cached) throw new Error("LEAD_RUNTIME_NOT_INITIALIZED"); return cached; }
export function initLeadRuntime(db: LeadSourceDb & Record<string, any>) { return (cached ??= createLeadRuntime(db)); }
