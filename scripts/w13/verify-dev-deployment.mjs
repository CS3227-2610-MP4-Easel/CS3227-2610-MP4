import { readFileSync } from "node:fs";

const DEV = { tier: "dev", project: "prj_U7YYwCGOdx4pThKCPYdkXH1a9Smd", alias: "development" };
const PREVIEW_SECRET_NAMES = ["DATABASE_URL", "DIRECT_DATABASE_URL", "FIREBASE_PROJECT_ID", "REGISTRATION_CODE_PM", "REGISTRATION_CODE_DEV_LEAD", "REGISTRATION_CODE_DEVELOPER", "RATE_KEY_SECRET", "SOCLAAS_BASE_URL", "SOCLAAS_API_KEY"];

export function verifyDevDeployment({ metadata, mergedSha, pushTimestamp }) {
  if (!metadata || typeof metadata !== "object") throw new Error("deployment metadata is missing");
  if (metadata.githubCommitSha !== mergedSha) throw new Error("githubCommitSha does not match merged SHA");
  if (metadata.project !== DEV.project) throw new Error("Vercel project does not match dev");
  if (metadata.deploymentId === undefined || metadata.deploymentId === "") throw new Error("deployment ID is missing");
  if (metadata.readyState !== "READY") throw new Error("deployment is not READY");
  if (metadata.alias !== DEV.alias || metadata.aliasOwner !== metadata.deploymentId) throw new Error("Vercel alias does not belong to deployment");
  if (metadata.aliases !== undefined && (metadata.aliases.length !== 1 || metadata.aliases[0]?.alias !== DEV.alias || metadata.aliases[0]?.deploymentId !== metadata.deploymentId)) throw new Error("Vercel alias ownership is ambiguous");
  const createdAt = Date.parse(metadata.createdAt);
  const pushedAt = Date.parse(pushTimestamp);
  if (!Number.isFinite(createdAt) || !Number.isFinite(pushedAt) || createdAt <= pushedAt) throw new Error("deployment createdAt is stale or invalid");
  return { tier: "dev", deploymentId: metadata.deploymentId, commit: mergedSha, project: DEV.project, alias: DEV.alias, state: "READY" };
}

export function validatePreviewEnvironment(env) {
  if (env.APP_TIER !== "preview") throw new Error("APP_TIER must be preview");
  const supplied = PREVIEW_SECRET_NAMES.find((name) => env[name] !== undefined);
  if (supplied) throw new Error(`preview must not receive ${supplied}`);
  return true;
}

export function classifyDevAiProbe(ok) {
  return ok ? { status: "pass", AI_ENABLED: "true" } : { status: "degraded", AI_ENABLED: "false" };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const metadata = JSON.parse(readFileSync(process.env.W13_VERCEL_METADATA_FILE, "utf8"));
  const result = verifyDevDeployment({ metadata, mergedSha: process.env.GITHUB_SHA, pushTimestamp: process.env.GITHUB_PUSH_TIMESTAMP });
  console.log(JSON.stringify(result));
}
