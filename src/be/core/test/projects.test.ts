import assert from "node:assert/strict";
import { test } from "node:test";
import { NotMember } from "@agile/contracts";
import { createProjects } from "../src/projects.js";

const projectId = "00000000-0000-4000-8000-000000000001";
const userId = "00000000-0000-4000-8000-000000000002";
const now = new Date("2026-11-08T00:00:00.000Z");
const access = (member = true, archived = false) => ({
  requireMember: async () => { if (!member) throw new NotMember(); },
  archivedMembership: async () => archived,
});

test("E2 project creation commits the project and creator membership together", async () => {
  const calls: string[] = [];
  const db = {
    $transaction: async (work: (tx: any) => Promise<unknown>, options: unknown) => {
      assert.deepEqual(options, { isolationLevel: "RepeatableRead" });
      calls.push("transaction");
      return work({ project: { create: async () => { calls.push("project"); return { id: projectId, name: "Roadmap", brief: null, status: "ACTIVE", createdBy: userId, createdAt: now, updatedAt: now, version: 1 }; } }, projectMember: { create: async () => { calls.push("member"); } } });
    },
  };
  const projects = createProjects(db as any, access());
  const created = await projects.create({ userId, role: "PM" }, { name: "Roadmap", brief: null });
  assert.equal(created.id, projectId);
  assert.deepEqual(calls, ["transaction", "project", "member"]);
});

test("E3-E5 add member normalizes email, rejects absent users, and returns an existing membership", async () => {
  const lookups: unknown[] = [];
  const existing = { userId: "00000000-0000-4000-8000-000000000003", displayName: "Lead", role: "DEV_LEAD", addedAt: now };
  const db = {
    $transaction: async (work: (tx: any) => Promise<unknown>) => work({
      project: { findFirst: async () => ({ status: "ACTIVE" }) },
      user: { findFirst: async (args: unknown) => { lookups.push(args); return { id: existing.userId, displayName: existing.displayName, role: existing.role }; } },
      projectMember: { findFirst: async () => ({ ...existing }), create: async () => { throw new Error("must not create duplicate"); } },
    }),
  };
  const result = await createProjects(db as any, access()).addMember({ userId, role: "PM" }, projectId, { email: "  LEAD@example.test  " });
  assert.deepEqual(result, { member: { ...existing, addedAt: now.toISOString() }, created: false });
  assert.deepEqual(lookups, [{ where: { email: "lead@example.test" }, select: { id: true, displayName: true, role: true } }]);
  await assert.rejects(() => createProjects({ ...db, $transaction: async (work: (tx: any) => Promise<unknown>) => work({ project: { findFirst: async () => ({ status: "ACTIVE" }) }, user: { findFirst: async () => null }, projectMember: {} }) } as any, access()).addMember({ userId, role: "PM" }, projectId, { email: "missing@example.test" }), /VALIDATION_FAILED/);
});

test("E27 concurrent add rereads the one membership only after the P2002 transaction rolls back", async () => {
  const member = { userId: "00000000-0000-4000-8000-000000000003", displayName: "Dev", role: "DEVELOPER", addedAt: now };
  let reads = 0;
  const db = {
    $transaction: async (work: (tx: any) => Promise<unknown>) => work({
      project: { findFirst: async () => ({ status: "ACTIVE" }) }, user: { findFirst: async () => ({ id: member.userId, displayName: member.displayName, role: member.role }) },
      projectMember: { findFirst: async () => { assert.equal(++reads, 1, "transaction never rereads after P2002"); return null; }, create: async () => { throw Object.assign(new Error("unique"), { code: "P2002" }); } },
    }),
    projectMember: { findFirst: async () => member },
  };
  assert.deepEqual(await createProjects(db as any, access()).addMember({ userId, role: "DEV_LEAD" }, projectId, { email: "dev@example.test" }), { member: { ...member, addedAt: now.toISOString() }, created: false });
});

test("project-scoped services prove caller membership before any project query", async () => {
  const db = { project: { findMany: async () => { throw new Error("must not query"); }, count: async () => 0, findFirst: async () => { throw new Error("must not query"); } }, projectMember: { findMany: async () => { throw new Error("must not query"); } } };
  const projects = createProjects(db as any, access(false));
  await assert.rejects(() => projects.detail({ userId, role: "DEVELOPER" }, projectId), /NOT_FOUND/);
  await assert.rejects(() => projects.members({ userId, role: "DEVELOPER" }, projectId), /NOT_FOUND/);
});

test("E7/E34 membership proof determines archived write precedence", async () => {
  const db = { $transaction: async (work: (tx: any) => Promise<unknown>) => work({}) };
  await assert.rejects(() => createProjects(db as any, access(false, true)).addMember({ userId, role: "PM" }, projectId, { email: "lead@example.test" }), /CONFLICT_STATE/);
  await assert.rejects(() => createProjects(db as any, access(false, false)).addMember({ userId, role: "PM" }, projectId, { email: "lead@example.test" }), /NOT_FOUND/);
});

test("add member rechecks membership with its transaction and blocks an archive race", async () => {
  const tx = { user: { findFirst: async () => { throw new Error("must not resolve target"); } }, projectMember: { findFirst: async () => null, create: async () => { throw new Error("must not write"); } } };
  const seen: unknown[] = [];
  let calls = 0;
  const projects = createProjects({ $transaction: async (work: (transaction: unknown) => Promise<unknown>) => work(tx) } as any, {
    requireMember: async (_userId, _projectId, transaction) => { seen.push(transaction); if (++calls === 2) throw new NotMember(); },
    archivedMembership: async () => true,
  });
  await assert.rejects(() => projects.addMember({ userId, role: "PM" }, projectId, { email: "lead@example.test" }), /CONFLICT_STATE/);
  assert.deepEqual(seen, [undefined, tx]);
});

test("unexpected membership failures escape rather than becoming not found", async () => {
  let checkedArchive = false;
  const projects = createProjects({} as any, { requireMember: async () => { throw new Error("db unavailable"); }, archivedMembership: async () => { checkedArchive = true; return false; } });
  await assert.rejects(() => projects.detail({ userId, role: "DEVELOPER" }, projectId), /db unavailable/);
  assert.equal(checkedArchive, false);
});

test("project services reject missing or mismatched actors", async () => {
  await assert.rejects(() => createProjects({} as any, access()).create({ userId, role: "DEV_LEAD" }, { name: "Roadmap" }), /FORBIDDEN_ROLE/);
});
