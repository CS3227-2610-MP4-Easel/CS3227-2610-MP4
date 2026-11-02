import assert from "node:assert/strict";
import { test } from "node:test";
import { createApiApp } from "../src/app.js";

test("F7/E13 health is public, database-free, and returns a server request id", async () => {
  const response = await createApiApp().request("http://localhost/api/health", { headers: { "X-Request-Id": "spoofed" } });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "UP" });
  assert.match(response.headers.get("content-type") ?? "", /application\/json/);
  assert.match(response.headers.get("x-request-id") ?? "", /^[0-9a-f-]{36}$/);
  assert.notEqual(response.headers.get("x-request-id"), "spoofed");
});
