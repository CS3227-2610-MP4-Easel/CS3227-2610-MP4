import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { z } from "zod/v3";
import type { LlmCall } from "@agile/contracts";
import { inCoreTransaction } from "@agile/db";
import { createLlmGateway, createMockProvider, defaultGuards, type GuardPipeline, type MockRespond } from "../src/index.js";
import { fakeClock, fakeGatewayDb, fakeHit, fakeProvider, fakeSessions, testSettings, textCall, type Step } from "./fakes.js";

const MIN = 60_000;

/** One gateway over in-memory fakes, with the default call's session usable and a mock response registered. */
function world(options: { steps?: Step[]; refuse?: Record<string, number>; settings?: Parameters<typeof testSettings>[0]; guards?: GuardPipeline; mockResponses?: Map<string, MockRespond>; provider?: "fake" | "mock"; failTouch?: boolean } = {}) {
  const clock = fakeClock();
  const store = fakeGatewayDb();
  const call = textCall();
  store.sessions.set(call.sessionId, { projectId: call.projectId });
  const { sessions, touched } = fakeSessions(new Map([[call.sessionId, { userId: call.caller.userId, feature: call.feature }]]));
  if (options.failTouch) sessions.touch = async () => { throw new Error("connection reset: session detail"); };
  const { hit, keys } = fakeHit(options.refuse);
  const mockResponses = options.mockResponses ?? new Map<string, MockRespond>([["DEV_STANDUP", () => "Yesterday: fixed login."]]);
  const fake = fakeProvider(clock, options.steps ?? [{ text: "Yesterday: fixed login." }]);
  const provider = options.provider === "mock" ? createMockProvider(mockResponses) : fake.provider;
  const gateway = createLlmGateway({ settings: testSettings(options.settings), db: store.db, hit, sessions, provider, guards: options.guards, clock, mockResponses });
  return { clock, store, hit: keys, touched, requests: fake.requests, gateway, call };
}
const breakerOf = (store: ReturnType<typeof fakeGatewayDb>) => store.state.get("breaker") as { failures: number; openUntil: string | null } | undefined;
const quietly = async <T>(run: () => Promise<T>) => {
  const warn = mock.method(console, "warn", () => {});
  try { return { result: await run(), warnings: warn.mock.calls.map((c) => c.arguments) }; } finally { warn.mock.restore(); }
};

test("baseline: a successful call is admitted, recorded and returned", async () => {
  const w = world();
  const result = await w.gateway.run(w.call);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value, "Yesterday: fixed login.");
  assert.equal(result.promptTokens, 100);
  assert.equal(result.completionTokens, 20);
  assert.equal(result.cacheHit, false);
  assert.equal(w.store.calls.length, 1);
  const row = w.store.calls[0];
  assert.equal(row.status, "OK");
  assert.equal(row.leaseExpiresAt, null);
  assert.equal(row.attempts, 1);
  assert.equal(result.costMicroUsd, Number(row.costMicrousd));
  assert.deepEqual(w.touched, [w.call.sessionId]);
  assert.deepEqual(w.hit, ["user:00000000-0000-4000-8000-0000000000a1:min", "user:00000000-0000-4000-8000-0000000000a1:day", "global:min", "global:day"]);
  assert.equal(w.requests[0].messages[0].content, "## rules\nWrite a standup.");
  assert.equal(w.requests[0].messages[1].content, "## items\nFixed the login bug.");
  assert.equal(w.requests[0].reasoningEffort, undefined, "llama3.1:8b takes no reasoning_effort");
});

test("E4 a role not allowed for the feature is ROLE_DENIED with no row, hit or provider call", async () => {
  for (const call of [textCall({ caller: { userId: textCall().caller.userId, role: "PM" } }), textCall({ feature: "PM_PLAN_OUTLINE" })]) {
    const w = world();
    assert.deepEqual(await w.gateway.run(call), { ok: false, code: "ROLE_DENIED" });
    assert.equal(w.store.calls.length, 0);
    assert.equal(w.hit.length, 0);
    assert.equal(w.requests.length, 0);
  }
});

test("E6 an invalid call throws INVALID_LLM_CALL before any database write", async () => {
  const w = world();
  for (const call of [{ ...textCall(), extra: 1 }, textCall({ sessionId: "not-a-uuid" }), textCall({ output: { kind: "json", schema: {} } })]) {
    await assert.rejects(w.gateway.run(call as LlmCall), { message: "INVALID_LLM_CALL" });
  }
  assert.deepEqual(w.store.writes, []);
});

test("E7 AI_ENABLED=false is AI_DISABLED with no row or hit, in mock and live mode", async () => {
  for (const llmMode of ["mock", "live"] as const) {
    const w = world({ settings: { aiEnabled: false, llmMode } });
    assert.deepEqual(await w.gateway.run(w.call), { ok: false, code: "AI_DISABLED" });
    assert.equal(w.store.calls.length, 0);
    assert.equal(w.hit.length, 0);
  }
});

test("E8 a per-user window refusal is AI_BUSY with hit's wait and no row", async () => {
  const w = world({ refuse: { "user:00000000-0000-4000-8000-0000000000a1:min": 37 } });
  assert.deepEqual(await w.gateway.run(w.call), { ok: false, code: "AI_BUSY", retryAfterSeconds: 37 });
  assert.equal(w.hit.length, 1);
  assert.equal(w.store.calls.length, 0);
});

test("E9 a global window refusal is AI_BUSY after the user keys were counted", async () => {
  const w = world({ refuse: { "global:min": 12 } });
  assert.deepEqual(await w.gateway.run(w.call), { ok: false, code: "AI_BUSY", retryAfterSeconds: 12 });
  assert.equal(w.hit.length, 3);
});

test("E11 a hit failure rejects run with no row and no provider call", async () => {
  const w = world();
  const gateway = createLlmGateway({ settings: testSettings(), db: w.store.db, hit: async () => { throw new Error("db down"); }, sessions: fakeSessions(new Map([[w.call.sessionId, { userId: w.call.caller.userId, feature: w.call.feature }]])).sessions, provider: fakeProvider(w.clock, []).provider, clock: w.clock, mockResponses: new Map([["DEV_STANDUP", () => "x"]]) });
  await assert.rejects(gateway.run(w.call), { message: "db down" });
  assert.equal(w.store.calls.length, 0);
});

test("E12 mock mode without a registered response throws NO_MOCK_RESPONSE", async () => {
  const w = world({ mockResponses: new Map() });
  await assert.rejects(w.gateway.run(w.call), { message: "NO_MOCK_RESPONSE" });
  assert.equal(w.store.calls.length, 0);
});

test("E41 the earlier admission step wins each adjacent pair", async () => {
  const fakeTx = { $transaction: async <R>(callback: (tx: unknown) => Promise<R>) => callback({}) };
  let w = world();
  await assert.rejects(inCoreTransaction(fakeTx, () => w.gateway.run({ ...textCall(), extra: 1 } as LlmCall)), { message: "INVALID_LLM_CALL" });
  await assert.rejects(inCoreTransaction(fakeTx, () => w.gateway.run(textCall({ feature: "PM_PLAN_OUTLINE" }))), { message: "LLM_CALL_IN_TRANSACTION" });
  assert.deepEqual(await w.gateway.run(textCall({ feature: "PM_PLAN_OUTLINE", sessionId: "00000000-0000-4000-8000-0000000000ff" })), { ok: false, code: "ROLE_DENIED" });
  w = world({ settings: { aiEnabled: false } });
  await assert.rejects(w.gateway.run(textCall({ sessionId: "00000000-0000-4000-8000-0000000000ff" })), { message: "NOT_FOUND" });
  w = world({ settings: { aiEnabled: false } });
  w.store.state.set("budget", { blockedUntil: new Date(w.clock.now().getTime() + 5 * MIN).toISOString() });
  assert.deepEqual(await w.gateway.run(w.call), { ok: false, code: "AI_DISABLED" });
  w = world({ refuse: { "user:00000000-0000-4000-8000-0000000000a1:min": 37 } });
  w.store.state.set("budget", { blockedUntil: new Date(w.clock.now().getTime() + 5 * MIN).toISOString() });
  assert.deepEqual(await w.gateway.run(w.call), { ok: false, code: "AI_BUSY", retryAfterSeconds: 300 });
  assert.equal(w.hit.length, 0, "budget block answers before hit");
  w = world({ refuse: { "global:day": 99 } });
  const open = { failures: 5, openUntil: new Date(w.clock.now().getTime() + MIN).toISOString() };
  w.store.state.set("breaker", structuredClone(open));
  assert.deepEqual(await w.gateway.run(w.call), { ok: false, code: "AI_BUSY", retryAfterSeconds: 99 });
  assert.deepEqual(breakerOf(w.store), open, "breaker untouched");
});

test("E42 a session of another project, or a project-less session, is NOT_FOUND", async () => {
  const w = world();
  w.store.sessions.set(w.call.sessionId, { projectId: "00000000-0000-4000-8000-0000000000c2" });
  await assert.rejects(w.gateway.run(w.call), { message: "NOT_FOUND" });
  w.store.sessions.set(w.call.sessionId, { projectId: null });
  await assert.rejects(w.gateway.run(w.call), { message: "NOT_FOUND" });
  assert.equal(w.store.calls.length, 0);
  assert.equal((await w.gateway.run(textCall({ projectId: null }))).ok, true, "both null counts as equal");
});

test("E12 live mode never needs a mock response", async () => {
  const w = world({ settings: { llmMode: "live", apiKey: "k" }, mockResponses: new Map() });
  assert.equal((await w.gateway.run(w.call)).ok, true);
});

test("E30 static sections over budget throw at admission: no row, no hit", async () => {
  const w = world();
  const call = textCall({ sections: [{ name: "rules", kind: "STATIC", priority: 0, budgetTokens: 1, text: "Far too long for one token.", trusted: true }] });
  await assert.rejects(w.gateway.run(call), { message: "STATIC_SECTION_OVER_BUDGET:rules" });
  assert.equal(w.store.calls.length, 0);
  assert.equal(w.hit.length, 0);
});

test("E32 a model override sets the row's model, the reservation and the reasoning effort sent", async () => {
  const w = world({ settings: { modelOverrides: { DEV_STANDUP: "qwen3.5:9b" } }, steps: [{ text: "ok", tokens: [null, null] }] });
  await w.gateway.run(w.call);
  const row = w.store.calls[0];
  assert.equal(row.model, "qwen3.5:9b");
  assert.equal(row.costMicrousd, 520n, "ceil(4000 * 0.1 + 800 * 0.15)");
  assert.equal(w.requests[0].model, "qwen3.5:9b");
  assert.equal(w.requests[0].reasoningEffort, "none");
});

test("E43 a hit refusal while the breaker is due a probe leaves openUntil unchanged", async () => {
  const w = world({ refuse: { "global:min": 5 } });
  const due = { failures: 5, openUntil: new Date(w.clock.now().getTime() - 1).toISOString() };
  w.store.state.set("breaker", structuredClone(due));
  assert.deepEqual(await w.gateway.run(w.call), { ok: false, code: "AI_BUSY", retryAfterSeconds: 5 });
  assert.deepEqual(breakerOf(w.store), due);
});

test("E17 five upstream failures open the breaker; the sixth call is refused without a row or provider call", async () => {
  const w = world({ steps: [{ fail: "HTTP_5XX" }] });
  const { warnings } = await quietly(async () => { for (let i = 0; i < 5; i++) await w.gateway.run(w.call); });
  assert.equal(breakerOf(w.store)?.failures, 5);
  assert.equal(warnings.filter((args) => args[0] === "llm_breaker_open").length, 1);
  const requests = w.requests.length;
  assert.deepEqual(await w.gateway.run(w.call), { ok: false, code: "AI_UNAVAILABLE" });
  assert.equal(w.store.calls.length, 5);
  assert.equal(w.requests.length, requests);
});

test("E18 breaker counting: schema failures do not count, OK resets, the probe closes or re-opens", async () => {
  let w = world({ steps: [{ fail: "HTTP_5XX" }, { fail: "HTTP_5XX" }, { fail: "HTTP_5XX" }, { fail: "HTTP_5XX" }, { fail: "HTTP_5XX" }, { fail: "HTTP_5XX" }, { fail: "HTTP_5XX" }, { fail: "HTTP_5XX" }, { text: "" }, { fail: "HTTP_5XX" }] });
  await quietly(async () => { for (let i = 0; i < 6; i++) await w.gateway.run(w.call); });
  assert.equal(breakerOf(w.store)?.failures, 5, "the empty text was SCHEMA_FAIL and did not count");
  assert.notEqual(breakerOf(w.store)?.openUntil, null);

  w = world({ steps: [{ fail: "HTTP_5XX" }, { fail: "HTTP_5XX" }, { fail: "HTTP_5XX" }, { fail: "HTTP_5XX" }, { fail: "HTTP_5XX" }, { fail: "HTTP_5XX" }, { fail: "HTTP_5XX" }, { fail: "HTTP_5XX" }, { text: "ok" }, { fail: "HTTP_5XX" }] });
  await quietly(async () => { for (let i = 0; i < 6; i++) await w.gateway.run(w.call); });
  assert.deepEqual(breakerOf(w.store), { failures: 1, openUntil: null }, "count restarts after OK");

  w = world({ steps: [{ fail: "HTTP_5XX" }] });
  await quietly(async () => { for (let i = 0; i < 5; i++) await w.gateway.run(w.call); });
  w.clock.advance(MIN);
  const { warnings } = await quietly(() => w.gateway.run(w.call));
  assert.equal(breakerOf(w.store)?.failures, 6);
  assert.equal(breakerOf(w.store)?.openUntil, new Date(w.clock.now().getTime() + MIN).toISOString(), "a failed probe re-opens for 60 s");
  assert.equal(warnings.filter((args) => args[0] === "llm_breaker_open").length, 1, "and logs again");
  const ok = world();
  ok.store.state.set("breaker", { failures: 6, openUntil: new Date(ok.clock.now().getTime() - 1).toISOString() });
  assert.equal((await ok.gateway.run(ok.call)).ok, true);
  assert.deepEqual(breakerOf(ok.store), { failures: 0, openUntil: null }, "a successful probe closes it");
});

test("E19 429 and 5xx retries: final status from the last attempt", async () => {
  const cases: Array<[Step[], string, number, number]> = [
    [[{ fail: "HTTP_429" }, { text: "ok" }], "OK", 2, 2_000],
    [[{ fail: "HTTP_429" }, { fail: "HTTP_429" }], "RATE_LIMITED", 2, 2_000],
    [[{ fail: "HTTP_429" }, { fail: "HTTP_5XX" }], "UPSTREAM_ERROR", 2, 2_000],
    [[{ fail: "HTTP_5XX" }, { text: "ok" }], "OK", 2, 0],
    [[{ fail: "HTTP_5XX" }, { fail: "HTTP_5XX" }], "UPSTREAM_ERROR", 2, 0],
  ];
  for (const [steps, status, attempts, waited] of cases) {
    const w = world({ steps });
    const start = w.clock.now().getTime();
    const { result } = await quietly(() => w.gateway.run(w.call));
    const row = w.store.calls[0];
    assert.equal(row.status, status);
    assert.equal(row.attempts, attempts);
    assert.equal(w.clock.now().getTime() - start, waited);
    if (status !== "OK") assert.deepEqual(result, { ok: false, code: "AI_UNAVAILABLE", callId: row.id });
    assert.equal(breakerOf(w.store)?.failures ?? 0, status === "UPSTREAM_ERROR" ? 1 : 0);
  }
});

test("E17 timeouts count towards the breaker like 5xx and network failures", async () => {
  const hangs = world({ steps: [{ hang: true }] });
  await quietly(async () => { for (let i = 0; i < 5; i++) await hangs.gateway.run(hangs.call); });
  assert.equal(breakerOf(hangs.store)?.failures, 5);
  assert.notEqual(breakerOf(hangs.store)?.openUntil, null);

  const mixed = world({ steps: [{ hang: true }, { fail: "HTTP_5XX" }, { fail: "HTTP_5XX" }, { fail: "NETWORK" }, { fail: "NETWORK" }] });
  await quietly(async () => { for (let i = 0; i < 3; i++) await mixed.gateway.run(mixed.call); });
  assert.deepEqual(mixed.store.calls.map((row) => row.status), ["TIMEOUT", "UPSTREAM_ERROR", "UPSTREAM_ERROR"]);
  assert.equal(breakerOf(mixed.store)?.failures, 3);
});

test("E19 a network failure is retried without waiting; an early failure's retry gets the rest of the 25 s", async () => {
  const network = world({ steps: [{ fail: "NETWORK" }, { text: "ok" }] });
  const start = network.clock.now().getTime();
  assert.equal((await network.gateway.run(network.call)).ok, true);
  assert.equal(network.clock.now().getTime() - start, 0);
  assert.equal(network.store.calls[0].attempts, 2);

  const early = world({ steps: [{ fail: "HTTP_5XX", after: 1_000 }, { text: "ok" }] });
  await early.gateway.run(early.call);
  assert.equal(early.requests[1].timeoutMs, 24_000);
});

test("E20 a provider that never answers is TIMEOUT at 20 s and not retried", async () => {
  const w = world({ steps: [{ hang: true }] });
  const start = w.clock.now().getTime();
  const { result } = await quietly(() => w.gateway.run(w.call));
  assert.equal(w.clock.now().getTime() - start, 20_000);
  assert.equal(w.requests.length, 1);
  assert.equal(w.store.calls[0].status, "TIMEOUT");
  assert.deepEqual(result, { ok: false, code: "AI_UNAVAILABLE", callId: w.store.calls[0].id });
});

test("E21 a retry needs 8 s left of the 25 s deadline, counting the 429 backoff", async () => {
  const cases: Array<[Step, number | null]> = [
    [{ fail: "HTTP_5XX", after: 17_000 }, 8_000],
    [{ fail: "HTTP_5XX", after: 17_100 }, null],
    [{ fail: "HTTP_429", after: 15_000 }, 8_000],
    [{ fail: "HTTP_429", after: 15_100 }, null],
  ];
  for (const [first, retryTimeout] of cases) {
    const w = world({ steps: [first, { text: "ok" }] });
    await quietly(() => w.gateway.run(w.call));
    assert.equal(w.requests[0].timeoutMs, 20_000);
    assert.equal(w.requests[1]?.timeoutMs ?? null, retryTimeout);
  }
});

test("E23 a response without usage keeps the reservation as the cost", async () => {
  const w = world({ steps: [{ text: "ok", tokens: [null, null] }] });
  const result = await w.gateway.run(w.call);
  const row = w.store.calls[0];
  assert.equal(row.promptTokens, null);
  assert.equal(row.completionTokens, null);
  assert.equal(row.costMicrousd, 104n);
  assert.deepEqual(result.ok && [result.promptTokens, result.completionTokens, result.costMicroUsd], [0, 0, 104]);
});

test("E24 output that fails validation is SCHEMA_FAIL and AI_UNAVAILABLE without touching the breaker", async () => {
  const jsonCall = textCall({ output: { kind: "json", schema: z.object({ yesterday: z.string() }).strict() } });
  const cases: Array<[LlmCall, string]> = [[jsonCall, "not json"], [jsonCall, "{\"today\":1}"], [textCall(), ""], [textCall({ output: { kind: "text", maxChars: 3 } }), "😀😀😀😀"]];
  for (const [call, text] of cases) {
    const w = world({ steps: [{ text }] });
    const result = await w.gateway.run(call);
    assert.equal(w.store.calls[0].status, "SCHEMA_FAIL", text);
    assert.deepEqual(result, { ok: false, code: "AI_UNAVAILABLE", callId: w.store.calls[0].id });
    assert.equal(breakerOf(w.store), undefined);
  }
  const ok = world({ steps: [{ text: "{\"yesterday\":\"fixed\"}" }] });
  const result = await ok.gateway.run(jsonCall);
  assert.deepEqual(result.ok && result.value, { yesterday: "fixed" });
  const exact = world({ steps: [{ text: "😀😀😀" }] });
  assert.equal((await exact.gateway.run(textCall({ output: { kind: "text", maxChars: 3 } }))).ok, true, "maxChars counts code points, not UTF-16 units");
});

test("E27 replacement guards plug in: changed text, blocked input, flags and refusals", async () => {
  const seen: string[] = [];
  const changed = world({ guards: { ...defaultGuards, input: (text) => { seen.push(text); return { text: text.toUpperCase(), flagged: false }; } } });
  await changed.gateway.run(changed.call);
  assert.equal(changed.requests[0].messages[1].content, "## items\nFIXED THE LOGIN BUG.");
  assert.equal(changed.requests[0].messages[0].content, "## rules\nWrite a standup.", "trusted sections skip the input guard");
  assert.deepEqual(seen, ["Fixed the login bug."]);

  const blocked = world({ guards: { ...defaultGuards, input: () => ({ blocked: true }) } });
  const result = await blocked.gateway.run(blocked.call);
  const row = blocked.store.calls[0];
  assert.deepEqual(result, { ok: false, code: "BLOCKED_INPUT", callId: row.id });
  assert.equal(row.status, "BLOCKED_INPUT");
  assert.equal(row.attempts, 0);
  assert.equal(row.costMicrousd, 0n);
  assert.equal(blocked.requests.length, 0);
  assert.equal(blocked.hit.length, 4, "the windows were already counted");

  const flagged = world({ guards: { ...defaultGuards, input: (text) => ({ text, flagged: true }) } });
  const flaggedResult = await flagged.gateway.run(flagged.call);
  assert.equal(flaggedResult.ok && flaggedResult.flagged, true);
  assert.equal(flagged.store.calls[0].flagged, true);

  const refused = world({ guards: { ...defaultGuards, output: () => ({ ok: false, status: "REFUSED" }) } });
  assert.deepEqual(await refused.gateway.run(refused.call), { ok: false, code: "REQUEST_REFUSED", callId: refused.store.calls[0].id });
  assert.equal(refused.store.calls[0].status, "REFUSED");
});

test("PR #14 review: a failed session or breaker write after the row is final keeps the answer and the row consistent", async () => {
  const breakerDown = (w: ReturnType<typeof world>) => {
    (w.store.db.llmGatewayState as unknown as { upsert: () => Promise<never> }).upsert = async () => { throw new Error("connection reset: breaker detail"); };
  };

  const touchFails = world({ failTouch: true });
  const touched = await quietly(() => touchFails.gateway.run(touchFails.call));
  assert.equal(touched.result.ok && touched.result.value, "Yesterday: fixed login.");
  assert.equal(touchFails.store.calls[0].status, "OK");
  assert.deepEqual(touched.warnings, [["llm_call_followup_failed", { callId: touchFails.store.calls[0].id, status: "OK" }]]);

  const closing = world();
  closing.store.state.set("breaker", { failures: 1, openUntil: null }); // an OK call writes to close the breaker
  breakerDown(closing);
  const closed = await quietly(() => closing.gateway.run(closing.call));
  assert.equal(closed.result.ok, true);
  assert.equal(closing.store.calls[0].status, "OK");

  const failing = world({ steps: [{ fail: "HTTP_5XX" }] });
  breakerDown(failing);
  const failed = await quietly(() => failing.gateway.run(failing.call));
  assert.deepEqual(failed.result, { ok: false, code: "AI_UNAVAILABLE", callId: failing.store.calls[0].id });
  assert.equal(failing.store.calls[0].status, "UPSTREAM_ERROR");
  for (const { warnings } of [touched, closed, failed]) assert.ok(!JSON.stringify(warnings).includes("detail"), "no database detail is logged");
});

test("E36 breaker updates are read then write: concurrent failures may lose an increment", async () => {
  const w = world({ steps: [{ fail: "HTTP_5XX" }] });
  await quietly(() => Promise.all([w.gateway.run(w.call), w.gateway.run(w.call)]));
  const failures = breakerOf(w.store)?.failures;
  assert.ok(failures === 1 || failures === 2, `failures: ${failures}`);
});

test("E45 mock registry at run level: unused in live mode, failures normalised and silent", async () => {
  let called = false;
  const live = world({ settings: { llmMode: "live", apiKey: "k" }, mockResponses: new Map([["DEV_STANDUP", () => { called = true; return "x"; }]]) });
  assert.equal((await live.gateway.run(live.call)).ok, true);
  assert.equal(called, false);

  const upstream = world({ provider: "mock", mockResponses: new Map([["DEV_STANDUP", () => { throw new UpstreamErrorFor5xx(); }]]) });
  await quietly(() => upstream.gateway.run(upstream.call));
  assert.equal(upstream.store.calls[0].status, "UPSTREAM_ERROR");

  const secret = world({ provider: "mock", mockResponses: new Map([["DEV_STANDUP", () => { throw new Error("secret"); }]]) });
  const { result, warnings } = await quietly(() => secret.gateway.run(secret.call));
  assert.equal(secret.store.calls[0].status, "UPSTREAM_ERROR");
  assert.equal(breakerOf(secret.store), undefined, "an internal error does not count towards the breaker");
  assert.ok(!JSON.stringify([result, warnings, secret.store.calls], (_, value) => (typeof value === "bigint" ? value.toString() : value)).includes("secret"));
});

test("E22 a throw after the row is written still finalises it and leaves only a fixed message", async () => {
  const w = world({ guards: { ...defaultGuards, output: () => { throw new Error("guard exploded with MKdetail"); } } });
  const { warnings } = await quietly(() => assert.rejects(w.gateway.run(w.call), (error: Error) => error.message === "LLM_CALL_FAILED" && error.cause === undefined));
  const row = w.store.calls[0];
  assert.equal(row.status, "UPSTREAM_ERROR");
  assert.equal(row.leaseExpiresAt, null);
  assert.deepEqual(warnings, [["llm_call_failed", { callId: row.id, status: "UPSTREAM_ERROR" }]]);
  assert.equal(breakerOf(w.store), undefined);
});

import { UpstreamError } from "../src/index.js";
class UpstreamErrorFor5xx extends UpstreamError { constructor() { super("HTTP_5XX", 503); } }
