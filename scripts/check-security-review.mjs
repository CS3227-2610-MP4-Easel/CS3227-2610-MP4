import { readFileSync } from "node:fs";
import { readFile as readFileAsync } from "node:fs/promises";
import { spawnSync } from "node:child_process";

export const SECURITY_REVIEWER = "@ludannnn";
export const HUMAN_OWNER = "@teleifo";
export const HUMAN_OWNER_FOR_DEV_LEAD = "@xiao-congchen";
export const BOOTSTRAP_TARGET_BRANCH = "development";
export const BOOTSTRAP_BASE_SHA = "7bd65440023a0123ac92445e5b6e58ec838ee57c";
export const BOOTSTRAP_PATHS = Object.freeze([
  ".github/**", "CODEOWNERS", "package.json", "package-lock.json", ".githooks/**",
  ".gitleaks.toml", ".gitleaksignore", ".gitignore", "scripts/**", "workflow/**",
  ".claude/**", ".codex/**", "src/be/contracts/**", "src/be/*/test/**", "tests/**",
  "tests/security/attack-corpus/**",
]);

function normalizeLogin(value) {
  if (typeof value !== "string" || value.trim() === "") return null;
  return `@${value.trim().replace(/^@+/, "").toLowerCase()}`;
}

export function getRequiredHumanApprover(prAuthor) {
  return normalizeLogin(prAuthor) === "@teleifo" ? HUMAN_OWNER_FOR_DEV_LEAD : HUMAN_OWNER;
}

export function parseSensitiveManifest(manifest) {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)
    || Object.keys(manifest).length !== 2
    || !Object.prototype.hasOwnProperty.call(manifest, "version")
    || !Object.prototype.hasOwnProperty.call(manifest, "paths")
    || manifest.version !== 1 || !Array.isArray(manifest.paths)) {
    throw new Error("sensitive-path manifest must contain exactly version and paths, version 1, and a paths array");
  }
  if (manifest.paths.some((path) => typeof path !== "string" || path.trim() === "")) {
    throw new Error("sensitive-path manifest paths must be non-empty strings");
  }
  if (new Set(manifest.paths).size !== manifest.paths.length) {
    throw new Error("sensitive-path manifest paths must be unique");
  }
  return manifest.paths;
}

function rejectDuplicateJsonObjectKeys(text) {
  const objectKeys = [];
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === '"') {
      const start = index;
      index += 1;
      while (index < text.length) {
        if (text[index] === "\\") index += 2;
        else if (text[index] === '"') break;
        else index += 1;
      }
      if (index >= text.length) break;
      let next = index + 1;
      while (/\s/.test(text[next] ?? "")) next += 1;
      if (text[next] === ":" && objectKeys.length > 0) {
        const key = JSON.parse(text.slice(start, index + 1));
        const keys = objectKeys.at(-1);
        if (keys.has(key)) throw new Error(`duplicate JSON object key: ${key}`);
        keys.add(key);
      }
    } else if (text[index] === "{") objectKeys.push(new Set());
    else if (text[index] === "}") objectKeys.pop();
  }
}

export function parseSensitiveManifestText(text) {
  rejectDuplicateJsonObjectKeys(text);
  return parseSensitiveManifest(JSON.parse(text));
}

export function resolveBaseSensitivePatterns({ baseManifest, baseBranch, baseSha, prNumber, bootstrapPrNumber }) {
  if (baseManifest !== null && baseManifest !== undefined) {
    return typeof baseManifest === "string" ? parseSensitiveManifestText(baseManifest) : parseSensitiveManifest(baseManifest);
  }
  if (baseBranch !== BOOTSTRAP_TARGET_BRANCH) throw new Error("bootstrap requires the development target");
  if (baseSha === BOOTSTRAP_BASE_SHA && (!bootstrapPrNumber || String(prNumber) !== String(bootstrapPrNumber))) {
    throw new Error("bootstrap requires the configured pull request");
  }
  if (baseSha !== BOOTSTRAP_BASE_SHA) throw new Error("base sensitive-path manifest is required after bootstrap");
  return BOOTSTRAP_PATHS;
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
    else if (!item || typeof item !== "object" || Array.isArray(item)
      || !item.user || typeof item.user !== "object"
      || typeof item.user.login !== "string" || item.user.login.trim() === ""
      || typeof item.state !== "string" || item.state.trim() === ""
      || typeof item.commit_id !== "string" || item.commit_id.trim() === ""
      || typeof item.submitted_at !== "string" || item.submitted_at.trim() === ""
      || !Number.isInteger(item.id) || item.id < 1) {
      throw new Error("GitHub review record is malformed");
    } else output.push(item);
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

export function validateSecurityReview({ headSha, prAuthor, changedPaths, reviews, sensitivePatterns = LOCAL_SENSITIVE_PATTERNS }) {
  const sensitiveChanges = changedPaths.filter((path) => isSensitivePath(path, sensitivePatterns));
  if (sensitiveChanges.length === 0) return [];

  const normalizedAuthor = normalizeLogin(prAuthor);
  if (normalizedAuthor === SECURITY_REVIEWER) return ["security reviewer cannot be the pull request author"];
  const requiredHuman = getRequiredHumanApprover(prAuthor);
  if (requiredHuman === normalizedAuthor) return ["human approver cannot be the pull request author"];

  const errors = [];
  if (reviews == null) errors.push("GitHub review data is required for sensitive changes");
  else errors.push(...reviewErrors(reviews, headSha, prAuthor));
  return errors;
}

function parseArgs(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (["--head-sha", "--base-sha", "--base-branch", "--pr-number", "--bootstrap-pr-number", "--pr-author", "--reviews-file"].includes(arg)) {
      options[arg.slice(2).replaceAll("-", "_")] = args[++index];
    } else throw new Error(`unknown security-review option: ${arg}`);
  }
  if (!options.head_sha || !options.base_sha || !options.base_branch || !options.pr_number || !options.pr_author) {
    throw new Error("--base-sha, --head-sha, --base-branch, --pr-number, and --pr-author are required");
  }
  return options;
}

function changedPaths(baseSha, headSha) {
  const result = spawnSync("git", ["diff", "--name-only", `${baseSha}..${headSha}`], { encoding: "utf8" });
  if (result.error || result.status !== 0) throw new Error("unable to resolve the pull request commit range");
  return result.stdout.split("\n").map((path) => path.trim()).filter(Boolean);
}

function manifestTextAtSha(sha) {
  const result = spawnSync("git", ["show", `${sha}:workflow/security-sensitive-paths.json`], { encoding: "utf8" });
  if (result.error || result.status !== 0) return null;
  return result.stdout;
}

function manifestChanged(changed) {
  return changed.includes("workflow/security-sensitive-paths.json");
}

export async function runSecurityReview(args = process.argv.slice(2)) {
  const options = parseArgs(args);
  const changed = changedPaths(options.base_sha, options.head_sha);
  const baseText = manifestTextAtSha(options.base_sha);
  const patterns = resolveBaseSensitivePatterns({
    baseManifest: baseText,
    baseBranch: options.base_branch,
    baseSha: options.base_sha,
    prNumber: options.pr_number,
    bootstrapPrNumber: options.bootstrap_pr_number,
  });
  const headText = manifestTextAtSha(options.head_sha);
  if (baseText === null || manifestChanged(changed)) {
    if (headText === null) throw new Error("head sensitive-path manifest is required");
    const headPatterns = parseSensitiveManifestText(headText);
    if (baseText === null && JSON.stringify(headPatterns) !== JSON.stringify(BOOTSTRAP_PATHS)) {
      throw new Error("bootstrap head manifest must match the fixed list");
    }
  }
  const sensitive = changed.some((path) => isSensitivePath(path, patterns));
  let reviews = null;
  if (sensitive && !options.reviews_file) throw new Error("--reviews-file is required for sensitive changes");
  if (options.reviews_file) reviews = JSON.parse(await readFileAsync(options.reviews_file, "utf8"));

  const errors = validateSecurityReview({
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
