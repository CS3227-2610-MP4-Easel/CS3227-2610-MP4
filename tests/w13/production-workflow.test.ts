import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { parseDocument } from "yaml";

const root = new URL("../../", import.meta.url);
const workflowPath = new URL(".github/workflows/w13-production.yml", root);

async function loadWorkflow() {
  const text = await readFile(workflowPath, "utf8");
  const document = parseDocument(text, { uniqueKeys: true });
  assert.equal(document.errors.length, 0, "production workflow must be valid YAML");
  return { text, workflow: document.toJS() as Record<string, any> };
}

test("production workflow is push-only, serialized, and protected", async () => {
  const { workflow } = await loadWorkflow();
  assert.deepEqual(Object.keys(workflow.on), ["push"]);
  assert.deepEqual(workflow.on.push.branches, ["main"]);
  assert.deepEqual(workflow.permissions, { contents: "read" });
  assert.deepEqual(workflow.concurrency, { group: "production", "cancel-in-progress": false });

  const jobs = Object.values(workflow.jobs) as Array<Record<string, any>>;
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].environment, "production");
  assert.deepEqual(workflow.env, {
    APP_TIER: "prod",
    VERCEL_ENV: "production",
    NEON_HOST: "ep-summer-heart-b3767eul-pooler.c-4.ap-southeast-1.aws.neon.tech",
    NEON_PROJECT: "super-sunset-36592949",
  });
});

test("production workflow checks out github.sha and gates the deploy hook on migration", async () => {
  const { text, workflow } = await loadWorkflow();
  const steps = (Object.values(workflow.jobs)[0] as Record<string, any>).steps as Array<Record<string, any>>;
  const checkout = steps.find((step) => typeof step.uses === "string" && step.uses.startsWith("actions/checkout@"));
  assert.equal(checkout?.with?.ref, "${{ github.sha }}");
  assert.equal(checkout?.uses, "actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683");
  assert.ok(steps.some((step) => step.uses === "actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020"));

  const runs = steps.map((step) => String(step.run ?? ""));
  const migrationIndex = runs.indexOf("node --import tsx scripts/w13/migrate-production.mjs");
  const hookIndex = runs.findIndex((run) => run.includes("VERCEL_DEPLOY_HOOK_URL"));
  assert.ok(migrationIndex >= 0);
  assert.ok(hookIndex > migrationIndex);
  assert.equal(steps[hookIndex].if, "success()");
  assert.equal(steps[migrationIndex].env.DIRECT_DATABASE_URL, "${{ secrets.DIRECT_DATABASE_URL }}");
  assert.equal(steps[hookIndex].env.VERCEL_DEPLOY_HOOK_URL, "${{ secrets.VERCEL_DEPLOY_HOOK_URL }}");
  assert.match(text, /npm ci --ignore-scripts/);
  assert.match(text, /npm --workspace @agile\/db run prisma:generate/);
  assert.match(text, /npm run typecheck/);
  assert.match(text, /npm --workspace easel-fe run build/);
  assert.doesNotMatch(text, /pull_request|workflow_dispatch|VERCEL_API_TOKEN|VERCEL_TOKEN|VERCEL_TEAM_ID/);
  assert.doesNotMatch(text, /prisma\s+migrate\s+deploy/);
});
