import assert from "node:assert/strict";
import { test } from "node:test";
import type { PrismaClient } from "@prisma/client";
import { createAuthRuntime, loadAuthSettings, validateTierResources } from "../src/index.js";

const base = {
  APP_TIER: "dev",
  FIREBASE_PROJECT_ID: "agile-platform-dev",
  VERCEL_PROJECT_ID: "prj_U7YYwCGOdx4pThKCPYdkXH1a9Smd",
  VERCEL_ENV: "preview",
  VERCEL_GIT_COMMIT_REF: "development",
  NEON_HOST: "ep-fragrant-union-aod4nxjd-pooler.c-2.ap-southeast-1.aws.neon.tech",
  NEON_PROJECT: "falling-rice-06970921",
  SOCLAAS_BASE_URL: "https://soclaas-api.comp.nus.edu.sg/v1",
  REGISTRATION_CODE_PM: "pm-code-0123456789",
  REGISTRATION_CODE_DEV_LEAD: "lead-code-0123456789",
  REGISTRATION_CODE_DEVELOPER: "dev-code-0123456789",
  RATE_KEY_SECRET: "s".repeat(32),
};

test("E3 matching tier resources are accepted", () => {
  assert.doesNotThrow(() => validateTierResources(base));
});

test("E3 cross-tier resource identity fails closed", () => {
  assert.throws(() => validateTierResources({ ...base, FIREBASE_PROJECT_ID: "agile-platform-prod" }), /FIREBASE_PROJECT_ID/);
  assert.throws(() => validateTierResources({ ...base, VERCEL_GIT_COMMIT_REF: "feature/wrong-tier" }), /VERCEL_GIT_COMMIT_REF/);
});

test("E10/E11 production maps to Vercel production, not preview", () => {
  const production = { ...base, APP_TIER: "prod", FIREBASE_PROJECT_ID: "agile-platform-prod", VERCEL_ENV: "production", VERCEL_GIT_COMMIT_REF: "main", NEON_HOST: "ep-summer-heart-b3767eul-pooler.c-4.ap-southeast-1.aws.neon.tech", NEON_PROJECT: "super-sunset-36592949", SOCLAAS_BASE_URL: "https://soclaas-api.comp.nus.edu.sg/v1" };
  assert.doesNotThrow(() => validateTierResources(production));
  assert.throws(() => validateTierResources({ ...production, VERCEL_ENV: "preview" }), /VERCEL_ENV/);
});

test("E1 preview runtime does not require or construct a database client", () => {
  const runtime = createAuthRuntime({ APP_TIER: "preview" });
  assert.equal(runtime.settings.firebaseProjectId, null);
  assert.rejects(runtime.resolvePrincipal("Bearer token"), /AUTH_NOT_CONFIGURED/);
});

test("E3 preview accepts the actual pull-request branch ref but not protected tiers", () => {
  const preview = {
    APP_TIER: "preview",
    VERCEL_PROJECT_ID: "prj_U7YYwCGOdx4pThKCPYdkXH1a9Smd",
    VERCEL_ENV: "preview",
    VERCEL_GIT_COMMIT_REF: "w13-deployment",
  };
  assert.doesNotThrow(() => validateTierResources(preview));
  assert.throws(() => validateTierResources({ ...preview, VERCEL_GIT_COMMIT_REF: "development" }), /VERCEL_GIT_COMMIT_REF/);
  assert.throws(() => validateTierResources({ ...preview, VERCEL_GIT_COMMIT_REF: "main" }), /VERCEL_GIT_COMMIT_REF/);
});

test("E32 emulator mode remains rejected on local", () => {
  assert.throws(() => loadAuthSettings({ APP_TIER: "local", FIREBASE_AUTH_EMULATOR_HOST: "localhost:9099" }), /FIREBASE_AUTH_EMULATOR_HOST/);
});

const fakeBase = { $extends: () => fakeBase } as unknown as PrismaClient;
const fakeVerifier = { verify: async () => ({ uid: "uid", email: null }) };
const devDatabaseUrl = "postgresql://user:password@ep-fragrant-union-aod4nxjd-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb";
const prodDatabaseUrl = "postgresql://user:password@ep-summer-heart-b3767eul-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb";

test("E3/E4 valid dev and prod auth runtimes construct only after target validation", () => {
  assert.doesNotThrow(() => createAuthRuntime({ ...base, DATABASE_URL: devDatabaseUrl }, { base: fakeBase, verifier: fakeVerifier }));
  assert.doesNotThrow(() => createAuthRuntime({ ...base, APP_TIER: "prod", FIREBASE_PROJECT_ID: "agile-platform-prod", VERCEL_ENV: "production", VERCEL_GIT_COMMIT_REF: "main", NEON_HOST: "ep-summer-heart-b3767eul-pooler.c-4.ap-southeast-1.aws.neon.tech", NEON_PROJECT: "super-sunset-36592949", SOCLAAS_BASE_URL: "https://soclaas-api.comp.nus.edu.sg/v1", DATABASE_URL: prodDatabaseUrl }, { base: fakeBase, verifier: fakeVerifier }));
});

test("E3/E4/E5/E14 auth rejects cross-tier, malformed, missing, and local/test production URLs before the client is used", () => {
  const invalid = [
    { ...base, DATABASE_URL: prodDatabaseUrl },
    { ...base, DATABASE_URL: "not-a-url" },
    { ...base, DATABASE_URL: undefined },
    { APP_TIER: "local", FIREBASE_PROJECT_ID: "agile-platform-local", REGISTRATION_CODE_PM: "pm-code-0123456789", REGISTRATION_CODE_DEV_LEAD: "lead-code-0123456789", REGISTRATION_CODE_DEVELOPER: "dev-code-0123456789", RATE_KEY_SECRET: "s".repeat(32), DATABASE_URL: prodDatabaseUrl },
  ];
  for (const env of invalid) {
    assert.throws(() => createAuthRuntime(env, { base: fakeBase, verifier: fakeVerifier }), (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /DATABASE_URL|target|malformed/);
      assert.equal(error.message.includes(prodDatabaseUrl), false);
      return true;
    });
  }
});

test("E12 local/test accept exact URL-only or complete matching observations, but reject partial observations", () => {
  const auth = { FIREBASE_PROJECT_ID: "w4-test", REGISTRATION_CODE_PM: "pm-code-0123456789", REGISTRATION_CODE_DEV_LEAD: "lead-code-0123456789", REGISTRATION_CODE_DEVELOPER: "dev-code-0123456789", RATE_KEY_SECRET: "s".repeat(32) };
  assert.doesNotThrow(() => createAuthRuntime({ APP_TIER: "local", ...auth, DATABASE_URL: "postgresql://localhost/agile_platform" }, { base: fakeBase, verifier: fakeVerifier }));
  assert.doesNotThrow(() => createAuthRuntime({ APP_TIER: "test", ...auth, DATABASE_URL: "postgresql://localhost/agile_platform" }, { base: fakeBase, verifier: fakeVerifier }));
  const testResources = { ...auth, FIREBASE_PROJECT_ID: "agile-platform-test", VERCEL_PROJECT_ID: "prj_U7YYwCGOdx4pThKCPYdkXH1a9Smd", VERCEL_ENV: "test", VERCEL_GIT_COMMIT_REF: "test", NEON_HOST: "localhost", NEON_PROJECT: "test", SOCLAAS_BASE_URL: "mock://soclaas" };
  assert.doesNotThrow(() => createAuthRuntime({ APP_TIER: "test", ...testResources, DATABASE_URL: "postgresql://localhost/agile_platform" }, { base: fakeBase, verifier: fakeVerifier }));
  assert.throws(() => createAuthRuntime({ APP_TIER: "test", ...testResources, DATABASE_URL: "postgresql://localhost/agile_platform", NEON_HOST: undefined }, { base: fakeBase, verifier: fakeVerifier }), /observations|NEON_HOST/);
});
