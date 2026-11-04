#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { mediateAgentOperation } from "../workflow/tools/agent-mediation.mjs";

function repoRelative(value, root) {
  if (typeof value !== "string" || value.length === 0) return "";
  const candidate = isAbsolute(value) ? resolve(value) : value;
  if (!isAbsolute(candidate)) return candidate.replaceAll("\\", "/");
  const rel = relative(root, candidate).replaceAll(sep, "/");
  return rel && !rel.startsWith("../") && rel !== ".." ? rel : candidate.replaceAll(sep, "/");
}

function firstInputValue(input, keys) {
  for (const key of keys) {
    if (typeof input?.[key] === "string" && input[key].length > 0) return input[key];
  }
  return "";
}

function commandRequest(command) {
  const value = command.trim();
  if (/\b(?:DATABASE_URL|FIREBASE_|GITHUB_TOKEN|OPENAI_API_KEY|AWS_SECRET|process\.env|printenv|env)\b/i.test(value)) {
    return { operation: "secret", target: value };
  }
  if (/\b(?:curl|wget|ssh|scp|nc|netcat|npm\s+publish|git\s+push)\b/i.test(value)) {
    return { operation: "network", target: value };
  }
  if (/(?:^|[;&|]\s*)(?:rm|mv|cp|touch|mkdir|chmod|chown|install|sed\s+-i|perl\s+-i|git\s+(?:add|commit|reset|checkout|apply|merge|rebase))\b|>>?|\b(?:rm|mv|cp)\s/i.test(value)) {
    return { operation: "write", scope: "repository", target: value };
  }
  return { operation: "read", scope: "repository", target: value };
}

export function requestFromToolCall(input, root = process.cwd()) {
  const tool = input?.tool_name || input?.toolName;
  const toolInput = input?.tool_input || input?.toolInput || {};
  const pathValue = firstInputValue(toolInput, ["file_path", "path", "file", "pattern"]);
  if (["Read", "Grep", "Glob", "Search"].includes(tool)) {
    return { operation: "read", scope: "repository", target: repoRelative(pathValue, root) };
  }
  if (["WebFetch", "WebSearch"].includes(tool)) {
    return { operation: "read", scope: "web", target: firstInputValue(toolInput, ["url", "query", "search_query"]) };
  }
  if (["Write", "Edit", "apply_patch"].includes(tool)) {
    return { operation: "write", scope: "repository", target: repoRelative(pathValue, root) };
  }
  if (tool === "Bash") return commandRequest(firstInputValue(toolInput, ["command", "cmd"]));
  return { operation: "unknown", target: "" };
}

export async function mediatePreToolUse(input, policyPath = "workflow/agent-permissions.json", root = process.cwd()) {
  return mediateAgentOperation(requestFromToolCall(input, root), policyPath);
}

function repositoryRoot() {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
  } catch {
    return process.cwd();
  }
}

function deny(reason) {
  process.stdout.write(`${JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: `Agent policy denied: ${reason}`,
    },
  })}\n`);
  process.exitCode = 2;
}

async function main() {
  try {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    const input = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    const root = repositoryRoot();
    const result = await mediatePreToolUse(input, resolve(root, "workflow/agent-permissions.json"), root);
    if (!result.allowed) deny(result.reason);
  } catch {
    deny("invalid-request");
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
