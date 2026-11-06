import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);
const MIGRATION = "00000000000000_init/migration.sql";

export function validateMigrationInputs(env) {
  if (env.APP_TIER !== "prod") throw new Error("APP_TIER must be prod");
  if (!env.DIRECT_DATABASE_URL) throw new Error("DIRECT_DATABASE_URL is required");
  if (env.NEON_HOST !== "prod.neon.tech") throw new Error("NEON_HOST does not match prod");
  if (env.NEON_PROJECT !== "agile-platform-prod") throw new Error("NEON_PROJECT does not match prod");
}

export function buildMigrationCommand() {
  return ["npm", "--workspace", "@agile/db", "exec", "prisma", "migrate", "deploy", "--", "--schema", "prisma/schema.prisma"];
}

export function validateMigrationManifest(entries, expectedChecksum) {
  return entries.length === 1 && entries[0] === `${MIGRATION} ${expectedChecksum}`;
}

export async function runProductionMigration(env = process.env, root = process.cwd()) {
  validateMigrationInputs(env);
  const sql = await readFile(`${root}/src/be/db/prisma/migrations/${MIGRATION}`);
  const checksum = createHash("sha256").update(sql).digest("hex");
  const directEnv = { ...env, DATABASE_URL: env.DIRECT_DATABASE_URL };
  try {
    await exec("npm", ["--workspace", "@agile/db", "exec", "prisma", "validate", "--", "--schema", "prisma/schema.prisma"], { cwd: root, env: directEnv });
    await exec("npm", buildMigrationCommand().slice(1), { cwd: root, env: directEnv });
    return { migration: MIGRATION, checksum, outcome: "pass" };
  } finally {
    delete directEnv.DATABASE_URL;
  }
}
