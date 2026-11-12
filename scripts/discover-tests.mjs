import { readdir } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

async function walk(root, directory = root) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(root, path));
    else if (entry.isFile() && entry.name.endsWith(".test.ts")) files.push(relative(root, path).replaceAll(sep, "/"));
  }
  return files;
}

export async function discoverTests(root = ".") {
  const files = [];
  for (const directory of ["tests", "src/be"]) {
    files.push(...await walk(root, join(root, directory)));
  }
  return files.sort();
}

export function buildTestRuns(files) {
  const security = files.filter((file) => file.startsWith("tests/security/"));
  const regular = files.filter((file) => !file.startsWith("tests/security/"));
  const setup = (includeNetworkDeny) => [
    "./tests/setup-auth-env.ts",
    ...(includeNetworkDeny ? ["./tests/security/w11-network-deny.setup.ts"] : []),
  ];
  return [
    regular.length === 0 ? null : { files: regular, setup: setup(false) },
    security.length === 0 ? null : { files: security, setup: setup(true) },
  ].filter(Boolean);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  discoverTests(process.cwd()).then((files) => {
    for (const run of buildTestRuns(files)) {
      const result = spawnSync(process.execPath, ["--import", "tsx", ...run.setup.flatMap((module) => ["--import", module]), "--test", ...run.files], { stdio: "inherit" });
      if (result.status !== 0) { process.exitCode = result.status ?? 1; return; }
    }
    process.exitCode = 0;
  }).catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
