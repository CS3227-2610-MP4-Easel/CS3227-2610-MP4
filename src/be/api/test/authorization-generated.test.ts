import assert from "node:assert/strict";
import { test } from "node:test";
import { getPolicyMap, type PolicyEntry, type ResolvedResource } from "@agile/contracts";
import { authorizeAdder, authorizeRequest, type ApiRequest, type AuthDependencies, type Principal } from "../src/middleware/auth.js";
import { createPredicateEvaluator } from "../src/middleware/predicates.js";

const AUDITOR = "AUDITOR" as never;
const request = (policy: PolicyEntry): ApiRequest => ({ method: policy.method, path: policy.path, params: { projectId: "project-a", id: "resource-a" }, query: new URLSearchParams(), body: undefined });

const resourceFor = (predicate: PolicyEntry["predicate"], caller = "user-a", allow = true): ResolvedResource => {
  if (predicate === "MEMBER_PROJECTS") return { kind: "PROJECT_SET", projectIds: allow ? ["project-a", "project-b"] : ["project-other"] };
  if (predicate === "SELF") return { kind: "STANDUP", projectId: "project-a", state: "ACTIVE", ownerId: allow ? caller : "user-b" };
  if (predicate === "MEMBER_OR_ASSIGNEE") return { kind: "TASK", projectId: "project-a", state: "ACTIVE", assigneeId: allow ? caller : "user-b" };
  if (predicate === "ADDER") return { kind: "MEMBERSHIP", projectId: "project-a", state: "ACTIVE", targetRole: allow ? "DEV_LEAD" : "DEVELOPER" };
  return { kind: "PROJECT", projectId: allow ? "project-a" : "project-other", state: "ACTIVE" };
};

const counters = () => ({ resolver: 0, membership: 0, predicate: 0, parser: 0, handler: 0 });

function depsFor(policy: PolicyEntry, role: Principal["role"], allow = true, counts = counters()): AuthDependencies {
  const caller = "user-a";
  const predicateEvaluator = createPredicateEvaluator(async (_userId, projectId) => {
    counts.membership++;
    if (!allow || !["project-a", "project-b"].includes(projectId)) throw new Error("NOT_FOUND");
  });
  return {
    resolvePrincipal: async (authorization) => { if (!authorization) throw new Error("UNAUTHENTICATED"); return { firebaseUid: "firebase-a", tokenClaims: {} }; },
    lookupRegisteredUser: async () => ({ firebaseUid: "firebase-a", userId: caller, role }),
    resolveResource: async () => { counts.resolver++; return resourceFor(policy.predicate, caller, allow); },
    requireMember: async (userId, projectId) => { counts.membership++; if (!allow || userId !== caller || projectId !== "project-a") throw new Error("NOT_FOUND"); },
    evaluatePredicate: async (predicate, principal, req, resolved, tx) => { counts.predicate++; return predicateEvaluator(predicate, principal, req, resolved, tx); },
  };
}

const roleFor = (policy: PolicyEntry) => policy.roles[0] ?? "PM";
const authRequest = (policy: PolicyEntry) => request(policy);
const expectCode = async (run: () => Promise<unknown>, code: string, status: number) => {
  await assert.rejects(run, (error: { code?: string; status?: number }) => error.code === code && error.status === status);
};

test("W11 policy map has 57 unique policy keys and operation IDs", () => {
  const policies = getPolicyMap();
  assert.equal(policies.length, 57);
  assert.equal(new Set(policies.map((policy) => policy.policyKey)).size, 57);
  assert.equal(new Set(policies.map((policy) => policy.operationId)).size, 57);
});

test("W11 derives one exact authentication row for every policy", async () => {
  for (const policy of getPolicyMap()) {
    const counts = counters();
    const result = await authorizeRequest(policy, depsFor(policy, roleFor(policy), true, counts), policy.authState === "PUBLIC" ? undefined : "Bearer synthetic-token", authRequest(policy), policy.predicate === "ADDER");
    assert.equal(result.resolved === null, policy.predicate === "NONE" || policy.authState === "PUBLIC" || policy.authState === "TOKEN");
    assert.equal(counts.resolver > 0, policy.authState === "REGISTERED" && policy.predicate !== "NONE");
  }
});

test("W11 protected policies reject an absent token before downstream calls", async () => {
  for (const policy of getPolicyMap().filter((entry) => entry.authState !== "PUBLIC")) {
    const counts = counters();
    await expectCode(() => authorizeRequest(policy, depsFor(policy, roleFor(policy), true, counts), undefined, authRequest(policy), policy.predicate === "ADDER"), "UNAUTHENTICATED", 401);
    assert.deepEqual(counts, { resolver: 0, membership: 0, predicate: 0, parser: 0, handler: 0 });
  }
});

test("W11 restricted policies allow every declared role and deny disjoint AUDITOR", async () => {
  for (const policy of getPolicyMap().filter((entry) => entry.roles.length > 0)) {
    for (const role of policy.roles) {
      const counts = counters();
      await authorizeRequest(policy, depsFor(policy, role, true, counts), "Bearer synthetic-token", authRequest(policy), policy.predicate === "ADDER");
      assert.equal(counts.resolver > 0, policy.predicate !== "NONE");
    }
    const counts = counters();
    const denied = depsFor(policy, "PM", true, counts);
    denied.lookupRegisteredUser = async () => ({ firebaseUid: "firebase-a", userId: "user-a", role: AUDITOR });
    await expectCode(() => authorizeRequest(policy, denied, "Bearer synthetic-token", authRequest(policy), policy.predicate === "ADDER"), "FORBIDDEN_ROLE", 403);
    assert.equal(counts.resolver, 0);
    assert.equal(counts.predicate, 0);
    assert.equal(counts.parser, 0);
    assert.equal(counts.handler, 0);
  }
});

test("W11 unrestricted policies have a synthetic PM allow", async () => {
  for (const policy of getPolicyMap().filter((entry) => entry.roles.length === 0)) {
    await authorizeRequest(policy, depsFor(policy, "PM", true), "Bearer synthetic-token", authRequest(policy), policy.predicate === "ADDER");
  }
});

test("W11 covers every non-NONE predicate with one allow and one hidden deny", async () => {
  const policies = getPolicyMap().filter((entry) => entry.predicate !== "NONE");
  assert.ok(policies.length > 0);
  for (const policy of policies) {
    const role = policy.predicate === "MEMBER_OR_ASSIGNEE" ? "DEVELOPER" : roleFor(policy);
    const allowCounts = counters();
    const allowRequest = authRequest(policy);
    if (policy.predicate === "ADDER") allowRequest.body = { role: "DEV_LEAD" };
    await authorizeRequest(policy, depsFor(policy, role, true, allowCounts), "Bearer synthetic-token", allowRequest, policy.predicate === "ADDER");
    if (policy.predicate === "ADDER") {
      const deps = depsFor(policy, role, true, allowCounts);
      await authorizeAdder(deps, policy, { firebaseUid: "firebase-a", userId: "user-a", role }, allowRequest);
    }
    const denyCounts = counters();
    const denyRequest = authRequest(policy);
    if (policy.predicate === "ADDER") denyRequest.body = { role: "DEVELOPER" };
    await expectCode(() => authorizeRequest(policy, depsFor(policy, role, false, denyCounts), "Bearer synthetic-token", denyRequest, policy.predicate === "ADDER"), "NOT_FOUND", 404);
    assert.equal(denyCounts.parser, 0);
    assert.equal(denyCounts.handler, 0);
    assert.ok(denyCounts.predicate <= 1, `${policy.operationId} evaluated predicate more than once after denial`);
  }
});

test("W11 ADDER resolves active membership before parsed authorization and accepts target role", async () => {
  const policy = getPolicyMap().find((entry) => entry.predicate === "ADDER");
  assert.ok(policy);
  const counts = counters();
  const req = authRequest(policy);
  const deps = depsFor(policy, "PM", true, counts);
  const scope = await authorizeRequest(policy, deps, "Bearer synthetic-token", req, true);
  assert.equal(counts.predicate, 0);
  counts.parser++;
  req.body = { role: "DEV_LEAD" };
  await authorizeAdder(deps, policy, scope.principal as Principal, req);
  assert.equal(counts.predicate, 1);
  assert.equal(counts.handler, 0);
});

test("W11 archived member writes distinguish member conflict from outsider hiding", async () => {
  const policy = getPolicyMap().find((entry) => entry.operationId === "TASK_UPDATE");
  assert.ok(policy);
  const memberCounts = counters();
  const memberDeps = depsFor(policy, "PM", true, memberCounts);
  memberDeps.resolveResource = async () => { memberCounts.resolver++; return { kind: "TASK", projectId: "project-a", state: "ARCHIVED" }; };
  await expectCode(() => authorizeRequest(policy, memberDeps, "Bearer synthetic-token", authRequest(policy)), "CONFLICT_STATE", 409);
  assert.equal(memberCounts.predicate, 0);
  const outsiderCounts = counters();
  const outsiderDeps = depsFor(policy, "PM", false, outsiderCounts);
  outsiderDeps.resolveResource = async () => { outsiderCounts.resolver++; return { kind: "TASK", projectId: "project-a", state: "ARCHIVED" }; };
  await expectCode(() => authorizeRequest(policy, outsiderDeps, "Bearer synthetic-token", authRequest(policy)), "NOT_FOUND", 404);
  assert.equal(outsiderCounts.predicate, 0);
});

test("W11 malformed protected requests fail before parser and handler", async () => {
  const policy = getPolicyMap().find((entry) => entry.operationId === "TASK_UPDATE");
  assert.ok(policy);
  const counts = counters();
  await expectCode(() => authorizeRequest(policy, depsFor(policy, "AUDITOR" as never, true, counts), undefined, authRequest(policy)), "UNAUTHENTICATED", 401);
  assert.equal(counts.parser, 0);
  assert.equal(counts.handler, 0);
  assert.equal(counts.predicate, 0);
});
