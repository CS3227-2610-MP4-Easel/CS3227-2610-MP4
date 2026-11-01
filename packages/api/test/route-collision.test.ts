import assert from "node:assert/strict";
import { test } from "node:test";
import { getPolicyMap, validateRouteRegistration } from "@agile/contracts";

test("E18 route registration rejects a duplicate operation binding", () => {
  const policy = getPolicyMap()[0];
  const route = { operationId: policy.operationId, method: policy.method, path: policy.path, policyKey: policy.policyKey, responseSchema: {}, handler: async () => new Response() };
  assert.throws(() => validateRouteRegistration([route, route]), /duplicate operation id/);
});
