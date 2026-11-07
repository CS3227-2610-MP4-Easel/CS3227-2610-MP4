import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const workflow = readFileSync(new URL("../../.github/workflows/w13-dev-check.yml", import.meta.url), "utf8");

test("E14/E27 protected metadata lookup precedes checkout and never exposes its token later", () => {
  const lookup = workflow.indexOf("Resolve current Vercel deployment before checkout");
  const checkout = workflow.indexOf("actions/checkout@");
  assert.ok(lookup >= 0 && lookup < checkout);
  assert.match(workflow, /environment: w13-development-verification/);
  assert.match(workflow, /VERCEL_TOKEN: \$\{\{ secrets\.VERCEL_TOKEN \}\}/);
  assert.match(workflow, /METADATA_FILE: \$\{\{ runner\.temp \}\}\/w13-vercel-metadata\.json/);
  assert.match(workflow, /GITHUB_SHA: \$\{\{ github\.sha \}\}/);
  assert.match(workflow, /PUSH_TIMESTAMP: \$\{\{ github\.event\.head_commit\.timestamp \}\}/);
  assert.match(workflow, /sleep 10/);
  assert.match(workflow, /seq 1 30/);
  const laterSteps = workflow.slice(checkout);
  assert.doesNotMatch(laterSteps, /VERCEL_TOKEN|GH_TOKEN|secrets\.VERCEL_TOKEN/);
  assert.doesNotMatch(workflow, /pull_request:/);
});

test("E4/E21/E22/E26 workflow selects exactly one current Vercel check and sanitizes fields", () => {
  assert.match(workflow, /commits\/\$\{GITHUB_SHA\}\/check-runs/);
  assert.match(workflow, /external_id/);
  assert.match(workflow, /v13\/deployments\/\$\{deployment_id\}/);
  assert.match(workflow, /v2\/deployments\/\$\{deployment_id\}\/aliases/);
  assert.match(workflow, /\.uid == \$id/);
  assert.match(workflow, /\.readyState == "READY"/);
  assert.match(workflow, /\.deploymentId == \$id/);
  assert.match(workflow, /jq -n/);
  assert.match(workflow, /current Vercel deployment was not ready or unambiguous before timeout/);
  assert.doesNotMatch(workflow, /fail-with-body/);
});
