import assert from "node:assert/strict";
import { test } from "node:test";
import { runSeed, runSeedWithFactory, seedDemoData, type SeedClient } from "../prisma/seed.js";
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
  await assert.rejects(runSeed({ APP_TIER: "prod", DATABASE_URL: "postgresql://user:password@ep-summer-heart-b3767eul-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb", NEON_HOST: "ep-summer-heart-b3767eul-pooler.c-4.ap-southeast-1.aws.neon.tech", NEON_PROJECT: "super-sunset-36592949" }), /production|prod/i);
  await assert.rejects(runSeed({ APP_TIER: "preview" }), /tier/i);
  await assert.rejects(runSeed({ APP_TIER: "staging" }), /tier/i);
});

test("E5/E6/E15/E16/E23/E28 canonical targets reject every cross-tier database substitution", () => {
  const dev = { APP_TIER: "dev", DATABASE_URL: "postgresql://user:placeholder@ep-fragrant-union-aod4nxjd-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb", NEON_HOST: "ep-fragrant-union-aod4nxjd-pooler.c-2.ap-southeast-1.aws.neon.tech", NEON_PROJECT: "falling-rice-06970921" };
  assert.deepEqual(getTierTarget("dev"), { tier: "dev", env: "dev", vercelEnv: "preview", branch: "development", neonHost: "ep-fragrant-union-aod4nxjd-pooler.c-2.ap-southeast-1.aws.neon.tech", neonProject: "falling-rice-06970921", databaseName: "neondb", vercelProject: "prj_U7YYwCGOdx4pThKCPYdkXH1a9Smd", vercelAlias: "development", firebaseProjectId: "agile-platform-dev", soclaasBaseUrl: "https://soclaas-api.comp.nus.edu.sg/v1" });
  assert.deepEqual(parseDatabaseTarget(dev.DATABASE_URL), { protocol: "postgresql:", host: "ep-fragrant-union-aod4nxjd-pooler.c-2.ap-southeast-1.aws.neon.tech", databaseName: "neondb" });
  assert.doesNotThrow(() => validateDatabaseTarget(dev, dev.APP_TIER));
  for (const key of ["DATABASE_URL", "NEON_HOST", "NEON_PROJECT"] as const) {
    const mismatch = { ...dev, [key]: key === "DATABASE_URL" ? "postgresql://user:password@ep-summer-heart-b3767eul-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb" : "ep-summer-heart-b3767eul-pooler.c-4.ap-southeast-1.aws.neon.tech" };
    if (key === "NEON_PROJECT") mismatch[key] = "agile-platform-prod";
    assert.throws(() => validateDatabaseTarget(mismatch, "dev"), /target|observations/i);
  }
  assert.throws(() => validateDatabaseTarget({ ...dev, DATABASE_URL: "not-a-url" }, "dev"), /malformed|protocol/i);
});

test("E1 recovery target is rejected before seed client construction", async () => {
  let constructed = false;
  await assert.rejects(runSeedWithFactory({
    APP_TIER: "dev",
    W13_RECOVERY_REHEARSAL: "1",
    NEON_BRANCH: "w13-recovery-baseline",
    NEON_HOST: "ep-other-shape-aohygd1w.c-2.ap-southeast-1.aws.neon.tech",
    NEON_PROJECT: "falling-rice-06970921",
    DATABASE_URL: "postgresql://user:password@ep-other-shape-aohygd1w.c-2.ap-southeast-1.aws.neon.tech/neondb",
  }, () => {
    constructed = true;
    throw new Error("client must not be constructed");
  }), /target|observations/i);
  assert.equal(constructed, false);
});
