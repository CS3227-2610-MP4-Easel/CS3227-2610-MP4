import assert from "node:assert/strict";
import { test } from "node:test";
import { createLeadRuntime } from "../src/runtime.js";
test("runtime factory exposes the lead flow methods", () => {
  const db = { task: { findMany: async () => [] }, sprint: { findMany: async () => [] }, checkpoint: { findMany: async () => [] }, projectMember: { findMany: async () => [] }, taskEvent: { findMany: async () => [] }, projectDigest: { findMany: async () => [] } } as any;
  const runtime = createLeadRuntime(db);
  assert.equal(typeof runtime.facts, "function"); assert.equal(typeof runtime.createDigest, "function"); assert.equal(typeof runtime.latestDigest, "function");
});
