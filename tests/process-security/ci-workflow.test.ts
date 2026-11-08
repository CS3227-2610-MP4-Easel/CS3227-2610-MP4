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
  assert.match(workflow, /DATABASE_URL:\s*postgresql:\/\/postgres:postgres@localhost:5432\/agile_platform/);

  for (const job of ["workspace", "typecheck", "lint", "contract", "dependency-audit", "secret-scan", "workflow-security-pr"]) {
    assert.match(workflow, new RegExp(`^  ${job}:`, "m"));
  }

  for (const job of ["workspace", "typecheck", "lint"]) {
    const start = workflow.indexOf(`  ${job}:`);
    const remainder = workflow.slice(start + 1);
    const next = remainder.search(/^  [a-z-]+:/m);
    const section = workflow.slice(start, next < 0 ? workflow.length : start + 1 + next);
    assert.match(section, /npm --workspace @agile\/db run prisma:generate/);
  }
  const workspaceStart = workflow.indexOf("  workspace:");
  const workspaceEnd = workflow.indexOf("\n  typecheck:", workspaceStart);
  const workspace = workflow.slice(workspaceStart, workspaceEnd);
  assert.match(workspace, /services:\s*\n\s+postgres:/);
  assert.match(workspace, /postgres:16@sha256:/);
  assert.match(workspace, /ports:\s*\n\s+- 5432:5432/);
  assert.match(workspace, /W1_INTEGRATION_DATABASE_URL:\s*postgresql:\/\/postgres:postgres@localhost:5432\/agile_platform\?connection_limit=25/);
  assert.match(workspace, /test -n "\$W1_INTEGRATION_DATABASE_URL"/);
  assert.match(workspace, /prisma migrate deploy -- --schema prisma\/schema\.prisma/);
  assert.match(workflow, /GITLEAKS_VERSION:\s*8\.24\.2/);
  assert.match(workflow, /fa0500f6b7e41d28791ebc680f5dd9899cd42b58629218a5f041efa899151a8e/);
  assert.match(workflow, /sha256sum --check/);

  const packageManifest = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
  assert.equal(packageManifest.scripts?.test, "node --import tsx scripts/discover-tests.mjs");
  assert.match(packageManifest.scripts?.["check:security-review"] ?? "", /check-security-review\.mjs/);
  assert.doesNotMatch(workflow, /npm run check:security-review/);
  assert.match(workflow, /npm run check:workflows -- --base-sha/);
  assert.match(workflow, /check:workflows -- --base-sha .*--base-branch/);
  assert.match(workflow, /check:workflows -- --base-sha .*--bootstrap-pr-number/);
  assert.match(workflow, /--base-branch "\$\{\{ github\.event\.pull_request\.base\.ref \}\}"/);
  assert.match(workflow, /--pr-number "\$\{\{ github\.event\.pull_request\.number \}\}"/);
  assert.match(workflow, /--bootstrap-pr-number "\$\{\{ vars\.W12_BOOTSTRAP_PR_NUMBER \}\}"/);
  assert.match(packageManifest.scripts?.contract ?? "", /src\/be\/api\/test\/openapi-parity\.test\.ts/);
  assert.match(packageManifest.scripts?.contract ?? "", /src\/be\/contracts\/test\/openapi\.test\.ts/);
});
