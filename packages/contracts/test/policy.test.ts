import assert from "node:assert/strict";
import { test } from "node:test";
import { getPolicyMap, translateRoleAlias, type PolicyEntry } from "../src/policy.js";
import { validateRouteRegistration, type RouteDefinition } from "../src/routes.js";

test("F3 policy map contains exactly 57 unique normative entries", () => {
  const policies = getPolicyMap();
  assert.equal(policies.length, 57);
  assert.equal(new Set(policies.map((policy) => policy.policyKey)).size, 57);
  assert.equal(new Set(policies.map((policy) => `${policy.method} ${policy.path}`)).size, 57);
});

test("canonical roles translate architecture aliases only at the boundary", () => {
  assert.equal(translateRoleAlias("LEAD"), "DEV_LEAD");
  assert.equal(translateRoleAlias("DEV"), "DEVELOPER");
  assert.equal(translateRoleAlias("PM"), "PM");
});

test("endpoint 24 preserves role-specific status predicates", () => {
  const policy = getPolicyMap().find((entry) => entry.policyKey === "endpoint-24");
  assert.deepEqual(policy?.roles, ["DEV_LEAD", "DEVELOPER"]);
  assert.equal(policy?.predicate, "MEMBER_OR_ASSIGNEE");
});

test("endpoint 43 is member-project scoped without a project path", () => {
  const policy = getPolicyMap().find((entry) => entry.policyKey === "endpoint-43");
  assert.equal(policy?.predicate, "MEMBER_PROJECTS");
  assert.equal(policy?.path, "/api/lead/overview");
});

test("E4/E18 reject missing policies and collisions before dispatch", () => {
  const base = { operationId: "health", method: "GET" as const, path: "/api/health", policyKey: "endpoint-1", responseSchema: {}, handler: async () => new Response() };
  assert.throws(() => validateRouteRegistration([base, { ...base, operationId: "other" }]), /duplicate (operation id|method\/path)|metadata mismatch/);
  assert.throws(() => validateRouteRegistration([{ ...base, policyKey: "missing" }]), /missing policy/);
});

test("E5 rejects route metadata that differs from its policy", () => {
  const policy = getPolicyMap()[0] as PolicyEntry;
  const route: RouteDefinition = { operationId: policy.operationId, method: "POST", path: policy.path, policyKey: policy.policyKey, responseSchema: {}, handler: async () => new Response() };
  assert.throws(() => validateRouteRegistration([route]), /metadata mismatch/);
});
