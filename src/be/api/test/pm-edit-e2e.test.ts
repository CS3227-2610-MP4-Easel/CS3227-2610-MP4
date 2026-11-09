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
  const provider: LlmProvider = { complete: async (request) => { prompts.push({ feature: request.call.feature, text: request.messages.map((m) => m.content).join("\n") }); return inner.complete(request); } };
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
  return { db, sessions, proposals, prompts, request, cleanup, track: (id: string) => userIds.push(id) };
}

type H = Awaited<ReturnType<typeof build>>;
const actor = async (h: H, f: Fixtures) => {
  const userId = await f.user("PM");
  h.track(userId);
  const projectId = await f.project(userId);
  await f.member(projectId, userId);
  return { userId, projectId };
};

test("W7b E4 E53 E54 creator ownership, project visibility, edited approval and replay", opts, async () => {
 await withIntegrationDb(async (base, f) => harness(base, async h => {
  const a=await actor(h,f); const other=await f.user("PM"); h.track(other); await f.member(a.projectId,other);
  const foreign=await actor(h,f);
  const create=await h.request(a.userId,"POST",`/api/pm/projects/${a.projectId}/plans`,{idea:"Build a team task tracker with sprints and reports"}); assert.equal(create.status,201);
  const plan=await create.json() as {id:string; version:number}; const root=`/api/pm/proposals/${plan.id}`;
  const before=await base.aiProposal.findUniqueOrThrow({where:{id:plan.id}}); const epicsBefore=await base.proposalEpic.findMany({where:{proposalId:plan.id},orderBy:{index:"asc"}});
  for (const [method,path,body] of [["PATCH",`${root}/epics/0`,{version:plan.version,title:"Other"}],["POST",`${root}/epics/0/regenerate`,{version:plan.version}],["PATCH",`${root}/checkpoints`,{version:plan.version,checkpoints:[]}],["POST",`${root}/epics`,{version:plan.version,title:"Other",description:"d",checkpointName:null}],["DELETE",`${root}/epics/0?version=${plan.version}`,undefined]] as const) assert.equal((await h.request(other,method,path,body)).status,404,path);
  const after=await base.aiProposal.findUniqueOrThrow({where:{id:plan.id}}); assert.equal(after.version,before.version); assert.deepEqual(after.payload,before.payload); assert.deepEqual(await base.proposalEpic.findMany({where:{proposalId:plan.id},orderBy:{index:"asc"}}),epicsBefore);
  assert.equal((await h.request(foreign.userId,"GET",`/api/pm/projects/${a.projectId}/proposals`)).status,404);
  const edit=await h.request(a.userId,"PATCH",`${root}/epics/0`,{version:plan.version,title:"Edited epic"}); assert.equal(edit.status,200); let current=await edit.json() as {version:number};
  for(const index of [0,1,2]) assert.equal((await h.request(a.userId,"POST",`${root}/epics/${index}/expand`,{})).status,200);
  current=await (await h.request(a.userId,"GET",root)).json() as {version:number};
  const regenerated=await h.request(a.userId,"POST",`${root}/epics/0/regenerate`,{version:current.version}); assert.equal(regenerated.status,200,await regenerated.clone().text()); current=await regenerated.json() as {version:number};
  const approve=await h.request(a.userId,"POST",`${root}/approve`,{version:current.version}); assert.equal(approve.status,200); assert.deepEqual((await approve.json() as {created:unknown}).created,{checkpoints:1,epics:3,tasks:9});
  const session=await base.aiSession.findFirstOrThrow({where:{projectId:a.projectId}}); assert.equal(session.outcome,"EDITED");
  const replay=await h.request(a.userId,"POST",`${root}/approve`,{version:current.version}); assert.equal(replay.status,200);
  assert.equal(await base.epic.count({where:{projectId:a.projectId}}),3); assert.equal(await base.task.count({where:{projectId:a.projectId}}),9);
  await f.archive(a.projectId); assert.equal((await h.request(a.userId,"GET",`/api/pm/projects/${a.projectId}/proposals`)).status,404);
 }));
});

test("W7b E59 maximum-size plan assembled via edits approves", opts, async () => {
 await withIntegrationDb(async (base,f)=>harness(base,async h=>{
  const a=await actor(h,f); const create=await h.request(a.userId,"POST",`/api/pm/projects/${a.projectId}/plans`,{idea:"Build a team task tracker with sprints and reports"}); assert.equal(create.status,201);
  let plan=await create.json() as {id:string;version:number;epics:unknown[]}; const root=`/api/pm/proposals/${plan.id}`;
  const checkpoints=Array.from({length:8},(_,i)=>({name:`${i}`.padEnd(200,"c"),targetDate:`2027-0${i+1}-01`}));
  let response=await h.request(a.userId,"PATCH",`${root}/checkpoints`,{version:plan.version,checkpoints}); assert.equal(response.status,200,await response.clone().text()); plan=await response.json() as typeof plan;
  while(plan.epics.length<10) { response=await h.request(a.userId,"POST",`${root}/epics`,{version:plan.version,title:`${plan.epics.length}`.padEnd(200,"e"),description:"d".repeat(4000),checkpointName:null}); assert.equal(response.status,201,await response.clone().text()); plan=await response.json() as typeof plan; }
  for(let i=0;i<10;i++){ const tasks=Array.from({length:8},(_,j)=>({title:`${i}-${j}`.padEnd(200,"t"),description:"d".repeat(4000),acceptanceCriteria:Array.from({length:12},()=>"a".repeat(300)),storyPoints:3})); response=await h.request(a.userId,"PATCH",`${root}/epics/${i}`,{version:plan.version,title:`${i}`.padEnd(200,"e"),description:"d".repeat(4000),tasks}); assert.equal(response.status,200,await response.clone().text()); plan=await response.json() as typeof plan; }
  response=await h.request(a.userId,"POST",`${root}/approve`,{version:plan.version}); assert.equal(response.status,200,await response.clone().text()); assert.deepEqual((await response.json() as {created:unknown}).created,{checkpoints:8,epics:10,tasks:80});
 }));
});


test("W7b E1 stale versions reject each editing endpoint without changes or model calls", opts, async () => {
 await withIntegrationDb(async (base, f) => harness(base, async h => {
  const a = await actor(h, f);
  const response = await h.request(a.userId, "POST", `/api/pm/projects/${a.projectId}/plans`, { idea: "Build a team task tracker with sprints and reports" });
  assert.equal(response.status, 201); const plan = await response.json() as { id: string; version: number };
  const root = `/api/pm/proposals/${plan.id}`, stale = plan.version;
  const advance = await h.request(a.userId, "PATCH", `${root}/epics/0`, { version: stale, title: "Advanced" });
  assert.equal(advance.status, 200);
  const before = await base.aiProposal.findUniqueOrThrow({ where: { id: plan.id } });
  const epics = await base.proposalEpic.findMany({ where: { proposalId: plan.id }, orderBy: { index: "asc" } });
  const calls = h.prompts.length;
  for (const [method, path, body] of [["PATCH", `${root}/epics/0`, { version: stale, title: "new" }], ["POST", `${root}/epics/0/regenerate`, { version: stale }], ["PATCH", `${root}/checkpoints`, { version: stale, checkpoints: [] }], ["POST", `${root}/epics`, { version: stale, title: "new", description: "d", checkpointName: null }], ["DELETE", `${root}/epics/0?version=${stale}`, undefined]] as const) {
   const rejected = await h.request(a.userId, method, path, body);
   assert.equal(rejected.status, 409, path); assert.equal((await rejected.json() as { error: { code: string } }).error.code, "CONFLICT_VERSION");
  }
  const after = await base.aiProposal.findUniqueOrThrow({ where: { id: plan.id } });
  assert.equal(after.version, before.version); assert.deepEqual(after.payload, before.payload);
  const ignoreLockTimestamp = (rows: typeof epics) => rows.map(({ updatedAt, ...rest }) => rest);
  assert.deepEqual(ignoreLockTimestamp(await base.proposalEpic.findMany({ where: { proposalId: plan.id }, orderBy: { index: "asc" } })), ignoreLockTimestamp(epics));
  assert.equal(h.prompts.length, calls);
 }));
});
