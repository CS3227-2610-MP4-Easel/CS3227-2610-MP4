import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ErrorEnvelopeSchema,
  PageQuerySchema,
  ProjectSchema,
  ProjectInputSchema,
  UserInputSchema,
} from "../src/index.js";

test("E1 rejects unknown request keys", () => {
  const result = UserInputSchema.safeParse({ displayName: "Lee", role: "DEVELOPER", extra: true });
  assert.equal(result.success, false);
});

test("E2 rejects server-managed fields instead of stripping them", () => {
  const result = ProjectInputSchema.safeParse({ name: "Project", id: "client-controlled" });
  assert.equal(result.success, false);
});

test("N2 enforces pagination bounds", () => {
  assert.equal(PageQuerySchema.safeParse({ page: 0, size: 100 }).success, true);
  assert.equal(PageQuerySchema.safeParse({ page: 0, size: 101 }).success, false);
  assert.equal(ProjectSchema.safeParse({ id: "not-a-uuid" }).success, false);
  assert.equal(UserInputSchema.safeParse({ displayName: "Lee", role: "ADMIN" }).success, false);
});

test("error envelope preserves stable error codes and request id", () => {
  const parsed = ErrorEnvelopeSchema.parse({
    error: {
      code: "VALIDATION_FAILED",
      message: "The request body is not valid.",
      details: [{ field: "name", message: "Required" }],
      requestId: "00000000-0000-0000-0000-000000000000",
    },
  });
  assert.equal(parsed.error.code, "VALIDATION_FAILED");
});
