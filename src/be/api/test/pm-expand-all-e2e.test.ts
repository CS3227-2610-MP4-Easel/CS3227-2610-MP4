import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { NotMember, type ResolvedResource } from "@agile/contracts";
import { createAiContext } from "@agile/ai-context/testing";
import { createDbClient } from "@agile/db";
import { createLlmGateway, createMockProvider, createSessions, loadGatewaySettings, mockRegistry, type LlmProvider, type MockRespond } from "@agile/llm-gateway";
import { createPlanFlow, createSimilarItemsSource, loadPmSettings } from "@agile/pm";
import { createProposalResolvers } from "@agile/proposals";
import { bindProposals, integrationUrl, withIntegrationDb, type Fixtures } from "../../pm/test/fakes.js";
import { createApiApp, createPredicateEvaluator, type AuthDependencies } from "../src/index.js";
import { pmRoutes } from "../src/routes/pm.js";

const opts = { skip: !integrationUrl };
const T0 = "2026-11-10T04:00:00.000Z";
const json = (value: unknown) => JSON.stringify(value);

/** The real flow, real sessions, real context assembly with the real similar-items source and the real gateway pipeline in mock mode. */
async function harness(base: PrismaClient, run: (h: Awaited<ReturnType<typeof build>>) => Promise<void>) {
  const h = await build(base);
  try { await run(h); } finally { await h.cleanup(); }
}

async function build(base: PrismaClient) {
  const db = createDbClient(base);
  const now = () => new Date(T0);
  const clock = { now, sleep: async () => {} };
  const settings = loadGatewaySettings({ APP_TIER: "test", LLM_MODE: "mock" });
  const sessions = createSessions({ db: base, settings, clock });
  const registry = new Map<string, MockRespond>(mockRegistry);
  const inner = createMockProvider(registry);
  const prompts: { feature: string; text: string }[] = [];
  let pause: (() => Promise<void>) | undefined;
  const provider: LlmProvider = { complete: async (request) => { prompts.push({ feature: request.call.feature, text: request.messages.map((m) => m.content).join("\n") }); if (pause && request.call.feature === "PM_PLAN_EXPAND") await pause(); return inner.complete(request); } };
  const stateKeyPrefix = `pm-e2e-${randomUUID()}-`;
  const gateway = createLlmGateway({ settings, db: base, sessions, clock, stateKeyPrefix, mockResponses: registry, provider, hit: async () => ({ allowed: true, retryAfterSeconds: 0 }) });
  const requireMember = async (userId: string, projectId: string) => {
    if (!(await db.projectMember.findFirst({ where: { userId, projectId } }))) throw new NotMember();
  };
  const aiContext = createAiContext({
    core: { requireMember },
    sources: new Map([
      ["core.projectBrief", async () => []],
      ["core.checkpoints", async () => []],
      ["pm.similarItems", createSimilarItemsSource({ db, settings: loadPmSettings({}) })],
    ]),
  });
  const proposals = bindProposals(base, sessions);
  const flow = createPlanFlow({ proposals, gateway, sessions, aiContext, clock });
  const gateMember = async (userId: string, projectId: string) => {
    if (!(await db.projectMember.findFirst({ where: { userId, projectId } }))) throw new Error("NOT_FOUND");
  };
  const proposalResolver = createProposalResolvers(db);
  const deps: AuthDependencies = {
    resolvePrincipal: async (authorization) => { if (!authorization) throw new Error("UNAUTHENTICATED"); return { firebaseUid: authorization, tokenClaims: {} }; },
    lookupRegisteredUser: async (uid) => ({ firebaseUid: uid, userId: uid.slice("Bearer ".length), role: "PM" }),
    resolveResource: async (operationId, request, tx): Promise<ResolvedResource | null> => operationId === "PM_PLAN_CREATE" || operationId === "PM_PROPOSAL_LIST"
      ? (await db.project.findFirst({ where: { id: request.params.id! } })) ? { kind: "PROJECT", projectId: request.params.id!, state: "ACTIVE" } : null
      : proposalResolver(operationId, request as never, tx as never),
    requireMember: gateMember,
    evaluatePredicate: createPredicateEvaluator(gateMember),
  };
  const app = createApiApp(deps, pmRoutes(() => flow));
  const userIds: string[] = [];
  const request = (token: string, method: "GET" | "POST" | "PATCH" | "DELETE", path: string, body?: unknown) =>
    app.request(`http://localhost${path}`, { method, headers: { authorization: `Bearer ${token}`, ...(body !== undefined ? { "content-type": "application/json" } : {}) }, ...(body !== undefined ? { body: json(body) } : {}) });
  const cleanup = async () => {
    await base.llmCall.deleteMany({ where: { userId: { in: userIds } } });
    await base.llmGatewayState.deleteMany({ where: { key: { startsWith: stateKeyPrefix } } });
  };
  return { db, sessions, proposals, prompts, request, cleanup, setPause: (p: (() => Promise<void>) | undefined) => { pause = p; }, track: (id: string) => userIds.push(id) };
}

type H = Awaited<ReturnType<typeof build>>;
const actor = async (h: H, f: Fixtures) => {
  const userId = await f.user("PM");
  h.track(userId);
  const projectId = await f.project(userId);
  await f.member(projectId, userId);
  return { userId, projectId };
};

const createPlan = async (h: H, userId: string, projectId: string) => {
  const response = await h.request(userId, "POST", `/api/pm/projects/${projectId}/plans`, { idea: "Build a team task tracker with sprints and reports" });
  assert.equal(response.status, 201, await response.clone().text());
  return await response.json() as { id: string; version: number; epics: { expansion: { status: string } }[] };
};
const expand = (h: H, userId: string, id: string, version: number) => h.request(userId, "POST", `/api/pm/proposals/${id}/expand`, { version });
const countExpand = (h: H) => h.prompts.filter(p => p.feature === "PM_PLAN_EXPAND").length;

test("W7c E10 E28 mock bulk expansion approves and preserves creator ownership", opts, async () => {
 await withIntegrationDb(async (base, f) => harness(base, async h => {
  const a = await actor(h, f); const other = await f.user("PM"); h.track(other); await f.member(a.projectId, other);
  const plan = await createPlan(h, a.userId, a.projectId); const before = countExpand(h);
  const forbidden = await expand(h, other, plan.id, plan.version); assert.equal(forbidden.status, 404); assert.equal((await forbidden.json() as { error: { code: string } }).error.code, "NOT_FOUND"); assert.equal(countExpand(h), before);
  const response = await expand(h, a.userId, plan.id, plan.version); assert.equal(response.status, 200, await response.clone().text());
  const done = await response.json() as typeof plan; assert.equal(done.version, plan.version); assert.ok(done.epics.every(e => e.expansion.status === "DONE")); assert.equal(countExpand(h) - before, 1);
  const approved = await h.request(a.userId, "POST", `/api/pm/proposals/${plan.id}/approve`, { version: plan.version }); assert.equal(approved.status, 200, await approved.clone().text());
 }));
});

test("W7c E15 replaying a stale version after an edit does not call the model", opts, async () => {
 await withIntegrationDb(async (base, f) => harness(base, async h => {
  const a = await actor(h, f); const plan = await createPlan(h, a.userId, a.projectId);
  const edit = await h.request(a.userId, "PATCH", `/api/pm/proposals/${plan.id}/epics/0`, { version: plan.version, title: "Edited" }); assert.equal(edit.status, 200);
  const before = countExpand(h); const stale = await expand(h, a.userId, plan.id, plan.version);
  assert.equal(stale.status, 409); assert.equal((await stale.json() as { error: { code: string } }).error.code, "CONFLICT_VERSION"); assert.equal(countExpand(h), before);
 }));
});

test("W7c E26 simultaneous requests make one mock gateway call", opts, async () => {
 await withIntegrationDb(async (base, f) => harness(base, async h => {
  const a = await actor(h, f); const plan = await createPlan(h, a.userId, a.projectId); const before = countExpand(h);
  let reached!: () => void; const entered = new Promise<void>(r => { reached = r; }); let release!: () => void; const gate = new Promise<void>(r => { release = r; });
  h.setPause(async () => { reached(); await gate; });
  const first = expand(h, a.userId, plan.id, plan.version); await entered;
  const second = await expand(h, a.userId, plan.id, plan.version); assert.equal(second.status, 409); assert.equal((await second.json() as { error: { code: string } }).error.code, "CONFLICT_STATE");
  release(); assert.equal((await first).status, 200); assert.equal(countExpand(h) - before, 1);
 }));
});

test("W7c E34 ten epic expansion uses only mock provider", opts, async () => {
 await withIntegrationDb(async (base, f) => harness(base, async h => {
  const a = await actor(h, f); const sessionId = await h.sessions.open({ feature: "PM_PLAN_OUTLINE", userId: a.userId, projectId: a.projectId });
  const id = await h.proposals.createProposal({ projectId: a.projectId, creatorId: a.userId, sessionId, flagged: false, approach: "Plan", checkpoints: [], retrieved: [], epics: Array.from({ length: 10 }, (_, i) => ({ title: `Epic ${i}`, description: "d", checkpointName: null })) });
  const before = countExpand(h); const response = await expand(h, a.userId, id, 1); assert.equal(response.status, 200, await response.clone().text());
  const body = await response.json() as { epics: { expansion: { status: string } }[] }; assert.equal(body.epics.length, 10); assert.ok(body.epics.every(e => e.expansion.status === "DONE")); assert.equal(countExpand(h) - before, 1);
 }));
});

test("W7c E27 edit during expansion completes and retains the edit", opts, async () => {
 await withIntegrationDb(async (base, f) => harness(base, async h => {
  const a = await actor(h, f); const plan = await createPlan(h, a.userId, a.projectId);
  const existing = await h.request(a.userId, "POST", `/api/pm/proposals/${plan.id}/epics/0/expand`, {}); assert.equal(existing.status, 200);
  let reached!: () => void; const entered = new Promise<void>(r => { reached = r; }); let release!: () => void; const gate = new Promise<void>(r => { release = r; });
  h.setPause(async () => { reached(); await gate; }); const pending = expand(h, a.userId, plan.id, plan.version); await entered;
  const edited = await h.request(a.userId, "PATCH", `/api/pm/proposals/${plan.id}/epics/0`, { version: plan.version, title: "Concurrent edit" }); assert.equal(edited.status, 200, await edited.clone().text());
  release(); const response = await pending; assert.equal(response.status, 200, await response.clone().text());
  const saved = await base.proposalEpic.findFirstOrThrow({ where: { proposalId: plan.id, index: 0 } }); assert.equal(saved.title, "Concurrent edit");
 }));
});
