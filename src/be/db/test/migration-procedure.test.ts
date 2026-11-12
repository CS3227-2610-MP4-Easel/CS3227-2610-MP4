import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const migration = new URL("../prisma/migrations/00000000000000_init/migration.sql", import.meta.url);
const recovery = new URL("../../../../docs/operations/database-recovery.md", import.meta.url);
const expand = new URL("../prisma/migrations/20261109000001_project_digest_facts_as_of_expand/migration.sql", import.meta.url);
const contract = new URL("../prisma/migrations/20261109000002_project_digest_facts_as_of_contract/migration.sql", import.meta.url);

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

test("W8 factsAsOf migrations are expand/contract, validated, and reversible", async () => {
  const expandSql = await readFile(expand, "utf8");
  const contractSql = await readFile(contract, "utf8");
  assert.match(expandSql, /ADD COLUMN .*facts_as_of.*TIMESTAMPTZ/i);
  assert.match(expandSql, /facts.*asOf|facts.*as_of/i);
  assert.match(expandSql, /\[Zz\].*\[0-9\]\{2\}:\[0-9\]\{2\}/);
  assert.match(expandSql, /CREATE TRIGGER .*facts_as_of_compat/i);
  assert.match(expandSql, /IF NEW\."facts_as_of" IS NULL/i);
  assert.match(expandSql, /RAISE EXCEPTION.*digest/i);
  assert.match(expandSql, /CREATE INDEX .*project_digests.*project_id.*facts_as_of.*created_at.*id/i);
  assert.doesNotMatch(expandSql, /DROP TABLE|DROP COLUMN/i);
  assert.match(contractSql, /SET NOT NULL/i);
  assert.match(contractSql, /facts_as_of/i);
  assert.doesNotMatch(contractSql, /DROP TABLE/i);
});
