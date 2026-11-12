import assert from "node:assert/strict";
import test from "node:test";
import { createApiApp, createPredicateEvaluator, type AuthDependencies } from "../src/index.js";
import { pmRoutes } from "../src/routes/pm.js";
import { PlanFlowError, type PlanFlow } from "@agile/pm";

const project = "1c8a7b4f-2d2e-4f6b-9a32-4d0e3b5c6f71";
const proposal = "0b7f6a3e-1c1d-4e5a-8f21-3c9d2a4b5e60";
const calls: string[] = [];
let failure: Error | undefined;
let role: "PM" | "DEV_LEAD" | "DEVELOPER" = "PM";
let member = true;
const hit = (name: string) => async () => { calls.push(name); if (failure) throw failure; return name === "listProposals" ? { items: [], page: 1, size: 20, total: 0 } : { id: proposal }; };
const flow = Object.fromEntries(["listProposals", "editEpic", "regenerateEpic", "replaceCheckpoints", "addEpic", "deleteEpic"].map(n => [n, hit(n)])) as unknown as PlanFlow;
const requireMember = async () => { if (!member) throw new Error("NOT_FOUND"); };
let resolves = 0;
const deps: AuthDependencies = {
  resolvePrincipal: async authorization => { if (!authorization) throw new Error("UNAUTHENTICATED"); return { firebaseUid: "uid", tokenClaims: {} }; },
  lookupRegisteredUser: async () => ({ firebaseUid: "uid", userId: "user", role }),
  resolveResource: async (_operation, request) => { resolves++; const id = request.params.proposalId; if (id && id !== proposal) return null; return id ? { kind: "PROPOSAL", projectId: project, ownerId: "user", state: "ACTIVE" } : { kind: "PROJECT", projectId: project, state: "ACTIVE" }; },
  requireMember, evaluatePredicate: createPredicateEvaluator(requireMember),
};
const app = createApiApp(deps, pmRoutes(() => flow));
const endpoints = [
  ["GET", `/api/pm/projects/${project}/proposals`, undefined, "listProposals", 200],
  ["PATCH", `/api/pm/proposals/${proposal}/epics/0`, { version: 1, title: "x" }, "editEpic", 200],
  ["POST", `/api/pm/proposals/${proposal}/epics/0/regenerate`, { version: 1 }, "regenerateEpic", 200],
  ["PATCH", `/api/pm/proposals/${proposal}/checkpoints`, { version: 1, checkpoints: [] }, "replaceCheckpoints", 200],
  ["POST", `/api/pm/proposals/${proposal}/epics`, { version: 1, title: "x", description: "d", checkpointName: null }, "addEpic", 201],
  ["DELETE", `/api/pm/proposals/${proposal}/epics/0?version=1`, undefined, "deleteEpic", 200],
] as const;
const send = (method: string, path: string, body?: unknown, token = true) => app.request(`http://localhost${path}`, { method, headers: { ...(token ? { authorization: "Bearer pm" } : {}), ...(body !== undefined ? { "content-type": "application/json" } : {}) }, ...(body !== undefined ? { body: typeof body === "string" ? body : JSON.stringify(body) } : {}) });
test("W7b E27 routes dispatch and reject malformed indexes", async () => {
 calls.length = 0;
 for (const [method,path,body,name,status] of endpoints) { assert.equal((await send(method,path,body)).status,status,name); assert.equal(calls.at(-1),name); }
 for (const index of ["-1", "1.5", "abc", "01", "+1", "1e0", "%201", "1000"]) for (const [method, suffix, body] of [["PATCH", "", {version:1,title:"x"}], ["POST", "/regenerate", {version:1}], ["DELETE", "?version=1", undefined]] as const) assert.equal((await send(method, `/api/pm/proposals/${proposal}/epics/${index}${suffix}`, body)).status,404,index);
});

test("W7b E4 E5 E6 policy and creator failures never bypass authorization", async () => {
  calls.length=0;
  for (const [method,path,body] of endpoints) {
    for (const r of ["DEV_LEAD", "DEVELOPER"] as const) { role=r; assert.equal((await send(method,path,body)).status,403); }
    role="PM"; member=false; assert.equal((await send(method,path,body)).status,404); member=true;
    assert.equal((await send(method,path,body,false)).status,401);
    if (path.includes(proposal)) { assert.equal((await send(method,path.replace(proposal,"not-a-uuid"),body)).status,404); assert.equal((await send(method,path.replace(proposal,"11111111-1111-4111-8111-111111111111"),body)).status,404); }
  }
  assert.equal(calls.length,0);
  failure=new PlanFlowError("NOT_FOUND",404,"Not found");
  for (const [method,path,body] of endpoints.slice(1)) assert.equal((await send(method,path,body)).status,404);
  failure=undefined;
});

test("W7b E7 E27 E36 E49 strict bodies, queries and index precedence", async () => {
 calls.length=0;
 for (const [method,path,body] of endpoints.slice(1,5)) {
   for (const value of [{}, {...body,version:0}, {...body,version:1.5}, {...body,model:"x"}]) assert.equal((await send(method,path,value)).status,422,`${method} ${path}`);
   assert.equal((await send(method,path,"{" )).status,422);
   assert.equal((await send(method,path,"{",false)).status,401);
 }
 for (const q of ["", "?version=0", "?version=1.5", "?version=1&id=x"]) assert.equal((await send("DELETE",`/api/pm/proposals/${proposal}/epics/0${q}`)).status,422);
 for (const q of ["?status=APPROVEDX", "?extra=1", "?size=21"]) assert.equal((await send("GET",`/api/pm/projects/${project}/proposals${q}`)).status,422);
 assert.equal((await send("PATCH",`/api/pm/proposals/${proposal}/epics/abc`,{})).status,422);
 assert.equal(calls.length,0);
 failure=new PlanFlowError("NOT_FOUND",404,"Not found");
 assert.equal((await send("DELETE",`/api/pm/proposals/${proposal}/epics/999?version=1`)).status,404);
 failure=undefined;
});

test("W7b E9 body limits run before authorization and resource resolution", async () => {
 for (const [method,path,limit,body,status] of [["PATCH",endpoints[1][1],262144,endpoints[1][2],200],["POST",endpoints[2][1],1024,endpoints[2][2],200],["PATCH",endpoints[3][1],16384,endpoints[3][2],200],["POST",endpoints[4][1],32768,endpoints[4][2],201]] as const) {
   calls.length=0; resolves=0;
   const valid=JSON.stringify(body); const at=await send(method,path,valid + " ".repeat(limit-valid.length)); assert.equal(at.status,status); calls.length=0;
   const before=resolves;
   assert.equal((await send(method,path,"x".repeat(limit+1))).status,413);
   assert.equal((await send(method,path,"x".repeat(limit+1),false)).status,413);
   const stream=new ReadableStream<Uint8Array>({start(c){ c.enqueue(new Uint8Array(limit+1).fill(120)); c.close(); }});
   const chunked=await app.request(`http://localhost${path}`, {method, headers:{authorization:"Bearer pm", "content-type":"application/json"},body:stream,duplex:"half"} as RequestInit);
   assert.equal(chunked.status,413); assert.equal(resolves,before); assert.equal(calls.length,0);
 }
});
