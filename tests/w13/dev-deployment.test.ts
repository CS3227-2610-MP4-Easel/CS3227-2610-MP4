import assert from "node:assert/strict";
import { test } from "node:test";
import { validatePreviewEnvironment as sharedValidatePreviewEnvironment } from "../../src/be/db/src/tier-targets.ts";
import { classifyDevAiProbe, validatePreviewEnvironment, verifyDevDeployment } from "../../scripts/w13/verify-dev-deployment.mjs";

const sha = "0123456789abcdef0123456789abcdef01234567";
const project = "prj_U7YYwCGOdx4pThKCPYdkXH1a9Smd";
const pushTimestamp = "2026-11-07T10:00:00.000Z";

function metadata(overrides = {}) {
  return {
    deploymentId: "dpl_current",
    githubCommitSha: sha,
    project,
    alias: "development",
    aliasOwner: "dpl_current",
    readyState: "READY",
    createdAt: "2026-11-07T10:01:00.000Z",
    ...overrides,
  };
}

test("E2/E26 dev deployment binds the merged SHA, project, and alias", () => {
  assert.deepEqual(verifyDevDeployment({ metadata: metadata(), mergedSha: sha, pushTimestamp }), { tier: "dev", deploymentId: "dpl_current", commit: sha, project, alias: "development", state: "READY" });
  assert.throws(() => verifyDevDeployment({ metadata: metadata({ githubCommitSha: "f".repeat(40) }), mergedSha: sha, pushTimestamp }), /SHA/);
  assert.throws(() => verifyDevDeployment({ metadata: metadata({ project: "other" }), mergedSha: sha, pushTimestamp }), /project/);
  assert.throws(() => verifyDevDeployment({ metadata: metadata({ readyState: "ERROR" }), mergedSha: sha, pushTimestamp }), /READY/);
  assert.throws(() => verifyDevDeployment({ metadata: metadata({ alias: "other" }), mergedSha: sha, pushTimestamp }), /alias/);
  assert.throws(() => verifyDevDeployment({ metadata: metadata({ aliasOwner: "dpl_old" }), mergedSha: sha, pushTimestamp }), /alias/);
  assert.throws(() => verifyDevDeployment({ metadata: metadata({ createdAt: pushTimestamp }), mergedSha: sha, pushTimestamp }), /createdAt/);
  assert.throws(() => verifyDevDeployment({ metadata: metadata({ deploymentId: undefined }), mergedSha: sha, pushTimestamp }), /deployment/);
});

test("E1/E3/E13/N1/N2 rejects incomplete or stale deployment metadata", () => {
  assert.throws(() => verifyDevDeployment({ metadata: metadata({ aliases: [] }), mergedSha: sha, pushTimestamp }), /alias/);
  assert.throws(() => verifyDevDeployment({ metadata: metadata({ createdAt: "not-a-date" }), mergedSha: sha, pushTimestamp }), /createdAt/);
  const result = verifyDevDeployment({ metadata: metadata({ token: "do-not-return", url: "https://secret.example" }), mergedSha: sha, pushTimestamp });
  assert.deepEqual(Object.keys(result).sort(), ["alias", "commit", "deploymentId", "project", "state", "tier"]);
  assert.equal(JSON.stringify(result).includes("secret"), false);
});

test("E2/E9/E11 preview verifier delegates to the shared policy", () => {
  assert.equal(validatePreviewEnvironment, sharedValidatePreviewEnvironment);
  assert.doesNotThrow(() => validatePreviewEnvironment({ APP_TIER: "preview" }));
  for (const name of [
    "DATABASE_URL", "DIRECT_DATABASE_URL", "FIREBASE_PROJECT_ID", "REGISTRATION_CODE_PM",
    "REGISTRATION_CODE_DEV_LEAD", "REGISTRATION_CODE_DEVELOPER", "RATE_KEY_SECRET", "NEON_HOST",
    "NEON_PROJECT", "SOCLAAS_BASE_URL", "SOCLAAS_API_KEY", "VERCEL_TOKEN", "VERCEL_TEAM_ID",
  ]) {
    assert.throws(() => validatePreviewEnvironment({ APP_TIER: "preview", [name]: "" }), new RegExp(name));
  }
});

test("E41/E42 dev AI failure is degraded and disables AI", () => {
  assert.deepEqual(classifyDevAiProbe(true), { status: "pass", AI_ENABLED: "true" });
  assert.deepEqual(classifyDevAiProbe(false), { status: "degraded", AI_ENABLED: "false" });
});
