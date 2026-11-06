import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { buildMigrationCommand, validateMigrationInputs, validateMigrationManifest } from "../../../../scripts/w13/migrate-production.mjs";
import { validateRecoveryEvidence } from "../../../../scripts/w13/recovery-evidence.mjs";

test("E5 migration manifest matches the committed migration checksum", async () => {
  const sql = await readFile(new URL("../prisma/migrations/00000000000000_init/migration.sql", import.meta.url));
  const checksum = createHash("sha256").update(sql).digest("hex");
  assert.equal(validateMigrationManifest([`00000000000000_init/migration.sql ${checksum}`], checksum), true);
});

test("E27/E36 migration inputs require a production direct target", () => {
  assert.doesNotThrow(() => validateMigrationInputs({ APP_TIER: "prod", DIRECT_DATABASE_URL: "postgresql://prod.example/db", NEON_HOST: "prod.neon.tech", NEON_PROJECT: "agile-platform-prod" }));
  assert.throws(() => validateMigrationInputs({ APP_TIER: "dev", DIRECT_DATABASE_URL: "postgresql://dev.example/db" }), /APP_TIER/);
  assert.throws(() => validateMigrationInputs({ APP_TIER: "prod", DIRECT_DATABASE_URL: "postgresql://dev.example/db", NEON_HOST: "dev.neon.tech", NEON_PROJECT: "agile-platform-dev" }), /NEON_HOST/);
  assert.deepEqual(buildMigrationCommand(), ["npm", "--workspace", "@agile/db", "exec", "prisma", "migrate", "deploy", "--", "--schema", "prisma/schema.prisma"]);
});

test("E22/E29/E40 recovery evidence enforces target and thresholds", () => {
  const good = { target: "restricted-rehearsal", backupReference: "neon-backup-1", migrationChecksum: "a".repeat(64), restoreStartedAt: "2026-02-01T00:00:00Z", restoreEndedAt: "2026-02-01T02:00:00Z", rpoHours: 12, rtoHours: 2, seedResult: "pass", owner: "owner", outcome: "pass" };
  assert.doesNotThrow(() => validateRecoveryEvidence(good));
  assert.throws(() => validateRecoveryEvidence({ ...good, target: "dev" }), /target/);
  assert.throws(() => validateRecoveryEvidence({ ...good, rpoHours: 25 }), /RPO/);
  assert.throws(() => validateRecoveryEvidence({ ...good, rtoHours: 5 }), /RTO/);
  assert.throws(() => validateRecoveryEvidence({ ...good, backupReference: "" }), /backupReference/);
});
