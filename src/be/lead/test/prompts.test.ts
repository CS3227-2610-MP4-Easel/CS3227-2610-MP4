import assert from "node:assert/strict";
import { test } from "node:test";
import { LEAD_STATIC_SECTIONS } from "../src/sections.js";
import { DigestOutputSchema } from "../src/schemas.js";
test("lead prompt sections are trusted literals and output is closed", () => {
  assert.ok(LEAD_STATIC_SECTIONS.every((section) => section.kind === "STATIC" && section.trusted));
  assert.equal(DigestOutputSchema.safeParse({ explanation: "ok", suggestions: [] }).success, true);
  assert.equal(DigestOutputSchema.safeParse({ explanation: "ok", suggestions: [{ type: "NOPE" }] }).success, false);
  for (const text of ["https://example.test", "<b>bad</b>", "[bad](https://example.test)"]) {
    assert.equal(DigestOutputSchema.safeParse({ explanation: text, suggestions: [] }).success, false, text);
    assert.equal(DigestOutputSchema.safeParse({ explanation: "ok", suggestions: [{ id: "00000000-0000-4000-8000-000000000001", type: "REASSIGN_TASK", taskId: "00000000-0000-4000-8000-000000000002", assigneeId: "00000000-0000-4000-8000-000000000003", rationale: text }] }).success, false, text);
  }
});
