import assert from "node:assert/strict";
import { test } from "node:test";
import { resetContextRegistries } from "@agile/ai-context/testing";
import { coreRegistry, sourceRegistry } from "../../ai-context/src/registry.js";
import { createApiApp } from "../src/app.js";
import { createCoreComposition, getCoreComposition } from "../src/core-composition.js";
import { createDevComposition, getDevComposition, withDevComposition } from "../src/dev-composition.js";

const db = { project: { findFirst: async () => null }, projectMember: { findFirst: async () => null, findMany: async () => [] }, checkpoint: { findMany: async () => [] }, taskEvent: { findMany: async () => [] }, task: { findMany: async () => [] }, activityItem: { findMany: async () => [] }, itemSummary: { findMany: async () => [] } };
const runtime = () => ({ db, lookupUserByEmail: async () => null, lookupUserRole: async () => null, lookupArchivedMembership: async () => false });

test("F8 boot registers core and both dev sources, once per auth runtime", () => {
  resetContextRegistries();
  const auth = runtime();
  const core = getCoreComposition(auth as never);
  const dev = getDevComposition(auth as never);
  assert.ok(coreRegistry.core, "core is registered");
  for (const id of ["core.projectBrief", "core.checkpoints", "core.taskEvents", "core.blockedTasks", "dev.activityItems", "dev.itemSummaries"]) assert.ok(sourceRegistry.has(id as never), id);
  assert.equal(getDevComposition(auth as never), dev, "cached per auth runtime");
  const merged = withDevComposition(core, dev);
  assert.equal(merged.requireMember, core.requireMember);
  assert.equal(merged.routes.length, core.routes.length + dev.routes.length);
  assert.deepEqual(merged.routes.map((r) => r.operationId).filter((id) => id.startsWith("DEV_") || id.startsWith("LEAD_STANDUP")).sort(), ["DEV_STANDUP_CREATE", "DEV_STANDUP_MINE_READ", "DEV_SUMMARY_CREATE", "DEV_UPLOAD_CREATE", "LEAD_STANDUP_LIST"]);
});

test("F8 a second dev registration on the same registry fails fast", () => {
  resetContextRegistries();
  createDevComposition(runtime() as never);
  assert.throws(() => createDevComposition(runtime() as never), /SOURCE_ALREADY_REGISTERED/);
});

test("F8 the merged composition builds an app", () => {
  resetContextRegistries();
  const auth = runtime();
  const composition = withDevComposition(createCoreComposition(auth as never), createDevComposition(auth as never));
  assert.ok(createApiApp({ resolvePrincipal: async () => { throw new Error("UNAUTHENTICATED"); }, lookupRegisteredUser: async () => null, requireMember: composition.requireMember, resolveResource: composition.resolveResource } as never, composition.routes));
});
