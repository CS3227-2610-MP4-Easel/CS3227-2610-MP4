import assert from "node:assert/strict";
import { test } from "node:test";
import { runSeed, seedDemoData, type SeedClient } from "../prisma/seed.js";

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
  await assert.rejects(runSeed({ APP_TIER: "prod", DATABASE_URL: "postgresql://prod.example/db" }), /production|prod/i);
  await assert.rejects(runSeed({ APP_TIER: "preview" }), /tier/i);
  await assert.rejects(runSeed({ APP_TIER: "staging" }), /tier/i);
});
