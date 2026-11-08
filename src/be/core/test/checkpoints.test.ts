import assert from "node:assert/strict";
import { test } from "node:test";
import { NotMember } from "@agile/contracts";
import { createCheckpoints } from "../src/checkpoints.js";

const projectId = "00000000-0000-4000-8000-000000000001";
const userId = "00000000-0000-4000-8000-000000000002";
const access = (member = true, archived = false) => ({ requireMember: async () => { if (!member) throw new NotMember(); }, archivedMembership: async () => archived });

test("E7 checkpoint creation rejects an archived project before body-dependent writes", async () => {
  let created = false;
  const checkpoints = createCheckpoints({ $transaction: async (work: (tx: any) => Promise<unknown>) => work({ checkpoint: { create: async () => { created = true; } } }) } as any, access(false, true));
  await assert.rejects(() => checkpoints.create({ userId, role: "DEV_LEAD" }, projectId, { name: "M1", targetDate: "2026-12-01" }), /CONFLICT_STATE/);
  assert.equal(created, false);
});

test("checkpoints list by target date then id", async () => {
  const rows = await createCheckpoints({ checkpoint: { findMany: async (args: any) => { assert.deepEqual(args.orderBy, [{ targetDate: "asc" }, { id: "asc" }]); return []; } } } as any, access()).list({ userId, role: "DEVELOPER" }, projectId);
  assert.deepEqual(rows, []);
});

test("E34 non-member archived checkpoint mutation remains not found", async () => {
  const checkpoints = createCheckpoints({ $transaction: async () => { throw new Error("must not begin mutation"); } } as any, access(false, false));
  await assert.rejects(() => checkpoints.create({ userId, role: "DEV_LEAD" }, projectId, { name: "M1", targetDate: "2026-12-01" }), /NOT_FOUND/);
});

test("checkpoint creation rejects impossible calendar dates", async () => {
  const checkpoints = createCheckpoints({} as any, access());
  await assert.rejects(() => checkpoints.create({ userId, role: "DEV_LEAD" }, projectId, { name: "M1", targetDate: "2026-02-31" }), /VALIDATION_FAILED/);
});

test("checkpoint creation rechecks membership with its transaction and blocks an archive race", async () => {
  const tx = { project: { update: async () => ({}) }, checkpoint: { create: async () => { throw new Error("must not write"); } } };
  const seen: unknown[] = [];
  let calls = 0;
  const checkpoints = createCheckpoints({ $transaction: async (work: (transaction: unknown) => Promise<unknown>) => work(tx) } as any, {
    requireMember: async (_userId, _projectId, transaction) => { seen.push(transaction); if (++calls === 2) throw new NotMember(); },
    archivedMembership: async () => true,
  });
  await assert.rejects(() => checkpoints.create({ userId, role: "DEV_LEAD" }, projectId, { name: "M1", targetDate: "2026-12-01" }), /CONFLICT_STATE/);
  assert.deepEqual(seen, [undefined, tx]);
});

test("checkpoint creation locks the project before its transaction membership check", async () => {
  const order: string[] = [];
  const tx = {
    project: { update: async () => { order.push("lock"); return {}; } },
    checkpoint: { create: async () => { order.push("create"); return {}; } },
  };
  const checkpoints = createCheckpoints({ $transaction: async (work: (transaction: unknown) => Promise<unknown>) => work(tx) } as any, {
    requireMember: async (_userId, _projectId, transaction) => { order.push(transaction ? "recheck" : "preflight"); },
    archivedMembership: async () => false,
  });
  await checkpoints.create({ userId, role: "DEV_LEAD" }, projectId, { name: "M1", targetDate: "2026-12-01" });
  assert.deepEqual(order, ["preflight", "lock", "recheck", "create"]);
});
