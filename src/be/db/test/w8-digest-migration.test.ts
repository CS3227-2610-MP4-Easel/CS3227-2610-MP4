import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Client } from "pg";

const url = process.env.W1_INTEGRATION_DATABASE_URL;
const expandFile = new URL("../prisma/migrations/20261109000001_project_digest_facts_as_of_expand/migration.sql", import.meta.url);
const contractFile = new URL("../prisma/migrations/20261109000002_project_digest_facts_as_of_contract/migration.sql", import.meta.url);

function scopedSql(sql: string, table: string): string {
  return sql
    .replaceAll('"project_digests"', `"${table}"`)
    .replaceAll('"project_digests_facts_as_of_compat"', `"${table}_compat"`)
    .replaceAll('"project_digests_facts_as_of_compat_trigger"', `"${table}_compat_trigger"`)
    .replaceAll('"project_digests_project_id_facts_as_of_created_at_id_idx"', `"${table}_latest_idx"`);
}

test("W8 migration executes an atomic fail-closed backfill and indexed contract", { skip: !url }, async () => {
  const client = new Client({ connectionString: url });
  const table = `w8_digest_${randomUUID().replaceAll("-", "")}`;
  await client.connect();
  try {
    await client.query(`CREATE TABLE "${table}" (id uuid PRIMARY KEY, project_id uuid NOT NULL, facts jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`);
    await client.query(`INSERT INTO "${table}" (id, project_id, facts) VALUES ($1, $2, $3), ($4, $2, $5)`, [randomUUID(), randomUUID(), { asOf: "2026-11-09T00:00:00.000Z" }, randomUUID(), { asOf: "2026-11-09T00:00:00" }]);
    const expand = scopedSql(await readFile(expandFile, "utf8"), table);
    await assert.rejects(client.query(expand), /valid instant|facts\.asOf/i);
    const absent = await client.query(`SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = 'facts_as_of'`, [table]);
    assert.equal(absent.rowCount, 0);

    await client.query(`DELETE FROM "${table}" WHERE facts->>'asOf' = '2026-11-09T00:00:00'`);
    await client.query(expand);
    const row = await client.query(`SELECT facts_as_of FROM "${table}"`);
    assert.equal(row.rowCount, 1);
    assert.equal(new Date(row.rows[0].facts_as_of).toISOString(), "2026-11-09T00:00:00.000Z");
    const index = await client.query(`SELECT indexdef FROM pg_indexes WHERE tablename = $1`, [table]);
    assert.match(index.rows.find((entry) => entry.indexdef.includes("latest_idx"))?.indexdef ?? "", /project_id.*facts_as_of DESC.*created_at DESC.*id DESC/i);

    await client.query(scopedSql(await readFile(contractFile, "utf8"), table));
    const constraint = await client.query(`SELECT is_nullable FROM information_schema.columns WHERE table_name = $1 AND column_name = 'facts_as_of'`, [table]);
    assert.equal(constraint.rows[0].is_nullable, "NO");
  } finally {
    await client.query(`DROP TABLE IF EXISTS "${table}" CASCADE`);
    await client.end();
  }
});
