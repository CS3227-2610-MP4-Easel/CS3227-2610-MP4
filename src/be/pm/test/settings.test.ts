import assert from "node:assert/strict";
import { test } from "node:test";
import { loadPmSettings } from "../src/settings.js";

test("settings default to on", () => {
  assert.deepEqual(loadPmSettings({}), { similarItems: true });
});

test("settings accept on and off", () => {
  assert.deepEqual(loadPmSettings({ PM_SIMILAR_ITEMS: "on" }), { similarItems: true });
  assert.deepEqual(loadPmSettings({ PM_SIMILAR_ITEMS: "off" }), { similarItems: false });
});

test("E18 PM_SIMILAR_ITEMS=maybe throws INVALID_SETTING without the value", () => {
  for (const bad of ["maybe", "ON", "", "secret-value"]) {
    assert.throws(
      () => loadPmSettings({ PM_SIMILAR_ITEMS: bad }),
      (error: unknown) => error instanceof Error && error.message === "INVALID_SETTING:PM_SIMILAR_ITEMS" && !error.message.includes(bad || "\u0000"),
    );
  }
});
