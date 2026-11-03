import assert from "node:assert/strict";
import { test } from "node:test";
import {
  LlmCallSchema,
  LlmResultSchema,
  NotMember,
  SESSION_CAPS,
  type AiContext,
  type Core,
  type LlmGateway,
  type Sessions,
} from "../src/index.js";

const gatewayFixture: LlmGateway = {
  run: async (call) => ({
    ok: true,
    value: call.output.kind === "text" ? "ok" : {},
    callId: "00000000-0000-0000-0000-000000000001",
    flagged: false,
    truncated: false,
    cacheHit: false,
    promptTokens: 1,
    completionTokens: 1,
    costMicroUsd: 1,
  }),
};

const contextFixture: AiContext = {
  assemble: async () => [],
};

const sessionsFixture: Sessions = {
  open: async () => "00000000-0000-0000-0000-000000000002",
  assertUsable: async () => undefined,
  touch: async () => undefined,
  close: async () => undefined,
};

const coreFixture: Core = {
  requireMember: async () => undefined,
  assertWritable: async () => undefined,
  progress: async () => ({ pointsTotal: 0, pointsDone: 0, percent: 0, unestimatedTasks: 0 }),
  velocity: async () => [],
  applyPlan: async () => undefined,
  applyReplan: async () => undefined,
};

test("F8 frozen consumers compile against all four interfaces", () => {
  assert.ok(gatewayFixture && contextFixture && sessionsFixture && coreFixture);
});

test("frozen gateway call and result schemas reject malformed shapes", () => {
  const call = LlmCallSchema.parse({
    feature: "DEV_SUMMARY",
    caller: { userId: "00000000-0000-0000-0000-000000000003", role: "DEVELOPER" },
    sessionId: "00000000-0000-0000-0000-000000000004",
    projectId: null,
    sections: [],
    output: { kind: "text", maxChars: 100 },
    inputHash: "hash",
  });
  assert.equal(call.output.kind, "text");
  assert.equal(LlmResultSchema.safeParse({ ok: false, code: "AI_BUSY" }).success, true);
  assert.equal(LlmResultSchema.safeParse({ ok: false, code: "NOT_A_CODE" }).success, false);
});

test("NotMember is the frozen resource-scope failure", () => {
  const error = new NotMember();
  assert.equal(error.name, "NotMember");
  assert.equal(error instanceof Error, true);
});

test("frozen session caps are explicit", () => {
  assert.deepEqual(SESSION_CAPS, { maxRegenerations: 5, maxNewSessionsPerUserPerDay: 20, maxOpenSessionsPerFeature: 3 });
});
