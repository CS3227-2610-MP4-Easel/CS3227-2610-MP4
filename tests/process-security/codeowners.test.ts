import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const requiredOwners = ["@teleifo", "@ludannnn", "@Xiao-Congchen"];

function entries(text: string) {
  return text.split("\n").filter((line) => line.trim() && !line.trim().startsWith("#")).map((line) => {
    const [pattern, ...owners] = line.trim().split(/\s+/);
    return { pattern: pattern.replace(/^\//, ""), owners };
  });
}

test("E8/E10 CODEOWNERS covers every canonical sensitive path", async () => {
  const manifest = JSON.parse(await readFile("workflow/security-sensitive-paths.json", "utf8"));
  assert.deepEqual(Object.keys(manifest).sort(), ["paths", "version"]);
  assert.equal(manifest.version, 1);
  assert.ok(Array.isArray(manifest.paths));
  assert.equal(new Set(manifest.paths).size, manifest.paths.length);

  const rows = entries(await readFile(".github/CODEOWNERS", "utf8"));
  for (const pattern of manifest.paths) {
    const row = rows.find((candidate) => candidate.pattern === pattern);
    assert.ok(row, `missing ${pattern}`);
    for (const owner of requiredOwners) assert.ok(row.owners.includes(owner), `${pattern} missing ${owner}`);
  }
  assert.ok(rows.every((row) => row.owners.includes("@teleifo")));
  assert.ok(!rows.some((row) => row.pattern.startsWith("packages/")));
});
