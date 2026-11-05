import type { AuthRuntime } from "@agile/auth";
import type { AuthDependencies } from "./middleware/auth.js";
import { createPredicateEvaluator } from "./middleware/predicates.js";

/** Wires auth into the policy gate. Membership and resource resolution are W5's (spec SD15); until W5 replaces these
 * placeholders they fail closed, so every MEMBER-scoped route is a 404. */
export function createAppDependencies(auth: Pick<AuthRuntime, "resolvePrincipal" | "lookupRegisteredUser">): AuthDependencies {
  const requireMember: AuthDependencies["requireMember"] = async () => { throw new Error("NOT_FOUND"); };
  return {
    resolvePrincipal: auth.resolvePrincipal,
    lookupRegisteredUser: auth.lookupRegisteredUser,
    resolveResource: async () => null,
    requireMember,
    evaluatePredicate: createPredicateEvaluator(requireMember),
  };
}
