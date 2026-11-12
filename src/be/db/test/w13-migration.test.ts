import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { buildMigrationCommand, runProductionMigration, runProductionMigrationCli, validateMigrationInputs, validateMigrationManifest } from "../../../../scripts/w13/migrate-production.mjs";
import { validateRecoveryEvidence } from "../../../../scripts/w13/recovery-evidence.mjs";

const RUNBOOK = new URL("../../../../docs/operations/w13-deployment.md", import.meta.url);
const WORKFLOW = new URL("../../../../.github/workflows/w13-production.yml", import.meta.url);
const VERCEL_CONFIG = new URL("../../../../vercel.json", import.meta.url);

const env = { APP_TIER: "prod", DIRECT_DATABASE_URL: "postgresql://user:password@ep-summer-heart-b3767eul.c-4.ap-southeast-1.aws.neon.tech/neondb", NEON_HOST: "ep-summer-heart-b3767eul-pooler.c-4.ap-southeast-1.aws.neon.tech", NEON_PROJECT: "super-sunset-36592949", DATABASE_URL: "postgresql://user:password@ep-summer-heart-b3767eul-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb", VERCEL_TOKEN: "must-not-pass" };

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
  assert.throws(() => validateMigrationInputs({ ...env, DIRECT_DATABASE_URL: env.DATABASE_URL }), /target|observations/i);
  assert.throws(() => validateMigrationInputs({ ...env, NEON_HOST: undefined }), /target|observations/i);
  assert.deepEqual(buildMigrationCommand(), ["npm", "--workspace", "@agile/db", "exec", "prisma", "migrate", "deploy", "--", "--schema", "prisma/schema.prisma"]);
});

test("E7/E10 production migration is wrapper-only and the runbook is CI-only", async () => {
  const runbook = await readFile(RUNBOOK, "utf8");
  const workflow = await readFile(WORKFLOW, "utf8");
  const vercel = JSON.parse(await readFile(VERCEL_CONFIG, "utf8"));
  assert.match(runbook, /node --import tsx scripts\/w13\/migrate-production\.mjs/);
  assert.match(runbook, /Production Branch auto-deploy for `main`/);
  assert.match(runbook, /redacted setting evidence/);
  assert.match(runbook, /protected `production` Environment/);
  assert.doesNotMatch(runbook, /prisma\s+migrate\s+deploy/i);
  assert.doesNotMatch(runbook, /DIRECT_DATABASE_URL.*(?:postgres|neon\.tech)/i);
  assert.match(workflow, /node --import tsx scripts\/w13\/migrate-production\.mjs/);
  assert.doesNotMatch(workflow, /npm\s+--workspace\s+@agile\/db\s+exec\s+prisma\s+migrate\s+deploy/i);
  assert.deepEqual(vercel, {
    $schema: "https://openapi.vercel.sh/vercel.json",
    git: { deploymentEnabled: { main: false } },
  });
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
  assert.equal(calls[0].options.env.VERCEL_DEPLOY_HOOK_URL, undefined);
  assert.deepEqual(Object.keys(calls[0].options.env).sort(), ["CI", "DATABASE_URL", "HOME", "NODE_ENV", "PATH", "npm_config_cache", "npm_config_user_agent"].filter((key) => calls[0].options.env[key] !== undefined).sort());
});

test("E4 target, manifest, and checksum failures invoke no executor", async () => {
  let calls = 0;
  await assert.rejects(runProductionMigration({ ...env, APP_TIER: "dev" }, process.cwd(), async () => {
    calls += 1;
    return { stdout: "", stderr: "" };
  }), /APP_TIER/);
  assert.equal(calls, 0);

  const root = await mkdtemp(join(tmpdir(), "w13-migration-"));
  try {
    const migration = join(root, "src/be/db/prisma/migrations/00000000000000_init");
    const manifest = join(root, "workflow/deployment");
    await mkdir(migration, { recursive: true });
    await mkdir(manifest, { recursive: true });
    await writeFile(join(migration, "migration.sql"), "SELECT 1;\n");
    await writeFile(join(manifest, "migrations.manifest"), "not-a-migration\n");
    await assert.rejects(runProductionMigration(env, root, async () => {
      calls += 1;
      return { stdout: "", stderr: "" };
    }), /manifest/);
    assert.equal(calls, 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("E4 executor failure prevents a successful migration outcome", async () => {
  let calls = 0;
  await assert.rejects(runProductionMigration(env, process.cwd(), async () => {
    calls += 1;
    throw new Error("migration command failed");
  }), /migration command failed/);
  assert.equal(calls, 1);
});

test("production migration CLI redacts executor failures", async () => {
  const secret = "postgresql://user:password@host.example/secret";
  const output: string[] = [];
  const exitCode = await runProductionMigrationCli({
    env: { ...env, GITHUB_ACTIONS: "true" },
    executor: async () => { throw Object.assign(new Error(secret), { stderr: secret }); },
    writeError: (message: string) => output.push(message),
  });
  assert.equal(exitCode, 1);
  assert.deepEqual(output, ["production migration failed"]);
  assert.doesNotMatch(output.join("\n"), /postgresql|password|secret/);
});

test("production migration CLI rejects direct local invocation", () => {
  const result = spawnSync(process.execPath, ["--import", "tsx", new URL("../../../../scripts/w13/migrate-production.mjs", import.meta.url).pathname], {
    env: { ...process.env, GITHUB_ACTIONS: "false" },
    encoding: "utf8",
  });
  assert.equal(result.status, 1);
  assert.equal(result.stderr.trim(), "production migration CLI is available only in GitHub Actions");
});

test("wrong migration checksum rejects before invoking Prisma", async () => {
  const root = await mkdtemp(join(tmpdir(), "w13-migration-"));
  let calls = 0;
  try {
    const migration = join(root, "src/be/db/prisma/migrations/00000000000000_init");
    const manifest = join(root, "workflow/deployment");
    await mkdir(migration, { recursive: true });
    await mkdir(manifest, { recursive: true });
    await writeFile(join(migration, "migration.sql"), "SELECT 1;\n");
    await writeFile(join(manifest, "migrations.manifest"), `00000000000000_init/migration.sql ${"0".repeat(64)}\n`);
    await assert.rejects(runProductionMigration(env, root, async () => {
      calls += 1;
      return { stdout: "", stderr: "" };
    }), /checksum/);
    assert.equal(calls, 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
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
