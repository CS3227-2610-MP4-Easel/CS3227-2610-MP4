#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { mediateAgentOperation } from "../workflow/tools/agent-mediation.mjs";

function repoRelative(value, root) {
  if (typeof value !== "string" || value.length === 0) return { target: "", scope: "external" };
  const repository = resolve(root);
  const candidate = resolve(repository, value);
  const target = relative(repository, candidate).replaceAll(sep, "/");
  const external = target === ".." || target.startsWith("../") || isAbsolute(target);
  return { target: target || ".", scope: external ? "external" : "repository" };
}

function firstInputValue(input, keys) {
  for (const key of keys) {
    if (typeof input?.[key] === "string" && input[key].length > 0) return input[key];
  }
  return "";
}

function hasExternalPathArgument(command, root) {
  const tokens = command.match(/(?:"[^"]*"|'[^']*'|[^\s]+)/g) ?? [];
  return tokens.slice(1).some((token) => {
    const value = token.replace(/^['"]|['"]$/g, "");
    if (!value || value.startsWith("-")) return false;
    if (value.startsWith("~")) return true;
    if (!value.includes("/") && !value.includes("\\")) return false;
    return repoRelative(value, root).scope === "external";
  });
}

function commandRequest(command, root) {
  const value = command.trim();
  if (/\b(?:DATABASE_URL|FIREBASE_|GITHUB_TOKEN|OPENAI_API_KEY|AWS_SECRET|process\.env|printenv|env)\b/i.test(value)) {
    return { operation: "secret", target: value };
  }
  if (/\b(?:curl|wget|ssh|scp|nc|netcat|npm\s+publish|git\s+push)\b/i.test(value)) {
    return { operation: "network", target: value };
  }
  if (/(?:^|[;&|]\s*)(?:rm|mv|cp|touch|mkdir|chmod|chown|install|sed\s+(?:-i|--in-place)|perl\s+(?:-i|--in-place)|git\s+(?:add|commit|reset|checkout|apply|merge|rebase))\b|>>?|\b(?:rm|mv|cp)\s/i.test(value)) {
    return { operation: "write", scope: "repository", source: "shell", target: value };
  }
  if (/(?:--output(?:=|\s)|--in-place\b|--ext-diff\b|\s-(?:exec|execdir|delete)\b)/i.test(value)) {
    return { operation: "unknown", target: value };
  }
  if (hasExternalPathArgument(value, root)) return { operation: "unknown", target: value };
  if (!/[;&|`$()<>]/.test(value) && [
    /^(?:pwd|ls|find|rg|grep|sed|cat|head|tail)(?:\s+[^\n]+)?$/,
    /^git\s+(?:status|diff|log|show|rev-parse)(?:\s+[^\n]+)?$/,
    /^npm\s+(?:test|run\s+(?:typecheck|lint|contract|scan:secrets|check:(?:workflows|agent-policy|security-review))(?:\s+[^\n]+)?|--workspace\s+[@\w./-]+\s+run\s+(?:typecheck|prisma:validate))$/,
  ].some((pattern) => pattern.test(value))) {
    return { operation: "read", scope: "repository", target: value };
  }
  return { operation: "unknown", target: value };
}

export function requestFromToolCall(input, root = process.cwd()) {
  const tool = input?.tool_name || input?.toolName;
  const toolInput = input?.tool_input || input?.toolInput || {};
  if (tool === "apply_patch") {
    const patch = firstInputValue(toolInput, ["patch"]);
    const files = [...patch.matchAll(/^\*\*\* (?:Update|Add|Delete) File:\s*(.+)$/gm)].map((match) => match[1].trim());
    if (files.length === 0) return { operation: "unknown", target: patch };
    const paths = files.map((file) => repoRelative(file, root));
    return {
      operation: "write",
      scope: paths.some((path) => path.scope === "external") ? "external" : "repository",
      target: paths.map((path) => path.target).join(" "),
    };
  }
  const pathValue = firstInputValue(toolInput, ["file_path", "path", "file", "pattern"]);
  if (["Read", "Grep", "Glob", "Search"].includes(tool)) {
    const path = repoRelative(pathValue, root);
    return { operation: "read", scope: path.scope, target: path.target };
  }
  if (["WebFetch", "WebSearch"].includes(tool)) {
    return { operation: "read", scope: "web", target: firstInputValue(toolInput, ["url", "query", "search_query"]) };
  }
  if (["Write", "Edit", "apply_patch"].includes(tool)) {
    const path = repoRelative(pathValue, root);
    return { operation: "write", scope: path.scope, target: path.target };
  }
  if (tool === "Bash") return commandRequest(firstInputValue(toolInput, ["command", "cmd"]), root);
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
