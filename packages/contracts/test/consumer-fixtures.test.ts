import assert from "node:assert/strict";
import { test } from "node:test";
import type { AiContext, Core, LlmGateway, Sessions } from "../src/index.js";

const consumers: { W2: LlmGateway; W4: Sessions; W5: Core; W6: AiContext } = {
  W2: { run: async () => ({ ok: false, code: "AI_BUSY" }) },
  W4: { open: async () => "00000000-0000-0000-0000-000000000001", assertUsable: async () => undefined, touch: async () => undefined, close: async () => undefined },
  W5: { requireMember: async () => undefined, assertWritable: async () => undefined, progress: async () => ({ pointsTotal: 0, pointsDone: 0, percent: 0, unestimatedTasks: 0 }), velocity: async () => [], applyPlan: async () => undefined, applyReplan: async () => undefined },
  W6: { assemble: async () => [] },
};

test("F8/E12 later workstreams consume only frozen public interfaces", () => {
  assert.deepEqual(Object.keys(consumers).sort(), ["W2", "W4", "W5", "W6"]);
});
