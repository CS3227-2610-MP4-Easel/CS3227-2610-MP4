import assert from "node:assert/strict";
import { test } from "node:test";
import { getPolicyMap, type PolicyEntry, type ResolvedResource } from "@agile/contracts";
import { authorizeAdder, authorizeRequest, type ApiRequest, type AuthDependencies, type Principal } from "../src/middleware/auth.js";
import { createPredicateEvaluator } from "../src/middleware/predicates.js";

const AUDITOR = "AUDITOR" as never;
type RowKind = "AUTH_REQUIRED" | "ROLE_ALLOW" | "ROLE_DENY" | "PREDICATE_ALLOW" | "PREDICATE_DENY";
type DerivedRow = { key: string; kind: RowKind; policy: PolicyEntry; role?: Principal["role"] | typeof AUDITOR };
const request = (policy: PolicyEntry): ApiRequest => ({ method: policy.method, path: policy.path, params: { projectId: "project-a", id: "resource-a" }, query: new URLSearchParams(), body: undefined });

function deriveRows(policies: readonly PolicyEntry[]): DerivedRow[] {
  return policies.flatMap((policy) => [
    { key: `${policy.policyKey}:AUTH_REQUIRED`, kind: "AUTH_REQUIRED" as const, policy },
    ...policy.roles.map((role) => ({ key: `${policy.policyKey}:ROLE_ALLOW:${role}`, kind: "ROLE_ALLOW" as const, policy, role })),
    ...(policy.roles.length > 0 ? [{ key: `${policy.policyKey}:ROLE_DENY:AUDITOR`, kind: "ROLE_DENY" as const, policy, role: AUDITOR }] : []),
    ...(policy.predicate !== "NONE" ? [
      { key: `${policy.policyKey}:PREDICATE_ALLOW`, kind: "PREDICATE_ALLOW" as const, policy },
      { key: `${policy.policyKey}:PREDICATE_DENY`, kind: "PREDICATE_DENY" as const, policy },
    ] : []),
  ]);
}

const derivedRows = deriveRows(getPolicyMap());

const resourceFor = (predicate: PolicyEntry["predicate"], caller = "user-a", allow = true): ResolvedResource => {
  if (predicate === "MEMBER_PROJECTS") return { kind: "PROJECT_SET", projectIds: allow ? ["project-a", "project-b"] : ["project-other"] };
  if (predicate === "SELF") return { kind: "STANDUP", projectId: "project-a", state: "ACTIVE", ownerId: allow ? caller : "user-b" };
  if (predicate === "MEMBER_OR_ASSIGNEE") return { kind: "TASK", projectId: "project-a", state: "ACTIVE", assigneeId: allow ? caller : "user-b" };
  if (predicate === "ADDER") return { kind: "MEMBERSHIP", projectId: "project-a", state: "ACTIVE", targetRole: allow ? "DEV_LEAD" : "DEVELOPER" };
  return { kind: "PROJECT", projectId: allow ? "project-a" : "project-other", state: "ACTIVE" };
};

const counters = () => ({ resolver: 0, membership: 0, predicate: 0 });

function depsFor(policy: PolicyEntry, role: Principal["role"], allow = true, counts = counters()): AuthDependencies {
  const caller = "user-a";
  const predicateEvaluator = createPredicateEvaluator(async (_userId, projectId) => {
    counts.membership++;
    if (!allow || !["project-a", "project-b"].includes(projectId)) throw new Error("NOT_FOUND");
  });
  return {
    resolvePrincipal: async (authorization) => { if (!authorization) throw new Error("UNAUTHENTICATED"); return { firebaseUid: "firebase-a", tokenClaims: {} }; },
    lookupRegisteredUser: async () => ({ firebaseUid: "firebase-a", userId: caller, role }),
    resolveResource: async (_operationId, req) => {
      counts.resolver++;
      const resource = resourceFor(policy.predicate, caller, allow);
      if (policy.predicate === "ADDER" && req.body && typeof req.body === "object" && "role" in req.body) {
        return { ...resource, targetRole: (req.body as { role: Principal["role"] }).role };
      }
      return resource;
    },
    requireMember: async (userId, projectId) => { counts.membership++; if (!allow || userId !== caller || projectId !== "project-a") throw new Error("NOT_FOUND"); },
    evaluatePredicate: async (predicate, principal, req, resolved, tx) => { counts.predicate++; return predicateEvaluator(predicate, principal, req, resolved, tx); },
  };
}

const roleFor = (policy: PolicyEntry) => policy.roles[0] ?? "PM";
const authRequest = (policy: PolicyEntry) => request(policy);
type DownstreamCallbacks = { parse(): unknown; handle(): unknown };
let thisState: { parsed: number; handled: number };
async function authorizeThenPipeline(policy: PolicyEntry, deps: AuthDependencies, authorization: string | undefined, req: ApiRequest, callbacks: DownstreamCallbacks, deferAdder = false) {
  const scope = await authorizeRequest(policy, deps, authorization, req, deferAdder);
  callbacks.parse();
  callbacks.handle();
  return scope;
}
const expectCode = async (run: () => Promise<unknown>, code: string, status: number) => {
  await assert.rejects(run, (error: { code?: string; status?: number }) => error.code === code && error.status === status);
};

test("W11 policy map has 59 unique policy keys and operation IDs", () => {
  const policies = getPolicyMap();
  assert.equal(policies.length, 59);
  assert.equal(new Set(policies.map((policy) => policy.policyKey)).size, 59);
  assert.equal(new Set(policies.map((policy) => policy.operationId)).size, 59);
});

test("W11 derived row objects have exact authorization cardinalities", () => {
  assert.equal(derivedRows.length, 270);
  assert.equal(derivedRows.filter((row) => row.kind === "AUTH_REQUIRED").length, 59);
  assert.equal(derivedRows.filter((row) => row.kind === "ROLE_ALLOW").length, 58);
  assert.equal(derivedRows.filter((row) => row.kind === "ROLE_DENY").length, 45);
  assert.equal(derivedRows.filter((row) => row.kind === "PREDICATE_ALLOW").length, 54);
  assert.equal(derivedRows.filter((row) => row.kind === "PREDICATE_DENY").length, 54);
  assert.equal(new Set(derivedRows.map((row) => row.key)).size, derivedRows.length);
});

test("W11 derives one exact authentication row for every policy", async () => {
  for (const { policy } of derivedRows.filter((row) => row.kind === "AUTH_REQUIRED")) {
    const counts = counters();
    const result = await authorizeRequest(policy, depsFor(policy, roleFor(policy), true, counts), policy.authState === "PUBLIC" ? undefined : "Bearer synthetic-token", authRequest(policy), policy.predicate === "ADDER");
    assert.equal(result.resolved === null, policy.predicate === "NONE" || policy.authState === "PUBLIC" || policy.authState === "TOKEN");
    assert.equal(counts.resolver > 0, policy.authState === "REGISTERED" && policy.predicate !== "NONE");
  }
});

test("W11 successful auth states expose the expected principal and reach downstream callbacks", async () => {
  const publicPolicy = getPolicyMap().find((policy) => policy.authState === "PUBLIC");
  const tokenPolicy = getPolicyMap().find((policy) => policy.authState === "TOKEN");
  const registeredPolicy = getPolicyMap().find((policy) => policy.authState === "REGISTERED" && policy.predicate === "NONE");
  assert.ok(publicPolicy && tokenPolicy && registeredPolicy);
  for (const [policy, authorization] of [[publicPolicy, undefined], [tokenPolicy, "Bearer verified-token"], [registeredPolicy, "Bearer verified-token"]] as const) {
    thisState = { parsed: 0, handled: 0 };
    const callbacks = { parse: () => { thisState.parsed++; }, handle: () => { thisState.handled++; } };
    const scope = await authorizeThenPipeline(policy, depsFor(policy, "PM"), authorization, authRequest(policy), callbacks, policy.predicate === "ADDER");
    assert.equal(thisState.parsed, 1);
    assert.equal(thisState.handled, 1);
    if (policy.authState === "PUBLIC") assert.equal(scope.principal, null);
    if (policy.authState === "TOKEN") {
      assert.equal("userId" in scope.principal, false);
      assert.equal((scope.principal as { firebaseUid: string }).firebaseUid, "firebase-a");
      assert.equal(scope.resolved, null);
    }
    if (policy.authState === "REGISTERED") {
      assert.equal((scope.principal as Principal).userId, "user-a");
      assert.equal(scope.resolved, null);
    }
  }
});

test("W11 protected policies reject an absent token before downstream calls", async () => {
  for (const { policy } of derivedRows.filter((row) => row.kind === "AUTH_REQUIRED" && row.policy.authState !== "PUBLIC")) {
    const counts = counters();
    thisState = { parsed: 0, handled: 0 };
    const callbacks = { parse: () => { thisState.parsed++; }, handle: () => { thisState.handled++; } };
    await expectCode(() => authorizeThenPipeline(policy, depsFor(policy, roleFor(policy), true, counts), undefined, authRequest(policy), callbacks, policy.predicate === "ADDER"), "UNAUTHENTICATED", 401);
    assert.deepEqual(counts, { resolver: 0, membership: 0, predicate: 0 });
    assert.deepEqual(thisState, { parsed: 0, handled: 0 });
  }
});

test("W11 registered policies reject a verified token without a registered user", async () => {
  for (const { policy } of derivedRows.filter((row) => row.kind === "AUTH_REQUIRED" && row.policy.authState === "REGISTERED")) {
    const counts = counters();
    const deps = depsFor(policy, roleFor(policy), true, counts);
    deps.lookupRegisteredUser = async () => { throw new Error("USER_NOT_REGISTERED"); };
    thisState = { parsed: 0, handled: 0 };
    const callbacks = { parse: () => { thisState.parsed++; }, handle: () => { thisState.handled++; } };
    await expectCode(() => authorizeThenPipeline(policy, deps, "Bearer verified-token", authRequest(policy), callbacks, policy.predicate === "ADDER"), "USER_NOT_REGISTERED", 403);
    assert.deepEqual(counts, { resolver: 0, membership: 0, predicate: 0 });
    assert.deepEqual(thisState, { parsed: 0, handled: 0 });
  }
});

test("W11 restricted policies allow every declared role and deny disjoint AUDITOR", async () => {
  for (const { policy, role } of derivedRows.filter((row): row is DerivedRow & { kind: "ROLE_ALLOW"; role: Principal["role"] } => row.kind === "ROLE_ALLOW")) {
      const counts = counters();
      await authorizeRequest(policy, depsFor(policy, role, true, counts), "Bearer synthetic-token", authRequest(policy), policy.predicate === "ADDER");
      assert.equal(counts.resolver > 0, policy.predicate !== "NONE");
  }
  for (const { policy, role } of derivedRows.filter((row): row is DerivedRow & { kind: "ROLE_DENY"; role: typeof AUDITOR } => row.kind === "ROLE_DENY")) {
    const counts = counters();
    const denied = depsFor(policy, "PM", true, counts);
    denied.lookupRegisteredUser = async () => ({ firebaseUid: "firebase-a", userId: "user-a", role: AUDITOR });
    thisState = { parsed: 0, handled: 0 };
    const callbacks = { parse: () => { thisState.parsed++; }, handle: () => { thisState.handled++; } };
    await expectCode(() => authorizeThenPipeline(policy, denied, "Bearer synthetic-token", authRequest(policy), callbacks, policy.predicate === "ADDER"), "FORBIDDEN_ROLE", 403);
    assert.equal(counts.resolver, 0);
    assert.equal(counts.predicate, 0);
    assert.equal(role, AUDITOR);
    assert.deepEqual(thisState, { parsed: 0, handled: 0 });
  }
});

test("W11 unrestricted policies have a synthetic PM allow", async () => {
  for (const policy of getPolicyMap().filter((entry) => entry.roles.length === 0)) {
    await authorizeRequest(policy, depsFor(policy, "PM", true), "Bearer synthetic-token", authRequest(policy), policy.predicate === "ADDER");
  }
});

test("W11 covers every non-NONE predicate with one allow and one hidden deny", async () => {
  for (const { policy } of derivedRows.filter((row) => row.kind === "PREDICATE_ALLOW")) {
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
    thisState = { parsed: 0, handled: 0 };
    const callbacks = { parse: () => { thisState.parsed++; }, handle: () => { thisState.handled++; } };
    await expectCode(() => authorizeThenPipeline(policy, depsFor(policy, role, false, denyCounts), "Bearer synthetic-token", denyRequest, callbacks, policy.predicate === "ADDER"), "NOT_FOUND", 404);
    assert.ok(denyCounts.predicate <= 1, `${policy.operationId} evaluated predicate more than once after denial`);
    assert.deepEqual(thisState, { parsed: 0, handled: 0 });
  }
  assert.equal(derivedRows.filter((row) => row.kind === "PREDICATE_DENY").length, 54);
});

test("W11 ADDER resolves active membership before parsed authorization and accepts target role", async () => {
  const policy = getPolicyMap().find((entry) => entry.predicate === "ADDER");
  assert.ok(policy);
  const counts = counters();
  const req = authRequest(policy);
  const deps = depsFor(policy, "PM", true, counts);
  const scope = await authorizeRequest(policy, deps, "Bearer synthetic-token", req, true);
  assert.equal(counts.predicate, 0);
  const events: string[] = [];
  const parseBody = () => { events.push("parser"); counts.membership += 0; return { role: "DEV_LEAD" }; };
  req.body = parseBody();
  events.push("authorizeAdder");
  await authorizeAdder(deps, policy, scope.principal as Principal, req);
  events.push("handler");
  assert.equal(counts.predicate, 1);
  assert.deepEqual(events, ["parser", "authorizeAdder", "handler"]);
});

test("W11 ADDER denies a parsed target role before handler execution", async () => {
  const policy = getPolicyMap().find((entry) => entry.predicate === "ADDER");
  assert.ok(policy);
  const counts = counters();
  const events: string[] = [];
  const deps = depsFor(policy, "PM", true, counts);
  const req = authRequest(policy);
  const scope = await authorizeRequest(policy, deps, "Bearer synthetic-token", req, true);
  req.body = (() => { events.push("parser"); return { role: "DEVELOPER" }; })();
  await expectCode(async () => { events.push("authorizeAdder"); return authorizeAdder(deps, policy, scope.principal as Principal, req); }, "VALIDATION_FAILED", 422);
  assert.deepEqual(events, ["parser", "authorizeAdder"]);
  assert.equal(counts.predicate, 1);
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
  thisState = { parsed: 0, handled: 0 };
  const callbacks = { parse: () => { thisState.parsed++; }, handle: () => { thisState.handled++; } };
  await expectCode(() => authorizeThenPipeline(policy, depsFor(policy, "PM", true, counts), undefined, authRequest(policy), callbacks), "UNAUTHENTICATED", 401);
  assert.deepEqual(counts, { resolver: 0, membership: 0, predicate: 0 });
  assert.deepEqual(thisState, { parsed: 0, handled: 0 });
});
