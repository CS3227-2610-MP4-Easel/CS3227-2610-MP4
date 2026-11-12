import assert from "node:assert/strict";
import { test } from "node:test";
import { redactLogValue } from "../src/errors.js";

test("N4/E11 log redaction removes credentials and untrusted AI text", () => {
  const redacted = redactLogValue({ authorization: "Bearer secret", prompt: "do not store", response: "private", password: "secret" });
  assert.deepEqual(redacted, { authorization: "[REDACTED]", prompt: "[REDACTED]", response: "[REDACTED]", password: "[REDACTED]" });
});
