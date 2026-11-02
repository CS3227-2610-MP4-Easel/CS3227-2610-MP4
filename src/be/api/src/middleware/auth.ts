import { HttpError } from "../errors.js";
import type { AuthorizationScope, AuthorizationTransaction, PolicyEntry, ResolvedResource } from "@agile/contracts";

export type ApiRequest = { method: string; path: string; params: Record<string, string>; query: URLSearchParams; body: unknown };
export type Principal = { firebaseUid: string; userId: string; role: "PM" | "DEV_LEAD" | "DEVELOPER" };
export type AuthDependencies = {
  resolvePrincipal(authorization: string | undefined): Promise<{ firebaseUid: string; tokenClaims: Record<string, unknown> }>;
  lookupRegisteredUser(firebaseUid: string): Promise<Principal>;
  beginTransaction?: () => Promise<AuthorizationTransaction>;
  resolveResource(operationId: string, request: ApiRequest, tx?: AuthorizationTransaction): Promise<ResolvedResource | null>;
  requireMember(userId: string, projectId: string): Promise<void>;
  evaluatePredicate(predicate: PolicyEntry["predicate"], principal: Principal, request: ApiRequest, resolved: ResolvedResource | null, tx?: AuthorizationTransaction): Promise<void>;
};

export async function authorizeRequest(policy: Pick<PolicyEntry, "operationId" | "method" | "authState" | "roles" | "predicate">, deps: AuthDependencies, authorization: string | undefined, request: ApiRequest): Promise<Principal | undefined | AuthorizationScope<Principal>> {
  if (policy.authState === "PUBLIC") return undefined;
  let token: { firebaseUid: string; tokenClaims: Record<string, unknown> };
  try { token = await deps.resolvePrincipal(authorization); } catch (error) { throw new HttpError("UNAUTHENTICATED", 401, "Authentication is required."); }
  if (policy.authState === "TOKEN") return { firebaseUid: token.firebaseUid, userId: "", role: "PM" };
  let principal: Principal;
  try { principal = await deps.lookupRegisteredUser(token.firebaseUid); } catch { throw new HttpError("USER_NOT_REGISTERED", 403, "The authenticated user is not registered."); }
  if (policy.roles.length > 0 && !policy.roles.includes(principal.role)) throw new HttpError("FORBIDDEN_ROLE", 403, "The user's role cannot access this operation.");
  const tx = deps.beginTransaction ? await deps.beginTransaction() : undefined;
  let resolved: ResolvedResource | null = null;
  if (policy.predicate !== "NONE") {
    try { resolved = await deps.resolveResource(policy.operationId, request, tx); } catch { throw new HttpError("NOT_FOUND", 404, "The requested resource was not found."); }
  }
  if (policy.predicate !== "NONE" && !resolved) throw new HttpError("NOT_FOUND", 404, "The requested resource was not found.");
  const suppliedProjectId = request.params.projectId;
  if (suppliedProjectId && resolved && resolved.kind !== "PROJECT_SET" && resolved.projectId !== suppliedProjectId) {
    throw new HttpError("NOT_FOUND", 404, "The requested resource was not found.");
  }
  if (resolved && resolved.kind !== "PROJECT_SET" && resolved.state === "ARCHIVED") {
    if (policy.method !== "GET") throw new HttpError("CONFLICT_STATE", 409, "The project or resource is archived.");
    throw new HttpError("NOT_FOUND", 404, "The requested resource was not found.");
  }
  if (policy.predicate === "MEMBER" && resolved && resolved.kind !== "PROJECT_SET" && resolved.projectId) {
    try { await deps.requireMember(principal.userId, resolved.projectId); } catch { throw new HttpError("NOT_FOUND", 404, "The requested resource was not found."); }
  }
  try { await deps.evaluatePredicate(policy.predicate, principal, request, resolved, tx); } catch { throw new HttpError("NOT_FOUND", 404, "The requested resource was not found."); }
  return { principal, resolved, tx };
}
