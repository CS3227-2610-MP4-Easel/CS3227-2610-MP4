import assert from "node:assert/strict";
import { test } from "node:test";
import { discoverTests } from "../../scripts/discover-tests.mjs";

test("F18 discovers sorted TypeScript tests without shell expansion", async () => {
  const files = await discoverTests(".");
  assert.ok(files.length > 0);
  assert.deepEqual(files, [...files].sort());
  assert.ok(files.every((file) => file.endsWith(".test.ts")));
  assert.ok(files.some((file) => file.startsWith("tests/")));
  assert.ok(files.some((file) => file.startsWith("src/be/")));
});
