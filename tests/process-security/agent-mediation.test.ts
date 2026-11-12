import assert from "node:assert/strict";
import { test } from "node:test";
import { mediateAgentOperation } from "../../workflow/tools/agent-mediation.mjs";

test("F8 mediation denies protected writes and secret access", async () => {
  assert.deepEqual(await mediateAgentOperation({
    operation: "write",
    target: ".github/workflows/ci.yml",
  }), {
    allowed: false,
    reason: "review-required",
    reviewers: ["@ludannnn"],
    owner: "@teleifo",
  });
  assert.deepEqual(await mediateAgentOperation({
    operation: "secret",
    target: "DATABASE_URL",
  }), { allowed: false, reason: "denied" });
});

test("F8 mediation allows only policy-approved repository reads", async () => {
  assert.deepEqual(await mediateAgentOperation({
    operation: "read",
    scope: "repository",
    target: "src/be/contracts/src/index.ts",
  }), { allowed: true, reason: "allowed" });
  assert.deepEqual(await mediateAgentOperation({
    operation: "read",
    scope: "secrets",
    target: "DATABASE_URL",
  }), { allowed: false, reason: "default-deny" });
});
