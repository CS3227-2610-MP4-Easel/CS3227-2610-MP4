import type { UserRole } from "@agile/contracts";
import type { FilteredDbClient } from "@agile/db";
import { InvalidToken, type TokenVerifier } from "./token-verifier.js";

export type TokenPrincipal = { firebaseUid: string; tokenClaims: { email: string } };
export type RegisteredPrincipal = { firebaseUid: string; userId: string; role: UserRole };

/** One `Bearer` header, any case, one or more spaces; two headers arrive joined with ", " and fail the pattern. */
const BEARER = /^Bearer +(\S+)$/i;

/** W1 `AuthDependencies.resolvePrincipal`: throws `Error("UNAUTHENTICATED")` for a missing, malformed or rejected token; rethrows `VerifierUnavailable`. */
export function createResolvePrincipal(verifier: TokenVerifier): (authorization: string | undefined) => Promise<TokenPrincipal> {
  return async (authorization) => {
    const token = authorization?.match(BEARER)?.[1];
    if (!token || Buffer.byteLength(token) > 4096) throw new Error("UNAUTHENTICATED");
    let verified: { uid: string; email: string | null };
    try { verified = await verifier.verify(token); } catch (error) {
      if (error instanceof InvalidToken) throw new Error("UNAUTHENTICATED");
      throw error;
    }
    if (verified.email === null) throw new Error("UNAUTHENTICATED");
    return { firebaseUid: verified.uid, tokenClaims: { email: verified.email.toLowerCase() } };
  };
}

/** W1 `AuthDependencies.lookupRegisteredUser`: throws `Error("USER_NOT_REGISTERED")` when no row has this uid. */
export function createLookupRegisteredUser(db: FilteredDbClient): (firebaseUid: string) => Promise<RegisteredPrincipal> {
  return async (firebaseUid) => {
    const row = await db.user.findUnique({ where: { firebaseUid }, select: { id: true, role: true } });
    if (!row) throw new Error("USER_NOT_REGISTERED");
    return { firebaseUid, userId: row.id, role: row.role };
  };
}
