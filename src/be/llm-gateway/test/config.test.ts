import assert from "node:assert/strict";
import { test } from "node:test";
import { costMicroUsd, FEATURES, MODELS, reservation } from "../src/index.js";

test("every feature's default model fits its prompt and output budget", () => {
  for (const [feature, config] of Object.entries(FEATURES)) {
    const model = MODELS[config.model];
    assert.ok(model, `${feature} default model has a capability record`);
    assert.ok(config.maxPromptTokens + config.maxTokens <= model.contextTokens, feature);
  }
});

test("E32 cost and reservation", () => {
  assert.equal(costMicroUsd("llama3.1:8b", 1000, 333), 30);
  assert.equal(reservation("DEV_STANDUP", "llama3.1:8b"), 104);
  // An unknown model is priced at the highest listed rate, so the estimate is never low.
  assert.equal(costMicroUsd("unknown-model", 1_000_000, 1_000_000), 260_000 + 900_000);
  assert.equal(costMicroUsd("llama3.1:8b", 0, 0), 0);
});
