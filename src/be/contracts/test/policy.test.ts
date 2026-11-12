import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { getPolicyMap, translateRoleAlias, type PolicyEntry } from "../src/policy.js";
import { validateRouteRegistration, type RouteDefinition } from "../src/routes.js";

test("F3 policy map contains exactly 61 unique normative entries", () => {
  const policies = getPolicyMap();
  assert.equal(policies.length, 61);
  assert.equal(new Set(policies.map((policy) => policy.policyKey)).size, 61);
  assert.equal(new Set(policies.map((policy) => `${policy.method} ${policy.path}`)).size, 61);
});

test("W1 conventions keep operation identifiers stable and uppercase", () => {
  const policies = getPolicyMap();
  assert.equal(policies[0]?.operationId, "HEALTH_READ");
  assert.equal(policies.every((policy) => /^[A-Z][A-Z0-9_]+$/.test(policy.operationId)), true);
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

test("F5/E10-E13 endpoint 42 adopts the PR #6 facts contract while endpoint 36 stays PM Tier 1", () => {
  const facts = getPolicyMap().find((entry) => entry.policyKey === "endpoint-42");
  assert.equal(facts?.operationId, "PROJECT_FACTS_READ");
  assert.equal(facts?.method, "GET");
  assert.equal(facts?.path, "/api/projects/{id}/facts");
  assert.deepEqual(facts?.roles, ["PM", "DEV_LEAD"]);
  assert.equal(facts?.responseSchema.$ref, "#/components/schemas/PROJECT_FACTS_READResponse");
  const projectList = getPolicyMap().find((entry) => entry.policyKey === "endpoint-6");
  assert.equal(projectList?.responseSchema.$ref, "#/components/schemas/PROJECT_LISTResponse");
  const planList = getPolicyMap().find((entry) => entry.policyKey === "endpoint-36");
  assert.deepEqual(planList?.roles, ["PM"]);
  assert.equal(getPolicyMap().some((entry) => entry.path === "/api/lead/projects/{id}/facts"), false);
});

test("F5/E12-E13 normative docs match endpoint 6, endpoint 42, and standup date behavior", () => {
  const contracts = readFileSync("docs/architecture/contracts.md", "utf8");
  const architecture = readFileSync("docs/architecture/agile-platform-architecture.md", "utf8");
  assert.match(contracts, /GET \/api\/projects\/\{id\}\/facts/);
  assert.match(contracts, /200 page of `ProjectDetail`/);
  assert.match(contracts, /Friday accepts Friday or Monday/);
  assert.match(architecture, /endpoint 42 is `GET \/api\/projects\/\{id\}\/facts`/);
  assert.match(architecture, /future Monday does not move its end/);
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
