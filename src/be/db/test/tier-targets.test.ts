import assert from "node:assert/strict";
import { test } from "node:test";
import { getTierTarget, parseDatabaseTarget, validateDatabaseTarget, validatePreviewEnvironment } from "../src/tier-targets.js";

const CANONICAL_SOCLAAS = "https://soclaas-api.comp.nus.edu.sg/v1";
const PREVIEW_FORBIDDEN_NAMES = [
  "DATABASE_URL", "DIRECT_DATABASE_URL", "FIREBASE_PROJECT_ID",
  "REGISTRATION_CODE_PM", "REGISTRATION_CODE_DEV_LEAD", "REGISTRATION_CODE_DEVELOPER",
  "RATE_KEY_SECRET", "NEON_HOST", "NEON_PROJECT", "SOCLAAS_BASE_URL",
  "SOCLAAS_API_KEY", "VERCEL_TOKEN", "VERCEL_TEAM_ID",
] as const;

test("E1/E2 canonical dev and prod targets use the confirmed values", () => {
  const dev = getTierTarget("dev");
  const prod = getTierTarget("prod");
  assert.equal(dev.soclaasBaseUrl, CANONICAL_SOCLAAS);
  assert.equal(prod.soclaasBaseUrl, CANONICAL_SOCLAAS);
  assert.equal(prod.firebaseProjectId, "agile-platform-prod");
  assert.equal(prod.neonProject, "super-sunset-36592949");
  assert.equal(prod.neonHost, "ep-summer-heart-b3767eul-pooler.c-4.ap-southeast-1.aws.neon.tech");
  assert.equal(prod.databaseName, "neondb");
});

test("E6/E7/E11 preview rejects every forbidden name, including empty values", () => {
  for (const name of PREVIEW_FORBIDDEN_NAMES) {
    for (const value of ["", " ", "redacted"]) {
      assert.throws(() => validatePreviewEnvironment({ APP_TIER: "preview", [name]: value }), new RegExp(name));
    }
  }
});

test("E8 preview accepts only non-protected identity fields", () => {
  assert.doesNotThrow(() => validatePreviewEnvironment({
    APP_TIER: "preview",
    VERCEL_PROJECT_ID: "prj_U7YYwCGOdx4pThKCPYdkXH1a9Smd",
    VERCEL_ENV: "preview",
    VERCEL_GIT_COMMIT_REF: "feature/example",
  }));
  for (const ref of ["development", "main"]) {
    assert.throws(() => validatePreviewEnvironment({ APP_TIER: "preview", VERCEL_GIT_COMMIT_REF: ref }), /protected|VERCEL_GIT_COMMIT_REF/);
  }
});

test("E5 malformed and cross-tier database targets fail without echoing the URL", () => {
  const dev = {
    APP_TIER: "dev",
    DATABASE_URL: "postgresql://user:password@ep-fragrant-union-aod4nxjd-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb",
    NEON_HOST: "ep-fragrant-union-aod4nxjd-pooler.c-2.ap-southeast-1.aws.neon.tech",
    NEON_PROJECT: "super-sunset-36592949",
  };
  assert.deepEqual(parseDatabaseTarget(dev.DATABASE_URL), {
    protocol: "postgresql:",
    host: dev.NEON_HOST,
    databaseName: "neondb",
  });
  assert.doesNotThrow(() => validateDatabaseTarget(dev, "dev"));
  const wrong = "postgresql://user:password@ep-summer-heart-b3767eul-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb";
  assert.throws(() => validateDatabaseTarget({ ...dev, DATABASE_URL: wrong }, "dev"), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.match(error.message, /target/);
    assert.equal(error.message.includes(wrong), false);
    return true;
  });
  assert.throws(() => parseDatabaseTarget("not-a-url"), /malformed/);
});

test("W13 recovery seed accepts only the explicitly approved isolated branch", () => {
  const rehearsal = {
    APP_TIER: "dev",
    W13_RECOVERY_REHEARSAL: "1",
    NEON_BRANCH: "w13-recovery-rehearsal",
    DATABASE_URL: "postgresql://user:password@ep-w13-recovery-123456-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb",
    NEON_HOST: "ep-w13-recovery-123456-pooler.c-2.ap-southeast-1.aws.neon.tech",
    NEON_PROJECT: "super-sunset-36592949",
  };
  assert.doesNotThrow(() => validateDatabaseTarget(rehearsal, "dev"));
  assert.throws(() => validateDatabaseTarget({ ...rehearsal, W13_RECOVERY_REHEARSAL: undefined }, "dev"), /target|rehearsal/i);
  assert.throws(() => validateDatabaseTarget({ ...rehearsal, NEON_BRANCH: "development" }, "dev"), /target|rehearsal/i);
  assert.throws(() => validateDatabaseTarget({ ...rehearsal, DATABASE_URL: "postgresql://user:password@ep-summer-heart-b3767eul-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb", NEON_HOST: "ep-summer-heart-b3767eul-pooler.c-4.ap-southeast-1.aws.neon.tech" }, "dev"), /target|observations/i);
});
