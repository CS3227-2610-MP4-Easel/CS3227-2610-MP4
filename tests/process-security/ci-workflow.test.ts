import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const root = new URL("../../", import.meta.url);

test("E1/E2/E12/E15 workflow is isolated and gates on W1", async () => {
  const workflow = await readFile(new URL(".github/workflows/ci.yml", root), "utf8");

  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /branches:\s*\[(?:development,\s*main|main,\s*development)\]/);
  assert.match(workflow, /github\.event\.pull_request\.head\.sha/);
  assert.match(workflow, /fetch-depth:\s*0/);
  assert.match(workflow, /permissions:\s*\{\}/);
  assert.match(workflow, /persist-credentials:\s*false/);
  assert.doesNotMatch(workflow, /pull_request_target/);
  assert.doesNotMatch(workflow, /secrets\./);
  assert.doesNotMatch(workflow, /environment:/);

  for (const job of ["workspace", "typecheck", "lint", "contract", "dependency-audit", "secret-scan", "workflow-security"]) {
    assert.match(workflow, new RegExp(`^  ${job}:`, "m"));
  }

  const packageManifest = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
  assert.match(packageManifest.scripts?.contract ?? "", /src\/be\/api\/test\/openapi-parity\.test\.ts/);
  assert.match(packageManifest.scripts?.contract ?? "", /src\/be\/contracts\/test\/openapi\.test\.ts/);
});
