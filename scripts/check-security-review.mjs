import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

export const SECURITY_REVIEWER = "@ludannnn";
export const HUMAN_OWNER = "@teleifo";

const SENSITIVE_PATTERNS = [
  ".github/**",
  ".claude/**",
  ".codex/**",
  ".githooks/**",
  ".gitleaks.toml",
  ".gitleaksignore",
  "scripts/**",
  "workflow/**",
  "src/be/*/test/**",
  "tests/process-security/**",
  "tests/security/attack-corpus/**",
];

function globToRegExp(pattern) {
  const escapedParts = pattern.split("**").map((part) => part
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replaceAll("*", "[^/]*"));
  return new RegExp(`^${escapedParts.join(".*")}$`);
}

const sensitiveMatchers = SENSITIVE_PATTERNS.map(globToRegExp);

export function isSensitivePath(path) {
  return sensitiveMatchers.some((matcher) => matcher.test(path));
}

export function validateSecurityReview({ artifact, headSha, prAuthor, changedPaths }) {
  const sensitiveChanges = changedPaths.filter(isSensitivePath);
  if (sensitiveChanges.length === 0) return [];
  if (!artifact) return ["security-review artifact is required for sensitive changes"];
  if (artifact.prHead !== headSha) return ["security-review artifact does not match the PR head"];
  if (artifact.reviewer === prAuthor) return ["security-reviewer cannot be the pull request author"];
  if (artifact.reviewer !== SECURITY_REVIEWER) return [`security-reviewer must be ${SECURITY_REVIEWER}`];
  if (artifact.decision !== "pass") return ["security review decision must be pass"];
  if (!Array.isArray(artifact.targetPaths) || !sensitiveChanges.every((path) => artifact.targetPaths.includes(path))) {
    return ["security-review artifact must cover every sensitive changed path"];
  }
  if (!artifact.humanApproval || artifact.humanApproval.approved !== true) {
    return ["independent human approval is required"];
  }
  if (artifact.humanApproval.login === artifact.reviewer) {
    return ["human approval must be independent of the security reviewer"];
  }
  if (artifact.humanApproval.login === prAuthor) {
    return ["human approval cannot be from the pull request author"];
  }
  if (artifact.humanApproval.login !== HUMAN_OWNER) {
    return [`human approval must be from ${HUMAN_OWNER}`];
  }
  return [];
}

function parseArgs(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (["--head-sha", "--base-sha", "--pr-author", "--artifact"].includes(arg)) {
      options[arg.slice(2).replaceAll("-", "_")] = args[++index];
    } else {
      throw new Error(`unknown security-review option: ${arg}`);
    }
  }
  if (!options.head_sha || !options.base_sha || !options.pr_author) {
    throw new Error("--base-sha, --head-sha, and --pr-author are required");
  }
  return options;
}

function changedPaths(baseSha, headSha) {
  const result = spawnSync("git", ["diff", "--name-only", `${baseSha}..${headSha}`], { encoding: "utf8" });
  if (result.error || result.status !== 0) {
    throw new Error("unable to resolve the pull request commit range");
  }
  return result.stdout.split("\n").map((path) => path.trim()).filter(Boolean);
}

export async function runSecurityReview(args = process.argv.slice(2)) {
  const options = parseArgs(args);
  const artifactPath = options.artifact ?? `workflow/security-reviews/${options.head_sha}.json`;
  let artifact = null;
  try {
    artifact = JSON.parse(await readFile(artifactPath, "utf8"));
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  const errors = validateSecurityReview({
    artifact,
    headSha: options.head_sha,
    prAuthor: options.pr_author,
    changedPaths: changedPaths(options.base_sha, options.head_sha),
  });
  if (errors.length > 0) {
    for (const error of errors) process.stderr.write(`${error}\n`);
    return 1;
  }
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runSecurityReview()
    .then((status) => { process.exitCode = status; })
    .catch((error) => {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 2;
    });
}
