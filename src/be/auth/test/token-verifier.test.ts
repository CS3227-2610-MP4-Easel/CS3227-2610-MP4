import assert from "node:assert/strict";
import { test } from "node:test";
import { createFirebaseTokenVerifier, InvalidToken, VerifierUnavailable } from "../src/index.js";

const b64 = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
const now = Math.floor(Date.now() / 1000);
const claims = (overrides: Record<string, unknown> = {}) => ({ iss: "https://securetoken.google.com/w4-test", aud: "w4-test", sub: "uid-1", iat: now - 10, exp: now + 3600, auth_time: now - 10, email: "a@b.test", ...overrides });
const jwt = (header: Record<string, unknown>, body: Record<string, unknown>) => `${b64(header)}.${b64(body)}.${Buffer.from("sig").toString("base64url")}`;

test("E14 adapter drops role claim and passes checkRevoked false", async () => {
  const calls: Array<[string, boolean]> = [];
  const verifier = createFirebaseTokenVerifier("w4-test", async (token, checkRevoked) => { calls.push([token, checkRevoked]); return { uid: "uid-1", email: "a@b.test", role: "PM" } as { uid: string; email?: unknown }; });
  assert.deepEqual(await verifier.verify("tok"), { uid: "uid-1", email: "a@b.test" });
  assert.deepEqual(calls, [["tok", false]]);
});

test("E14 email that is absent, empty or not a string becomes null", async () => {
  for (const email of [undefined, "", 42]) {
    const verifier = createFirebaseTokenVerifier("w4-test", async () => ({ uid: "uid-1", email }));
    assert.deepEqual(await verifier.verify("tok"), { uid: "uid-1", email: null });
  }
});

test("E45 Firebase error mapping", async () => {
  const cases: Array<[unknown, new () => Error]> = [
    [Object.assign(new Error("x"), { code: "auth/id-token-expired" }), InvalidToken],
    [Object.assign(new Error("x"), { code: "auth/argument-error" }), InvalidToken],
    [Object.assign(new Error("x"), { code: "auth/internal-error" }), VerifierUnavailable],
    [Object.assign(new Error("x"), { code: "auth/some-new-code" }), InvalidToken],
    [new Error("plain"), VerifierUnavailable],
    // Observed with outbound HTTPS blocked: a public-key fetch failure arrives as auth/argument-error.
    [Object.assign(new Error("Error while making request: . Error code: EPERM"), { code: "auth/argument-error" }), VerifierUnavailable],
  ];
  for (const [error, expected] of cases) {
    const verifier = createFirebaseTokenVerifier("w4-test", async () => { throw error; });
    await assert.rejects(() => verifier.verify("tok"), expected);
  }
});

test("E36 real adapter rejects forged tokens offline", async () => {
  const verifier = createFirebaseTokenVerifier("w4-test");
  const forged = [
    jwt({ alg: "none", typ: "JWT" }, claims()),
    jwt({ alg: "RS256", kid: "k1", typ: "JWT" }, claims({ aud: "other-project" })),
    jwt({ alg: "RS256", kid: "k1", typ: "JWT" }, claims({ iss: "https://securetoken.google.com/other-project" })),
    "not.a-token",
  ];
  for (const token of forged) await assert.rejects(() => verifier.verify(token), InvalidToken);
});
