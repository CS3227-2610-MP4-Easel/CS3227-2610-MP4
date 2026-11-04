export class InvalidToken extends Error { constructor() { super("InvalidToken"); this.name = "InvalidToken"; } }
export class VerifierUnavailable extends Error { constructor() { super("VerifierUnavailable"); this.name = "VerifierUnavailable"; } }

/** `email` is the claim when it is a non-empty string, else null; no other claim leaves the adapter. */
export type TokenVerifier = { verify(token: string): Promise<{ uid: string; email: string | null }> };

/** Production adapter: `firebase-admin` `verifyIdToken(token, false)`, initialised from the project id only. */
export function createFirebaseTokenVerifier(firebaseProjectId: string): TokenVerifier {
  void firebaseProjectId;
  throw new Error("NOT_IMPLEMENTED");
}
