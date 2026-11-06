export { ALLOW_LIST, ENTITY_TYPES, FACT_KEYS, FEATURE_ROLES, SOURCE_IDS } from "./allow-list.js";
export type { AssembleOptions, EntityType, FactKind, Scope, SectionSpec, SourceId } from "./allow-list.js";
export { ContextScopeViolation } from "./errors.js";
export { getAiContext } from "./assemble.js";
export type { AiContextWith, AssembleResult, Provenance } from "./assemble.js";
export { registerContextSource, registerCore } from "./registry.js";
export type { ContextRow, ContextSource, MemberCheck, SourceArgs } from "./registry.js";
