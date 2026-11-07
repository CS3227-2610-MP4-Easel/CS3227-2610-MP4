import assert from "node:assert/strict";
import { test } from "node:test";
import { NotMember, type Core } from "@agile/contracts";
import { createCore } from "../src/index.js";

const projectId = "00000000-0000-4000-8000-000000000001";
const userId = "00000000-0000-4000-8000-000000000002";

test("requireMember accepts an active project membership and rejects archived projects", async () => {
  const core = createCore({
    db: { projectMember: { findFirst: async () => ({ projectId }) } },
    archivedMembership: async () => false,
  });
  await core.requireMember(userId, projectId);
  const hidden = createCore({ db: { projectMember: { findFirst: async () => null } }, archivedMembership: async () => true });
  await assert.rejects(() => hidden.requireMember(userId, projectId), NotMember);
});

test("assertWritable rejects archived projects", async () => {
  const core = createCore({ db: { project: { findFirst: async () => ({ status: "ARCHIVED" }) } } });
  await assert.rejects(() => core.assertWritable(projectId), /CONFLICT_STATE/);
});

test("core remains assignable to the frozen Core contract", () => {
  const core: Core = createCore({ db: {} });
  assert.ok(core);
});
