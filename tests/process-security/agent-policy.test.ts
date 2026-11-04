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
  for (const path of [".claude/**", ".codex/**", "scripts/**"]) {
    assert.ok(policy.review_required.protected_paths.includes(path));
  }
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

test("F8 rejects a policy that weakens required security values", async () => {
  const policy = JSON.parse(readFileSync("workflow/agent-permissions.json", "utf8"));
  policy.allow.read = ["repository", "web", "secrets"];
  policy.deny.production_credentials = ["not-a-credential"];
  policy.deny.production_hosts = ["not-a-production-host"];
  policy.review_required.reviewers = ["@attacker"];
  policy.review_required.owner = "@attacker";

  const result = await validatePolicy(policy);
  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /allow\.read|production_credentials|production_hosts|reviewers|owner/);
});

test("F8 provider adapters expose the executable mediation seam", async () => {
  const config = JSON.parse(await readFile("workflow/config.json", "utf8"));
  assert.equal(config.process_security?.policy_mediator, "npm run mediate:agent");
  assert.equal(config.process_security?.policy_hook, "scripts/agent-pre-tool-hook.mjs");
  for (const adapter of [".claude/agents/implementer.md", ".codex/agents/implementer.md"]) {
    assert.match(await readFile(adapter, "utf8"), /npm run mediate:agent/);
  }
  assert.match(await readFile(".claude/settings.json", "utf8"), /agent-pre-tool-hook\.mjs/);
  assert.match(await readFile(".codex/hooks.json", "utf8"), /agent-pre-tool-hook\.mjs/);
});
