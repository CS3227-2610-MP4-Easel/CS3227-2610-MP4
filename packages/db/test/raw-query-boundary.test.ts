import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

test("E19 maintenance capability is not exported through request-facing DB client", async () => {
  const client = await readFile(new URL("../src/client.ts", import.meta.url), "utf8");
  const maintenance = await readFile(new URL("../src/maintenance.ts", import.meta.url), "utf8");
  assert.doesNotMatch(client, /queryRaw|executeRaw/);
  assert.match(maintenance, /unique symbol/);
  assert.doesNotMatch(client, /maintenance/);
});
