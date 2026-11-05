import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mock, test } from "node:test";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod/v3";
import type { LlmCall } from "@agile/contracts";
import { createDbClient, inMutationTransaction } from "@agile/db";
import { createLlmGateway, createMockProvider, createSessions, createSoclaasProvider, defaultGuards, SOCLAAS_BASE_URL, type GuardPipeline, type LlmProvider, type MockRespond } from "../src/index.js";
import { fakeClock, fakeHit, fakeProvider, integrationUrl, testSettings, withIntegrationDb, type Fixtures } from "./fakes.js";

const skip = !integrationUrl;
const MIN = 60_000;

/** A real gateway over Postgres with its own breaker and budget rows, a fake clock and an allow-all limiter. */
async function setup(base: PrismaClient, { user, project }: Fixtures, options: { provider?: (clock: ReturnType<typeof fakeClock>) => LlmProvider; settings?: Parameters<typeof testSettings>[0]; guards?: GuardPipeline; mockResponses?: Map<string, MockRespond> } = {}) {
  const clock = fakeClock();
  const settings = testSettings(options.settings);
  const sessions = createSessions({ db: base, settings, clock });
  const userId = await user();
  const projectId = await project(userId);
  const sessionId = await sessions.open({ feature: "DEV_STANDUP", userId, projectId });
  const mockResponses = options.mockResponses ?? new Map<string, MockRespond>([["DEV_STANDUP", () => "Yesterday: fixed login."]]);
  const stateKeyPrefix = `test-${randomUUID()}-`;
  const gateway = createLlmGateway({
    settings, db: base, hit: fakeHit().hit, sessions, clock, stateKeyPrefix, guards: options.guards, mockResponses,
    provider: options.provider?.(clock) ?? createMockProvider(mockResponses),
  });
  const call = (overrides: Partial<LlmCall> = {}): LlmCall => ({
    feature: "DEV_STANDUP", caller: { userId, role: "DEVELOPER" }, sessionId, projectId,
    sections: [
      { name: "rules", kind: "STATIC", priority: 0, budgetTokens: 200, text: "Write a standup.", trusted: true },
      { name: "items", kind: "DYNAMIC", priority: 1, budgetTokens: 400, text: "Fixed the login bug.", trusted: false },
    ],
    output: { kind: "text", maxChars: 500 }, inputHash: "hash-1", ...overrides,
  });
  const cleanup = () => base.llmGatewayState.deleteMany({ where: { key: { startsWith: stateKeyPrefix } } });
  return { clock, gateway, call, userId, projectId, sessionId, cleanup };
}

test("E5 run refuses inside a transaction and runs normally after it", { skip }, () => withIntegrationDb(async (base, fixtures) => {
  const s = await setup(base, fixtures);
  try {
    const fakeTx = { $transaction: async <R>(callback: (tx: unknown) => Promise<R>) => callback({}) };
    await assert.rejects(inMutationTransaction(fakeTx, async () => {}, async () => {}, () => s.gateway.run(s.call())), { message: "LLM_CALL_IN_TRANSACTION" });
    await assert.rejects(createDbClient(base).$transaction(() => s.gateway.run(s.call())), { message: "LLM_CALL_IN_TRANSACTION" });
    assert.equal(await base.llmCall.count({ where: { userId: s.userId } }), 0);
    assert.equal((await s.gateway.run(s.call())).ok, true);
  } finally { await s.cleanup(); }
}));

test("E13 run with a missing or another user's session is NOT_FOUND with no row", { skip }, () => withIntegrationDb(async (base, fixtures) => {
  const s = await setup(base, fixtures);
  try {
    await assert.rejects(s.gateway.run(s.call({ sessionId: randomUUID() })), { message: "NOT_FOUND" });
    const other = await fixtures.user();
    await assert.rejects(s.gateway.run(s.call({ caller: { userId: other, role: "DEVELOPER" } })), { message: "NOT_FOUND" });
    assert.equal(await base.llmCall.count({ where: { userId: s.userId } }), 0);
  } finally { await s.cleanup(); }
}));

test("E22 expired leases are finalised TIMEOUT by the next run; a swept call returns AI_UNAVAILABLE", { skip }, () => withIntegrationDb(async (base, fixtures) => {
  let sweep = async () => {};
  const s = await setup(base, fixtures, { provider: (clock) => fakeProvider(clock, [{ text: "ok" }, { text: "ok", during: () => sweep() }]).provider });
  try {
    const stale = await base.llmCall.create({ data: {
      userId: s.userId, role: "DEVELOPER", env: "test", feature: "DEV_STANDUP", model: "llama3.1:8b", promptVersion: "000000000000", status: "IN_FLIGHT",
      leaseExpiresAt: new Date(s.clock.now().getTime() - 1), createdAt: new Date(s.clock.now().getTime() - MIN), attempts: 0, estimatedPromptTokens: 0, sectionTokens: {},
      prefixHash: "p", inputHash: "i", flagged: false, truncated: false, costMicrousd: 104n, experiment: {},
    } });
    assert.equal((await s.gateway.run(s.call())).ok, true);
    const swept = await base.llmCall.findUniqueOrThrow({ where: { id: stale.id } });
    assert.equal(swept.status, "TIMEOUT");
    assert.equal(swept.costMicrousd, 104n, "the reservation stays counted");
    assert.equal(await base.llmGatewayState.count({ where: { key: { contains: "breaker" }, value: { path: ["failures"], gt: 0 } } }), 0, "a sweep does not touch the breaker");

    sweep = async () => { await base.llmCall.updateMany({ where: { userId: s.userId, status: "IN_FLIGHT" }, data: { status: "TIMEOUT", leaseExpiresAt: null } }); };
    const result = await s.gateway.run(s.call());
    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.code, "AI_UNAVAILABLE");
    assert.equal((await base.llmCall.findUniqueOrThrow({ where: { id: result.callId as string } })).status, "TIMEOUT");
  } finally { await s.cleanup(); }
}));

test("E31 a successful call's row and session; a failed call leaves the session's activity", { skip }, () => withIntegrationDb(async (base, fixtures) => {
  const s = await setup(base, fixtures);
  try {
    s.clock.advance(5 * MIN);
    const first = await s.gateway.run(s.call());
    const second = await s.gateway.run(s.call());
    assert.ok(first.ok && second.ok);
    assert.deepEqual([first.value, first.promptTokens, first.completionTokens], [second.value, second.promptTokens, second.completionTokens], "mock is deterministic");
    const row = await base.llmCall.findUniqueOrThrow({ where: { id: first.callId } });
    assert.equal(row.status, "OK");
    assert.equal(row.leaseExpiresAt, null);
    assert.equal(row.promptVersion, row.prefixHash.slice(0, 12));
    assert.deepEqual(row.experiment, { resultCache: false, llmMode: "mock" });
    assert.deepEqual(row.createdAt, s.clock.now());
    const session = await base.aiSession.findUniqueOrThrow({ where: { id: s.sessionId } });
    assert.deepEqual(session.lastActivityAt, s.clock.now());

    const failing = await setup(base, fixtures, { provider: (clock) => fakeProvider(clock, [{ fail: "HTTP_5XX" }]).provider });
    try {
      const before = (await base.aiSession.findUniqueOrThrow({ where: { id: failing.sessionId } })).lastActivityAt;
      failing.clock.advance(5 * MIN);
      const warn = mock.method(console, "warn", () => {});
      try { assert.equal((await failing.gateway.run(failing.call())).ok, false); } finally { warn.mock.restore(); }
      assert.deepEqual((await base.aiSession.findUniqueOrThrow({ where: { id: failing.sessionId } })).lastActivityAt, before);
    } finally { await failing.cleanup(); }
  } finally { await s.cleanup(); }
}));

test("E25 marker text, key, provider bodies and rejected values never reach rows, logs, errors or results", { skip }, () => withIntegrationDb(async (base, fixtures) => {
  const MARK = "MKw2Leak9";
  const KEY = `sk-${MARK}-key`;
  const logged: string[] = [];
  const spies = (["log", "info", "warn", "error", "debug"] as const).map((name) => mock.method(console, name, (...args: unknown[]) => { logged.push(JSON.stringify(args)); }));
  const outcomes: unknown[] = [];
  const userIds: string[] = [];
  const record = async (run: () => Promise<unknown>) => {
    try { outcomes.push(await run()); } catch (error) { outcomes.push((error as Error).message, (error as Error).stack); }
  };
  const marked = (call: LlmCall): LlmCall => ({ ...call, sections: call.sections.map((section) => ({ ...section, text: `${section.text} ${MARK}` })), inputHash: "hash-1" });
  /** SoCLaaS with the marker key, answering with `respond`; `redirect` and headers are exercised for real. */
  const soclaas = (respond: () => Response) => () => createSoclaasProvider({ baseUrl: SOCLAAS_BASE_URL, apiKey: KEY, fetch: (async () => respond()) as unknown as typeof fetch });
  const live = { llmMode: "live" as const, apiKey: KEY };
  const scenarios: Array<[Parameters<typeof setup>[2], (call: LlmCall) => LlmCall]> = [
    [{ settings: live, provider: soclaas(() => Response.json({ choices: [{ message: { content: "fine" } }], usage: { prompt_tokens: 10, completion_tokens: 2 } })) }, (c) => c],
    [{ settings: live, provider: soclaas(() => Response.json({ choices: [{ message: { content: JSON.stringify({ today: MARK }) } }] })) }, (c) => ({ ...c, output: { kind: "json", schema: z.object({ yesterday: z.string() }).strict() } })],
    [{ settings: live, provider: soclaas(() => new Response(`upstream says ${MARK} ${KEY}`, { status: 503 })) }, (c) => c],
    [{ settings: live, provider: soclaas(() => new Response(`slow down ${MARK}`, { status: 429 })) }, (c) => c],
    [{ provider: (clock) => fakeProvider(clock, [{ hang: true }]).provider }, (c) => c],
    [{ guards: { ...defaultGuards, input: () => ({ blocked: true }) } }, (c) => c],
    [{ guards: { ...defaultGuards, output: () => ({ ok: false, status: "REFUSED" }) } }, (c) => c],
    [{ settings: { aiEnabled: false } }, (c) => c],
    [{}, (c) => ({ ...c, caller: { ...c.caller, role: "PM" } })],
    [{}, (c) => ({ ...c, sessionId: randomUUID() })],
    // Section names are fixed by feature code and appear in STATIC_SECTION_OVER_BUDGET by design; only text is untrusted.
    [{}, (c) => ({ ...c, sections: [{ name: "rules", kind: "STATIC", priority: 0, budgetTokens: 1, text: MARK, trusted: true }] })],
    [{ mockResponses: new Map([["DEV_STANDUP", () => { throw new Error(MARK); }]]) }, (c) => c],
  ];
  const cleanups: Array<() => Promise<unknown>> = [];
  try {
    for (const [options, shape] of scenarios) {
      const s = await setup(base, fixtures, options);
      cleanups.push(s.cleanup);
      userIds.push(s.userId);
      await record(() => s.gateway.run(marked(shape(s.call()))));
    }
  } finally {
    for (const spy of spies) spy.mock.restore();
    for (const cleanup of cleanups) await cleanup();
  }
  const rows = await base.llmCall.findMany({ where: { userId: { in: userIds } } });
  const sessions = await base.aiSession.findMany({ where: { userId: { in: userIds } } });
  const statuses = new Set(rows.map((row) => row.status));
  for (const status of ["OK", "SCHEMA_FAIL", "UPSTREAM_ERROR", "RATE_LIMITED", "TIMEOUT", "BLOCKED_INPUT", "REFUSED"]) assert.ok(statuses.has(status as never), `covered ${status}`);
  for (const [where, value] of Object.entries({ rows, sessions, logged, outcomes })) {
    const text = JSON.stringify(value, (_, item) => (typeof item === "bigint" ? item.toString() : item));
    const at = text.indexOf(MARK);
    assert.equal(at, -1, `marker leaked into ${where}: ${text.slice(Math.max(0, at - 80), at + 20)}`);
  }
}));
