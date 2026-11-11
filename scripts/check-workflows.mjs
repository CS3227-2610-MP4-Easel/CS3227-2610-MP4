import { readFile } from "node:fs/promises";
import { readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { parseDocument } from "yaml";

const SHA = /^[0-9a-f]{40}$/;
const REQUIRED_CI_COMMANDS = Object.freeze({
  workspace: "npm test",
  typecheck: "npm run typecheck",
  lint: "npm run lint",
  contract: "npm run contract",
  "dependency-audit": "npm run audit:dependencies",
  "secret-scan": "npm run scan:secrets",
});
export const BOOTSTRAP_BASE_SHA = "637d09ff591b3e9d8d0743aa7d7d452ec0ad460b";
export const BOOTSTRAP_ACTION_PINS = Object.freeze({
  version: 1,
  actions: Object.freeze({
    "actions/checkout": Object.freeze({
      sha: "11bd71901bbe5b1630ceea73d27597364c9af683",
      version: "v4.2.2",
      type: "action",
    }),
    "actions/setup-node": Object.freeze({
      sha: "49933ea5288caeca8642d1e84afbd3f7d6820020",
      version: "v4.4.0",
      type: "action",
    }),
  }),
});

function parseActionPins(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || value.version !== 1 || !value.actions || typeof value.actions !== "object"
    || Array.isArray(value.actions)) {
    throw new Error("Action pin manifest must contain version 1 and an actions object");
  }
  return value;
}

export function resolveActionPins({ baseManifest, baseSha, baseBranch, prNumber, bootstrapPrNumber }) {
  if (baseManifest !== null && baseManifest !== undefined) {
    return parseActionPins(typeof baseManifest === "string" ? JSON.parse(baseManifest) : baseManifest);
  }
  if (baseBranch !== "development") throw new Error("bootstrap requires the development target");
  if (baseSha !== BOOTSTRAP_BASE_SHA) throw new Error("base Action manifest is required after bootstrap");
  if (!bootstrapPrNumber || String(prNumber) !== String(bootstrapPrNumber)) {
    throw new Error("bootstrap requires the configured pull request");
  }
  return BOOTSTRAP_ACTION_PINS;
}

function actionManifestAtSha(root, sha) {
  const result = spawnSync("git", ["show", `${sha}:workflow/action-pins.json`], {
    cwd: root,
    encoding: "utf8",
  });
  return result.error || result.status !== 0 ? null : result.stdout;
}

export function validateWorkflowText(text, pins, file = "workflow.yml") {
  const errors = [];
  let workflow;
  try {
    const document = parseDocument(text, { uniqueKeys: true });
    if (document.errors.length > 0) {
      errors.push(`${file}: invalid YAML: ${document.errors.map((error) => error.message).join("; ")}`);
      return errors;
    }
    workflow = document.toJS();
  } catch (error) {
    errors.push(`${file}: invalid YAML: ${error instanceof Error ? error.message : String(error)}`);
    return errors;
  }
  if (!workflow || typeof workflow !== "object" || Array.isArray(workflow)) {
    errors.push(`${file}: workflow must be a YAML object`);
    return errors;
  }
  const triggerValue = workflow.on;
  const triggers = typeof triggerValue === "string"
    ? [triggerValue]
    : Array.isArray(triggerValue)
      ? triggerValue
      : triggerValue && typeof triggerValue === "object" ? Object.keys(triggerValue) : [];
  const trustedReviewWorkflow = file === ".github/workflows/review-security.yml";
  if (triggers.some((trigger) => ["deployment", "deployment_status"].includes(trigger))) {
    errors.push(`${file}: deployment trigger is forbidden in pull-request workflows`);
  }
  const allowedTriggers = trustedReviewWorkflow ? ["pull_request", "pull_request_review"] : ["pull_request", "push"];
  const pushConfiguration = triggerValue && typeof triggerValue === "object" && !Array.isArray(triggerValue) ? triggerValue.push : null;
  if (triggers.length === 0 || triggers.some((trigger) => !allowedTriggers.includes(trigger))) {
    errors.push(`${file}: unexpected workflow trigger (found: ${triggers.join(", ") || "none"})`);
  }
  if (trustedReviewWorkflow) {
    const reviewTypes = workflow.on?.pull_request_review?.types;
    if (!Array.isArray(reviewTypes)
      || reviewTypes.length !== 3
      || new Set(reviewTypes).size !== 3
      || !["submitted", "edited", "dismissed"].every((type) => reviewTypes.includes(type))) {
      errors.push(`${file}: pull_request_review must allow exactly submitted, edited, and dismissed`);
    }
  }
  const jobs = workflow.jobs && typeof workflow.jobs === "object" ? workflow.jobs : {};
  const permissionValues = [workflow.permissions, ...Object.values(jobs).map((job) => job?.permissions)];
  if (permissionValues.some((permissions) => hasWritePermission(permissions))) {
    errors.push(`${file}: write permissions are forbidden in pull-request workflows`);
  }
  for (const job of Object.values(jobs)) {
    if (!job || typeof job !== "object") continue;
    if (Object.prototype.hasOwnProperty.call(job, "environment") && triggers.some((trigger) => trigger.startsWith("pull_request"))) {
      errors.push(`${file}: environments are forbidden in pull-request workflows`);
    }
    if (containsSelfHosted(job["runs-on"])) {
      errors.push(`${file}: self-hosted runners are forbidden in pull-request workflows`);
    }
    if (typeof job.uses === "string") validateActionReference(job.uses, pins, file, errors);
    else if (Object.prototype.hasOwnProperty.call(job, "uses")) errors.push(`${file}: reusable workflow reference must be a string`);
    for (const step of Array.isArray(job.steps) ? job.steps : []) {
      if (!step || typeof step !== "object") continue;
      if (typeof step.uses === "string") {
        validateActionReference(step.uses, pins, file, errors);
      } else if (Object.prototype.hasOwnProperty.call(step, "uses")) {
        errors.push(`${file}: workflow Action reference must be a string`);
      }
      if (typeof step.run === "string" && /\b(?:curl|wget)\b(?:[^\\\n]|\\\r?\n)*\|/i.test(step.run)) {
        errors.push(`${file}: remote bootstrap commands are forbidden`);
      }
    }
    for (const image of containerImages(job)) {
      if (!image.includes("@sha256:")) errors.push(`${file}: container image ${image} is not pinned by digest`);
    }
  }
  return errors;
}

function parseWorkflow(text, file) {
  try {
    const document = parseDocument(text, { uniqueKeys: true });
    if (document.errors.length > 0) return { errors: [`${file}: invalid YAML: ${document.errors.map((error) => error.message).join("; ")}`] };
    return { workflow: document.toJS() };
  } catch (error) {
    return { errors: [`${file}: invalid YAML: ${error instanceof Error ? error.message : String(error)}`] };
  }
}

export function validateProductionWorkflowContract(text, file = ".github/workflows/w13-production.yml") {
  const errors = [];
  if (file !== ".github/workflows/w13-production.yml") {
    errors.push(`${file}: production contract is restricted to .github/workflows/w13-production.yml`);
  }
  const parsed = parseWorkflow(text, file);
  if (parsed.errors) return [...errors, ...parsed.errors];
  const workflow = parsed.workflow;
  if (!workflow || typeof workflow !== "object" || Array.isArray(workflow)) {
    return [...errors, `${file}: workflow must be a YAML object`];
  }
  const triggerValue = workflow.on;
  const triggers = triggerValue && typeof triggerValue === "object" && !Array.isArray(triggerValue)
    ? Object.keys(triggerValue) : typeof triggerValue === "string" ? [triggerValue] : Array.isArray(triggerValue) ? triggerValue : [];
  if (triggers.length !== 1 || triggers[0] !== "push") errors.push(`${file}: production workflow must use push only`);
  const push = triggerValue && typeof triggerValue === "object" && !Array.isArray(triggerValue) ? triggerValue.push : null;
  const branches = push && typeof push === "object" && !Array.isArray(push) ? push.branches : null;
  if (!Array.isArray(branches) || branches.length !== 1 || branches[0] !== "main") {
    errors.push(`${file}: production workflow must push only to main`);
  }
  const concurrency = workflow.concurrency;
  if (!concurrency || typeof concurrency !== "object" || concurrency.group !== "production") {
    errors.push(`${file}: concurrency.group must be production`);
  }
  if (concurrency?.["cancel-in-progress"] !== false) errors.push(`${file}: concurrency.cancel-in-progress must be false`);
  const jobs = workflow.jobs && typeof workflow.jobs === "object" ? workflow.jobs : {};
  const jobValues = Object.values(jobs).filter((job) => job && typeof job === "object");
  const hasProductionEnvironment = jobValues.some((job) => job.environment === "production" || job.environment?.name === "production");
  if (!hasProductionEnvironment) errors.push(`${file}: production environment is required`);
  const actionErrors = [];
  for (const job of jobValues) {
    if (typeof job.uses === "string") validateActionReference(job.uses, BOOTSTRAP_ACTION_PINS, file, actionErrors);
    for (const step of Array.isArray(job.steps) ? job.steps : []) {
      if (typeof step?.uses === "string") validateActionReference(step.uses, BOOTSTRAP_ACTION_PINS, file, actionErrors);
    }
  }
  errors.push(...actionErrors.map((error) => error.replace("Action repository", "production Action repository")));
  const steps = jobValues.flatMap((job) => Array.isArray(job.steps) ? job.steps : []);
  const runs = steps.map((step) => typeof step?.run === "string" ? step.run : "");
  if (/(?:VERCEL_API_TOKEN|VERCEL_TOKEN)/i.test(text)) errors.push(`${file}: Vercel API tokens are forbidden`);
  const checkoutRefs = steps.filter((step) => step?.uses?.startsWith("actions/checkout@")).map((step) => step.with?.ref);
  if (checkoutRefs.length === 0 || checkoutRefs.some((ref) => ref !== "${{ github.sha }}")) errors.push(`${file}: checkout must use github.sha`);
  const migrationIndex = runs.findIndex((run) => /node scripts\/w13\/migrate-production\.mjs|npm run [^\n]*production-migration/i.test(run));
  if (migrationIndex < 0) errors.push(`${file}: production migration wrapper is required`);
  if (runs.some((run) => /\bprisma\s+migrate\s+deploy\b/i.test(run))) errors.push(`${file}: direct Prisma migration is forbidden`);
  const deployIndex = runs.findIndex((run) => /deploy hook|DEPLOY_HOOK|VERCEL_DEPLOY_HOOK/i.test(run));
  if (deployIndex >= 0 && migrationIndex >= 0 && deployIndex < migrationIndex) errors.push(`${file}: deployment trigger must follow the migration wrapper`);
  if (deployIndex < 0) errors.push(`${file}: deployment trigger is required`);
  return errors;
}

function validateActionReference(reference, pins, file, errors) {
  const at = reference.lastIndexOf("@");
  const repository = at === -1 ? reference : reference.slice(0, at);
  const sha = at === -1 ? "" : reference.slice(at + 1);
  if (repository.startsWith("./")) {
    errors.push(`${file}: local workflow Actions are forbidden`);
    return;
  }
  if (!SHA.test(sha)) errors.push(`${file}: Action ${reference} must use a full commit SHA`);
  const approved = pins?.actions?.[repository];
  if (!approved) errors.push(`${file}: Action repository ${repository} is not in the approved repository manifest`);
  else if (sha !== approved.sha) errors.push(`${file}: Action ${repository} does not match its approved SHA`);
}

function hasWritePermission(permissions) {
  if (typeof permissions === "string") return /^(?:write-all|write)$/i.test(permissions.trim());
  if (!permissions || typeof permissions !== "object" || Array.isArray(permissions)) return false;
  return Object.values(permissions).some((value) => typeof value === "string" && /^write$/i.test(value.trim()));
}

function containsSelfHosted(value) {
  return JSON.stringify(value ?? "").toLowerCase().includes("self-hosted");
}

function containerImages(job) {
  const images = [];
  if (job.container?.image) images.push(String(job.container.image));
  for (const service of Object.values(job.services ?? {})) {
    if (service?.image) images.push(String(service.image));
  }
  return images;
}

function containsCommand(runs, command) {
  const escaped = command.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|\\n|[;&|])\\s*${escaped}(?:\\s|$)`).test(runs);
}

export function validateCiWorkflowContract(text, file = "ci.yml") {
  const errors = [];
  let workflow;
  try {
    const document = parseDocument(text, { uniqueKeys: true });
    if (document.errors.length > 0) return [`${file}: invalid YAML: ${document.errors.map((error) => error.message).join("; ")}`];
    workflow = document.toJS();
  } catch (error) {
    return [`${file}: invalid YAML: ${error instanceof Error ? error.message : String(error)}`];
  }
  const jobs = workflow?.jobs && typeof workflow.jobs === "object" ? workflow.jobs : {};
  for (const [jobName, command] of Object.entries(REQUIRED_CI_COMMANDS)) {
    if (!Object.prototype.hasOwnProperty.call(jobs, jobName)) {
      errors.push(`${file}: required CI job ${jobName} is missing`);
      continue;
    }
    const job = jobs[jobName];
    const runs = (Array.isArray(job?.steps) ? job.steps : [])
      .map((step) => step?.run)
      .filter((run) => typeof run === "string")
      .join("\n");
    if (!containsCommand(runs, command)) errors.push(`${file}: job ${jobName} must run ${command}`);
  }
  const securityRuns = (Array.isArray(jobs["workflow-security-pr"]?.steps) ? jobs["workflow-security-pr"].steps : [])
    .map((step) => step?.run)
    .filter((run) => typeof run === "string")
    .join("\n");
  for (const command of ["npm run check:agent-policy"]) {
    if (!containsCommand(securityRuns, command)) errors.push(`${file}: workflow-security-pr must run ${command}`);
  }
  return errors;
}

export async function validateWorkflowDirectory(root = ".", options = {}) {
  const baseManifest = options.baseSha
    ? actionManifestAtSha(root, options.baseSha)
    : await readFile(join(root, "workflow/action-pins.json"), "utf8");
  const manifest = resolveActionPins({ ...options, baseManifest });
  const directory = join(root, ".github/workflows");
  const files = (await readdir(directory)).filter((file) => /\.ya?ml$/.test(file));
  const errors = [];
  for (const file of files) {
    const text = await readFile(join(directory, file), "utf8");
    errors.push(...validateWorkflowText(text, manifest, `.github/workflows/${file}`));
    if (file === "w13-production.yml") errors.push(...validateProductionWorkflowContract(text, `.github/workflows/${file}`));
    if (file === "ci.yml" || file === "ci.yaml") errors.push(...validateCiWorkflowContract(text, `.github/workflows/${file}`));
  }
  if (!files.some((file) => file === "ci.yml" || file === "ci.yaml")) {
    errors.push(".github/workflows/ci.yml: required CI workflow is missing");
  }
  return errors;
}

function parseArgs(args) {
  const options = {};
  const optionNames = {
    "--base-sha": "baseSha",
    "--base-branch": "baseBranch",
    "--pr-number": "prNumber",
    "--bootstrap-pr-number": "bootstrapPrNumber",
  };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (Object.prototype.hasOwnProperty.call(optionNames, arg)) {
      options[optionNames[arg]] = args[++index];
    } else throw new Error(`unknown workflow-check option: ${arg}`);
  }
  if (!options.baseSha || !options.baseBranch || !options.prNumber) {
    throw new Error("--base-sha, --base-branch, and --pr-number are required");
  }
  return options;
}

async function main() {
  try {
    const errors = await validateWorkflowDirectory(".", parseArgs(process.argv.slice(2)));
    if (errors.length) {
      process.stderr.write(`${errors.join("\n")}\n`);
      process.exitCode = 1;
    }
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
