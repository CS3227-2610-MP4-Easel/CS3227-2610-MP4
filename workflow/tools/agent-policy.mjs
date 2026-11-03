import { readFile } from "node:fs/promises";

const REQUIRED_PROTECTED_PATHS = [
  ".github/**",
  "workflow/agent-permissions.json",
  ".githooks/**",
  "tests/security/attack-corpus/**",
];

function hasStringArray(value) {
  return Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === "string" && item.length > 0);
}

function matchesProtectedPath(target, patterns) {
  return patterns.some((pattern) => {
    if (pattern.endsWith("/**")) {
      const base = pattern.slice(0, -3);
      return target === base || target.startsWith(`${base}/`);
    }
    return target === pattern;
  });
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
  if (policy.allow && !hasStringArray(policy.allow.read)) errors.push("allow.read must be a non-empty string array");
  if (policy.deny && !hasStringArray(policy.deny.production_credentials)) errors.push("deny.production_credentials must be a non-empty string array");
  if (policy.deny && !hasStringArray(policy.deny.production_hosts)) errors.push("deny.production_hosts must be a non-empty string array");
  if (policy.review_required && !hasStringArray(policy.review_required.protected_paths)) errors.push("review_required.protected_paths must be a non-empty string array");
  if (policy.review_required && !hasStringArray(policy.review_required.reviewers)) errors.push("review_required.reviewers must be a non-empty string array");
  if (policy.review_required && typeof policy.review_required.owner !== "string") errors.push("review_required.owner must be a string");
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
