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

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  discoverTests(process.cwd()).then((files) => {
    const result = spawnSync(process.execPath, ["--import", "tsx", "--import", "./tests/setup-auth-env.ts", "--test", ...files], { stdio: "inherit" });
    process.exitCode = result.status ?? 1;
  }).catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
