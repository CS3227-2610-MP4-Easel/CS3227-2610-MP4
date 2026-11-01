import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const root = new URL("../", import.meta.url);
const expectedPackages = [
  "@agile/contracts",
  "@agile/db",
  "@agile/api",
  "@agile/llm-gateway",
  "@agile/web",
];

test("F1/E15 workspace declares every W1 package boundary", async () => {
  const manifest = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
  assert.deepEqual(manifest.workspaces, ["apps/*", "packages/*"]);

  for (const packageName of expectedPackages) {
    const packagePath = packageName === "@agile/web"
      ? new URL("apps/web/package.json", root)
      : new URL(`packages/${packageName.slice("@agile/".length)}/package.json`, root);
    const packageManifest = JSON.parse(await readFile(packagePath, "utf8"));
    assert.equal(packageManifest.name, packageName);
  }
});

test("F1 root scripts expose test and typecheck commands", async () => {
  const manifest = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
  assert.equal(typeof manifest.scripts?.test, "string");
  assert.equal(typeof manifest.scripts?.typecheck, "string");
});
