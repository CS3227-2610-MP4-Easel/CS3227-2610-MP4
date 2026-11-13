import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { execFile } from "node:child_process";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { validateDirectMigrationTarget } from "../../src/be/db/src/tier-targets.ts";

const execFileAsync = promisify(execFile);
const MIGRATIONS_ROOT = "src/be/db/prisma/migrations";
const MANIFEST = "workflow/deployment/migrations.manifest";

export function validateMigrationInputs(env) {
  if (env.APP_TIER !== "prod") throw new Error("APP_TIER must be prod");
  if (!env.DIRECT_DATABASE_URL) throw new Error("DIRECT_DATABASE_URL is required");
  validateDirectMigrationTarget(env, "prod");
}

export function buildMigrationCommand() {
  return ["npm", "--workspace", "@agile/db", "exec", "prisma", "migrate", "deploy", "--", "--schema", "prisma/schema.prisma"];
}

export function validateMigrationManifest(entries, expected) {
  if (typeof expected === "string") return entries.length === 1 && entries[0] === `00000000000000_init/migration.sql ${expected}`;
  const paths = entries.map((entry) => entry.path);
  return entries.length > 0
    && entries.every((entry) => /^[^\s]+ [0-9a-f]{64}$/.test(`${entry.path} ${entry.checksum}`))
    && new Set(paths).size === paths.length
    && paths.every((path, index) => index === 0 || paths[index - 1] < path)
    && new Set(expected).size === expected.length
    && paths.length === expected.length
    && paths.every((path) => expected.includes(path));
}

async function findMigrationFiles(directory, root = directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await findMigrationFiles(path, root));
    else if (entry.isFile() && entry.name === "migration.sql") files.push(relative(root, path).split(sep).join("/"));
  }
  return files.sort();
}

function childEnvironment(env, databaseUrl) {
  const allowed = ["PATH", "HOME", "NODE_ENV", "CI", "npm_config_user_agent", "npm_config_cache"];
  return Object.fromEntries([...allowed.filter((key) => env[key] !== undefined).map((key) => [key, env[key]]), ["DATABASE_URL", databaseUrl]]);
}

export async function runProductionMigration(env = process.env, root = process.cwd(), executor = async (file, args, options) => execFileAsync(file, args, options)) {
  validateMigrationInputs(env);
  const migrationsRoot = join(root, MIGRATIONS_ROOT);
  const migrationPaths = await findMigrationFiles(migrationsRoot);
  const manifestText = await readFile(join(root, MANIFEST), "utf8");
  const lines = manifestText.split("\n");
  if (lines.at(-1) === "") lines.pop();
  const entries = lines.map((line) => {
    const match = /^(\S+) ([0-9a-f]{64})$/.exec(line);
    if (!match) throw new Error("migration manifest is malformed");
    return { path: match[1], checksum: match[2] };
  });
  if (!validateMigrationManifest(entries, migrationPaths)) throw new Error("migration manifest does not match repository files");
  const checksums = [];
  for (const entry of entries) {
    const sql = await readFile(join(migrationsRoot, entry.path));
    const checksum = createHash("sha256").update(sql).digest("hex");
    if (checksum !== entry.checksum) throw new Error("migration checksum does not match manifest");
    checksums.push({ path: entry.path, checksum });
  }
  const directUrl = env.DIRECT_DATABASE_URL;
  const safeEnv = childEnvironment(env, directUrl);
  await executor("npm", ["--workspace", "@agile/db", "exec", "prisma", "validate", "--", "--schema", "prisma/schema.prisma"], { cwd: root, env: safeEnv });
  await executor("npm", buildMigrationCommand().slice(1), { cwd: root, env: safeEnv });
  return { migrations: checksums, outcome: "pass" };
}

export async function runProductionMigrationCli({ env = process.env, root = process.cwd(), executor, writeError = console.error } = {}) {
  if (env.GITHUB_ACTIONS !== "true") {
    writeError("production migration CLI is available only in GitHub Actions");
    return 1;
  }
  try {
    await runProductionMigration(env, root, executor);
    return 0;
  } catch {
    writeError("production migration failed");
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runProductionMigrationCli().then((exitCode) => { process.exitCode = exitCode; });
}
