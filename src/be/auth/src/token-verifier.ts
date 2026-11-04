import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

export class InvalidToken extends Error { constructor() { super("InvalidToken"); this.name = "InvalidToken"; } }
export class VerifierUnavailable extends Error { constructor() { super("VerifierUnavailable"); this.name = "VerifierUnavailable"; } }

/** `email` is the claim when it is a non-empty string, else null; no other claim leaves the adapter. */
export type TokenVerifier = { verify(token: string): Promise<{ uid: string; email: string | null }> };
export type VerifyIdToken = (token: string, checkRevoked: boolean) => Promise<{ uid: string; email?: unknown }>;

/** Production adapter: `firebase-admin` `verifyIdToken(token, false)`, initialised from the project id only.
 * `checkRevoked` is false because AD-57 is kept (spec SD3). Tests pass `verifyIdToken` to stub the SDK. */
export function createFirebaseTokenVerifier(firebaseProjectId: string, verifyIdToken: VerifyIdToken = firebaseVerifyIdToken(firebaseProjectId)): TokenVerifier {
  return {
    async verify(token) {
      let decoded: { uid: string; email?: unknown };
      try { decoded = await verifyIdToken(token, false); } catch (error) {
        const { code, message } = error as { code?: unknown; message?: unknown };
        // firebase-admin reports a failed public-key fetch as auth/argument-error too; only its message tells an outage from a bad token.
        const keyFetchFailed = code === "auth/argument-error" && typeof message === "string" && message.startsWith("Error while making request");
        if (typeof code === "string" && code.startsWith("auth/") && code !== "auth/internal-error" && !keyFetchFailed) throw new InvalidToken();
        throw new VerifierUnavailable();
      }
      return { uid: decoded.uid, email: typeof decoded.email === "string" && decoded.email !== "" ? decoded.email : null };
    },
  };
}

function firebaseVerifyIdToken(projectId: string): VerifyIdToken {
  const name = `w4-auth-${projectId}`;
  const app = getApps().find((a) => a.name === name) ?? initializeApp({ projectId }, name);
  return (token, checkRevoked) => getAuth(app).verifyIdToken(token, checkRevoked);
}
