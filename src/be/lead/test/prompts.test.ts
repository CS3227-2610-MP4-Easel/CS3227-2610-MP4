import assert from "node:assert/strict";
import { test } from "node:test";
import { LEAD_STATIC_SECTIONS } from "../src/sections.js";
import { DigestOutputSchema } from "../src/schemas.js";
test("lead prompt sections are trusted literals and output is closed", () => {
  assert.ok(LEAD_STATIC_SECTIONS.every((section) => section.kind === "STATIC" && section.trusted));
  assert.equal(DigestOutputSchema.safeParse({ explanation: "ok", suggestions: [] }).success, true);
  assert.equal(DigestOutputSchema.safeParse({ explanation: "ok", suggestions: [{ type: "NOPE" }] }).success, false);
});
