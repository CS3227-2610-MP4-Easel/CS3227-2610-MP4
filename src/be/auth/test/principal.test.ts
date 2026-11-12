import assert from "node:assert/strict";
import { test } from "node:test";
import type { FilteredDbClient } from "@agile/db";
import { createLookupRegisteredUser, createLookupUserByEmail, createLookupUserRole, createResolvePrincipal, InvalidToken, VerifierUnavailable, type TokenVerifier } from "../src/index.js";

const verifier = (result: () => Promise<{ uid: string; email: string | null }>) => {
  const seen: string[] = [];
  const v: TokenVerifier = { verify: async (token) => { seen.push(token); return result(); } };
  return { v, seen };
};
const unauthenticated = { message: "UNAUTHENTICATED" };

test("E1 rejects malformed Authorization without calling the verifier", async () => {
  const { v, seen } = verifier(async () => ({ uid: "u", email: "a@b.test" }));
  const resolve = createResolvePrincipal(v);
  for (const header of [undefined, "Basic abc", "Bearer ", "Bearer", "Bearer a, Bearer b", `Bearer ${"x".repeat(4097)}`, `Bearer ${"é".repeat(2049)}`]) await assert.rejects(() => resolve(header), unauthenticated);
  assert.equal(seen.length, 0);
  await resolve("bearer   abc");
  await resolve(`Bearer ${"y".repeat(4096)}`);
  assert.deepEqual(seen, ["abc", "y".repeat(4096)]);
});

test("E3 missing or non-string email is UNAUTHENTICATED", async () => {
  const { v } = verifier(async () => ({ uid: "u", email: null }));
  await assert.rejects(() => createResolvePrincipal(v)("Bearer abc"), unauthenticated);
});

test("resolvePrincipal lowercases the email and maps verifier errors", async () => {
  assert.deepEqual(await createResolvePrincipal(verifier(async () => ({ uid: "u", email: "Foo@X.com" })).v)("Bearer abc"), { firebaseUid: "u", tokenClaims: { email: "foo@x.com" } });
  await assert.rejects(() => createResolvePrincipal(verifier(async () => { throw new InvalidToken(); }).v)("Bearer abc"), unauthenticated);
  await assert.rejects(() => createResolvePrincipal(verifier(async () => { throw new VerifierUnavailable(); }).v)("Bearer abc"), VerifierUnavailable);
});

test("E6 principal role is the stored role", async () => {
  const db = { user: { findUnique: async ({ where }: { where: { firebaseUid: string } }) => (where.firebaseUid === "known" ? { id: "user-1", role: "DEV_LEAD" } : null) } } as unknown as FilteredDbClient;
  const lookup = createLookupRegisteredUser(db);
  assert.deepEqual(await lookup("known"), { firebaseUid: "known", userId: "user-1", role: "DEV_LEAD" });
  await assert.rejects(() => lookup("unknown"), { message: "USER_NOT_REGISTERED" });
});

test("user directory lookups normalize email and obtain role from storage", async () => {
  const db = { user: { findFirst: async ({ where }: { where: { email?: string; id?: string } }) => {
    if (where.email === "lead@example.test") return { id: "user-1" };
    if (where.id === "user-1") return { role: "DEV_LEAD" };
    return null;
  } } } as unknown as FilteredDbClient;
  assert.deepEqual(await createLookupUserByEmail(db)(" Lead@Example.Test "), { userId: "user-1" });
  assert.equal(await createLookupUserRole(db)("user-1"), "DEV_LEAD");
  assert.equal(await createLookupUserRole(db)("unknown"), null);
});
