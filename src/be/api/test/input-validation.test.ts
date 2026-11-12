import assert from "node:assert/strict";
import { test } from "node:test";
import { parseJsonBody, parseInput } from "../src/errors.js";
import { ProjectInputSchema } from "@agile/contracts";

test("E3/N2 malformed JSON and content type map to BAD_REQUEST", async () => {
  await assert.rejects(() => parseJsonBody(new Request("http://localhost", { body: "{", method: "POST", headers: { "content-type": "text/plain" } })), (error: { code?: string; status?: number }) => error.code === "BAD_REQUEST" && error.status === 400);
  await assert.rejects(() => parseJsonBody(new Request("http://localhost", { body: "{", method: "POST", headers: { "content-type": "application/json" } })), (error: { code?: string; status?: number }) => error.code === "BAD_REQUEST" && error.status === 400);
});

test("strict body parsing opts into lead media and JSON status mappings", async () => {
  await assert.rejects(() => parseJsonBody(new Request("http://localhost", { body: "{}", method: "POST", headers: { "content-type": "text/plain" } }), { strict: true }), (error: { code?: string; status?: number }) => error.code === "BAD_REQUEST" && error.status === 415);
  await assert.rejects(() => parseJsonBody(new Request("http://localhost", { body: "{", method: "POST", headers: { "content-type": "application/json" } }), { strict: true }), (error: { code?: string; status?: number }) => error.code === "BAD_REQUEST" && error.status === 422);
});

test("E1/E2/N2 strict schema errors map to VALIDATION_FAILED", () => {
  assert.throws(() => parseInput(ProjectInputSchema, { name: "ok", id: "server" }), (error: { code?: string }) => error.code === "VALIDATION_FAILED");
});
