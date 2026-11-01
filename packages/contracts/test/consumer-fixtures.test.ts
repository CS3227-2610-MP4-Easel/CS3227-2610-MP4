import assert from "node:assert/strict";
import { test } from "node:test";
import type { AiContext, Core, LlmGateway, Sessions } from "../src/index.js";

const consumers: Record<string, unknown> = {
  W2: {} as LlmGateway,
  W4: {} as Sessions,
  W5: {} as Core,
  W6: {} as AiContext,
};

test("F8/E12 later workstreams consume only frozen public interfaces", () => {
  assert.deepEqual(Object.keys(consumers).sort(), ["W2", "W4", "W5", "W6"]);
});
