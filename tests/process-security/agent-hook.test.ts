import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { test } from "node:test";
import { join } from "node:path";
import { mediatePreToolUse, requestFromToolCall } from "../../scripts/agent-pre-tool-hook.mjs";

const root = process.cwd();

test("F8 pre-tool mediation blocks protected file writes at the provider boundary", async () => {
  const input = {
    tool_name: "Write",
    tool_input: { file_path: join(root, ".github/workflows/ci.yml") },
  };
  assert.deepEqual(requestFromToolCall(input, root), {
    operation: "write",
    scope: "repository",
    target: ".github/workflows/ci.yml",
  });
  assert.deepEqual(await mediatePreToolUse(input, join(root, "workflow/agent-permissions.json")), {
    allowed: false,
    reason: "review-required",
    reviewers: ["@ludannnn"],
    owner: "@teleifo",
  });
});

test("F8 pre-tool mediation allows ordinary repository reads and writes", async () => {
  const read = { tool_name: "Read", tool_input: { file_path: join(root, "src/be/index.ts") } };
  const write = { tool_name: "Edit", tool_input: { file_path: join(root, "src/be/index.ts") } };
  assert.deepEqual(await mediatePreToolUse(read, join(root, "workflow/agent-permissions.json")), {
    allowed: true,
    reason: "allowed",
  });
  assert.deepEqual(await mediatePreToolUse(write, join(root, "workflow/agent-permissions.json")), {
    allowed: true,
    reason: "allowed",
  });
});

test("F8 pre-tool mediation fails closed for unknown provider tools", async () => {
  const input = { tool_name: "UnknownTool", tool_input: {} };
  assert.deepEqual(await mediatePreToolUse(input, join(root, "workflow/agent-permissions.json")), {
    allowed: false,
    reason: "default-deny",
  });
});

test("F8 provider hook CLI emits a blocking decision and exit code", async () => {
  const child = spawn(process.execPath, ["scripts/agent-pre-tool-hook.mjs"], { cwd: root });
  let output = "";
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stdin.end(JSON.stringify({
    tool_name: "Write",
    tool_input: { file_path: join(root, ".github/workflows/ci.yml") },
  }));
  const exitCode = await new Promise((resolve) => child.once("close", resolve));
  assert.equal(exitCode, 2);
  assert.match(output, /"permissionDecision":"deny"/);
});
