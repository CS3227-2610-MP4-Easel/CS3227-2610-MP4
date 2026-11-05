import { readFile } from "node:fs/promises";
import { evaluatePolicy, validatePolicy } from "./agent-policy.mjs";

export const DEFAULT_POLICY_PATH = "workflow/agent-permissions.json";

export async function mediateAgentOperation(request, source = DEFAULT_POLICY_PATH) {
  let policy;
  try {
    policy = JSON.parse(await readFile(source, "utf8"));
  } catch {
    return { allowed: false, reason: "invalid-policy" };
  }
  const validation = await validatePolicy(policy);
  if (!validation.valid) return { allowed: false, reason: "invalid-policy" };
  return evaluatePolicy(policy, request);
}
