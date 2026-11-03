import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const root = new URL("../", import.meta.url);
const expectedPackages = [
  "@agile/contracts",
  "@agile/db",
  "@agile/api",
  "@agile/llm-gateway",
  "easel-fe",
];

const expectedBackendMetadata = {
  "@agile/contracts": "contracts",
  "@agile/db": "db",
  "@agile/api": "api",
  "@agile/llm-gateway": "llm-gateway",
};

test("F1/E15 workspace declares every W1 package boundary", async () => {
  const manifest = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
  assert.deepEqual(manifest.workspaces, ["src/fe", "src/be/*"]);

  for (const packageName of expectedPackages) {
    const packagePath = packageName === "easel-fe"
      ? new URL("src/fe/package.json", root)
      : new URL(`src/be/${packageName.slice("@agile/".length)}/package.json`, root);
    const packageManifest = JSON.parse(await readFile(packagePath, "utf8"));
    assert.equal(packageManifest.name, packageName);
    if (packageName in expectedBackendMetadata) {
      assert.equal(packageManifest.main, "dist/index.js");
      assert.equal(packageManifest.types, "dist/index.d.ts");
      assert.equal(packageManifest.exports?.["."], "./src/index.ts");
    }
  }
});

test("F1 root scripts expose test and typecheck commands", async () => {
  const manifest = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
  assert.equal(typeof manifest.scripts?.test, "string");
  assert.equal(typeof manifest.scripts?.typecheck, "string");
});

test("F1 clean installs generate Prisma Client before workspace tests", async () => {
  const rootManifest = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
  const dbManifest = JSON.parse(await readFile(new URL("src/be/db/package.json", root), "utf8"));
  assert.match(rootManifest.scripts?.pretest ?? "", /@agile\/db.*prisma:generate/);
  assert.match(dbManifest.scripts?.["prisma:generate"] ?? "", /prisma generate/);
});

test("F1/E7 public package entrypoints resolve for all backend consumers", async () => {
  const contracts = await import("@agile/contracts");
  const api = await import("@agile/api");
  const db = await import("@agile/db");
  const gateway = await import("@agile/llm-gateway");
  assert.equal(typeof contracts.ProjectDetailSchema, "object");
  assert.equal(typeof api.createApiApp, "function");
  assert.equal(typeof api.apiApp, "object");
  assert.equal(typeof db.createDbClient, "function");
  assert.equal(typeof gateway, "object");
});
