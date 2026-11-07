import assert from "node:assert/strict";
import { test } from "node:test";
import { createProjects } from "../src/projects.js";

const projectId = "00000000-0000-4000-8000-000000000001";
const userId = "00000000-0000-4000-8000-000000000002";
const now = new Date("2026-11-08T00:00:00.000Z");

test("E2 project creation commits the project and creator membership together", async () => {
  const calls: string[] = [];
  const db = {
    $transaction: async (work: (tx: any) => Promise<unknown>, options: unknown) => {
      assert.deepEqual(options, { isolationLevel: "RepeatableRead" });
      calls.push("transaction");
      return work({ project: { create: async () => { calls.push("project"); return { id: projectId, name: "Roadmap", brief: null, status: "ACTIVE", createdBy: userId, createdAt: now, updatedAt: now, version: 1 }; } }, projectMember: { create: async () => { calls.push("member"); } } });
    },
  };
  const projects = createProjects(db as any);
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
  const result = await createProjects(db as any).addMember({ userId, role: "PM" }, projectId, { email: "  LEAD@example.test  " });
  assert.deepEqual(result, { member: { ...existing, addedAt: now.toISOString() }, created: false });
  assert.deepEqual(lookups, [{ where: { email: "lead@example.test" }, select: { id: true, displayName: true, role: true } }]);
  await assert.rejects(() => createProjects({ ...db, $transaction: async (work: (tx: any) => Promise<unknown>) => work({ project: { findFirst: async () => ({ status: "ACTIVE" }) }, user: { findFirst: async () => null }, projectMember: {} }) } as any).addMember({ userId, role: "PM" }, projectId, { email: "missing@example.test" }), /VALIDATION_FAILED/);
});

test("E27 concurrent add rereads the one membership after a unique race", async () => {
  const member = { userId: "00000000-0000-4000-8000-000000000003", displayName: "Dev", role: "DEVELOPER", addedAt: now };
  let reads = 0;
  const db = {
    $transaction: async (work: (tx: any) => Promise<unknown>) => work({
      project: { findFirst: async () => ({ status: "ACTIVE" }) }, user: { findFirst: async () => ({ id: member.userId, displayName: member.displayName, role: member.role }) },
      projectMember: { findFirst: async () => ++reads === 1 ? null : member, create: async () => { throw Object.assign(new Error("unique"), { code: "P2002" }); } },
    }),
  };
  assert.deepEqual(await createProjects(db as any).addMember({ userId, role: "DEV_LEAD" }, projectId, { email: "dev@example.test" }), { member: { ...member, addedAt: now.toISOString() }, created: false });
});

test("project services reject missing or mismatched actors", async () => {
  await assert.rejects(() => createProjects({} as any).create({ userId, role: "DEV_LEAD" }, { name: "Roadmap" }), /FORBIDDEN_ROLE/);
});
