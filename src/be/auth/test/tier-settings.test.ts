import assert from "node:assert/strict";
import { test } from "node:test";
import { createAuthRuntime, loadAuthSettings, validateTierResources } from "../src/index.js";

const base = {
  APP_TIER: "dev",
  FIREBASE_PROJECT_ID: "agile-platform-dev",
  VERCEL_PROJECT_ID: "prj_U7YYwCGOdx4pThKCPYdkXH1a9Smd",
  VERCEL_ENV: "preview",
  VERCEL_GIT_COMMIT_REF: "development",
  NEON_HOST: "dev.neon.tech",
  NEON_PROJECT: "agile-platform-dev",
  SOCLAAS_BASE_URL: "https://dev.soclaas.example",
};

test("E3 matching tier resources are accepted", () => {
  assert.doesNotThrow(() => validateTierResources(base));
});

test("E3 cross-tier resource identity fails closed", () => {
  assert.throws(() => validateTierResources({ ...base, FIREBASE_PROJECT_ID: "agile-platform-prod" }), /FIREBASE_PROJECT_ID/);
  assert.throws(() => validateTierResources({ ...base, VERCEL_GIT_COMMIT_REF: "feature/wrong-tier" }), /VERCEL_GIT_COMMIT_REF/);
});

test("E1 preview runtime does not require or construct a database client", () => {
  const runtime = createAuthRuntime({ APP_TIER: "preview" });
  assert.equal(runtime.settings.firebaseProjectId, null);
  assert.rejects(runtime.resolvePrincipal("Bearer token"), /AUTH_NOT_CONFIGURED/);
});

test("E32 emulator mode remains rejected on local", () => {
  assert.throws(() => loadAuthSettings({ APP_TIER: "local", FIREBASE_AUTH_EMULATOR_HOST: "localhost:9099" }), /FIREBASE_AUTH_EMULATOR_HOST/);
});
