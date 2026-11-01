import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const migration = new URL("../prisma/migrations/00000000000000_init/migration.sql", import.meta.url);
const recovery = new URL("../../../docs/operations/database-recovery.md", import.meta.url);

test("F9/E14 initial migration is forward-only and contains project constraints", async () => {
  const sql = await readFile(migration, "utf8");
  assert.match(sql, /CREATE TABLE "projects"/i);
  assert.match(sql, /CREATE TABLE "tasks"/i);
  assert.match(sql, /CREATE UNIQUE INDEX .*\("project_id", "id"\)/i);
  assert.doesNotMatch(sql, /DROP TABLE|DROP COLUMN|ALTER TABLE .* DROP/i);
});

test("E20 recovery procedure records compatibility and recovery targets", async () => {
  const guide = await readFile(recovery, "utf8");
  assert.match(guide, /24-hour recovery-point/i);
  assert.match(guide, /4-hour recovery-time/i);
  assert.match(guide, /migrate deploy/i);
  assert.match(guide, /previous application/i);
  assert.match(guide, /protected/i);
});
