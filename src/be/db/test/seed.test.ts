import assert from "node:assert/strict";
import { test } from "node:test";
import { runSeed, seedDemoData, type SeedClient } from "../prisma/seed.js";
import { getTierTarget, parseDatabaseTarget, validateDatabaseTarget } from "../src/tier-targets.js";

function fakeClient() {
  const calls: unknown[] = [];
  const model = (name: string) => ({
    upsert: async (args: unknown) => {
      calls.push({ name, args });
      const input = args as { create?: { id?: string } };
      return { id: input.create?.id ?? `${name}-id` };
    },
  });
  return { client: { user: model("user"), project: model("project"), projectMember: model("projectMember"), checkpoint: model("checkpoint"), epic: model("epic"), sprint: model("sprint"), task: model("task") } as unknown as SeedClient, calls };
}

test("E7/E8 seed creates the complete non-production demo shape", async () => {
  const { client, calls } = fakeClient();
  await seedDemoData(client);
  const names = calls.map((call) => (call as { name: string }).name);
  assert.equal(names.filter((name) => name === "user").length, 3);
  assert.equal(names.filter((name) => name === "projectMember").length, 3);
  assert.equal(names.filter((name) => name === "sprint").length, 3);
  assert.ok(names.includes("checkpoint"));
  assert.ok(names.includes("epic"));
  assert.ok(names.includes("task"));
  assert.equal(JSON.stringify(calls).includes("REGISTRATION_CODE"), false);
  assert.equal(JSON.stringify(calls).includes("API_KEY"), false);
});

test("E20 repeated seed input is deterministic", async () => {
  const first = fakeClient();
  const second = fakeClient();
  await seedDemoData(first.client);
  await seedDemoData(second.client);
  assert.deepEqual(first.calls, second.calls);
});

test("E21/E28 seed rejects unsupported and production tiers before client construction", async () => {
  await assert.rejects(runSeed({ APP_TIER: "prod", DATABASE_URL: "postgresql://prod.neon.tech/agile_platform", NEON_HOST: "prod.neon.tech", NEON_PROJECT: "agile-platform-prod" }), /production|prod/i);
  await assert.rejects(runSeed({ APP_TIER: "preview" }), /tier/i);
  await assert.rejects(runSeed({ APP_TIER: "staging" }), /tier/i);
});

test("E5/E6/E15/E16/E23/E28 canonical targets reject every cross-tier database substitution", () => {
  const dev = { APP_TIER: "dev", DATABASE_URL: "postgresql://dev.neon.tech/agile_platform", NEON_HOST: "dev.neon.tech", NEON_PROJECT: "agile-platform-dev" };
  assert.deepEqual(getTierTarget("dev"), { tier: "dev", env: "dev", vercelEnv: "preview", branch: "development", neonHost: "dev.neon.tech", neonProject: "agile-platform-dev", databaseName: "agile_platform" });
  assert.deepEqual(parseDatabaseTarget(dev.DATABASE_URL), { protocol: "postgresql:", host: "dev.neon.tech", databaseName: "agile_platform" });
  assert.doesNotThrow(() => validateDatabaseTarget(dev, dev.APP_TIER));
  for (const key of ["DATABASE_URL", "NEON_HOST", "NEON_PROJECT"] as const) {
    const mismatch = { ...dev, [key]: key === "DATABASE_URL" ? "postgresql://prod.neon.tech/agile_platform" : "prod.neon.tech" };
    if (key === "NEON_PROJECT") mismatch[key] = "agile-platform-prod";
    assert.throws(() => validateDatabaseTarget(mismatch, "dev"), /target|observations/i);
  }
  assert.throws(() => validateDatabaseTarget({ ...dev, DATABASE_URL: "not-a-url" }, "dev"), /malformed|protocol/i);
});
