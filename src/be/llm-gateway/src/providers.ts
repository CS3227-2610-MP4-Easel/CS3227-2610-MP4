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

/** OpenAI-compatible chat completions. The key stays inside this closure and goes only to `baseUrl`, which settings pin to SoCLaaS. */
export function createSoclaasProvider({ baseUrl, apiKey, fetch = globalThis.fetch }: { baseUrl: string; apiKey: string; fetch?: typeof globalThis.fetch }): LlmProvider {
  return {
    async complete({ model, messages, maxTokens, temperature, reasoningEffort, timeoutMs }) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
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
      } finally {
        clearTimeout(timer);
      }
      if (response.status === 429) throw new UpstreamError("HTTP_429", 429);
      if (!response.ok) throw new UpstreamError("HTTP_5XX", response.status);
      let body: { choices?: Array<{ message?: { content?: unknown } }>; usage?: { prompt_tokens?: unknown; completion_tokens?: unknown } };
      try { body = await response.json(); } catch { throw new UpstreamError("HTTP_5XX", response.status); }
      const text = body?.choices?.[0]?.message?.content;
      if (typeof text !== "string") throw new UpstreamError("HTTP_5XX", response.status);
      const count = (value: unknown) => (Number.isInteger(value) && (value as number) >= 0 ? (value as number) : null);
      return { text, promptTokens: count(body.usage?.prompt_tokens), completionTokens: count(body.usage?.completion_tokens) };
    },
  };
}
