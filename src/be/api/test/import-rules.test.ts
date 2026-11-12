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
  const web = await sourceFiles(join(process.cwd(), "src/fe"));
  const api = await sourceFiles(join(process.cwd(), "src/be/api/src"));
  for (const file of [...web, ...api]) {
    const source = await readFile(file, "utf8");
    assert.doesNotMatch(source, /@prisma\/client|@agile\/db|\$queryRaw|\$executeRaw/);
    assert.doesNotMatch(source, /(?:\.\.\/|\.\/)[^\n"']*(?:\/db\/|\/prisma\/)/);
  }
});

test("E19 production composition owns core assembly and its required context-source registration", async () => {
  const source = await readFile(join(process.cwd(), "src/be/api/src/core-composition.ts"), "utf8");
  assert.match(source, /registerCore\(core\);/);
  assert.match(source, /registerCoreContextSources\(db as never, registerContextSource\);/);
  assert.ok(source.indexOf("registerCore(core)") < source.lastIndexOf("registerCoreContextSources"));
});
