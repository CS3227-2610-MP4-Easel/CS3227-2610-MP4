import assert from "node:assert/strict";
import { test } from "node:test";
import type { LlmCall } from "@agile/contracts";
import { createMockProvider, createSoclaasProvider, estimateTokens, hasMockResponse, mockRegistry, registerMockResponse, UpstreamError, type MockRespond, type ProviderRequest } from "../src/index.js";

const KEY = "sk-marker-key-123";
const BASE = "https://soclaas-api.comp.nus.edu.sg/v1";
const call = { feature: "DEV_STANDUP", caller: { userId: "00000000-0000-4000-8000-000000000001", role: "DEVELOPER" }, sessionId: "00000000-0000-4000-8000-000000000002", projectId: null, sections: [], output: { kind: "text", maxChars: 500 }, inputHash: "h" } as LlmCall;
const request = (overrides: Partial<ProviderRequest> = {}): ProviderRequest => ({
  model: "llama3.1:8b",
  messages: [{ role: "system", content: "## rules\nBe brief." }, { role: "user", content: "## items\nDid things." }],
  maxTokens: 800,
  temperature: 0.2,
  timeoutMs: 1_000,
  call,
  ...overrides,
});

type Seen = { url: string; init: RequestInit };
const fakeFetch = (respond: (seen: Seen) => Promise<Response>) => {
  const seen: Seen[] = [];
  const fetch = (async (url: string, init: RequestInit) => { seen.push({ url, init }); return respond({ url, init }); }) as unknown as typeof globalThis.fetch;
  return { fetch, seen };
};
const ok = (body: unknown) => async () => Response.json(body);
const kindOf = async (promise: Promise<unknown>) => {
  try { await promise; } catch (error) {
    assert.ok(error instanceof UpstreamError);
    assert.equal(error.cause, undefined, "UpstreamError never carries a cause");
    assert.ok(!error.message.includes(KEY));
    return { kind: error.kind, status: error.status, message: error.message };
  }
  assert.fail("expected an UpstreamError");
};

test("E39 SoCLaaS request shape: key, redirect refused, reasoning effort only when given", async () => {
  const { fetch, seen } = fakeFetch(ok({ choices: [{ message: { content: "hello" } }], usage: { prompt_tokens: 12, completion_tokens: 3, total_tokens: 15 } }));
  const provider = createSoclaasProvider({ baseUrl: BASE, apiKey: KEY, fetch });
  assert.deepEqual(await provider.complete(request()), { text: "hello", promptTokens: 12, completionTokens: 3 });
  await provider.complete(request({ model: "qwen3.5:9b", reasoningEffort: "none" }));
  assert.equal(seen[0].url, `${BASE}/chat/completions`);
  assert.equal(seen[0].init.method, "POST");
  assert.equal(seen[0].init.redirect, "error");
  assert.equal(new Headers(seen[0].init.headers).get("authorization"), `Bearer ${KEY}`);
  const first = JSON.parse(String(seen[0].init.body));
  assert.deepEqual(first, { model: "llama3.1:8b", messages: request().messages, max_tokens: 800, temperature: 0.2 });
  assert.equal("reasoning_effort" in first, false);
  assert.equal(JSON.parse(String(seen[1].init.body)).reasoning_effort, "none");
});

test("E39 SoCLaaS failures map to UpstreamError kinds without provider detail", async () => {
  const marker = "MARKERbody7";
  const cases: Array<[() => Promise<Response>, string, number | null]> = [
    [async () => new Response(marker, { status: 401 }), "HTTP_5XX", 401],
    [async () => new Response(marker, { status: 503 }), "HTTP_5XX", 503],
    [async () => new Response(marker, { status: 429 }), "HTTP_429", 429],
    [async () => Response.json({ choices: [{ message: { content: 5 } }] }), "HTTP_5XX", 200],
    [async () => new Response("not json", { status: 200 }), "HTTP_5XX", 200],
    [async () => { throw new TypeError(`fetch failed ${marker}`); }, "NETWORK", null],
    [async () => { throw new TypeError("redirect mode is set to error"); }, "NETWORK", null],
  ];
  for (const [respond, kind, status] of cases) {
    const provider = createSoclaasProvider({ baseUrl: BASE, apiKey: KEY, fetch: fakeFetch(respond).fetch });
    const error = await kindOf(provider.complete(request()));
    assert.deepEqual(error, { kind, status, message: `UPSTREAM_${kind}` });
  }
});

test("E39 SoCLaaS abort at timeoutMs is TIMEOUT; missing usage gives null tokens", async () => {
  const hanging = fakeFetch(({ init }) => new Promise((_, reject) => init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")))));
  const slow = createSoclaasProvider({ baseUrl: BASE, apiKey: KEY, fetch: hanging.fetch });
  assert.equal((await kindOf(slow.complete(request({ timeoutMs: 5 })))).kind, "TIMEOUT");
  const noUsage = createSoclaasProvider({ baseUrl: BASE, apiKey: KEY, fetch: fakeFetch(ok({ choices: [{ message: { content: "x" } }], usage: { prompt_tokens: 1.5 } })).fetch });
  assert.deepEqual(await noUsage.complete(request()), { text: "x", promptTokens: null, completionTokens: null });
});

test("E45 mock registry: registered text, token estimates, failures normalised", async () => {
  const registry = new Map<string, MockRespond>();
  const provider = createMockProvider(registry);
  registry.set("DEV_STANDUP", () => "Yesterday: 😀 shipped");
  const result = await provider.complete(request());
  assert.equal(result.text, "Yesterday: 😀 shipped");
  assert.equal(result.promptTokens, estimateTokens(request().messages[0].content, "llama3.1:8b") + estimateTokens(request().messages[1].content, "llama3.1:8b"));
  assert.equal(result.completionTokens, estimateTokens("Yesterday: 😀 shipped", "llama3.1:8b"));
  assert.deepEqual(await provider.complete(request()), result, "deterministic");

  registry.set("DEV_STANDUP", () => { throw new UpstreamError("HTTP_5XX", 503); });
  assert.equal((await kindOf(provider.complete(request()))).kind, "HTTP_5XX");

  registry.set("DEV_STANDUP", () => { throw new Error("secret"); });
  await assert.rejects(provider.complete(request()), (error: Error) => error.message === "MOCK_RESPONSE_FAILED" && error.cause === undefined);

  registry.delete("DEV_STANDUP");
  await assert.rejects(provider.complete(request()), { message: "NO_MOCK_RESPONSE" });
});

test("E45 registerMockResponse writes the process-wide registry", () => {
  assert.equal(hasMockResponse("LEAD_DIGEST"), false);
  registerMockResponse("LEAD_DIGEST", () => "{}");
  assert.equal(hasMockResponse("LEAD_DIGEST"), true);
  assert.equal(mockRegistry.get("LEAD_DIGEST")?.(call), "{}");
  mockRegistry.delete("LEAD_DIGEST");
});
