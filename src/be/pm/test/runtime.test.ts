import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { resetContextRegistries } from "@agile/ai-context/testing";
import type { FilteredDbClient } from "@agile/db";
import { ensureSimilarItemsRegistered, getPmRuntime, resetPmRuntimeForTests } from "../src/runtime.js";
import { registerSimilarItems } from "../src/similar-items.js";

afterEach(() => { resetContextRegistries(); resetPmRuntimeForTests(); });

test("two failed builds followed by a good one register the source once, never SOURCE_ALREADY_REGISTERED", () => {
  resetContextRegistries();
  resetPmRuntimeForTests();
  const db = {} as unknown as FilteredDbClient;
  let attempts = 0;
  const build = (fail: boolean) => {
    attempts += 1;
    // Everything else is built first and may throw; registration only happens at the end.
    if (fail) throw new Error("build failed");
    ensureSimilarItemsRegistered(() => registerSimilarItems({ db, settings: { similarItems: true } }));
  };
  assert.throws(() => build(true), /build failed/);
  assert.throws(() => build(true), /build failed/);
  assert.doesNotThrow(() => build(false));
  assert.doesNotThrow(() => ensureSimilarItemsRegistered(() => assert.fail("must not register twice")));
  assert.equal(attempts, 3);
});

test("a registration that throws leaves the flag unset so it can be retried", () => {
  resetPmRuntimeForTests();
  assert.throws(() => ensureSimilarItemsRegistered(() => { throw new Error("nope"); }), /nope/);
  let called = false;
  ensureSimilarItemsRegistered(() => { called = true; });
  assert.equal(called, true);
});

test("a failed build followed by a retry creates the database client once", () => {
  resetPmRuntimeForTests();
  let created = 0;
  const deps = {
    createDbClient: () => { created += 1; return {} as unknown as FilteredDbClient; },
    gatewayParts: (() => { throw new Error("gateway failed"); }) as never,
  };
  assert.throws(() => getPmRuntime(deps), /gateway failed/);
  assert.throws(() => getPmRuntime(deps), /gateway failed/);
  assert.equal(created, 1);
});
