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
  assert.match(workflow, /DATABASE_URL:\s*postgresql:\/\/localhost:5432\/agile_platform/);

  for (const job of ["workspace", "typecheck", "lint", "contract", "dependency-audit", "secret-scan", "workflow-security"]) {
    assert.match(workflow, new RegExp(`^  ${job}:`, "m"));
  }

  for (const job of ["workspace", "typecheck", "lint"]) {
    const start = workflow.indexOf(`  ${job}:`);
    const remainder = workflow.slice(start + 1);
    const next = remainder.search(/^  [a-z-]+:/m);
    const section = workflow.slice(start, next < 0 ? workflow.length : start + 1 + next);
    assert.match(section, /npm --workspace @agile\/db run prisma:generate/);
  }
  assert.match(workflow, /GITLEAKS_VERSION:\s*8\.24\.2/);
  assert.match(workflow, /fa0500f6b7e41d28791ebc680f5dd9899cd42b58629218a5f041efa899151a8e/);
  assert.match(workflow, /sha256sum --check/);

  const packageManifest = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
  assert.match(packageManifest.scripts?.test ?? "", /find tests src\/be -type f -name '\*\.test\.ts' -print/);
  assert.match(packageManifest.scripts?.contract ?? "", /src\/be\/api\/test\/openapi-parity\.test\.ts/);
  assert.match(packageManifest.scripts?.contract ?? "", /src\/be\/contracts\/test\/openapi\.test\.ts/);
});
