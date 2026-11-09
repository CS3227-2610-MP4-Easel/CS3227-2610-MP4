import type { AuthRuntime } from "@agile/auth";
import type { AuthDependencies } from "./middleware/auth.js";
import { createPredicateEvaluator } from "./middleware/predicates.js";

/** Wires auth into the policy gate. Membership and resource resolution are W5's (spec SD15); until W5 replaces these
 * placeholders they fail closed, so every MEMBER-scoped route is a 404. */
export const LOCAL_DEV_PM_TOKEN = "Bearer dev-pm";
const LOCAL_DEV_PM_UID = "w13-demo-pm";

/** Stand-in for sign-in until the sign-in screen lands (C46): on the `local` tier only, the fixed token `dev-pm` resolves to
 * the seeded demo PM. Every other tier, and every other token, goes to the real verifier. */
function withLocalDevPm(auth: Pick<AuthRuntime, "resolvePrincipal"> & { settings?: { tier: string } }): AuthDependencies["resolvePrincipal"] {
  if (auth.settings?.tier !== "local") return auth.resolvePrincipal;
  return (authorization) => authorization === LOCAL_DEV_PM_TOKEN ? Promise.resolve({ firebaseUid: LOCAL_DEV_PM_UID, tokenClaims: {} }) : auth.resolvePrincipal(authorization);
}

export function createAppDependencies(auth: Pick<AuthRuntime, "resolvePrincipal" | "lookupRegisteredUser"> & { settings?: { tier: string } }, core?: Pick<AuthDependencies, "resolveResource" | "requireMember">): AuthDependencies {
  const requireMember: AuthDependencies["requireMember"] = async () => { throw new Error("NOT_FOUND"); };
  const membership = core?.requireMember ?? requireMember;
  return {
    resolvePrincipal: withLocalDevPm(auth),
    lookupRegisteredUser: auth.lookupRegisteredUser,
    resolveResource: core?.resolveResource ?? (async () => null),
    requireMember: membership,
    evaluatePredicate: createPredicateEvaluator(membership),
  };
}
