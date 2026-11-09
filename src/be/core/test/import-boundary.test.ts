import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(async (entry) => entry.isDirectory() ? sourceFiles(join(directory, entry.name)) : entry.name.endsWith(".ts") ? [join(directory, entry.name)] : []))).flat();
}

test("core uses no raw SQL or maintenance database capability", async () => {
  for (const file of await sourceFiles(join(dirname(fileURLToPath(import.meta.url)), "..", "src"))) {
    const source = await readFile(file, "utf8");
    assert.doesNotMatch(source, /\$queryRaw|\$executeRaw|maintenance/);
  }
});
