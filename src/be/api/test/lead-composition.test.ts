import assert from "node:assert/strict";
import { test } from "node:test";
import { createLeadRoutes } from "../src/routes/lead.js";
import { getPolicyMap } from "@agile/contracts";

test("lead route factories compose exactly endpoints 42, 44 and 45", () => {
  const routes = createLeadRoutes({ runtime: () => ({ facts: async () => ({} as any), createDigest: async () => ({} as any), latestDigest: async () => null }) });
  assert.deepEqual(routes.map((route) => route.operationId), ["PROJECT_FACTS_READ", "LEAD_DIGEST_CREATE", "LEAD_DIGEST_LATEST_READ"]);
  for (const route of routes) {
    const policy = getPolicyMap().find((entry) => entry.operationId === route.operationId);
    assert.equal(route.path, policy?.path);
    assert.equal(route.method, policy?.method);
    assert.equal(route.policyKey, policy?.policyKey);
  }
});
