import type { LlmCall } from "@agile/contracts";

export type InputGuardResult = { text: string; flagged: boolean } | { blocked: true };
export type OutputGuardResult = { ok: true; value: unknown } | { ok: false; status: "SCHEMA_FAIL" | "REFUSED" };

/** The slot W3 fills with sanitising, flagging and output rules (spec SD1). */
export type GuardPipeline = {
  input(text: string): InputGuardResult;
  output(text: string, output: LlmCall["output"]): OutputGuardResult;
};

type SafeParser = { safeParse(value: unknown): { success: true; data: unknown } | { success: false } };

/** W2's defaults: input passes unchanged; output is parsed and schema-checked, and the parser's error is discarded (N1). */
export const defaultGuards: GuardPipeline = {
  input: (text) => ({ text, flagged: false }),
  output(text, output) {
    if (output.kind === "text") {
      const length = [...text].length;
      return length === 0 || length > output.maxChars ? { ok: false, status: "SCHEMA_FAIL" } : { ok: true, value: text };
    }
    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch { return { ok: false, status: "SCHEMA_FAIL" }; }
    const result = (output.schema as SafeParser).safeParse(parsed);
    return result.success ? { ok: true, value: result.data } : { ok: false, status: "SCHEMA_FAIL" };
  },
};
