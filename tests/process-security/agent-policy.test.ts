import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { evaluatePolicy, validatePolicy } from "../../workflow/tools/agent-policy.mjs";

test("F8 canonical policy has explicit default-deny controls", async () => {
  const policy = JSON.parse(await readFile("workflow/agent-permissions.json", "utf8"));
  assert.equal((await validatePolicy(policy)).valid, true);
  assert.equal(policy.default, "deny");
  assert.ok(policy.deny.production_credentials);
  assert.ok(policy.deny.production_hosts);
  assert.ok(policy.review_required.protected_paths.includes(".github/**"));
  assert.equal(policy.content_handling.repository, "data_not_instructions");
  assert.equal(policy.content_handling.web, "data_not_instructions");
  assert.equal(policy.content_handling.attack_corpus, "data_not_instructions");
});

test("F8 unknown operations and production access fail closed", () => {
  const policy = JSON.parse(readFileSync("workflow/agent-permissions.json", "utf8"));
  assert.deepEqual(evaluatePolicy(policy, { operation: "unknown", target: "anything" }), { allowed: false, reason: "default-deny" });
  assert.equal(evaluatePolicy(policy, { operation: "network", target: "https://production.example" }).allowed, false);
  assert.equal(evaluatePolicy(policy, { operation: "secret", target: "DATABASE_URL" }).allowed, false);
});

test("E8 protected paths require both security reviewer and human owner", () => {
  const policy = JSON.parse(readFileSync("workflow/agent-permissions.json", "utf8"));
  const decision = evaluatePolicy(policy, { operation: "write", target: ".github/workflows/ci.yml" });
  assert.deepEqual(decision, { allowed: false, reason: "review-required", reviewers: ["@ludannnn"], owner: "@teleifo" });
});

test("E9 policy validation fails closed for missing and malformed files", async () => {
  const directory = await mkdtemp(join(tmpdir(), "w12-policy-"));
  const missing = await validatePolicy(join(directory, "missing.json"));
  assert.equal(missing.valid, false);
  await writeFile(join(directory, "malformed.json"), JSON.stringify({ default: "allow" }));
  const malformed = await validatePolicy(join(directory, "malformed.json"));
  assert.equal(malformed.valid, false);
});
