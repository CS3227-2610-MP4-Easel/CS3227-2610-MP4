import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { createDbClient } from "@agile/db";
import { AlreadyRegistered, createResolvePrincipal, createUser, getUser, type NewUser } from "../src/index.js";

const url = process.env.W1_INTEGRATION_DATABASE_URL;

async function withDb(run: (db: ReturnType<typeof createDbClient>, newUser: (overrides?: Partial<NewUser>) => NewUser) => Promise<void>) {
  const base = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  const tag = randomUUID();
  const newUser = (overrides: Partial<NewUser> = {}): NewUser => ({ firebaseUid: `${tag}-${randomUUID()}`, email: `${randomUUID()}@${tag}.test`, displayName: "Dev", role: "DEVELOPER", ...overrides });
  try { await run(createDbClient(base), newUser); } finally { await base.user.deleteMany({ where: { OR: [{ firebaseUid: { startsWith: tag } }, { email: { endsWith: `@${tag}.test` } }] } }); await base.$disconnect(); }
}
const settled = (results: PromiseSettledResult<unknown>[]) => ({
  created: results.filter((r) => r.status === "fulfilled").length,
  duplicates: results.filter((r) => r.status === "rejected" && r.reason instanceof AlreadyRegistered).length,
});

test("E22 concurrent registers give one 201 and one 409", { skip: !url }, () => withDb(async (db, newUser) => {
  const sameUid = newUser();
  assert.deepEqual(settled(await Promise.allSettled([createUser(db, sameUid), createUser(db, { ...sameUid, email: newUser().email })])), { created: 1, duplicates: 1 });
  const sameEmail = newUser();
  assert.deepEqual(settled(await Promise.allSettled([createUser(db, sameEmail), createUser(db, { ...sameEmail, firebaseUid: newUser().firebaseUid })])), { created: 1, duplicates: 1 });
  assert.equal(await db.user.count({ where: { email: sameEmail.email } }), 1);
}));

test("E23 email in another case is 409", { skip: !url }, () => withDb(async (db, newUser) => {
  const first = newUser();
  await createUser(db, first);
  // The email reaches createUser through resolvePrincipal, which lowercases it.
  const resolve = createResolvePrincipal({ verify: async () => ({ uid: newUser().firebaseUid, email: first.email.toUpperCase() }) });
  const principal = await resolve("Bearer t");
  await assert.rejects(createUser(db, { ...newUser(), firebaseUid: principal.firebaseUid, email: String(principal.tokenClaims.email) }), AlreadyRegistered);
  assert.equal(await db.user.count({ where: { email: first.email } }), 1);
}));

test("E26 same uid again is 409 and row unchanged", { skip: !url }, () => withDb(async (db, newUser) => {
  const first = newUser();
  const created = await createUser(db, first);
  await assert.rejects(createUser(db, { ...first, role: "PM", displayName: "Changed" }), AlreadyRegistered);
  assert.deepEqual(await getUser(db, created.id), created);
}));

test("E41 email stored lowercased", { skip: !url }, () => withDb(async (db, newUser) => {
  const email = newUser().email.replace(/^./, "F").replace("@", "@X");
  const resolve = createResolvePrincipal({ verify: async () => ({ uid: newUser().firebaseUid, email }) });
  const principal = await resolve("Bearer t");
  const created = await createUser(db, newUser({ firebaseUid: principal.firebaseUid, email: String(principal.tokenClaims.email) }));
  assert.equal(created.email, email.toLowerCase());
  assert.equal((await getUser(db, created.id)).email, email.toLowerCase());
}));
