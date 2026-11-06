const DEV = { tier: "dev", project: "agile-platform", alias: "development" };
const PREVIEW_SECRET_NAMES = ["DATABASE_URL", "DIRECT_DATABASE_URL", "FIREBASE_PROJECT_ID", "REGISTRATION_CODE_PM", "REGISTRATION_CODE_DEV_LEAD", "REGISTRATION_CODE_DEVELOPER", "RATE_KEY_SECRET", "SOCLAAS_BASE_URL", "SOCLAAS_API_KEY"];

export function verifyDevDeployment({ metadata, mergedSha, manifest = DEV }) {
  if (manifest.tier !== "dev") throw new Error("tier does not match dev");
  if (metadata.githubCommitSha !== mergedSha) throw new Error("githubCommitSha does not match merged SHA");
  if (metadata.project !== manifest.project) throw new Error("Vercel project does not match dev");
  if (metadata.alias !== manifest.alias) throw new Error("Vercel alias does not match dev");
  return { tier: "dev", commit: mergedSha, project: metadata.project, alias: metadata.alias };
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
  const metadata = { githubCommitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA, project: process.env.VERCEL_PROJECT_ID, alias: process.env.VERCEL_ALIAS };
  const result = verifyDevDeployment({ metadata, mergedSha: process.env.GITHUB_SHA });
  console.log(JSON.stringify(result));
}
