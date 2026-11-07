import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import type { LlmResult, ResolvedResource } from "@agile/contracts";
import { ContextScopeViolation, type AiContextWith } from "@agile/ai-context";
import { createDbClient } from "@agile/db";
import { createSessions } from "@agile/llm-gateway";
import { createPlanFlow, PlanFlowError, type PlanFlow } from "@agile/pm";
import { createProposalResolvers } from "@agile/proposals";
import { bindProposals, integrationUrl, withIntegrationDb } from "../../pm/test/fakes.js";
import { createApiApp, createPredicateEvaluator, type AuthDependencies } from "../src/index.js";
import { pmRoutes } from "../src/routes/pm.js";

const noop = () => undefined;
void noop;
const P1 = randomUUID(); // project the PM belongs to
const P2 = randomUUID(); // project the PM does not belong to
const PROPOSALS = new Map<string, string>(); // proposalId -> projectId
const OWN = randomUUID();
const FOREIGN = randomUUID();
PROPOSALS.set(OWN, P1);
PROPOSALS.set(FOREIGN, P2);
const users: Record<string, { userId: string; role: "PM" | "DEV_LEAD" | "DEVELOPER"; projects: string[] }> = {
  "Bearer pm": { userId: "u-pm", role: "PM", projects: [P1] },
  "Bearer lead": { userId: "u-lead", role: "DEV_LEAD", projects: [P1] },
  "Bearer dev": { userId: "u-dev", role: "DEVELOPER", projects: [P1] },
  "Bearer other": { userId: "u-other", role: "PM", projects: [] },
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fakeDeps(): AuthDependencies {
  const requireMember = async (userId: string, projectId: string) => {
    const user = Object.values(users).find((u) => u.userId === userId);
    if (!user?.projects.includes(projectId)) throw new Error("NOT_FOUND");
  };
  return {
    resolvePrincipal: async (authorization) => { if (!authorization || !users[authorization]) throw new Error("UNAUTHENTICATED"); return { firebaseUid: authorization, tokenClaims: {} }; },
    lookupRegisteredUser: async (uid) => ({ firebaseUid: uid, userId: users[uid]!.userId, role: users[uid]!.role }),
    resolveResource: async (operationId, request): Promise<ResolvedResource | null> => {
      if (operationId === "PM_PLAN_CREATE") return { kind: "PROJECT", projectId: request.params.id!, state: "ACTIVE" };
      const id = request.params.proposalId;
      const projectId = id && UUID.test(id) ? PROPOSALS.get(id) : undefined;
      return projectId ? { kind: "PROPOSAL", projectId, ownerId: "u-pm", state: "ACTIVE" } : null;
    },
    requireMember,
    evaluatePredicate: createPredicateEvaluator(requireMember),
  };
}

type Call = { method: string; args: unknown };
function fakeFlow(failure?: () => Error) {
  const calls: Call[] = [];
  const hit = <T>(method: string, result: T) => async (args: unknown): Promise<T> => { calls.push({ method, args }); if (failure) throw failure(); return result; };
  const flow = {
    createPlan: hit("createPlan", { id: OWN }),
    getProposal: hit("getProposal", { id: OWN }),
    expandEpic: hit("expandEpic", { index: 0 }),
    approve: hit("approve", { proposalId: OWN, status: "APPROVED" }),
    reject: hit("reject", { id: OWN }),
  } as unknown as PlanFlow;
  return { flow, calls };
}

const appFor = (flow: PlanFlow, deps: AuthDependencies = fakeDeps()) => createApiApp(deps, pmRoutes(() => flow));
type Req = { token?: string; body?: BodyInit | null; headers?: Record<string, string> };
const send = (app: ReturnType<typeof appFor>, method: "GET" | "POST", path: string, req: Req = {}) =>
  app.request(`http://localhost${path}`, {
    method,
    headers: { ...(req.token ? { authorization: req.token } : {}), ...(method === "POST" ? { "content-type": "application/json" } : {}), ...req.headers },
    ...(req.body !== undefined ? { body: req.body, duplex: "half" } as RequestInit : {}),
  });
const json = (value: unknown) => JSON.stringify(value);
const create = (app: ReturnType<typeof appFor>, body: BodyInit, token = "Bearer pm", headers?: Record<string, string>) => send(app, "POST", `/api/pm/projects/${P1}/plans`, { token, body, ...(headers ? { headers } : {}) });
const code = async (response: Response) => ((await response.json()) as { error: { code: string } }).error.code;

const idea = (n: number, ch = "a") => ch.repeat(n);
const ENDPOINTS: { key: string; method: "GET" | "POST"; path: (proposal: string) => string; body?: unknown }[] = [
  { key: "34", method: "POST", path: () => `/api/pm/projects/${P1}/plans`, body: { idea: idea(30) } },
  { key: "35", method: "GET", path: (p) => `/api/pm/proposals/${p}` },
  { key: "37", method: "POST", path: (p) => `/api/pm/proposals/${p}/epics/0/expand`, body: {} },
  { key: "40", method: "POST", path: (p) => `/api/pm/proposals/${p}/approve`, body: { version: 1 } },
  { key: "41", method: "POST", path: (p) => `/api/pm/proposals/${p}/reject`, body: { version: 1 } },
];
const callEndpoint = (app: ReturnType<typeof appFor>, e: (typeof ENDPOINTS)[number], proposal: string, token?: string) =>
  send(app, e.method, e.path(proposal), { ...(token ? { token } : {}), ...(e.body !== undefined ? { body: json(e.body) } : {}) });

test("routes return 201 for create and 200 for the others and pass the caller, ids and parsed input to the flow", async () => {
  const { flow, calls } = fakeFlow();
  const app = appFor(flow);
  assert.equal((await callEndpoint(app, ENDPOINTS[0]!, OWN, "Bearer pm")).status, 201);
  for (const e of ENDPOINTS.slice(1)) assert.equal((await callEndpoint(app, e, OWN, "Bearer pm")).status, 200, e.key);
  assert.deepEqual(calls.map((c) => c.method), ["createPlan", "getProposal", "expandEpic", "approve", "reject"]);
  assert.deepEqual(calls[0]!.args, { caller: { userId: "u-pm", role: "PM" }, projectId: P1, idea: idea(30) });
  assert.deepEqual(calls[2]!.args, { caller: { userId: "u-pm", role: "PM" }, proposalId: OWN, index: 0 });
  assert.deepEqual(calls[3]!.args, { caller: { userId: "u-pm", role: "PM" }, proposalId: OWN, version: 1 });
});

test("E3 idea length bounds: 19 -> 422, 20 and 6000 accepted, 6001 -> 422, 6000 four-byte characters accepted", async () => {
  const { flow, calls } = fakeFlow();
  const app = appFor(flow);
  assert.equal((await create(app, json({ idea: idea(19) }))).status, 422);
  assert.equal(calls.length, 0);
  assert.equal((await create(app, json({ idea: idea(20) }))).status, 201);
  assert.equal((await create(app, json({ idea: idea(6000) }))).status, 201);
  const tooLong = await create(app, json({ idea: idea(6001) }));
  assert.equal(tooLong.status, 422);
  assert.equal(await code(tooLong), "VALIDATION_FAILED");
  const emoji = json({ idea: idea(6000, "\u{1F600}") });
  assert.ok(Buffer.byteLength(emoji) > 24000 && Buffer.byteLength(emoji) < 32768);
  assert.equal((await create(app, emoji)).status, 201);
  assert.equal(calls.length, 3);
  const unknown = await create(app, json({ idea: idea(30), extra: 1 }));
  assert.equal(unknown.status, 422);
  assert.equal(await code(unknown), "VALIDATION_FAILED");
  assert.equal(calls.length, 3);
});

test("E3 a body over 32 KiB is 413 PAYLOAD_TOO_LARGE by Content-Length and by streamed bytes, before parsing; non-JSON is 400", async () => {
  const { flow, calls } = fakeFlow();
  const app = appFor(flow);
  const big = json({ idea: idea(33000) });
  const declared = await create(app, big, "Bearer pm", { "content-length": "40000" });
  assert.equal(declared.status, 413);
  assert.equal(await code(declared), "PAYLOAD_TOO_LARGE");
  // Not JSON at all and oversized: still 413, so the size check ran before parsing.
  const garbage = await create(app, "x".repeat(40000));
  assert.equal(garbage.status, 413);
  assert.equal(await code(garbage), "PAYLOAD_TOO_LARGE");
  // Streamed, with no Content-Length.
  let pulled = 0;
  const chunk = new TextEncoder().encode("a".repeat(1000));
  const stream = new ReadableStream<Uint8Array>({ pull(controller) { pulled += 1; if (pulled > 200) controller.close(); else controller.enqueue(chunk); } });
  const streamed = await create(app, stream);
  assert.equal(streamed.status, 413);
  assert.equal(await code(streamed), "PAYLOAD_TOO_LARGE");
  assert.ok(pulled < 200, `the stream was drained (${pulled} pulls)`);
  // Exactly at the limit is not too large (it is invalid, not oversized).
  const atLimit = await create(app, json({ idea: idea(32_700) }));
  assert.equal(atLimit.status, 422);
  const nonJson = await create(app, "not json");
  assert.equal(nonJson.status, 400);
  assert.equal(await code(nonJson), "BAD_REQUEST");
  assert.equal(calls.length, 0);
});

test("small-body endpoints (37, 40, 41) answer 413 over 1 KiB by Content-Length and by streamed bytes", async () => {
  const { flow, calls } = fakeFlow();
  const app = appFor(flow);
  for (const e of ENDPOINTS.slice(2)) {
    const declared = await send(app, "POST", e.path(OWN), { token: "Bearer pm", body: json(e.body), headers: { "content-length": "5000" } });
    assert.equal(declared.status, 413, e.key);
    assert.equal(await code(declared), "PAYLOAD_TOO_LARGE");
    const streamed = await send(app, "POST", e.path(OWN), { token: "Bearer pm", body: "x".repeat(1025) });
    assert.equal(streamed.status, 413, e.key);
    assert.equal((await send(app, "POST", e.path(OWN), { token: "Bearer pm", body: json(e.body) })).status, 200);
  }
  assert.equal(calls.length, 3);
});

test("E47 bodies with extra keys are 422 VALIDATION_FAILED", async () => {
  const { flow, calls } = fakeFlow();
  const app = appFor(flow);
  const bodies: [(typeof ENDPOINTS)[number], unknown][] = [
    [ENDPOINTS[0]!, { idea: idea(30), sessionId: "s", model: "m", projectId: P1, flag: true }],
    [ENDPOINTS[2]!, { x: 1 }],
    [ENDPOINTS[3]!, { version: 1, status: "APPROVED" }],
    [ENDPOINTS[4]!, { version: 1, status: "REJECTED" }],
  ];
  for (const [e, body] of bodies) {
    const response = await send(app, "POST", e.path(OWN), { token: "Bearer pm", body: json(body) });
    assert.equal(response.status, 422, e.key);
    assert.equal(await code(response), "VALIDATION_FAILED");
  }
  assert.equal((await send(app, "POST", `/api/pm/proposals/${OWN}/approve`, { token: "Bearer pm", body: json({ version: 0 }) })).status, 422);
  assert.equal((await send(app, "POST", `/api/pm/proposals/${OWN}/approve`, { token: "Bearer pm", body: json({ version: 2147483648 }) })).status, 422);
  assert.equal(calls.length, 0);
});

test("E5 DEV_LEAD and DEVELOPER get 403 FORBIDDEN_ROLE, a non-member PM 404, no token 401; the flow is never called", async () => {
  const { flow, calls } = fakeFlow();
  const app = appFor(flow);
  for (const e of ENDPOINTS) {
    for (const token of ["Bearer lead", "Bearer dev"]) {
      const response = await callEndpoint(app, e, OWN, token);
      assert.equal(response.status, 403, `${e.key} ${token}`);
      assert.equal(await code(response), "FORBIDDEN_ROLE");
    }
    const outsider = await callEndpoint(app, e, OWN, "Bearer other");
    assert.equal(outsider.status, 404, e.key);
    assert.equal(await code(outsider), "NOT_FOUND");
    const anonymous = await callEndpoint(app, e, OWN);
    assert.equal(anonymous.status, 401, e.key);
    assert.equal(await code(anonymous), "UNAUTHENTICATED");
  }
  assert.equal(calls.length, 0);
});

test("E19 an unknown uuid, a non-uuid and another project's proposal are 404 NOT_FOUND on 35, 37, 40 and 41", async () => {
  const { flow, calls } = fakeFlow();
  const app = appFor(flow);
  for (const e of ENDPOINTS.slice(1)) {
    for (const id of [randomUUID(), "not-a-uuid", FOREIGN]) {
      const response = await callEndpoint(app, e, id, "Bearer pm");
      assert.equal(response.status, 404, `${e.key} ${id}`);
      assert.equal(await code(response), "NOT_FOUND");
    }
  }
  assert.equal(calls.length, 0);
});

test("E21 epic index -1, 1.5, a, 01, 1e0, 99999999999 is 404 NOT_FOUND without calling the flow; 0 and 999 reach it", async () => {
  const { flow, calls } = fakeFlow();
  const app = appFor(flow);
  for (const index of ["-1", "1.5", "a", "01", "1e0", "99999999999", "1000"]) {
    const response = await send(app, "POST", `/api/pm/proposals/${OWN}/epics/${index}/expand`, { token: "Bearer pm", body: "{}" });
    assert.equal(response.status, 404, index);
    assert.equal(await code(response), "NOT_FOUND");
  }
  assert.equal(calls.length, 0);
  for (const index of ["0", "999"]) assert.equal((await send(app, "POST", `/api/pm/proposals/${OWN}/epics/${index}/expand`, { token: "Bearer pm", body: "{}" })).status, 200);
  assert.deepEqual(calls.map((c) => (c.args as { index: number }).index), [0, 999]);
});

test("a PlanFlowError becomes its status and code, with Retry-After on a 429; details carry only the reason", async () => {
  let failure: Error = new PlanFlowError("AI_BUSY", 429, "The AI is busy; try again shortly.", 17, { reason: "LOCAL_LIMIT" });
  const { flow } = fakeFlow(() => failure);
  const app = appFor(flow);
  const busy = await create(app, json({ idea: idea(30) }));
  assert.equal(busy.status, 429);
  assert.equal(busy.headers.get("retry-after"), "17");
  assert.deepEqual(await busy.json(), { error: { code: "AI_BUSY", message: "The AI is busy; try again shortly.", details: [{ field: "reason", message: "LOCAL_LIMIT" }], requestId: busy.headers.get("x-request-id") } });
  failure = new PlanFlowError("CONFLICT_VERSION", 409, "The proposal changed; reload it.");
  const conflict = await send(app, "POST", `/api/pm/proposals/${OWN}/approve`, { token: "Bearer pm", body: json({ version: 1 }) });
  assert.equal(conflict.status, 409);
  assert.equal(conflict.headers.get("retry-after"), null);
  assert.equal(await code(conflict), "CONFLICT_VERSION");
});

test("E9 ContextScopeViolation, CONTEXT_SOURCE_FAILED, CORE_FAILED and unknown errors are 500 INTERNAL_ERROR with no thrown message", async () => {
  const failures = [new ContextScopeViolation("pm.similarItems", "membership"), new Error("CONTEXT_SOURCE_FAILED:pm.similarItems"), new Error("CORE_FAILED"), new Error("secret database detail")];
  for (const failure of failures) {
    const { flow } = fakeFlow(() => failure);
    const app = appFor(flow);
    const originalError = console.error;
    console.error = noop;
    try {
      for (const e of ENDPOINTS) {
        const response = await callEndpoint(app, e, OWN, "Bearer pm");
        assert.equal(response.status, 500, e.key);
        const text = await response.text();
        const body = JSON.parse(text) as { error: { code: string; message: string; requestId: string } };
        assert.deepEqual(Object.keys(body.error).sort(), ["code", "message", "requestId"]);
        assert.equal(body.error.code, "INTERNAL_ERROR");
        assert.equal(body.error.requestId, response.headers.get("x-request-id"));
        assert.ok(!text.includes(failure.message) && !text.includes("pm.similarItems") && !text.includes("secret"), text);
      }
    } finally { console.error = originalError; }
  }
});

test("E19 and E36 against the real resolver and database: unknown ids and non-member proposals are 404; an archived project hides the plan", { skip: !integrationUrl }, async () => {
  await withIntegrationDb(async (base, fixtures) => {
    const db = createDbClient(base);
    const sessions = createSessions({ db: base, settings: { tier: "test" } });
    const today = "2026-11-10";
    const outline = { approach: "Build it.", checkpoints: [{ name: "MVP", targetDate: "2026-12-01" }], epics: [{ title: "One", description: "d", checkpointName: null }, { title: "Two", description: "d", checkpointName: "MVP" }, { title: "Three", description: "d", checkpointName: null }] };
    let runs = 0;
    const tasks = { tasks: [{ title: "Task", description: "d", acceptanceCriteria: ["done"], storyPoints: 3 }] };
    const gateway = { run: async (call: { feature: string }): Promise<LlmResult> => { runs += 1; return { ok: true, value: call.feature === "PM_PLAN_EXPAND" ? tasks : outline, callId: randomUUID(), flagged: false, truncated: false, cacheHit: false, promptTokens: 1, completionTokens: 1, costMicroUsd: 0 }; } };
    const aiContext = { assemble: async () => [], assembleWith: async () => ({ sections: [], provenance: [] }) } as unknown as AiContextWith;
    const clock = { now: () => new Date(`${today}T04:00:00.000Z`) };
    const flow = createPlanFlow({ proposals: bindProposals(base, sessions), gateway: gateway as never, sessions, aiContext, clock });

    const pm = await fixtures.user("PM");
    const outsider = await fixtures.user("PM");
    const projectA = await fixtures.project(pm);
    await fixtures.member(projectA, pm);
    const projectB = await fixtures.project(outsider);
    await fixtures.member(projectB, outsider);
    const requireMember = async (userId: string, projectId: string) => {
      if (!(await db.projectMember.findFirst({ where: { userId, projectId } }))) throw new Error("NOT_FOUND");
    };
    const proposalResolver = createProposalResolvers(db);
    const deps: AuthDependencies = {
      resolvePrincipal: async (authorization) => { if (!authorization) throw new Error("UNAUTHENTICATED"); return { firebaseUid: authorization, tokenClaims: {} }; },
      lookupRegisteredUser: async (uid) => ({ firebaseUid: uid, userId: uid.slice("Bearer ".length), role: "PM" }),
      resolveResource: async (operationId, request, tx) => operationId === "PM_PLAN_CREATE"
        ? { kind: "PROJECT", projectId: request.params.id!, state: "ACTIVE" }
        : proposalResolver(operationId, request as never, tx as never),
      requireMember,
      evaluatePredicate: createPredicateEvaluator(requireMember),
    };
    const app = createApiApp(deps, pmRoutes(() => flow));
    const asPm = `Bearer ${pm}`;
    const planned = await send(app, "POST", `/api/pm/projects/${projectA}/plans`, { token: asPm, body: json({ idea: idea(30) }) });
    assert.equal(planned.status, 201);
    const plan = (await planned.json()) as { id: string; version: number };
    const foreignPlan = await flow.createPlan({ caller: { userId: outsider, role: "PM" }, projectId: projectB, idea: idea(30) });

    // E19: unknown uuid, non-uuid, a non-member project's proposal.
    for (const e of ENDPOINTS.slice(1)) {
      for (const id of [randomUUID(), "not-a-uuid", foreignPlan.id]) {
        const response = await callEndpoint(app, e, id, asPm);
        assert.equal(response.status, 404, `${e.key} ${id}`);
        assert.equal(await code(response), "NOT_FOUND");
      }
    }
    // E21: the epic count (3) is out of range.
    const outOfRange = await send(app, "POST", `/api/pm/proposals/${plan.id}/epics/3/expand`, { token: asPm, body: "{}" });
    assert.equal(outOfRange.status, 404);
    assert.equal(await code(outOfRange), "NOT_FOUND");

    // E36: approve while active, archive, then every endpoint (and a repeat approve) is 404 and nothing more is created.
    assert.equal((await send(app, "GET", `/api/pm/proposals/${plan.id}`, { token: asPm })).status, 200);
    for (const index of [0, 1, 2]) assert.equal((await send(app, "POST", `/api/pm/proposals/${plan.id}/epics/${index}/expand`, { token: asPm, body: "{}" })).status, 200);
    const expanded = (await (await send(app, "GET", `/api/pm/proposals/${plan.id}`, { token: asPm })).json()) as { version: number };
    plan.version = expanded.version;
    const approved = await send(app, "POST", `/api/pm/proposals/${plan.id}/approve`, { token: asPm, body: json({ version: plan.version }) });
    assert.equal(approved.status, 200);
    const second = await flow.createPlan({ caller: { userId: pm, role: "PM" }, projectId: projectA, idea: idea(30) });
    const counts = async () => [await base.epic.count({ where: { projectId: projectA } }), await base.task.count({ where: { projectId: projectA } }), await base.checkpoint.count({ where: { projectId: projectA } })];
    const before = await counts();
    assert.deepEqual(before.slice(0, 1), [3]);
    await fixtures.archive(projectA);
    const afterStatuses = [
      await callEndpoint(app, ENDPOINTS[1]!, second.id, asPm),
      await callEndpoint(app, ENDPOINTS[2]!, second.id, asPm),
      await callEndpoint(app, ENDPOINTS[3]!, second.id, asPm),
      await callEndpoint(app, ENDPOINTS[4]!, second.id, asPm),
      await send(app, "POST", `/api/pm/proposals/${plan.id}/approve`, { token: asPm, body: json({ version: plan.version + 1 }) }),
    ];
    for (const response of afterStatuses) {
      assert.equal(response.status, 404);
      assert.equal(await code(response), "NOT_FOUND");
    }
    assert.deepEqual(await counts(), before);
    assert.equal((await base.aiProposal.findUniqueOrThrow({ where: { id: second.id } })).status, "PENDING");
    assert.equal((await base.aiProposal.findUniqueOrThrow({ where: { id: plan.id } })).status, "APPROVED");
    assert.equal(runs, 6);
  });
});
