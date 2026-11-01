import { HttpError } from "../errors.js";
import type { PolicyEntry } from "@agile/contracts";

export type ApiRequest = { method: string; path: string; params: Record<string, string>; query: URLSearchParams; body: unknown };
export type Principal = { firebaseUid: string; userId: string; role: "PM" | "DEV_LEAD" | "DEVELOPER" };
export type AuthDependencies = {
  resolvePrincipal(authorization: string | undefined): Promise<{ firebaseUid: string; tokenClaims: Record<string, unknown> }>;
  lookupRegisteredUser(firebaseUid: string): Promise<Principal>;
  requireMember(userId: string, projectId: string): Promise<void>;
  evaluatePredicate(predicate: PolicyEntry["predicate"], principal: Principal, request: ApiRequest): Promise<void>;
};

export async function authorizeRequest(policy: Pick<PolicyEntry, "authState" | "roles" | "predicate">, deps: AuthDependencies, authorization: string | undefined, request: ApiRequest): Promise<Principal | undefined> {
  if (policy.authState === "PUBLIC") return undefined;
  let token: { firebaseUid: string; tokenClaims: Record<string, unknown> };
  try { token = await deps.resolvePrincipal(authorization); } catch (error) { throw new HttpError("UNAUTHENTICATED", 401, "Authentication is required."); }
  if (policy.authState === "TOKEN") return { firebaseUid: token.firebaseUid, userId: "", role: "PM" };
  let principal: Principal;
  try { principal = await deps.lookupRegisteredUser(token.firebaseUid); } catch { throw new HttpError("USER_NOT_REGISTERED", 403, "The authenticated user is not registered."); }
  if (policy.roles.length > 0 && !policy.roles.includes(principal.role)) throw new HttpError("FORBIDDEN_ROLE", 403, "The user's role cannot access this operation.");
  const projectId = request.params.projectId ?? request.params.id;
  if (policy.predicate === "MEMBER" && projectId) {
    try { await deps.requireMember(principal.userId, projectId); } catch { throw new HttpError("NOT_FOUND", 404, "The requested resource was not found."); }
  }
  try { await deps.evaluatePredicate(policy.predicate, principal, request); } catch { throw new HttpError("NOT_FOUND", 404, "The requested resource was not found."); }
  return principal;
}
