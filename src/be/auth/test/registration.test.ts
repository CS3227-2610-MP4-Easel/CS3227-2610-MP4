import assert from "node:assert/strict";
import crypto from "node:crypto";
import { mock, test } from "node:test";
import { checkRegistrationCode } from "../src/index.js";

const codes = { PM: "pm-code-123456789", DEV_LEAD: "lead-code-12345678", DEVELOPER: "dev-code-123456789" };

test("E30 both values hashed, timingSafeEqual once", () => {
  for (const code of ["x", "y".repeat(128), ""]) {
    const spy = mock.method(crypto, "timingSafeEqual");
    try {
      assert.equal(checkRegistrationCode(codes, "PM", code), false);
      assert.equal(spy.mock.callCount(), 1);
      const [a, b] = spy.mock.calls[0].arguments as unknown as [Buffer, Buffer];
      const sha = (v: string) => crypto.createHash("sha256").update(v, "utf8").digest();
      assert.ok(a.equals(sha(code)) && b.equals(sha(codes.PM)), "compares the full digests of both values");
    } finally { spy.mock.restore(); }
  }
  assert.equal(checkRegistrationCode(codes, "PM", codes.PM), true);
  assert.equal(checkRegistrationCode(codes, "PM", codes.DEVELOPER), false);
});
