// Fake auth settings for the test process, set only where unset, so modules that load `apiApp` can start.
// Settings tests pass their own env maps and never read these.
const defaults: Record<string, string> = {
  APP_TIER: "test",
  FIREBASE_PROJECT_ID: "w4-test",
  REGISTRATION_CODE_PM: "test-pm-code-000",
  REGISTRATION_CODE_DEV_LEAD: "test-lead-code-000",
  REGISTRATION_CODE_DEVELOPER: "test-dev-code-000",
  RATE_KEY_SECRET: "test-rate-key-secret-0000000000000",
};
for (const [name, value] of Object.entries(defaults)) process.env[name] ??= value;
