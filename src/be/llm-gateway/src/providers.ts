import type { Feature, LlmCall } from "@agile/contracts";
import { estimateTokens } from "./budget.js";

export type ChatMessage = { role: "system" | "user"; content: string };
/** `call` is passed to the mock only; the SoCLaaS provider ignores it. */
export type ProviderRequest = { model: string; messages: ChatMessage[]; maxTokens: number; temperature: number; reasoningEffort?: string; timeoutMs: number; call: LlmCall };
export type ProviderResult = { text: string; promptTokens: number | null; completionTokens: number | null };
export type LlmProvider = { complete(request: ProviderRequest): Promise<ProviderResult> };

export type UpstreamKind = "HTTP_429" | "HTTP_5XX" | "NETWORK" | "TIMEOUT";

/** Carries only the kind and status, never a cause, URL, header or body, so nothing from the provider reaches a log (N1). */
export class UpstreamError extends Error {
  constructor(public readonly kind: UpstreamKind, public readonly status: number | null = null) {
    super(`UPSTREAM_${kind}`);
    this.name = "UpstreamError";
  }
}

export type MockRespond = (call: LlmCall) => string;

/** Process-wide mock responses; feature modules register theirs at import (spec SD2). Never read in live mode. */
export const mockRegistry = new Map<string, MockRespond>();

export function registerMockResponse(feature: Feature, respond: MockRespond): void {
  mockRegistry.set(feature, respond);
}

export function hasMockResponse(feature: Feature, registry: ReadonlyMap<string, MockRespond> = mockRegistry): boolean {
  return registry.has(feature);
}

/** Deterministic: returns the registered text with token counts estimated as for a live call. */
export function createMockProvider(registry: ReadonlyMap<string, MockRespond> = mockRegistry): LlmProvider {
  return {
    async complete({ model, messages, call }) {
      const respond = registry.get(call.feature);
      if (!respond) throw new Error("NO_MOCK_RESPONSE");
      let text: string;
      try {
        text = respond(call);
      } catch (error) {
        if (error instanceof UpstreamError) throw error;
        // The original error may quote prompt text, so it is dropped.
        throw new Error("MOCK_RESPONSE_FAILED");
      }
      const promptTokens = messages.reduce((sum, message) => sum + estimateTokens(message.content, model), 0);
      return { text, promptTokens, completionTokens: estimateTokens(text, model) };
    },
  };
}

/** No reply the gateway asks for comes near this; a bigger body is treated as a provider fault. */
const MAX_RESPONSE_BYTES = 1_000_000;
/** Above any real count; larger values would overflow the int columns, so they are treated as missing. */
const MAX_TOKEN_COUNT = 10_000_000;
const tokenCount = (value: unknown) => (Number.isInteger(value) && (value as number) >= 0 && (value as number) <= MAX_TOKEN_COUNT ? (value as number) : null);

/** Reads the body as text, stopping with an error once it passes `limit` bytes. */
async function readCapped(response: Response, limit: number): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) { reader.cancel().catch(() => {}); throw new Error("RESPONSE_TOO_LARGE"); }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

/** OpenAI-compatible chat completions. The key stays inside this closure and goes only to `baseUrl`, which settings pin to SoCLaaS. */
export function createSoclaasProvider({ baseUrl, apiKey, fetch = globalThis.fetch }: { baseUrl: string; apiKey: string; fetch?: typeof globalThis.fetch }): LlmProvider {
  return {
    async complete({ model, messages, maxTokens, temperature, reasoningEffort, timeoutMs }) {
      const controller = new AbortController();
      // The deadline covers the whole exchange, body included, so a slow-drip response cannot hold the call open.
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        let response: Response;
        try {
          response = await fetch(`${baseUrl}/chat/completions`, {
            method: "POST",
            headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
            body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature, ...(reasoningEffort === undefined ? {} : { reasoning_effort: reasoningEffort }) }),
            // A redirect would forward the Bearer header to another host (SD14).
            redirect: "error",
            signal: controller.signal,
          });
        } catch {
          throw new UpstreamError(controller.signal.aborted ? "TIMEOUT" : "NETWORK");
        }
        if (response.status === 429) throw new UpstreamError("HTTP_429", 429);
        if (!response.ok) throw new UpstreamError("HTTP_5XX", response.status);
        let body: { choices?: Array<{ message?: { content?: unknown } }>; usage?: { prompt_tokens?: unknown; completion_tokens?: unknown } };
        try {
          body = JSON.parse(await readCapped(response, MAX_RESPONSE_BYTES));
        } catch {
          throw new UpstreamError(controller.signal.aborted ? "TIMEOUT" : "HTTP_5XX", controller.signal.aborted ? null : response.status);
        }
        const text = body?.choices?.[0]?.message?.content;
        if (typeof text !== "string") throw new UpstreamError("HTTP_5XX", response.status);
        return { text, promptTokens: tokenCount(body.usage?.prompt_tokens), completionTokens: tokenCount(body.usage?.completion_tokens) };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
