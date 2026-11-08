import assert from "node:assert/strict";
import { test } from "node:test";
import { loadAuthSettings, type AppTier } from "../src/index.js";

const PM = "pm-code-0123456789";
const LEAD = "lead-code-0123456789";
const DEV = "dev-code-0123456789";
const SECRET = "s".repeat(32);
const valid = (tier: AppTier = "test"): Record<string, string | undefined> => ({
  APP_TIER: tier, FIREBASE_PROJECT_ID: tier === "dev" ? "agile-platform-dev" : tier === "prod" ? "agile-platform-prod" : "w4-test", REGISTRATION_CODE_PM: PM, REGISTRATION_CODE_DEV_LEAD: LEAD, REGISTRATION_CODE_DEVELOPER: DEV, RATE_KEY_SECRET: SECRET,
  ...(tier === "dev" ? { VERCEL_PROJECT_ID: "prj_U7YYwCGOdx4pThKCPYdkXH1a9Smd", VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "development", NEON_HOST: "ep-fragrant-union-aod4nxjd-pooler.c-2.ap-southeast-1.aws.neon.tech", NEON_PROJECT: "super-sunset-36592949", SOCLAAS_BASE_URL: "https://soclaas-api.comp.nus.edu.sg/v1" } : {}),
  ...(tier === "prod" ? { VERCEL_PROJECT_ID: "prj_U7YYwCGOdx4pThKCPYdkXH1a9Smd", VERCEL_ENV: "production", VERCEL_GIT_COMMIT_REF: "main", NEON_HOST: "ep-summer-heart-b3767eul-pooler.c-4.ap-southeast-1.aws.neon.tech", NEON_PROJECT: "super-sunset-36592949", SOCLAAS_BASE_URL: "https://soclaas-api.comp.nus.edu.sg/v1" } : {}),
});
const fails = (env: Record<string, string | undefined>, name: string, value?: string) => {
  assert.throws(() => loadAuthSettings(env), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.match(error.message, new RegExp(name));
    if (value) assert.ok(!error.message.includes(value), "error must not include the value");
    return true;
  });
};

test("E24 missing tier", () => fails({ ...valid(), APP_TIER: undefined }, "APP_TIER"));
test("E24 unknown tier", () => fails({ ...valid(), APP_TIER: "staging-secret-tier" }, "APP_TIER", "staging-secret-tier"));
test("E24 emulator variable on each tier", () => {
  for (const tier of ["local", "dev", "prod", "test"] as const) fails({ ...valid(tier), FIREBASE_AUTH_EMULATOR_HOST: "localhost:9099" }, "FIREBASE_AUTH_EMULATOR_HOST", "localhost:9099");
  fails({ APP_TIER: "preview", FIREBASE_AUTH_EMULATOR_HOST: "localhost:9099" }, "FIREBASE_AUTH_EMULATOR_HOST", "localhost:9099");
});
test("E24 missing Firebase project id", () => fails({ ...valid(), FIREBASE_PROJECT_ID: undefined }, "FIREBASE_PROJECT_ID"));
test("E24 12-character code", () => fails({ ...valid(), REGISTRATION_CODE_PM: "a".repeat(12) }, "REGISTRATION_CODE_PM", "a".repeat(12)));
test("E24 129-character code", () => fails({ ...valid(), REGISTRATION_CODE_DEV_LEAD: "b".repeat(129) }, "REGISTRATION_CODE_DEV_LEAD", "b".repeat(129)));
test("E24 duplicate codes", () => fails({ ...valid(), REGISTRATION_CODE_DEVELOPER: PM }, "REGISTRATION_CODE_DEVELOPER", PM));
test("E24 demo code on prod", () => fails({ ...valid("prod"), REGISTRATION_CODE_PM: "PROJ_MANAGER_DEMO" }, "REGISTRATION_CODE_PM", "PROJ_MANAGER_DEMO"));
test("E24 31-character secret", () => fails({ ...valid(), RATE_KEY_SECRET: "t".repeat(31) }, "RATE_KEY_SECRET", "t".repeat(31)));
test("E24 13 and 128 character codes and a 32-character secret pass", () => {
  const settings = loadAuthSettings({ ...valid(), REGISTRATION_CODE_PM: "c".repeat(13), REGISTRATION_CODE_DEV_LEAD: "d".repeat(128) });
  assert.deepEqual(settings, { tier: "test", firebaseProjectId: "w4-test", registrationCodes: { PM: "c".repeat(13), DEV_LEAD: "d".repeat(128), DEVELOPER: DEV }, rateKeySecret: SECRET });
});
test("E24 demo codes pass on dev", () => {
  const settings = loadAuthSettings({ ...valid("dev"), REGISTRATION_CODE_PM: "PROJ_MANAGER_DEMO", REGISTRATION_CODE_DEV_LEAD: "DEV_LEAD_DEMO", REGISTRATION_CODE_DEVELOPER: "DEVELOPER_DEMO" });
  assert.equal(settings.registrationCodes?.PM, "PROJ_MANAGER_DEMO");
});
test("E50 preview without data settings loads with nulls", () => {
  assert.deepEqual(loadAuthSettings({ APP_TIER: "preview" }), { tier: "preview", firebaseProjectId: null, registrationCodes: null, rateKeySecret: null });
});
test("E50 preview with data settings is rejected by the shared policy", () => fails({ APP_TIER: "preview", FIREBASE_PROJECT_ID: "w4-test" }, "FIREBASE_PROJECT_ID"));
test("E10/E19/E20 production startup requires complete production identity", () => {
  assert.doesNotThrow(() => loadAuthSettings(valid("prod")));
  fails({ ...valid("prod"), VERCEL_ENV: "preview" }, "VERCEL_ENV", "preview");
  fails({ ...valid("prod"), VERCEL_GIT_COMMIT_REF: "development" }, "VERCEL_GIT_COMMIT_REF", "development");
  fails({ ...valid("prod"), NEON_PROJECT: undefined }, "NEON_PROJECT");
});
