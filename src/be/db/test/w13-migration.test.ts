import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { buildMigrationCommand, runProductionMigration, validateMigrationInputs, validateMigrationManifest } from "../../../../scripts/w13/migrate-production.mjs";
import { validateRecoveryEvidence } from "../../../../scripts/w13/recovery-evidence.mjs";

const env = { APP_TIER: "prod", DIRECT_DATABASE_URL: "postgresql://user:password@ep-summer-heart-b3767eul-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb", NEON_HOST: "ep-summer-heart-b3767eul-pooler.c-4.ap-southeast-1.aws.neon.tech", NEON_PROJECT: "super-sunset-36592949", DATABASE_URL: "postgresql://user:password@ep-summer-heart-b3767eul-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb", VERCEL_TOKEN: "must-not-pass" };

test("E8/E18/E24 manifest matches every committed migration checksum", async () => {
  const sql = await readFile(new URL("../prisma/migrations/00000000000000_init/migration.sql", import.meta.url));
  const checksum = createHash("sha256").update(sql).digest("hex");
  const entry = { path: "00000000000000_init/migration.sql", checksum };
  assert.equal(validateMigrationManifest([entry], [entry.path]), true);
  assert.equal(validateMigrationManifest([], [entry.path]), false);
  assert.equal(validateMigrationManifest([entry, entry], [entry.path]), false);
  assert.equal(validateMigrationManifest([{ ...entry, checksum: "0".repeat(64) }], [entry.path]), true);
});

test("E17/E28 direct migration inputs require the canonical production target", () => {
  assert.doesNotThrow(() => validateMigrationInputs(env));
  assert.throws(() => validateMigrationInputs({ ...env, APP_TIER: "dev" }), /APP_TIER/);
  assert.throws(() => validateMigrationInputs({ ...env, DIRECT_DATABASE_URL: "postgresql://user:password@ep-fragrant-union-aod4nxjd-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb", NEON_HOST: "ep-fragrant-union-aod4nxjd-pooler.c-2.ap-southeast-1.aws.neon.tech", NEON_PROJECT: "super-sunset-36592949" }), /target|observations/i);
  assert.deepEqual(buildMigrationCommand(), ["npm", "--workspace", "@agile/db", "exec", "prisma", "migrate", "deploy", "--", "--schema", "prisma/schema.prisma"]);
});

test("E9/E29 executor sees validation then deploy with an allowlisted environment", async () => {
  const calls: Array<{ file: string; args: string[]; options: { env: Record<string, string | undefined> } }> = [];
  const result = await runProductionMigration(env, process.cwd(), async (file, args, options) => {
    calls.push({ file, args, options });
    return { stdout: "", stderr: "" };
  });
  assert.equal(result.outcome, "pass");
  assert.equal(calls.length, 2);
  assert.match(calls[0].args.join(" "), /prisma validate/);
  assert.match(calls[1].args.join(" "), /migrate deploy/);
  assert.equal(calls[0].options.env.DATABASE_URL, env.DIRECT_DATABASE_URL);
  assert.equal(calls[0].options.env.DIRECT_DATABASE_URL, undefined);
  assert.equal(calls[0].options.env.VERCEL_TOKEN, undefined);
});

test("E12/E25 migration failures do not expose credential values", async () => {
  await assert.rejects(runProductionMigration({ ...env, DIRECT_DATABASE_URL: "postgresql://wrong.neon.tech/secret_database" }, process.cwd(), async () => ({ stdout: "", stderr: "" })), /target|observations/i);
});

test("E22/E29 recovery evidence enforces target and thresholds", () => {
  const good = { target: "restricted-rehearsal", backupReference: "neon-backup-1", migrationChecksum: "a".repeat(64), restoreStartedAt: "2026-02-01T00:00:00Z", restoreEndedAt: "2026-02-01T02:00:00Z", rpoHours: 12, rtoHours: 2, seedResult: "pass", owner: "owner", outcome: "pass" };
  assert.doesNotThrow(() => validateRecoveryEvidence(good));
  assert.throws(() => validateRecoveryEvidence({ ...good, target: "dev" }), /target/);
  assert.throws(() => validateRecoveryEvidence({ ...good, rpoHours: 25 }), /RPO/);
  assert.throws(() => validateRecoveryEvidence({ ...good, rtoHours: 5 }), /RTO/);
  assert.throws(() => validateRecoveryEvidence({ ...good, backupReference: "" }), /backupReference/);
});
