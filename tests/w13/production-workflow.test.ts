import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { validateProductionIdentity, sanitizeProductionEvidence } from "../../scripts/w13/verify-production-identity.mjs";

const sha = "0123456789abcdef0123456789abcdef01234567";
const manifest = {
  tier: "prod",
  branch: "main",
  vercelProject: "prj_U7YYwCGOdx4pThKCPYdkXH1a9Smd",
  vercelAlias: "production",
  vercelEnv: "production",
};
const candidate = {
  id: "dpl_candidate",
  projectId: manifest.vercelProject,
  readyState: "READY",
  target: "production",
  meta: { githubCommitSha: sha, artifactDigest: "sha256:artifact" },
};

test("E4/E5 validates the detached SHA, production marker, project, alias and artifact", () => {
  assert.doesNotThrow(() => validateProductionIdentity({ manifest, candidate, expectedSha: sha, expectedArtifactDigest: "sha256:artifact", env: { APP_TIER: "prod", VERCEL_ENV: "production" } }));
  assert.throws(() => validateProductionIdentity({ manifest, candidate: { ...candidate, meta: { ...candidate.meta, githubCommitSha: "f".repeat(40) } }, expectedSha: sha, expectedArtifactDigest: "sha256:artifact", env: { APP_TIER: "prod", VERCEL_ENV: "production" } }), /SHA/);
  assert.throws(() => validateProductionIdentity({ manifest, candidate: { ...candidate, target: "preview" }, expectedSha: sha, expectedArtifactDigest: "sha256:artifact", env: { APP_TIER: "prod", VERCEL_ENV: "production" } }), /production target/);
  assert.throws(() => validateProductionIdentity({ manifest, candidate: { ...candidate, projectId: "wrong" }, expectedSha: sha, expectedArtifactDigest: "sha256:artifact", env: { APP_TIER: "prod", VERCEL_ENV: "production" } }), /project/);
});

test("E6 rejects a missing production marker, stale artifact or non-ready candidate", () => {
  assert.throws(() => validateProductionIdentity({ manifest, candidate, expectedSha: sha, expectedArtifactDigest: "sha256:other", env: { APP_TIER: "prod", VERCEL_ENV: "production" } }), /artifact/);
  assert.throws(() => validateProductionIdentity({ manifest, candidate: { ...candidate, readyState: "BUILDING" }, expectedSha: sha, expectedArtifactDigest: "sha256:artifact", env: { APP_TIER: "prod", VERCEL_ENV: "production" } }), /READY/);
  assert.throws(() => validateProductionIdentity({ manifest, candidate, expectedSha: sha, expectedArtifactDigest: "sha256:artifact", env: { APP_TIER: "prod", VERCEL_ENV: "preview" } }), /VERCEL_ENV/);
});

test("E25/E35 evidence is allowlisted and never carries credentials or bodies", () => {
  const evidence = sanitizeProductionEvidence({ deploymentId: "dpl_candidate", project: manifest.vercelProject, alias: "production", commit: sha, artifactDigest: "sha256:artifact", state: "READY", outcome: "pass", token: "secret", responseBody: "private" });
  assert.deepEqual(Object.keys(evidence).sort(), ["alias", "artifactDigest", "commit", "deploymentId", "outcome", "project", "state"]);
});

test("E4/E27 production workflow is protected and does not run on pull requests", async () => {
  const workflow = await readFile(new URL("../../.github/workflows/w13-production.yml", import.meta.url), "utf8");
  assert.match(workflow, /branches:\s*\[main\]/);
  assert.doesNotMatch(workflow, /pull_request:/);
  assert.match(workflow, /environment:\s*production/);
  assert.match(workflow, /concurrency:/);
  assert.match(workflow, /github\.sha/);
  assert.match(workflow, /DIRECT_DATABASE_URL/);
  assert.match(workflow, /VERCEL_DEPLOY_HOOK_URL/);
  assert.match(workflow, /curl.*VERCEL_DEPLOY_HOOK_URL/);
  assert.doesNotMatch(workflow, /VERCEL_TOKEN|VERCEL_TEAM_ID|vercel@|vercel.*--prod/i);
});
