import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { PrismaClient } from "@prisma/client";
import { createDbClient } from "../src/client.js";

test("E19 maintenance capability is not exported through request-facing DB client", async () => {
  const client = await readFile(new URL("../src/client.ts", import.meta.url), "utf8");
  const maintenance = await readFile(new URL("../src/maintenance.ts", import.meta.url), "utf8");
  assert.match(client, /Omit<PrismaClient, RawSqlMethodName>/);
  assert.match(maintenance, /unique symbol/);
  assert.doesNotMatch(client, /maintenance/);
});

test("E19 request-facing DB client hides Prisma raw SQL methods at runtime", async () => {
  const base = new PrismaClient();
  const client = createDbClient(base) as Record<string, unknown>;
  assert.equal(client.$queryRaw, undefined);
  assert.equal(client.$queryRawUnsafe, undefined);
  assert.equal(client.$executeRaw, undefined);
  assert.equal(client.$executeRawUnsafe, undefined);
  await base.$disconnect();
});
