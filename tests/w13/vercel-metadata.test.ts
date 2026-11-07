import assert from "node:assert/strict";
import { test } from "node:test";
import { sanitizeVercelMetadata, selectVercelCheckDeploymentId } from "../../scripts/w13/vercel-metadata.mjs";

const sha = "0123456789abcdef0123456789abcdef01234567";
const baseDeployment = { uid: "dpl_current", projectId: "prj_U7YYwCGOdx4pThKCPYdkXH1a9Smd", meta: { githubCommitSha: sha }, readyState: "READY", createdAt: "2026-11-07T10:01:00.000Z" };
const hostname = "agile-platform-development.example.com";
const aliasResponse = { aliases: [{ alias: hostname, created: "2026-11-07T10:01:00.000Z", uid: "alias_current" }] };

test("E4/E26 selects the single deployment named by the current Vercel check", () => {
  assert.equal(selectVercelCheckDeploymentId([{ app: { slug: "vercel" }, external_id: "dpl_current" }]), "dpl_current");
  assert.throws(() => selectVercelCheckDeploymentId([]), /missing or ambiguous/);
  assert.throws(() => selectVercelCheckDeploymentId([{ app: { slug: "vercel" }, external_id: "dpl_old" }, { app: { slug: "vercel" }, external_id: "dpl_current" }]), /missing or ambiguous/);
});

test("E21/E22 validates readiness, exact identity, timestamp, and alias ownership", () => {
  const result = sanitizeVercelMetadata({ deployment: baseDeployment, aliases: aliasResponse, expectedAlias: hostname, mergedSha: sha, pushTimestamp: "2026-11-07T10:00:00.000Z" });
  assert.equal(result.deploymentId, "dpl_current");
  assert.throws(() => sanitizeVercelMetadata({ deployment: { ...baseDeployment, readyState: "BUILDING" }, aliases: aliasResponse, expectedAlias: hostname, mergedSha: sha, pushTimestamp: "2026-11-07T10:00:00.000Z" }), /identity or readiness/);
  assert.throws(() => sanitizeVercelMetadata({ deployment: baseDeployment, aliases: { aliases: [{ ...aliasResponse.aliases[0], alias: "wrong.example.com" }] }, expectedAlias: hostname, mergedSha: sha, pushTimestamp: "2026-11-07T10:00:00.000Z" }), /ownership/);
  assert.throws(() => sanitizeVercelMetadata({ deployment: baseDeployment, aliases: aliasResponse, expectedAlias: hostname, mergedSha: sha, pushTimestamp: "2026-11-07T10:02:00.000Z" }), /timestamp/);
});

test("E25 sanitized metadata never carries response bodies or credentials", () => {
  const result = sanitizeVercelMetadata({ deployment: { ...baseDeployment, secret: "token", url: "https://secret.example" }, aliases: aliasResponse, expectedAlias: hostname, mergedSha: sha, pushTimestamp: "2026-11-07T10:00:00.000Z" });
  assert.deepEqual(Object.keys(result).sort(), ["alias", "aliasOwner", "createdAt", "deploymentId", "githubCommitSha", "project", "readyState"]);
});

test("documented deployment ID and millisecond timestamp are accepted", () => {
  const { uid: _, ...deployment } = baseDeployment;
  const result = sanitizeVercelMetadata({ deployment: { ...deployment, id: "dpl_current", createdAt: Date.parse(baseDeployment.createdAt) }, aliases: aliasResponse, expectedAlias: hostname, mergedSha: sha, pushTimestamp: "2026-11-07T10:00:00.000Z" });
  assert.equal(result.deploymentId, "dpl_current");
  assert.equal(result.createdAt, baseDeployment.createdAt);
});
