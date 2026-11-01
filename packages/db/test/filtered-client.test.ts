import assert from "node:assert/strict";
import { test } from "node:test";
import { applyDefaultReadFilter, canUseMaintenanceCapability } from "../src/client.js";

test("F5/E10 request-facing reads exclude deleted and archived rows", () => {
  assert.deepEqual(applyDefaultReadFilter("Task", { where: { status: "TODO" } }), { where: { status: "TODO", deletedAt: null, project: { status: "ACTIVE" } } });
});

test("E19 request-facing client has no maintenance opt-out", () => {
  assert.equal(canUseMaintenanceCapability(), false);
});
