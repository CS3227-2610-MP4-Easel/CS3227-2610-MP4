import assert from "node:assert/strict";
import { test } from "node:test";
import { createCheckpoints } from "../src/checkpoints.js";

const projectId = "00000000-0000-4000-8000-000000000001";
const userId = "00000000-0000-4000-8000-000000000002";

test("E7 checkpoint creation rejects an archived project before body-dependent writes", async () => {
  let created = false;
  const checkpoints = createCheckpoints({ $transaction: async (work: (tx: any) => Promise<unknown>) => work({ project: { findFirst: async () => ({ status: "ARCHIVED" }) }, checkpoint: { create: async () => { created = true; } } }) } as any);
  await assert.rejects(() => checkpoints.create({ userId, role: "DEV_LEAD" }, projectId, { name: "M1", targetDate: "2026-12-01" }), /CONFLICT_STATE/);
  assert.equal(created, false);
});

test("checkpoints list by target date then id", async () => {
  const rows = await createCheckpoints({ checkpoint: { findMany: async (args: any) => { assert.deepEqual(args.orderBy, [{ targetDate: "asc" }, { id: "asc" }]); return []; } } } as any).list({ userId, role: "DEVELOPER" }, projectId);
  assert.deepEqual(rows, []);
});
