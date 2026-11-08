import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const workflow = readFileSync(new URL("../../.github/workflows/w13-dev-check.yml", import.meta.url), "utf8");

test("E14/E27 metadata lookup precedes checkout and never exposes its token later", () => {
  const lookup = workflow.indexOf("Resolve current Vercel deployment before checkout");
  const checkout = workflow.indexOf("actions/checkout@");
  assert.ok(lookup >= 0 && lookup < checkout);
  assert.doesNotMatch(workflow, /environment:/);
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
  assert.match(workflow, /startswith\("dpl_"\)/);
  assert.match(workflow, /v13\/deployments\/\$\{deployment_id\}/);
  assert.match(workflow, /v2\/deployments\/\$\{deployment_id\}\/aliases/);
  assert.match(workflow, /VERCEL_DEV_ALIAS: \$\{\{ vars\.VERCEL_DEV_ALIAS \}\}/);
  assert.match(workflow, /\.readyState == "READY"/);
  assert.match(workflow, /jq -n/);
  assert.match(workflow, /current Vercel deployment was not ready or unambiguous before timeout/);
  assert.doesNotMatch(workflow, /fail-with-body/);
});

test("Vercel's documented alias response passes only for the expected hostname", () => {
  const expression = workflow.match(/jq -e --arg alias "[^"]+"(?: --arg id "[^"]+")? '([^']+)' "\$\{aliases_file\}"/);
  assert.ok(expression, "workflow must validate the raw alias response before checkout");
  const response = { aliases: [{ alias: "agile-platform-development.example.com", created: "2017-04-26T23:00:34.232Z", uid: "alias_current" }] };
  const check = (expected: string) => spawnSync("jq", ["-e", "--arg", "alias", expected, "--arg", "id", "dpl_current", expression[1]], { input: JSON.stringify(response), encoding: "utf8" });
  assert.equal(check(response.aliases[0].alias).status, 0);
  assert.notEqual(check("wrong.example.com").status, 0);
});

test("Vercel's documented deployment ID and millisecond timestamp pass the identity check", () => {
  const expression = workflow.match(/jq -e --arg sha [^\n]+ '([^']+)' "\$\{deployment_file\}"/);
  assert.ok(expression, "workflow must validate the deployment response before checkout");
  const sha = "0123456789abcdef0123456789abcdef01234567";
  const deployment = { id: "dpl_current", projectId: "prj_U7YYwCGOdx4pThKCPYdkXH1a9Smd", meta: { githubCommitSha: sha }, readyState: "READY", createdAt: Date.parse("2026-11-07T10:01:00Z") };
  const check = (value: typeof deployment) => spawnSync("jq", ["-e", "--arg", "sha", sha, "--arg", "project", deployment.projectId, "--arg", "pushed", "2026-11-07T10:00:00Z", "--arg", "id", deployment.id, expression[1]], { input: JSON.stringify(value), encoding: "utf8" });
  assert.equal(check(deployment).status, 0);
  assert.notEqual(check({ ...deployment, meta: { githubCommitSha: "f".repeat(40) } }).status, 0);
});
