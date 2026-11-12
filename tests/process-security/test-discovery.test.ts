import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { buildTestRuns, discoverTests } from "../../scripts/discover-tests.mjs";

test("F18 discovers sorted TypeScript tests without shell expansion", async () => {
  const files = await discoverTests(".");
  assert.ok(files.length > 0);
  assert.deepEqual(files, [...files].sort());
  assert.ok(files.every((file) => file.endsWith(".test.ts")));
  assert.ok(files.some((file) => file.startsWith("tests/")));
  assert.ok(files.some((file) => file.startsWith("src/be/")));
});

test("W11 security tests run in a process with the network deny setup", () => {
  assert.deepEqual(buildTestRuns([
    "src/be/auth/test/rate-limit.test.ts",
    "tests/security/attack-corpus.test.ts",
    "tests/process-security/test-discovery.test.ts",
  ]), [
    {
      files: ["src/be/auth/test/rate-limit.test.ts", "tests/process-security/test-discovery.test.ts"],
      setup: ["./tests/setup-auth-env.ts"],
    },
    {
      files: ["tests/security/attack-corpus.test.ts"],
      setup: ["./tests/setup-auth-env.ts", "./tests/security/w11-network-deny.setup.ts"],
    },
  ]);
});

test("W11 registration corpus cases use the production route for repeated attempts", () => {
  const source = readFileSync("tests/security/attack-corpus/runner.ts", "utf8");
  assert.match(source, /createAppDependencies/);
  assert.match(source, /\.request\(/);
  assert.doesNotMatch(source, /count:\s*21/);
});
