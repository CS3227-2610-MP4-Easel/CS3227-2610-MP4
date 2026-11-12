import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { createDbClient } from "../src/client.js";

function newTestPrismaClient() {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "postgresql://localhost:5432/agile_platform" }) });
}

test("E19 maintenance capability is not exported through request-facing DB client", async () => {
  const client = await readFile(new URL("../src/client.ts", import.meta.url), "utf8");
  const maintenance = await readFile(new URL("../src/maintenance.ts", import.meta.url), "utf8");
  assert.match(client, /Omit<PrismaClient, RawSqlMethodName \| "\$transaction">/);
  assert.match(maintenance, /unique symbol/);
  assert.doesNotMatch(client, /maintenance/);
});

test("E19 request-facing DB client hides Prisma raw SQL methods at runtime", async () => {
  const base = newTestPrismaClient();
  const client = createDbClient(base) as Record<string, unknown>;
  assert.equal(client.$queryRaw, undefined);
  assert.equal(client.$queryRawUnsafe, undefined);
  assert.equal(client.$executeRaw, undefined);
  assert.equal(client.$executeRawUnsafe, undefined);
  await base.$disconnect();
});

test("interactive transaction clients hide raw SQL methods", async () => {
  const fake = { $extends: () => ({ $transaction: async (callback: (tx: object) => Promise<unknown>) => callback({ $queryRaw: () => [], $executeRaw: () => 1 }) }) };
  const client = createDbClient(fake as never);
  await client.$transaction(async (tx) => {
    assert.equal((tx as any).$queryRaw, undefined);
    assert.equal((tx as any).$executeRaw, undefined);
  });
});

test("request-facing clients cannot create an unprotected extension", async () => {
  const base = newTestPrismaClient();
  const client = createDbClient(base);
  assert.equal((client as any).$extends, undefined);
  await base.$disconnect();
});


test('maintenance repair fails explicitly', async () => {
  const { withMaintenanceRead } = await import('../src/maintenance.js');
  await assert.rejects(() => withMaintenanceRead({} as never, (db) => db.executeRepair('repair')), /NOT_IMPLEMENTED/);
});
