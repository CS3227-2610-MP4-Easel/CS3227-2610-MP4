import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { test } from "node:test";
import { join } from "node:path";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
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
    "python3 -c 'print(1)'",
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

test("F8 pre-tool mediation rejects mutation flags that write outside the repository", async () => {
  for (const command of ["git diff --output=/tmp/outside.txt", "find /tmp -delete"]) {
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

const policyPath = join(root, "workflow/agent-permissions.json");
const bash = (command: string) => mediatePreToolUse({ tool_name: "Bash", tool_input: { command } }, policyPath);
const edit = (file_path: string) => mediatePreToolUse({ tool_name: "Edit", tool_input: { file_path } }, policyPath);

test("external literal paths are denied regardless of parent existence", async () => {
  const dir = await mkdtemp(join(tmpdir(), "hook-path-"));
  const parent = join(dir, "missing");
  const outside = join(parent, "file").replaceAll("\\", "/");
  try {
    for (const command of [
      `mv src/be/index.ts ${outside}`, `mkdir -p ${outside}`, `cat ${outside}`, `find ${outside}`,
      `git diff --output=${outside}`, `echo x > ${outside}`, `echo x >> ${outside}`,
      `sed -f ${outside} src/be/index.ts`, `sed -n '/^model/,/^}/p' ${outside}`,
      `grep -f ${outside} src/be/index.ts`, `rg -f ${outside} src/be/index.ts`,
      `rg -e pattern ${outside}`, `rg -f repo-patterns ${outside}`,
      `grep -e one -f repo-patterns -e two ${outside}`,
    ]) assert.deepEqual(await bash(command), { allowed: false, reason: "default-deny" }, command);
    await mkdir(parent);
    assert.deepEqual(await bash(`cat ${outside}`), { allowed: false, reason: "default-deny" });
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("literal search expressions stay distinct from path operands", async () => {
  for (const command of [
    "sed -n '/^model Project {/,/^}/p' src/be/db/prisma/schema.prisma",
    "grep '/^model/' src/be/db/prisma/schema.prisma",
    "grep -e '/^model/' src/be/db/prisma/schema.prisma",
    "rg '/^model/' src/be/db/prisma/schema.prisma",
    "rg -e '/^model/' -e '/^enum/' src/be/db/prisma/schema.prisma",
    `cat ${join(root, "src/be/index.ts").replaceAll("\\", "/")}`,
  ]) assert.deepEqual(await bash(command), { allowed: true, reason: "allowed" }, command);
  if (process.platform === "win32") {
    assert.equal((await bash("cat Z:/nonexistent-hook-test/file")).reason, "default-deny");
    assert.equal((await bash("cat //nonexistent-hook-server/share/file")).reason, "default-deny");
  }
});

test("F8 pre-tool mediation allows ordinary repository work in the shell", async () => {
  for (const command of [
    "git add src/be/index.ts workflow/plans/2026-11-05-w2-gateway.md",
    "git commit -m \"feat: something (W2)\" -m \"Workstream: W2\"",
    "git checkout -b w2-follow-up origin/development",
    "git fetch origin && git merge origin/development",
    "npm install left-pad",
    "npm --workspace @agile/db run prisma:generate",
    "node workflow/tools/ws.mjs pack implementer --area llm-gateway",
    "grep -n \"model\" src/be/db/prisma/schema.prisma | head -5",
    "grep -E \"F8|E8 protected\" tests/process-security/agent-hook.test.ts",
    "sed -n '/^model Project {/,/^}/p' src/be/db/prisma/schema.prisma",
    "npm test 2>&1 | tail -5",
    "ls > /dev/null",
    "cp .ws/w2-plan.md workflow/plans/2026-11-05-w2-gateway.md",
  ]) {
    assert.deepEqual(await bash(command), { allowed: true, reason: "allowed" }, command);
  }
});

test("F8 pre-tool mediation still denies push, publish, verification bypass and hidden commands", async () => {
  for (const command of [
    "git push origin w2-gateway",
    "git commit --no-verify -m x",
    "git commit -n -m x",
    "npm publish",
    "curl https://example.com",
    "echo $(cat src/be/index.ts)",
    "echo `whoami`",
    "ls; curl https://example.com",
    "ls && echo \"a|b\" | curl https://example.com",
    "git config core.hooksPath /tmp",
  ]) {
    assert.equal((await bash(command)).allowed, false, command);
  }
});

test("F8 agents write workflow outputs but not workflow controls", async () => {
  for (const file of ["workflow/plans/x.md", "workflow/specs/x.md", "workflow/project-state/branch-states/x.md", "workflow/project-state/STATE.md", "workflow/skill-feedback.md"]) {
    assert.deepEqual(await edit(file), { allowed: true, reason: "allowed" }, file);
  }
  for (const file of ["workflow/agent-permissions.json", "workflow/tools/ws.mjs", "workflow/agents/reviewer.md", "workflow/skills/branch-state/SKILL.md", "workflow/config.json", "workflow/security-sensitive-paths.json"]) {
    assert.equal((await edit(file)).reason, "review-required", file);
  }
  assert.equal((await bash("cp a.json workflow/config.json")).reason, "review-required");
});

test("F8 shell redirects are writes to their target", async () => {
  assert.equal((await bash("echo x > /tmp/outside.txt")).reason, "default-deny");
  assert.equal((await bash("echo x > scripts/extra.mjs")).reason, "review-required");
  assert.deepEqual(await bash("echo x > notes.txt"), { allowed: true, reason: "allowed" });
});

test("F8 commands naming secrets stay denied", async () => {
  for (const command of ["grep FIREBASE_PROJECT_ID src/be/auth/src/settings.ts", "cat src/fe/.env.local", "printenv", "env"]) {
    assert.deepEqual(await bash(command), { allowed: false, reason: "denied" }, command);
  }
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
