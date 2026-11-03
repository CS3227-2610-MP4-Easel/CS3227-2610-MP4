import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { buildGitleaksArgs, parseScanArgs, redactOutput } from "../../scripts/scan-secrets.mjs";

const root = new URL("../../", import.meta.url);

test("E4/F12 staged scans use the shared Gitleaks configuration", () => {
  const options = parseScanArgs(["--staged"]);
  assert.equal(options.mode, "staged");
  assert.deepEqual(buildGitleaksArgs(options), [
    "detect", "--config", ".gitleaks.toml", "--no-banner", "--redact", "--exit-code", "1", "--pipe",
  ]);
});

test("E13 CI scans require both immutable PR range endpoints", () => {
  const options = parseScanArgs(["--base-sha", "base123", "--head-sha", "head456"]);
  assert.equal(options.mode, "range");
  assert.deepEqual(buildGitleaksArgs(options).at(-1), "--log-opts=base123..head456");
  assert.throws(() => parseScanArgs(["--base-sha", "base123"]), /both --base-sha and --head-sha/);
});

test("E5 narrow allowlist output and E14 failures redact secret-like values", () => {
  assert.equal(redactOutput("token=ghp_abcdefghijklmnopqrstuvwxyz123456"), "token=[REDACTED]");
  assert.equal(redactOutput("password: super-secret-value"), "password: [REDACTED]");
});

test("E13/F12 local and CI scan paths cannot be replaced by the local hook bypass", async () => {
  const hook = await readFile(new URL(".githooks/pre-commit", root), "utf8");
  const workflow = await readFile(new URL(".github/workflows/ci.yml", root), "utf8");
  assert.match(hook, /npm run scan:secrets -- --staged/);
  assert.match(workflow, /npm run scan:secrets -- --base-sha/);
  assert.doesNotMatch(workflow, /--no-verify/);
});
