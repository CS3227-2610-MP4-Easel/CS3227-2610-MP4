import assert from "node:assert/strict";
import { test } from "node:test";
import type { PrismaClient } from "@prisma/client";
import { createLlmGatewayRuntime } from "../src/runtime.js";

const CANONICAL_SOCLAAS = "https://soclaas-api.comp.nus.edu.sg/v1";
const dev = {
  APP_TIER: "dev", LLM_MODE: "live", SOCLAAS_API_KEY: "sk-test-key", SOCLAAS_BASE_URL: CANONICAL_SOCLAAS,
  DATABASE_URL: "postgresql://user:password@ep-fragrant-union-aod4nxjd-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb",
  NEON_HOST: "ep-fragrant-union-aod4nxjd-pooler.c-2.ap-southeast-1.aws.neon.tech", NEON_PROJECT: "falling-rice-06970921",
};
const prod = {
  APP_TIER: "prod", LLM_MODE: "live", SOCLAAS_API_KEY: "sk-test-key", SOCLAAS_BASE_URL: CANONICAL_SOCLAAS,
  DATABASE_URL: "postgresql://user:password@ep-summer-heart-b3767eul-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb",
  NEON_HOST: "ep-summer-heart-b3767eul-pooler.c-4.ap-southeast-1.aws.neon.tech", NEON_PROJECT: "super-sunset-36592949",
};
const fakeDb = {} as PrismaClient;
const hit = async () => ({ allowed: true, retryAfterSeconds: 0 });

test("E3/E4 valid dev and prod gateway runtimes construct after target validation", () => {
  let calls = 0;
  const createClient = () => { calls += 1; return fakeDb; };
  assert.doesNotThrow(() => createLlmGatewayRuntime(dev, { createClient, hit }));
  assert.doesNotThrow(() => createLlmGatewayRuntime(prod, { createClient, hit }));
  assert.equal(calls, 2);
});

test("E3/E4/E5/E14 invalid gateway targets fail before the client factory", () => {
  let calls = 0;
  const createClient = () => { calls += 1; return fakeDb; };
  for (const env of [
    { ...dev, DATABASE_URL: prod.DATABASE_URL },
    { ...prod, NEON_HOST: "wrong.neon.tech" },
    { ...dev, DATABASE_URL: "not-a-url" },
    { APP_TIER: "local", DATABASE_URL: prod.DATABASE_URL, LLM_MODE: "mock" },
  ]) {
    assert.throws(() => createLlmGatewayRuntime(env, { createClient, hit }), /DATABASE_URL|target|observations|malformed/);
  }
  assert.equal(calls, 0);
});

test("E12 local/test URL-only and complete observations pass, partial observations fail", () => {
  let calls = 0;
  const createClient = () => { calls += 1; return fakeDb; };
  assert.doesNotThrow(() => createLlmGatewayRuntime({ APP_TIER: "test", LLM_MODE: "mock", DATABASE_URL: "postgresql://localhost/agile_platform" }, { createClient, hit }));
  assert.doesNotThrow(() => createLlmGatewayRuntime({ APP_TIER: "test", LLM_MODE: "mock", DATABASE_URL: "postgresql://localhost/agile_platform", NEON_HOST: "localhost", NEON_PROJECT: "test" }, { createClient, hit }));
  assert.throws(() => createLlmGatewayRuntime({ APP_TIER: "test", LLM_MODE: "mock", DATABASE_URL: "postgresql://localhost/agile_platform", NEON_HOST: "localhost" }, { createClient, hit }), /observations/);
  assert.equal(calls, 2);
});

test("E6/E7 preview credentials are rejected before the gateway client factory", () => {
  let calls = 0;
  assert.throws(() => createLlmGatewayRuntime({ APP_TIER: "preview", LLM_MODE: "mock", DATABASE_URL: "postgresql://localhost/agile_platform" }, { createClient: () => { calls += 1; return fakeDb; }, hit }), /DATABASE_URL/);
  assert.equal(calls, 0);
});

test("E8 identity-only previews return AI_DISABLED without a database client", async () => {
  let calls = 0;
  const runtime = createLlmGatewayRuntime({ APP_TIER: "preview", LLM_MODE: "mock", VERCEL_PROJECT_ID: "prj_U7YYwCGOdx4pThKCPYdkXH1a9Smd", VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "feature/preview" }, { createClient: () => { calls += 1; return fakeDb; }, hit });
  assert.equal(calls, 0);
  assert.deepEqual(await runtime.gateway.run(undefined as never), { ok: false, code: "AI_DISABLED" });
  await assert.rejects(runtime.sessions.open(undefined as never), /AI_NOT_CONFIGURED/);
});
