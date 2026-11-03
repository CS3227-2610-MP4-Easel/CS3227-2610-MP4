import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const required = [
  ".github/**",
  "CODEOWNERS",
  "package.json",
  "package-lock.json",
  ".githooks/**",
  ".gitleaks.toml",
  ".gitignore",
  "scripts/**",
  "workflow/**",
  ".claude/**",
  ".codex/**",
  "src/be/contracts/**",
  "src/be/*/test/**",
  "tests/**",
  "tests/security/attack-corpus/**",
];

function entries(text: string) {
  return text.split("\n").filter((line) => line.trim() && !line.trim().startsWith("#")).map((line) => {
    const [pattern, ...owners] = line.trim().split(/\s+/);
    return { pattern: pattern.replace(/^\//, ""), owners };
  });
}

test("E8/E10 CODEOWNERS covers every protected W12 path", async () => {
  const rows = entries(await readFile(".github/CODEOWNERS", "utf8"));
  for (const pattern of required) assert.ok(rows.some((row) => row.pattern === pattern), `missing ${pattern}`);
  assert.ok(rows.every((row) => row.owners.includes("@teleifo")));
  assert.ok(rows.filter((row) => row.pattern === ".github/**" || row.pattern === "workflow/**" || row.pattern === "tests/security/attack-corpus/**").every((row) => row.owners.includes("@ludannnn")));
  assert.ok(!rows.some((row) => row.pattern.startsWith("packages/")));
});
