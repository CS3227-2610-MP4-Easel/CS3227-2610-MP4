import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await sourceFiles(path));
    else if (entry.name.endsWith(".ts")) files.push(path);
  }
  return files;
}

test("AD-01b/N4/E19 request-facing sources do not import Prisma or raw SQL", async () => {
  const web = await sourceFiles(join(process.cwd(), "apps/web"));
  const api = await sourceFiles(join(process.cwd(), "packages/api/src"));
  for (const file of [...web, ...api]) {
    const source = await readFile(file, "utf8");
    assert.doesNotMatch(source, /@prisma\/client|packages\/db|\$queryRaw|\$executeRaw/);
  }
});
