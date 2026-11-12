import assert from "node:assert/strict";
import { test } from "node:test";
import { createLeadRuntime, getLeadRuntime, initLeadRuntime } from "../src/runtime.js";
test("runtime factory exposes flow methods and binds lookup to database identity", () => {
  const db = { task: { findMany: async () => [] }, sprint: { findMany: async () => [] }, checkpoint: { findMany: async () => [] }, projectMember: { findMany: async () => [] }, taskEvent: { findMany: async () => [] }, projectDigest: { findMany: async () => [] } } as any;
  const binding = { gateway: { run: async () => { throw new Error("unused"); } }, sessions: { open: async () => "s", close: async () => {} } } as any;
  const runtime = createLeadRuntime(db, undefined, binding, { registerSources: false });
  assert.equal(typeof runtime.facts, "function"); assert.equal(typeof runtime.createDigest, "function"); assert.equal(typeof runtime.latestDigest, "function");
  assert.equal(initLeadRuntime(db, binding), getLeadRuntime(db));
  const other = {} as any;
  assert.throws(() => getLeadRuntime(other), { message: "LEAD_RUNTIME_NOT_INITIALIZED" });
});
