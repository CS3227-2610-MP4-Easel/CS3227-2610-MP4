import assert from "node:assert/strict";
import { test } from "node:test";
import { loadGatewaySettings } from "../src/index.js";

const KEY = "sk-marker-key-123";
const live = { APP_TIER: "dev", LLM_MODE: "live", SOCLAAS_API_KEY: KEY };
const rejects = (env: Record<string, string | undefined>, name: string) => {
  assert.throws(() => loadGatewaySettings(env), (error: Error) => {
    assert.equal(error.message, `Invalid setting ${name}`);
    for (const value of Object.values(env)) if (value && value.length > 4 && !["local", "dev", "preview", "prod", "test"].includes(value)) assert.ok(!error.message.includes(value));
    return true;
  });
};

test("E1 test and preview refuse live; prod refuses mock or unset", () => {
  rejects({ APP_TIER: "test", LLM_MODE: "live", SOCLAAS_API_KEY: KEY }, "LLM_MODE");
  rejects({ APP_TIER: "preview", LLM_MODE: "live" }, "LLM_MODE");
  rejects({ APP_TIER: "prod", LLM_MODE: "mock" }, "LLM_MODE");
  rejects({ APP_TIER: "prod" }, "LLM_MODE");
});

test("E2 unsafe or malformed settings name the setting, never the value", () => {
  rejects({ APP_TIER: "dev" }, "LLM_MODE");
  for (const mode of ["Live", "", " live"]) rejects({ APP_TIER: "local", LLM_MODE: mode }, "LLM_MODE");
  rejects({ APP_TIER: "dev", LLM_MODE: "live" }, "SOCLAAS_API_KEY");
  rejects({ ...live, SOCLAAS_API_KEY: "sk marker key" }, "SOCLAAS_API_KEY");
  for (const url of ["https://evil.example/v1", "http://soclaas-api.comp.nus.edu.sg/v1", "https://soclaas-api.comp.nus.edu.sg:8443/v1", "https://u:p@soclaas-api.comp.nus.edu.sg/v1", "https://soclaas-api.comp.nus.edu.sg/v1?x=1", "https://soclaas-api.comp.nus.edu.sg/v1#f", "https://soclaas-api.comp.nus.edu.sg/v1/"]) {
    rejects({ ...live, SOCLAAS_BASE_URL: url }, "SOCLAAS_BASE_URL");
  }
  for (const value of ["yes", "TRUE"]) rejects({ APP_TIER: "local", AI_ENABLED: value }, "AI_ENABLED");
  rejects({ APP_TIER: "local", LLM_MODEL_DEV_STANDUP: "gpt-marker-model" }, "LLM_MODEL_DEV_STANDUP");
});

test("E3 local with no gateway settings is mock, enabled, default models", () => {
  const settings = loadGatewaySettings({ APP_TIER: "local" });
  assert.equal(settings.tier, "local");
  assert.equal(settings.llmMode, "mock");
  assert.equal(settings.aiEnabled, true);
  assert.equal(settings.apiKey, null);
  assert.equal(settings.baseUrl, "https://soclaas-api.comp.nus.edu.sg/v1");
  assert.deepEqual(settings.modelOverrides, {});
});

test("E3 valid live and override settings load", () => {
  const settings = loadGatewaySettings({ ...live, AI_ENABLED: "false", SOCLAAS_BASE_URL: "https://soclaas-api.comp.nus.edu.sg/v1", LLM_MODEL_DEV_STANDUP: "qwen3.5:9b" });
  assert.equal(settings.llmMode, "live");
  assert.equal(settings.aiEnabled, false);
  assert.equal(settings.apiKey, KEY);
  assert.deepEqual(settings.modelOverrides, { DEV_STANDUP: "qwen3.5:9b" });
  assert.equal(loadGatewaySettings({ APP_TIER: "test", LLM_MODE: "mock", SOCLAAS_API_KEY: "has space ignored" }).apiKey, null);
});

test("E40 APP_TIER missing or unknown", () => {
  rejects({}, "APP_TIER");
  rejects({ APP_TIER: "staging" }, "APP_TIER");
});
