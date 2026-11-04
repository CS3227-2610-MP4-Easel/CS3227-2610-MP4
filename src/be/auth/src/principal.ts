import type { UserRole } from "@agile/contracts";
import type { FilteredDbClient } from "@agile/db";
import type { TokenVerifier } from "./token-verifier.js";

export type TokenPrincipal = { firebaseUid: string; tokenClaims: { email: string } };
export type RegisteredPrincipal = { firebaseUid: string; userId: string; role: UserRole };

/** W1 `AuthDependencies.resolvePrincipal`: throws `Error("UNAUTHENTICATED")` for a missing, malformed or rejected token; rethrows `VerifierUnavailable`. */
export function createResolvePrincipal(verifier: TokenVerifier): (authorization: string | undefined) => Promise<TokenPrincipal> {
  void verifier;
  return async () => { throw new Error("NOT_IMPLEMENTED"); };
}

/** W1 `AuthDependencies.lookupRegisteredUser`: throws `Error("USER_NOT_REGISTERED")` when no row has this uid. */
export function createLookupRegisteredUser(db: FilteredDbClient): (firebaseUid: string) => Promise<RegisteredPrincipal> {
  void db;
  return async () => { throw new Error("NOT_IMPLEMENTED"); };
}
