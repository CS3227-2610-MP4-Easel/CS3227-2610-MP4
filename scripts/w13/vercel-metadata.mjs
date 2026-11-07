const PROJECT = "prj_U7YYwCGOdx4pThKCPYdkXH1a9Smd";
const ALIAS = "development";

export function selectVercelCheckDeploymentId(checkRuns) {
  const ids = checkRuns
    .filter((check) => check?.app?.slug === "vercel" || check?.app?.name === "Vercel")
    .map((check) => check.external_id ?? check.deploymentId ?? null)
    .filter(Boolean);
  const unique = [...new Set(ids)];
  if (unique.length !== 1) throw new Error("current Vercel check is missing or ambiguous");
  return unique[0];
}

export function sanitizeVercelMetadata({ deployment, aliases, mergedSha, pushTimestamp }) {
  const deploymentId = deployment?.uid;
  if (deploymentId === undefined || deployment?.projectId !== PROJECT || deployment?.meta?.githubCommitSha !== mergedSha || deployment?.readyState !== "READY") {
    throw new Error("Vercel deployment identity or readiness is invalid");
  }
  if (!Number.isFinite(Date.parse(deployment.createdAt)) || Date.parse(deployment.createdAt) <= Date.parse(pushTimestamp)) {
    throw new Error("Vercel deployment timestamp is stale or invalid");
  }
  const owned = aliases.filter((alias) => alias?.alias === ALIAS && alias?.deploymentId === deploymentId);
  if (owned.length !== 1) throw new Error("Vercel alias ownership is missing or ambiguous");
  return { deploymentId, githubCommitSha: mergedSha, project: PROJECT, alias: ALIAS, aliasOwner: deploymentId, readyState: "READY", createdAt: deployment.createdAt };
}
