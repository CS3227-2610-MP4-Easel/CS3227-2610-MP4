import assert from "node:assert/strict";
import { test } from "node:test";
import { createApiApp } from "../src/app.js";

test("F6 route registration exposes only the W1 health handler", async () => {
  const response = await createApiApp().request("http://localhost/api/not-w1");
  assert.equal(response.status, 404);
});
