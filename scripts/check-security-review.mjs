import { readFileSync } from "node:fs";
import { readFile as readFileAsync } from "node:fs/promises";
import { spawnSync } from "node:child_process";

export const SECURITY_REVIEWER = "@ludannnn";
export const HUMAN_OWNER = "@teleifo";
export const HUMAN_OWNER_FOR_DEV_LEAD = "@xiao-congchen";

function normalizeLogin(value) {
  if (typeof value !== "string" || value.trim() === "") return null;
  return `@${value.trim().replace(/^@+/, "").toLowerCase()}`;
}

export function getRequiredHumanApprover(prAuthor) {
  return normalizeLogin(prAuthor) === "@teleifo" ? HUMAN_OWNER_FOR_DEV_LEAD : HUMAN_OWNER;
}

export function parseSensitiveManifest(manifest) {
  if (!manifest || manifest.version !== 1 || !Array.isArray(manifest.paths)) {
    throw new Error("sensitive-path manifest must contain version 1 and a paths array");
  }
  if (manifest.paths.some((path) => typeof path !== "string" || path.trim() === "")) {
    throw new Error("sensitive-path manifest paths must be non-empty strings");
  }
  if (new Set(manifest.paths).size !== manifest.paths.length) {
    throw new Error("sensitive-path manifest paths must be unique");
  }
  return manifest.paths;
}

const LOCAL_SENSITIVE_PATTERNS = parseSensitiveManifest(JSON.parse(readFileSync("workflow/security-sensitive-paths.json", "utf8")));

function globToRegExp(pattern) {
  const escapedParts = pattern.split("**").map((part) => part
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replaceAll("*", "[^/]*"));
  return new RegExp(`^${escapedParts.join(".*")}$`);
}

export function isSensitivePath(path, patterns = LOCAL_SENSITIVE_PATTERNS) {
  return patterns.map(globToRegExp).some((matcher) => matcher.test(path));
}

function flattenReviews(value, output = []) {
  if (!Array.isArray(value)) throw new Error("GitHub review response must be an array or array of pages");
  for (const item of value) {
    if (Array.isArray(item)) flattenReviews(item, output);
    else if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("GitHub review record is malformed");
    else output.push(item);
  }
  return output;
}

function latestReview(records, login) {
  return records
    .filter((record) => normalizeLogin(record.user?.login) === login)
    .sort((left, right) => {
      const timestamp = String(left.submitted_at ?? "").localeCompare(String(right.submitted_at ?? ""));
      if (timestamp !== 0) return timestamp;
      return Number(left.id ?? 0) - Number(right.id ?? 0);
    })
    .at(-1);
}

function reviewErrors(reviews, headSha, prAuthor) {
  let records;
  try {
    records = flattenReviews(reviews);
  } catch (error) {
    return [error instanceof Error ? error.message : String(error)];
  }

  const errors = [];
  const required = [SECURITY_REVIEWER, getRequiredHumanApprover(prAuthor)];
  for (const login of required) {
    const latest = latestReview(records, login);
    if (!latest) {
      errors.push(`GitHub review from ${login} is required`);
      continue;
    }
    if (latest.state !== "APPROVED") {
      errors.push(`GitHub review from ${login} must be the latest exact-head approval`);
      continue;
    }
    if (latest.commit_id !== headSha) errors.push(`GitHub review from ${login} must approve the exact PR head`);
  }
  return errors;
}

export function validateSecurityReview({ artifact, headSha, prAuthor, changedPaths, reviews, sensitivePatterns = LOCAL_SENSITIVE_PATTERNS }) {
  const sensitiveChanges = changedPaths.filter((path) => isSensitivePath(path, sensitivePatterns));
  if (sensitiveChanges.length === 0) return [];

  const normalizedAuthor = normalizeLogin(prAuthor);
  if (normalizedAuthor === SECURITY_REVIEWER) return ["security reviewer cannot be the pull request author"];
  const requiredHuman = getRequiredHumanApprover(prAuthor);
  if (requiredHuman === normalizedAuthor) return ["human approver cannot be the pull request author"];

  const errors = [];
  if (!artifact) errors.push("security-review artifact is required for sensitive changes");
  else {
    if (artifact.prHead !== headSha) errors.push("security-review artifact does not match the PR head");
    if (normalizeLogin(artifact.reviewer) !== SECURITY_REVIEWER) errors.push(`security-reviewer must be ${SECURITY_REVIEWER}`);
    if (artifact.decision !== "pass") errors.push("security review decision must be pass");
    if (!Array.isArray(artifact.targetPaths) || !sensitiveChanges.every((path) => artifact.targetPaths.includes(path))) {
      errors.push("security-review artifact must cover every sensitive changed path");
    }
  }
  if (reviews == null) errors.push("GitHub review data is required for sensitive changes");
  else errors.push(...reviewErrors(reviews, headSha, prAuthor));
  return errors;
}

function parseArgs(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (["--head-sha", "--base-sha", "--pr-author", "--artifact", "--reviews-file"].includes(arg)) {
      options[arg.slice(2).replaceAll("-", "_")] = args[++index];
    } else throw new Error(`unknown security-review option: ${arg}`);
  }
  if (!options.head_sha || !options.base_sha || !options.pr_author) throw new Error("--base-sha, --head-sha, and --pr-author are required");
  return options;
}

function changedPaths(baseSha, headSha) {
  const result = spawnSync("git", ["diff", "--name-only", `${baseSha}..${headSha}`], { encoding: "utf8" });
  if (result.error || result.status !== 0) throw new Error("unable to resolve the pull request commit range");
  return result.stdout.split("\n").map((path) => path.trim()).filter(Boolean);
}

function baseManifest(baseSha) {
  const result = spawnSync("git", ["show", `${baseSha}:workflow/security-sensitive-paths.json`], { encoding: "utf8" });
  if (result.error || result.status !== 0) throw new Error("unable to resolve the base sensitive-path manifest");
  return parseSensitiveManifest(JSON.parse(result.stdout));
}

export async function runSecurityReview(args = process.argv.slice(2)) {
  const options = parseArgs(args);
  const artifactPath = options.artifact ?? `workflow/security-reviews/${options.head_sha}.json`;
  let artifact = null;
  try { artifact = JSON.parse(await readFileAsync(artifactPath, "utf8")); }
  catch (error) { if (error?.code !== "ENOENT") throw error; }

  const patterns = baseManifest(options.base_sha);
  const changed = changedPaths(options.base_sha, options.head_sha);
  const sensitive = changed.some((path) => isSensitivePath(path, patterns));
  let reviews = null;
  if (sensitive && !options.reviews_file) throw new Error("--reviews-file is required for sensitive changes");
  if (options.reviews_file) reviews = JSON.parse(await readFileAsync(options.reviews_file, "utf8"));

  const errors = validateSecurityReview({
    artifact,
    headSha: options.head_sha,
    prAuthor: options.pr_author,
    changedPaths: changed,
    reviews,
    sensitivePatterns: patterns,
  });
  if (errors.length > 0) {
    for (const error of errors) process.stderr.write(`${error}\n`);
    return 1;
  }
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runSecurityReview().then((status) => { process.exitCode = status; }).catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 2;
  });
}
