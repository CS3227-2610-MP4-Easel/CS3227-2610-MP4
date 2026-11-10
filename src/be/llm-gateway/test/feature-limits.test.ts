import assert from "node:assert/strict";
import { test } from "node:test";
import { createLlmGateway, FEATURES, LIMITS } from "../src/index.js";
import { fakeClock, fakeGatewayDb, fakeHit, fakeProvider, fakeSessions, testSettings, textCall, type Step } from "./fakes.js";

function world(feature: keyof typeof FEATURES, steps: Step[]) {
  const clock = fakeClock();
  const store = fakeGatewayDb();
  const call = textCall({ feature, caller: { ...textCall().caller, role: FEATURES[feature].role } });
  store.sessions.set(call.sessionId, { projectId: call.projectId });
  const { sessions } = fakeSessions(new Map([[call.sessionId, { userId: call.caller.userId, feature }]]));
  const fake = fakeProvider(clock, steps);
  const gateway = createLlmGateway({ settings: testSettings(), db: store.db, hit: fakeHit().hit, sessions, provider: fake.provider, clock, mockResponses: new Map([[feature, () => "ok"]]), boundary: () => "0123456789abcdef" });
  return { clock, store, call, gateway, requests: fake.requests };
}

test("W7c E8 other features keep their timeout, deadline, lease and tokens", async () => {
  for (const feature of Object.keys(FEATURES) as (keyof typeof FEATURES)[]) {
    if (feature === "PM_PLAN_EXPAND") continue;
    const w = world(feature, [{ fail: "HTTP_5XX", after: 1_000 }, { text: "ok", during: async () => {
      assert.equal((w.store.calls[0].leaseExpiresAt as Date).getTime() - (w.store.calls[0].createdAt as Date).getTime(), 60_000);
    } }]);
    assert.equal((await w.gateway.run(w.call)).ok, true);
    assert.deepEqual(w.requests.map((r) => r.timeoutMs), [20_000, 24_000]);
    assert.equal(w.requests[0].maxTokens, FEATURES[feature].maxTokens);
    assert.equal(FEATURES[feature].attemptTimeoutMs ?? LIMITS.attemptTimeoutMs, 20_000);
    assert.equal(FEATURES[feature].deadlineMs ?? LIMITS.deadlineMs, 25_000);
  }
});

test("W7c E9 expand uses its timeout, deadline and lease across success and retries", async () => {
  const success = world("PM_PLAN_EXPAND", [{ text: "ok", after: 50_000, during: async () => {
    assert.equal((success.store.calls[0].leaseExpiresAt as Date).getTime() - (success.store.calls[0].createdAt as Date).getTime(), 75_000);
  } }]);
  assert.equal((await success.gateway.run(success.call)).ok, true);
  assert.deepEqual(success.requests.map((r) => [r.timeoutMs, r.maxTokens]), [[54_000, 4_200]]);
  const timeout = world("PM_PLAN_EXPAND", [{ hang: true }]);
  const result = await timeout.gateway.run(timeout.call);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "AI_UNAVAILABLE");
  assert.deepEqual(timeout.requests.map((r) => r.timeoutMs), [54_000]);
  for (const [kind, after, remaining] of [["HTTP_5XX", 10_000, 44_000], ["HTTP_429", 1_000, 51_000]] as const) {
    const w = world("PM_PLAN_EXPAND", [{ fail: kind, after }, { text: "ok" }]);
    assert.equal((await w.gateway.run(w.call)).ok, true);
    assert.deepEqual(w.requests.map((r) => r.timeoutMs), [54_000, remaining]);
  }
});

test("W7c E9 N2 expand limits cover twice the observed bulk call", () => {
  const feature = FEATURES.PM_PLAN_EXPAND;
  assert.ok((feature.attemptTimeoutMs ?? 0) >= 2 * 26_850);
  assert.ok((feature.deadlineMs ?? 0) >= 2 * 26_850);
  assert.ok(feature.maxTokens >= 2 * 2_086);
  assert.equal(feature.maxPromptTokens, 7_000);
});
