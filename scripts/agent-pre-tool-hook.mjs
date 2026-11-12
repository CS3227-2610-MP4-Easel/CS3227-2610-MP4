#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
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

const unquote = (token) => token.replace(/^['"]|['"]$/g, "");
const tokenize = (text) => (text.match(/(?:"[^"]*"|'[^']*'|[^\s]+)/g) ?? []).map(unquote);

/** True when a path token names a path outside the repository; `/dev/null` is always allowed. */
function isExternalPath(value, root) {
  if (!value || value === "/dev/null") return false;
  if (value.startsWith("~")) return true;
  if (!value.includes("/") && !value.includes("\\")) return false;
  return repoRelative(value, root).scope === "external";
}

const SECRET = [
  /\b(?:DATABASE_URL|FIREBASE_\w*|GITHUB_TOKEN|OPENAI_API_KEY|AWS_SECRET\w*|SOCLAAS_API_KEY|process\.env|printenv)\b/i,
  /(?:^|[\s;&|])env(?:\s|$)/,
  /(?:^|[\s/'"=])\.env(?:[.\s'"]|$)/,
];
const NETWORK = /^(?:curl|wget|ssh|scp|nc|netcat|gh)$/;
const READ_PROGRAMS = new Set(["pwd", "ls", "find", "rg", "grep", "sed", "cat", "head", "tail", "wc", "sort", "uniq", "cut", "tr", "diff", "echo", "printf", "true", "false", "test", "which", "stat", "du", "file", "basename", "dirname", "realpath", "cd", "sleep", "jq"]);
// File operations write their arguments; tool runners write somewhere, but their arguments are inputs, not targets.
const FILE_WRITE_PROGRAMS = new Set(["mkdir", "cp", "mv", "rm", "touch", "chmod", "ln"]);
const RUNNER_PROGRAMS = new Set(["node", "npx", "tsx", "tsc", "npm", "docker", "prisma"]);
const GIT_READ = new Set(["status", "diff", "log", "show", "rev-parse", "branch", "blame", "ls-files", "grep", "describe", "shortlog", "check-ignore", "merge-base"]);
const GIT_WRITE = new Set(["add", "commit", "checkout", "switch", "restore", "merge", "rebase", "fetch", "pull", "stash", "reset", "cherry-pick", "revert", "tag", "mv", "rm"]);

/** Classifies one simple command (no `&&`, `|` or `;`). `written` lists the paths the policy checks against protected paths. */
function classifySegment(segment, root) {
  const tokens = tokenize(segment);
  while (tokens.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[0])) tokens.shift();
  const [program = "", ...args] = tokens;
  const expressions = new Set();
  if (program === "sed" && args[0] === "-n" && /^\/[^/\\;\n]+\/,\/[^/\\;\n]+\/p$/.test(args[1] ?? "")) expressions.add(1);
  if (program === "grep" || program === "rg") {
    const explicit = args.includes("-e") || args.includes("-f");
    let positional = false;
    for (let i = 0; i < args.length; i++) {
      if (args[i] === "-e") { if (++i < args.length) expressions.add(i); }
      else if (args[i] === "-f") i++;
      else if (!explicit && !positional && !args[i].startsWith("-")) { expressions.add(i); positional = true; }
    }
  }
  const paths = args.map((arg, index) => expressions.has(index) ? "" : (arg.startsWith("-") && arg.includes("=") ? arg.slice(arg.indexOf("=") + 1) : arg));
  const operands = paths.filter((arg) => !arg.startsWith("-"));
  let operation;
  let written = [];
  if (NETWORK.test(program)) operation = "network";
  else if (program === "git") {
    const sub = args.find((arg) => !arg.startsWith("-")) ?? "";
    // push leaves the machine; --no-verify skips the local secret scan; config can repoint hooks.
    if (sub === "push") operation = "network";
    else if (args.includes("--no-verify") || (args.includes("-n") && sub === "commit")) operation = "unknown";
    else if (GIT_WRITE.has(sub)) { operation = "write"; written = operands.slice(1); }
    else if (GIT_READ.has(sub)) operation = "read";
    else operation = "unknown";
  } else if (program === "npm" && args[0] === "publish") operation = "network";
  else if (program === "node" && args.some((arg) => /^(?:-e|--eval|-p|--print)$/.test(arg))) operation = "unknown";
  else if (FILE_WRITE_PROGRAMS.has(program)) { operation = "write"; written = operands; }
  else if (RUNNER_PROGRAMS.has(program)) operation = "write";
  else if (program === "sed" && args.some((arg) => /^(?:-i|--in-place)/.test(arg))) { operation = "write"; written = operands; }
  else if (program === "find" && args.some((arg) => /^-(?:exec|execdir|delete|ok)$/.test(arg))) { operation = "write"; written = operands; }
  else if (READ_PROGRAMS.has(program)) operation = "read";
  else operation = "unknown";
  if (operation === "read" && args.some((arg) => /^--output(?:=|$)/.test(arg))) { operation = "write"; written = paths; }

  // Redirections write their target: `> file`, `>> file`, `2> file`; `2>&1` and `/dev/null` are harmless.
  for (const match of segment.matchAll(/\d*>>?\s*([^\s&|;<>]+)/g)) {
    const target = unquote(match[1]);
    if (target.startsWith("&") || target === "/dev/null") continue;
    paths.push(target);
    written.push(target);
    if (operation === "read") operation = "write";
  }
  const external = paths.some((path) => isExternalPath(path, root));
  return { operation, external, written };
}

/** Splits on `&&`, `||`, `;`, `|` and newlines outside quotes, so `grep -E "a|b"` stays one command. */
function splitCommand(value) {
  const segments = [];
  let current = "";
  let quote = null;
  for (let index = 0; index < value.length; index++) {
    const char = value[index];
    if (quote) {
      if (char === quote) quote = null;
      current += char;
    } else if (char === "'" || char === "\"") {
      quote = char;
      current += char;
    } else if (char === ";" || char === "\n" || char === "|" || (char === "&" && value[index + 1] === "&" && value[index - 1] !== ">")) {
      if (char === "&" || (char === "|" && value[index + 1] === "|")) index++;
      segments.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  segments.push(current.trim());
  return segments.filter(Boolean);
}

function commandRequest(command, root) {
  const value = command.trim();
  if (SECRET.some((pattern) => pattern.test(value))) return { operation: "secret", target: value };
  // Command substitution and process substitution can hide any command, so they stay unclassified.
  if (/\$\(|`|<\(|>\(/.test(value)) return { operation: "unknown", target: value };
  const segments = splitCommand(value);
  if (segments.length === 0) return { operation: "unknown", target: value };
  const results = segments.map((segment) => classifySegment(segment, root));
  for (const operation of ["network", "unknown"]) {
    if (results.some((result) => result.operation === operation)) return { operation, target: value };
  }
  const operation = results.some((result) => result.operation === "write") ? "write" : "read";
  const scope = results.some((result) => result.external) ? "external" : "repository";
  if (operation === "read") return { operation, scope, target: value };
  // The policy matches protected paths against the target, so it carries only the paths actually written.
  return { operation, scope, source: "shell", target: results.flatMap((result) => result.written).join(" ") };
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

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
