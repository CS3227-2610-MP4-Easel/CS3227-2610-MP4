import assert from "node:assert/strict";
import { test } from "node:test";
import { assertSameProject, assertWritableState } from "../src/transactions.js";

test("E6/E9 cross-project child identifiers are rejected", () => {
  assert.throws(() => assertSameProject("project-a", "project-b"), /NOT_FOUND/);
});

test("E7 archived projects are read-only", () => {
  assert.throws(() => assertWritableState("ARCHIVED"), /CONFLICT_STATE/);
  assert.doesNotThrow(() => assertWritableState("ACTIVE"));
});
