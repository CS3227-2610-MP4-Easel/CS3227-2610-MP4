import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const SHA = /^[0-9a-f]{40}$/;

function fail(message) {
  throw new Error(message);
}

export function validateProductionIdentity({ manifest, candidate, expectedSha, expectedArtifactDigest, env }) {
  if (env?.APP_TIER !== "prod") fail("APP_TIER must be prod");
  if (env?.VERCEL_ENV !== "production") fail("VERCEL_ENV must be production");
  if (!manifest || manifest.tier !== "prod" || manifest.branch !== "main" || manifest.vercelEnv !== "production") fail("production manifest identity is invalid");
  if (!SHA.test(expectedSha)) fail("expected SHA is invalid");
  if (!candidate || candidate.readyState !== "READY") fail("candidate deployment is not READY");
  if (candidate.target !== "production") fail("candidate is not a production target");
  if (candidate.projectId !== manifest.vercelProject) fail("candidate project does not match production manifest");
  if (candidate.meta?.githubCommitSha !== expectedSha) fail("candidate SHA does not match detached SHA");
  if (candidate.meta?.artifactDigest !== expectedArtifactDigest) fail("candidate artifact digest does not match build artifact");
  return true;
}

export function sanitizeProductionEvidence(input) {
  return {
    deploymentId: input.deploymentId,
    project: input.project,
    alias: input.alias,
    commit: input.commit,
    artifactDigest: input.artifactDigest,
    state: input.state,
    outcome: input.outcome,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void (async () => {
    const manifest = JSON.parse(await readFile("workflow/deployment/tier-manifest.json", "utf8"));
    const prod = manifest.tiers.find((tier) => tier.tier === "prod");
    const candidate = JSON.parse(await readFile(process.env.CANDIDATE_JSON, "utf8"));
    validateProductionIdentity({ manifest: prod, candidate, expectedSha: process.env.EXPECTED_SHA, expectedArtifactDigest: process.env.EXPECTED_ARTIFACT_DIGEST, env: process.env });
    console.log(JSON.stringify(sanitizeProductionEvidence({
      deploymentId: candidate.uid ?? candidate.id,
      project: candidate.projectId,
      alias: prod.vercelAlias,
      commit: process.env.EXPECTED_SHA,
      artifactDigest: process.env.EXPECTED_ARTIFACT_DIGEST,
      state: candidate.readyState,
      outcome: "pass",
    })));
  })().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
}
