import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { resetContextRegistries } from "@agile/ai-context/testing";
import type { FilteredDbClient } from "@agile/db";
import { registerOnce } from "../src/runtime.js";
import { registerSimilarItems } from "../src/similar-items.js";

afterEach(() => resetContextRegistries());

test("two failed builds followed by a good one register the source once, never SOURCE_ALREADY_REGISTERED", () => {
  resetContextRegistries();
  const state = { done: false };
  const db = {} as unknown as FilteredDbClient;
  let attempts = 0;
  const build = (fail: boolean) => {
    attempts += 1;
    // Everything else is built first and may throw; registration only happens at the end.
    if (fail) throw new Error("build failed");
    registerOnce(() => registerSimilarItems({ db, settings: { similarItems: true } }), state);
  };
  assert.throws(() => build(true), /build failed/);
  assert.throws(() => build(true), /build failed/);
  assert.doesNotThrow(() => build(false));
  assert.equal(state.done, true);
  assert.doesNotThrow(() => registerOnce(() => assert.fail("must not register twice"), state));
  assert.equal(attempts, 3);
});

test("a registration that throws leaves the flag unset so it can be retried", () => {
  const state = { done: false };
  assert.throws(() => registerOnce(() => { throw new Error("nope"); }, state), /nope/);
  assert.equal(state.done, false);
});
