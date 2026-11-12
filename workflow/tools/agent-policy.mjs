import { readFile } from "node:fs/promises";
import { normalize } from "node:path";

const REQUIRED_PROTECTED_PATHS = [
  ".github/**",
  "workflow/agent-permissions.json",
  ".githooks/**",
  ".claude/**",
  ".codex/**",
  "scripts/**",
  "tests/security/attack-corpus/**",
];
const REQUIRED_READ_SCOPES = ["repository", "web", "attack_corpus"];
const REQUIRED_WRITE_SCOPES = ["repository"];
const REQUIRED_DENIED_OPERATIONS = ["unknown", "execute_production", "write_secret"];
const REQUIRED_PRODUCTION_CREDENTIALS = ["*"];
const REQUIRED_PRODUCTION_HOSTS = ["production", "prod", "*.prod.*", "*.production.*"];
const REQUIRED_DENIED_PATHS = ["tests/security/attack-corpus/**"];
const REQUIRED_REVIEWERS = ["@ludannnn"];
const REQUIRED_OWNER = "@teleifo";

function hasStringArray(value) {
  return Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === "string" && item.length > 0);
}

function hasExactStrings(value, expected) {
  return hasStringArray(value)
    && value.length === expected.length
    && expected.every((item) => value.includes(item));
}

function hasRequiredStrings(value, expected) {
  return hasStringArray(value) && expected.every((item) => value.includes(item));
}

function matchesProtectedPath(target, patterns) {
  const candidates = [target, ...(target.match(/(?:"[^"]*"|'[^']*'|[^\s]+)/g) ?? [])]
    .map((candidate) => candidate.replace(/^['"]|['"]$/g, "").replaceAll("\\", "/"))
    .map((candidate) => candidate.includes("/") ? normalize(candidate).replaceAll("\\", "/").replace(/^\.\//, "") : candidate);
  return patterns.some((pattern) => candidates.some((candidate) => {
    if (pattern.endsWith("/**")) {
      const base = pattern.slice(0, -3);
      return candidate === base || candidate.startsWith(`${base}/`);
    }
    return candidate === pattern;
  }));
}

function validateObject(policy) {
  const errors = [];
  if (!policy || typeof policy !== "object" || Array.isArray(policy)) return { valid: false, errors: ["policy must be an object"] };
  if (policy.version !== 1) errors.push("version must be 1");
  if (policy.default !== "deny") errors.push("default must be deny");
  if (!policy.allow || typeof policy.allow !== "object") errors.push("allow must be an object");
  if (!policy.deny || typeof policy.deny !== "object") errors.push("deny must be an object");
  if (!policy.review_required || typeof policy.review_required !== "object") errors.push("review_required must be an object");
  if (!policy.content_handling || typeof policy.content_handling !== "object") errors.push("content_handling must be an object");
  if (policy.allow && !hasExactStrings(policy.allow.read, REQUIRED_READ_SCOPES)) errors.push("allow.read must contain only the approved read scopes");
  if (policy.allow && !hasExactStrings(policy.allow.write, REQUIRED_WRITE_SCOPES)) errors.push("allow.write must contain only the approved write scopes");
  if (policy.deny && !hasExactStrings(policy.deny.operations, REQUIRED_DENIED_OPERATIONS)) errors.push("deny.operations must contain the required denied operations");
  if (policy.deny && !hasExactStrings(policy.deny.production_credentials, REQUIRED_PRODUCTION_CREDENTIALS)) errors.push("deny.production_credentials must deny all production credentials");
  if (policy.deny && !hasExactStrings(policy.deny.production_hosts, REQUIRED_PRODUCTION_HOSTS)) errors.push("deny.production_hosts must contain the required production host patterns");
  if (policy.deny && !hasRequiredStrings(policy.deny.protected_paths, REQUIRED_DENIED_PATHS)) errors.push("deny.protected_paths must protect the attack corpus");
  if (policy.review_required && !hasStringArray(policy.review_required.protected_paths)) errors.push("review_required.protected_paths must be a non-empty string array");
  if (policy.review_required && !hasExactStrings(policy.review_required.reviewers, REQUIRED_REVIEWERS)) errors.push("review_required.reviewers must contain the configured security reviewer");
  if (policy.review_required && policy.review_required.owner !== REQUIRED_OWNER) errors.push(`review_required.owner must be ${REQUIRED_OWNER}`);
  for (const key of ["repository", "web", "attack_corpus"]) {
    if (policy.content_handling?.[key] !== "data_not_instructions") errors.push(`content_handling.${key} must be data_not_instructions`);
  }
  for (const required of REQUIRED_PROTECTED_PATHS) {
    if (!policy.review_required?.protected_paths?.includes(required)) errors.push(`missing protected path ${required}`);
  }
  return { valid: errors.length === 0, errors };
}

export async function validatePolicy(source = "workflow/agent-permissions.json") {
  if (typeof source === "object") return validateObject(source);
  try {
    return validateObject(JSON.parse(await readFile(source, "utf8")));
  } catch (error) {
    return { valid: false, errors: [`cannot load policy: ${error.message}`] };
  }
}

export function evaluatePolicy(policy, request) {
  const validation = validateObject(policy);
  if (!validation.valid) return { allowed: false, reason: "invalid-policy" };
  const operation = request?.operation;
  const target = typeof request?.target === "string" ? request.target : "";
  if (operation === "secret" || operation === "execute_production" || operation === "write_secret") return { allowed: false, reason: "denied" };
  if (operation === "network" && policy.deny.production_hosts.some((host) => target.includes(host.replace("*", "")))) return { allowed: false, reason: "denied" };
  if (operation === "write" && matchesProtectedPath(target, policy.review_required.protected_paths)) {
    return { allowed: false, reason: "review-required", reviewers: policy.review_required.reviewers, owner: policy.review_required.owner };
  }
  // Shell writes inside the repository are ordinary work (git add/commit, npm install, file moves); protected
  // paths are caught above and external targets fall through to default-deny because allow.write is repository only.
  if (operation === "write" && policy.allow.write.includes(request?.scope)) return { allowed: true, reason: "allowed" };
  if (operation === "read" && policy.allow.read.includes(request?.scope)) return { allowed: true, reason: "allowed" };
  return { allowed: false, reason: "default-deny" };
}

async function main() {
  const result = await validatePolicy(process.argv[2] ?? "workflow/agent-permissions.json");
  if (!result.valid) {
    console.error(`agent policy invalid: ${result.errors.join("; ")}`);
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
