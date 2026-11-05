import assert from "node:assert/strict";
import { test } from "node:test";

test("E46 live SoCLaaS fetch is blocked in tests", async () => {
  await assert.rejects(fetch("https://soclaas-api.comp.nus.edu.sg/v1/models"), { message: "LIVE_SOCLAAS_IN_TESTS" });
  assert.equal(process.env.LLM_MODE, "mock");
});
