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

test("F8 pre-tool mediation resolves apply-patch file paths", async () => {
  const ordinary = {
    tool_name: "apply_patch",
    tool_input: { patch: "*** Begin Patch\n*** Update File: src/be/index.ts\n@@\n" },
  };
  assert.deepEqual(requestFromToolCall(ordinary, root), {
    operation: "write",
    scope: "repository",
    target: "src/be/index.ts",
  });
  assert.deepEqual(await mediatePreToolUse(ordinary, join(root, "workflow/agent-permissions.json")), {
    allowed: true,
    reason: "allowed",
  });

  const protectedPatch = {
    tool_name: "apply_patch",
    tool_input: { patch: "*** Begin Patch\n*** Update File: .codex/hooks.json\n@@\n" },
  };
  assert.equal((await mediatePreToolUse(protectedPatch, join(root, "workflow/agent-permissions.json"))).reason, "review-required");
});

test("F8 pre-tool mediation fails closed for unknown provider tools", async () => {
  const input = { tool_name: "UnknownTool", tool_input: {} };
  assert.deepEqual(await mediatePreToolUse(input, join(root, "workflow/agent-permissions.json")), {
    allowed: false,
    reason: "default-deny",
  });
});

test("F8 pre-tool mediation denies unclassified shell commands", async () => {
  for (const command of [
    "node -e \"require('fs').writeFileSync('.github/workflows/ci.yml','x')\"",
    "npm install left-pad",
  ]) {
    const input = { tool_name: "Bash", tool_input: { command } };
    assert.deepEqual(requestFromToolCall(input, root), { operation: "unknown", target: command });
    assert.deepEqual(await mediatePreToolUse(input, join(root, "workflow/agent-permissions.json")), {
      allowed: false,
      reason: "default-deny",
    });
  }
});

test("F8 pre-tool mediation normalizes traversal and rejects external paths", async () => {
  const traversal = {
    tool_name: "Write",
    tool_input: { file_path: "src/../.github/workflows/ci.yml" },
  };
  assert.deepEqual(requestFromToolCall(traversal, root), {
    operation: "write",
    scope: "repository",
    target: ".github/workflows/ci.yml",
  });
  assert.equal((await mediatePreToolUse(traversal, join(root, "workflow/agent-permissions.json"))).reason, "review-required");

  const external = {
    tool_name: "Write",
    tool_input: { file_path: "/tmp/outside.txt" },
  };
  assert.equal(requestFromToolCall(external, root).scope, "external");
  assert.deepEqual(await mediatePreToolUse(external, join(root, "workflow/agent-permissions.json")), {
    allowed: false,
    reason: "default-deny",
  });
});

test("F8 pre-tool mediation protects its provider control plane", async () => {
  for (const file_path of [".codex/hooks.json", ".claude/settings.json", "scripts/agent-pre-tool-hook.mjs"]) {
    assert.deepEqual(await mediatePreToolUse({ tool_name: "Edit", tool_input: { file_path } }, join(root, "workflow/agent-permissions.json")), {
      allowed: false,
      reason: "review-required",
      reviewers: ["@ludannnn"],
      owner: "@teleifo",
    });
  }
  assert.deepEqual(await mediatePreToolUse({ tool_name: "Bash", tool_input: { command: "rm .codex/hooks.json" } }, join(root, "workflow/agent-permissions.json")), {
    allowed: false,
    reason: "review-required",
    reviewers: ["@ludannnn"],
    owner: "@teleifo",
  });
});

test("F8 pre-tool mediation allows approved repository inspection commands with arguments", async () => {
  const input = {
    tool_name: "Bash",
    tool_input: { command: "npm run check:workflows -- --base-sha abc" },
  };
  assert.deepEqual(await mediatePreToolUse(input, join(root, "workflow/agent-permissions.json")), {
    allowed: true,
    reason: "allowed",
  });
});

test("F8 pre-tool mediation denies shell-originated writes", async () => {
  const input = {
    tool_name: "Bash",
    tool_input: { command: "mv src/be/index.ts /tmp/outside.txt" },
  };
  assert.deepEqual(await mediatePreToolUse(input, join(root, "workflow/agent-permissions.json")), {
    allowed: false,
    reason: "default-deny",
  });
});

test("F8 pre-tool mediation rejects mutation flags hidden in read commands", async () => {
  for (const command of ["git diff --output=/tmp/outside.txt", "find . -exec rm {} \\"]) {
    const input = { tool_name: "Bash", tool_input: { command } };
    assert.deepEqual(await mediatePreToolUse(input, join(root, "workflow/agent-permissions.json")), {
      allowed: false,
      reason: "default-deny",
    });
  }
});

test("F8 pre-tool mediation rejects external paths hidden in read commands", async () => {
  for (const command of ["cat /tmp/outside.txt", "rg secret ../other-repo", "find /tmp -maxdepth 1"]) {
    const input = { tool_name: "Bash", tool_input: { command } };
    assert.deepEqual(await mediatePreToolUse(input, join(root, "workflow/agent-permissions.json")), {
      allowed: false,
      reason: "default-deny",
    });
  }
});

test("F8 pre-tool mediation rejects unapproved npm workspace scripts", async () => {
  const input = {
    tool_name: "Bash",
    tool_input: { command: "npm --workspace @agile/db run prisma:generate" },
  };
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
