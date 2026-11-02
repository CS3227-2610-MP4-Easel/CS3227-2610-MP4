import type { Predicate, PolicyEntry } from "./policy.js";
import type { UserRole } from "./enums.js";

export type ResourceKind = "PROJECT" | "TASK" | "MEMBERSHIP" | "STANDUP" | "ACTIVITY_ITEM" | "SUMMARY" | "PROPOSAL" | "PROPOSAL_EPIC" | "SESSION" | "USAGE";
export type ResourceState = "ACTIVE" | "ARCHIVED";

export type ResolvedResource = {
  kind: ResourceKind;
  projectId: string | null;
  ownerId?: string;
  assigneeId?: string;
  targetRole?: UserRole;
  state: ResourceState;
} | {
  kind: "PROJECT_SET";
  projectIds: string[];
};

export type AuthorizationTransaction = unknown;
export type ResourceResolver = (operationId: string, request: unknown, tx?: AuthorizationTransaction) => Promise<ResolvedResource | null>;
export type ResourceResolverRegistry = Readonly<Record<string, ResourceResolver>>;
export type AuthorizationPredicateInput = {
  predicate: Predicate;
  resource: ResolvedResource | null;
  policy: Pick<PolicyEntry, "operationId" | "method">;
};
export type AuthorizationScope<TPrincipal = unknown> = {
  principal: TPrincipal;
  resolved: ResolvedResource | null;
  tx?: AuthorizationTransaction;
};
