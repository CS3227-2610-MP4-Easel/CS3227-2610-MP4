import assert from "node:assert/strict";
import { test } from "node:test";
import { forecast, projectCompletion } from "../src/forecast.js";

test("zero or unavailable velocity has no projected completion date", () => {
  assert.equal(projectCompletion("2026-11-09", 10, 0, 14), null);
  assert.equal(projectCompletion("2026-11-09", 10, null, 14), null);
  assert.equal(projectCompletion("2026-11-09", 10, 2, null), null);
  assert.deepEqual(forecast("2026-11-09", "2026-12-01", 10, null, 14), { projectedDate: null, risk: "UNKNOWN" });
});

test("zero remaining work stays on track without velocity", () => {
  assert.deepEqual(forecast("2026-11-09", "2026-12-01", 0, null, null), { projectedDate: null, risk: "ON_TRACK" });
});
