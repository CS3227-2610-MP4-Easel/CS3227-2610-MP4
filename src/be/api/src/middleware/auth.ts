import { HttpError } from "../errors.js";
import type { AuthorizationScope, AuthorizationTransaction, PolicyEntry, ResolvedResource } from "@agile/contracts";

export type ApiRequest = { method: string; path: string; params: Record<string, string>; query: URLSearchParams; body: unknown; userId?: string };
export type Principal = { firebaseUid: string; userId: string; role: "PM" | "DEV_LEAD" | "DEVELOPER" };
export type AuthDependencies = {
  resolvePrincipal(authorization: string | undefined): Promise<{ firebaseUid: string; tokenClaims: Record<string, unknown> }>;
  lookupRegisteredUser(firebaseUid: string): Promise<Principal>;
  beginTransaction?: () => Promise<AuthorizationTransaction>;
  resolveResource(operationId: string, request: ApiRequest, tx?: AuthorizationTransaction): Promise<ResolvedResource | null>;
  requireMember(userId: string, projectId: string): Promise<void>;
  evaluatePredicate(predicate: PolicyEntry["predicate"], principal: Principal, request: ApiRequest, resolved: ResolvedResource | null, tx?: AuthorizationTransaction): Promise<void>;
};

const notFound = () => new HttpError("NOT_FOUND", 404, "The requested resource was not found.");

export async function authorizeRequest(policy: Pick<PolicyEntry, "operationId" | "method" | "authState" | "roles" | "predicate">, deps: AuthDependencies, authorization: string | undefined, request: ApiRequest, deferAdder = false): Promise<AuthorizationScope<Principal | { firebaseUid: string; tokenClaims: Record<string, unknown> } | null>> {
  if (policy.authState === "PUBLIC") return { principal: null, resolved: null };
  let token: { firebaseUid: string; tokenClaims: Record<string, unknown> };
  try { token = await deps.resolvePrincipal(authorization); } catch (error) { if (!(error instanceof Error) || error.message !== "UNAUTHENTICATED") throw error; throw new HttpError("UNAUTHENTICATED", 401, "Authentication is required."); }
  if (policy.authState === "TOKEN") return { principal: token, resolved: null };
  let principal: Principal;
  try { principal = await deps.lookupRegisteredUser(token.firebaseUid); } catch (error) { if (!(error instanceof Error) || error.message !== "USER_NOT_REGISTERED") throw error; throw new HttpError("USER_NOT_REGISTERED", 403, "The authenticated user is not registered."); }
  if (policy.roles.length > 0 && !policy.roles.includes(principal.role)) throw new HttpError("FORBIDDEN_ROLE", 403, "The user's role cannot access this operation.");
  const tx = deps.beginTransaction ? await deps.beginTransaction() : undefined;
  request.userId = principal.userId;
  try {
  let resolved: ResolvedResource | null = null;
  if (policy.predicate !== "NONE") {
    try { resolved = await deps.resolveResource(policy.operationId, request, tx); } catch (error) { if (!(error instanceof Error) || error.message !== "NOT_FOUND") throw error; throw new HttpError("NOT_FOUND", 404, "The requested resource was not found."); }
  }
  if (policy.predicate !== "NONE" && !resolved) throw new HttpError("NOT_FOUND", 404, "The requested resource was not found.");
  const suppliedProjectId = request.params.projectId;
  if (suppliedProjectId && resolved && resolved.kind !== "PROJECT_SET" && resolved.projectId !== suppliedProjectId) {
    throw new HttpError("NOT_FOUND", 404, "The requested resource was not found.");
  }
  if ((policy.predicate === "MEMBER" || policy.predicate === "ADDER") && resolved && resolved.kind !== "PROJECT_SET") {
    if (!resolved.projectId) throw new HttpError("NOT_FOUND", 404, "The requested resource was not found.");
    try { await deps.requireMember(principal.userId, resolved.projectId); } catch (error) { if (!(error instanceof Error) || error.message !== "NOT_FOUND") throw error; throw new HttpError("NOT_FOUND", 404, "The requested resource was not found."); }
  }
  if (policy.predicate !== "MEMBER" && !(policy.predicate === "ADDER" && deferAdder)) {
    try { await deps.evaluatePredicate(policy.predicate, principal, request, resolved, tx); } catch (error) { if (!(error instanceof Error) || error.message !== "NOT_FOUND") throw error; throw new HttpError("NOT_FOUND", 404, "The requested resource was not found."); }
  }
  if (resolved && resolved.kind !== "PROJECT_SET" && resolved.state === "ARCHIVED") {
    if (policy.method !== "GET") throw new HttpError("CONFLICT_STATE", 409, "The project or resource is archived.");
    throw new HttpError("NOT_FOUND", 404, "The requested resource was not found.");
  }
  if (policy.predicate === "MEMBER") {
    try { await deps.evaluatePredicate(policy.predicate, principal, request, resolved, tx); } catch (error) { if (!(error instanceof Error) || error.message !== "NOT_FOUND") throw error; throw new HttpError("NOT_FOUND", 404, "The requested resource was not found."); }
  }
  return { principal, resolved, tx };
  } catch (error) {
    if (tx) await tx.rollback();
    throw error;
  }
}

/** Runs ADDER only after a valid body is available, while pre-parse membership/archive checks remain intact. */
export async function authorizeAdder(deps: AuthDependencies, policy: Pick<PolicyEntry, "operationId">, principal: Principal, request: ApiRequest, tx?: AuthorizationTransaction): Promise<void> {
  try {
    const resolved = await deps.resolveResource(policy.operationId, request, tx);
    if (!resolved) throw notFound();
    await deps.evaluatePredicate("ADDER", principal, request, resolved, tx);
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (error instanceof Error && error.message === "NOT_FOUND") throw notFound();
    throw error;
  }
}
