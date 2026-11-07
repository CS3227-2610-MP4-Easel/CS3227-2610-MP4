import assert from "node:assert/strict";
import { test } from "node:test";
import { NotMember, type Core } from "@agile/contracts";
import { createCore } from "../src/index.js";

const projectId = "00000000-0000-4000-8000-000000000001";
const userId = "00000000-0000-4000-8000-000000000002";

test("requireMember accepts an active project membership and returns a fresh NotMember for archived projects", async () => {
  const core = createCore({
    db: { projectMember: { findFirst: async () => ({ projectId }) } },
    archivedMembership: async () => false,
  });
  await core.requireMember(userId, projectId);
  const hidden = createCore({ db: { projectMember: { findFirst: async () => ({ projectId }) } }, archivedMembership: async () => true });
  const first = await hidden.requireMember(userId, projectId).catch((error) => error);
  const second = await hidden.requireMember(userId, projectId).catch((error) => error);
  assert.ok(first instanceof NotMember);
  assert.ok(second instanceof NotMember);
  assert.notEqual(first, second);
});

test("assertWritable distinguishes absent, archived, and active projects", async () => {
  await assert.rejects(() => createCore({ db: { project: { findFirst: async () => null } } }).assertWritable(projectId), /NOT_FOUND/);
  await assert.rejects(() => createCore({ db: { project: { findFirst: async () => ({ status: "ARCHIVED" }) } } }).assertWritable(projectId), /CONFLICT_STATE/);
  await createCore({ db: { project: { findFirst: async () => ({ status: "ACTIVE" }) } } }).assertWritable(projectId);
});

test("core remains assignable to the frozen Core contract", () => {
  const core: Core = createCore({ db: {} });
  assert.ok(core);
});
