import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyDevAiProbe, validatePreviewEnvironment, verifyDevDeployment } from "../../scripts/w13/verify-dev-deployment.mjs";

const sha = "0123456789abcdef0123456789abcdef01234567";

test("E2/E26 dev deployment binds the merged SHA, project, and alias", () => {
  assert.deepEqual(verifyDevDeployment({ metadata: { githubCommitSha: sha, project: "prj_U7YYwCGOdx4pThKCPYdkXH1a9Smd", alias: "development" }, mergedSha: sha }), { tier: "dev", commit: sha, project: "prj_U7YYwCGOdx4pThKCPYdkXH1a9Smd", alias: "development" });
  assert.throws(() => verifyDevDeployment({ metadata: { githubCommitSha: "f".repeat(40), project: "prj_U7YYwCGOdx4pThKCPYdkXH1a9Smd", alias: "development" }, mergedSha: sha }), /SHA/);
  assert.throws(() => verifyDevDeployment({ metadata: { githubCommitSha: sha, project: "other", alias: "development" }, mergedSha: sha }), /project/);
});

test("E2 preview environment rejects every data credential", () => {
  assert.doesNotThrow(() => validatePreviewEnvironment({ APP_TIER: "preview" }));
  assert.throws(() => validatePreviewEnvironment({ APP_TIER: "preview", DATABASE_URL: "redacted" }), /DATABASE_URL/);
  assert.throws(() => validatePreviewEnvironment({ APP_TIER: "preview", SOCLAAS_API_KEY: "redacted" }), /SOCLAAS_API_KEY/);
});

test("E41/E42 dev AI failure is degraded and disables AI", () => {
  assert.deepEqual(classifyDevAiProbe(true), { status: "pass", AI_ENABLED: "true" });
  assert.deepEqual(classifyDevAiProbe(false), { status: "degraded", AI_ENABLED: "false" });
});
