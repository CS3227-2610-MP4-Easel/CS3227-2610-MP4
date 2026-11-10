import assert from "node:assert/strict";
import test from "node:test";
import { createApiApp, createPredicateEvaluator, type AuthDependencies } from "../src/index.js";
import { pmRoutes } from "../src/routes/pm.js";
import { PlanFlowError, type PlanFlow } from "@agile/pm";

const project = "1c8a7b4f-2d2e-4f6b-9a32-4d0e3b5c6f71";
const proposal = "0b7f6a3e-1c1d-4e5a-8f21-3c9d2a4b5e60";
const path = `/api/pm/proposals/${proposal}/expand`;
let calls: unknown[] = [], resolves = 0, failure: Error | undefined;
let role: "PM" | "DEV_LEAD" | "DEVELOPER" = "PM", member = true, archived = false;
const flow = { expandAll: async (args: unknown) => { calls.push(args); if (failure) throw failure; return { id: proposal }; } } as unknown as PlanFlow;
const requireMember = async () => { if (!member) throw new Error("NOT_FOUND"); };
const deps: AuthDependencies = {
 resolvePrincipal: async authorization => { if (!authorization) throw new Error("UNAUTHENTICATED"); return { firebaseUid: "uid", tokenClaims: {} }; },
 lookupRegisteredUser: async () => ({ firebaseUid: "uid", userId: "user", role }),
 resolveResource: async (_operation, request) => { resolves++; return request.params.proposalId === proposal && !archived ? { kind: "PROPOSAL", projectId: project, ownerId: "user", state: "ACTIVE" } : null; },
 requireMember, evaluatePredicate: createPredicateEvaluator(requireMember),
};
const app = createApiApp(deps, pmRoutes(() => flow));
const send = (body?: BodyInit, token = true, target = path) => app.request(`http://localhost${target}`, { method: "POST", headers: { ...(token ? { authorization: "Bearer pm" } : {}), "content-type": "application/json" }, ...(body !== undefined ? { body, duplex: "half" } as RequestInit : {}) });
const code = async (r: Response) => ((await r.json()) as { error: { code: string } }).error.code;

test("W7c E10 dispatches the caller, proposal and version", async () => {
 calls = []; const r = await send('{"version":1}'); assert.equal(r.status, 200);
 assert.deepEqual(calls, [{ caller: { userId: "user", role: "PM" }, proposalId: proposal, version: 1 }]);
});
test("W7c E29 validates strict bodies and limits bytes before authorization", async () => {
 calls = [];
 for (const value of [undefined, "", "{}", '{"version":"1"}', '{"version":1.5}', '{"version":0}', '{"version":1,"extra":1}', "{"]) {
  const r = await send(value); assert.equal(r.status, 422); assert.equal(await code(r), "VALIDATION_FAILED");
 }
 const valid = '{"version":1}'; assert.equal((await send(valid + " ".repeat(1024 - valid.length))).status, 200); calls = [];
 const prior = resolves;
 for (const token of [true, false]) { const r = await send("x".repeat(1025), token); assert.equal(r.status, 413); assert.equal(await code(r), "PAYLOAD_TOO_LARGE"); }
 const stream = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new Uint8Array(600).fill(120)); c.enqueue(new Uint8Array(425).fill(120)); c.close(); } });
 const r = await send(stream); assert.equal(r.status, 413); assert.equal(await code(r), "PAYLOAD_TOO_LARGE");
 assert.equal(resolves, prior); assert.equal(calls.length, 0);
});
test("W7c E28 rejects unauthorized and unknown resources", async () => {
 calls = [];
 for (const value of ["DEV_LEAD", "DEVELOPER"] as const) { role = value; const r = await send('{"version":1}'); assert.equal(r.status, 403); assert.equal(await code(r), "FORBIDDEN_ROLE"); }
 role = "PM"; member = false; let r = await send('{"version":1}'); assert.equal(r.status, 404); assert.equal(await code(r), "NOT_FOUND"); member = true;
 r = await send('{"version":1}', false); assert.equal(r.status, 401); assert.equal(await code(r), "UNAUTHENTICATED");
 for (const id of ["not-a-uuid", "11111111-1111-4111-8111-111111111111"]) { r = await send('{"version":1}', true, path.replace(proposal, id)); assert.equal(r.status, 404); assert.equal(await code(r), "NOT_FOUND"); }
 archived = true; r = await send('{"version":1}'); assert.equal(r.status, 404); assert.equal(await code(r), "NOT_FOUND"); archived = false;
 assert.equal(calls.length, 0);
 failure = new PlanFlowError("NOT_FOUND", 404, "Not found"); r = await send('{"version":1}'); assert.equal(r.status, 404); assert.equal(await code(r), "NOT_FOUND"); failure = undefined;
});
test("W7c E15 maps stale and closed flow errors", async () => {
 for (const value of ["CONFLICT_VERSION", "CONFLICT_STATE"] as const) { failure = new PlanFlowError(value, 409, "Conflict"); const r = await send('{"version":1}'); assert.equal(r.status, 409); assert.equal(await code(r), value); }
 failure = undefined;
});
