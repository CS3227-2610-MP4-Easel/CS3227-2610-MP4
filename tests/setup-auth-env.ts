// Fake auth settings for the test process, set only where unset, so modules that load `apiApp` can start.
// Settings tests pass their own env maps and never read these.
const defaults: Record<string, string> = {
  APP_TIER: "test",
  DATABASE_URL: "postgresql://localhost/agile_platform",
  FIREBASE_PROJECT_ID: "w4-test",
  REGISTRATION_CODE_PM: "test-pm-code-000",
  REGISTRATION_CODE_DEV_LEAD: "test-lead-code-000",
  REGISTRATION_CODE_DEVELOPER: "test-dev-code-000",
  RATE_KEY_SECRET: "test-rate-key-secret-0000000000000",
  // The process-wide LLM gateway in tests is always the mock (AD-26).
  LLM_MODE: "mock",
};
for (const [name, value] of Object.entries(defaults)) process.env[name] ??= value;

// CI never calls the live service: any request to SoCLaaS from a test process fails (AD-26, W2 E46).
const realFetch = globalThis.fetch;
globalThis.fetch = (input, init) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (new URL(url).hostname === "soclaas-api.comp.nus.edu.sg") return Promise.reject(new Error("LIVE_SOCLAAS_IN_TESTS"));
  return realFetch(input, init);
};
