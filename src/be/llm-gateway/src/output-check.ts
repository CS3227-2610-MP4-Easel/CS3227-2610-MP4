import type { LlmCall } from "@agile/contracts";
import type { Rule } from "./sanitise.js";

export type OutputReason = "REFUSAL" | "PARSE" | "SHAPE" | "FORBIDDEN_CHAR" | "LINK" | "HTML" | "MARKDOWN_LINK" | "BOUNDARY" | "SECRET" | "LENGTH" | "SCHEMA";
/** What `run` passes the output guard: the call's boundary and the secrets that must never be echoed (spec SD8). */
export type OutputContext = { boundary: string; secrets: readonly string[] };
export type CheckedOutput = { ok: true; value: unknown } | { ok: false; status: "SCHEMA_FAIL" | "REFUSED"; reason: OutputReason };
type OutputRule = Rule & { step: "5a" | "5b" | "6" | "7" | "9" };
type SafeParser = { safeParse(value: unknown): { success: true; data: unknown } | { success: false } };

export const OUTPUT_LIMITS = { maxDepth: 64, maxStrings: 10_000, minSecretLength: 8 } as const;

/** Spec api.md § Output checks: 5a runs on a copy without tabs and line breaks, 5b on the string as it is. */
export const OUTPUT_RULES: readonly OutputRule[] = [
  { id: "L1", step: "5a", source: String.raw`[a-z][a-z0-9+.\-]{1,15}://`, flags: "iu" },
  { id: "L2", step: "5a", source: String.raw`(?:^|[^:\w])//[\p{L}\p{N}]`, flags: "iu" },
  { id: "L3", step: "5a", source: String.raw`\bwww\.`, flags: "iu" },
  { id: "L4", step: "5a", source: String.raw`\b(?:javascript|vbscript):`, flags: "iu" },
  { id: "L5", step: "5b", source: String.raw`\b(?:mailto|data|file|tel|sms|ftp|blob|intent):(?=\S)`, flags: "iu" },
  { id: "L6", step: "5b", source: String.raw`\b\d{1,3}(?:\.\d{1,3}){3}\b`, flags: "iu" },
  { id: "H1", step: "6", source: String.raw`<\/?(?:a|img|script|iframe|svg|style|link|object|embed|form|input|button|meta|base|video|audio|source|frame|math|body|html|div|span|table|details)(?=[\s/>])`, flags: "iu" },
  { id: "H2", step: "6", source: String.raw`<\/[a-z]`, flags: "iu" },
  { id: "H3", step: "6", source: String.raw`<[!?]`, flags: "iu" },
  { id: "H4", step: "6", source: String.raw`&(?:#\d{1,7}|#x[0-9a-f]{1,6}|[a-z]{2,8});`, flags: "iu" },
  { id: "M1", step: "7", source: String.raw`\]\(`, flags: "iu" },
  { id: "M2", step: "7", source: String.raw`\]\[`, flags: "iu" },
  { id: "M3", step: "7", source: String.raw`!\[`, flags: "iu" },
  { id: "S1", step: "9", source: String.raw`(?<![\w\-])sk-[A-Za-z0-9_\-]{16,}`, flags: "u" },
];

/** As the input set, but CR, U+FE0F and a ZWJ between two pictographs (emoji sequences) are allowed (spec SD13). */
export const OUTPUT_INVISIBLE_SOURCE = String.raw`(?![\n\t\r])[\p{Cc}\p{Co}\p{Cs}\u{FE00}-\u{FE0E}\u{E0100}-\u{E01EF}\u{115F}\u{1160}\u{3164}\u{FFA0}]|(?!\u{200D})\p{Cf}|(?<!\p{Extended_Pictographic}\u{FE0F}?)\u{200D}|\u{200D}(?!\p{Extended_Pictographic})`;

export const OUTPUT_STEPS = ["refusal", "parse", "collect", "nfkc", "forbidden-chars", "links-stripped", "links-as-is", "html", "markdown", "boundary", "secret", "joined:links-stripped+html+markdown+boundary+secret", "length", "schema", "check-schema-result"] as const;

const forbidden = new RegExp(OUTPUT_INVISIBLE_SOURCE, "u");
const rulesFor = (step: OutputRule["step"]) => OUTPUT_RULES.filter((rule) => rule.step === step).map((rule) => new RegExp(rule.source, rule.flags));
const [stripped, asIs, html, markdown, secretPattern] = [rulesFor("5a"), rulesFor("5b"), rulesFor("6"), rulesFor("7"), rulesFor("9")];
const fail = (reason: OutputReason): CheckedOutput => ({ ok: false, status: "SCHEMA_FAIL", reason });

function isRefusal(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{")) return false;
  try {
    const value: unknown = JSON.parse(trimmed);
    return typeof value === "object" && value !== null && !Array.isArray(value) && Object.keys(value).length === 1 && (value as { refusal?: unknown }).refusal === true;
  } catch {
    return false;
  }
}

/** Every string value and own key in document order, without recursion; null when too deep or too wide. */
function collect(value: unknown): string[] | null {
  const out: string[] = [];
  const stack: Array<[unknown, number]> = [[value, 0]];
  while (stack.length > 0) {
    const [item, depth] = stack.pop() as [unknown, number];
    if (typeof item === "string") {
      out.push(item);
      if (out.length > OUTPUT_LIMITS.maxStrings) return null;
      continue;
    }
    if (typeof item !== "object" || item === null) continue;
    if (depth >= OUTPUT_LIMITS.maxDepth) return null;
    // Pushed in reverse so pops follow document order: key1, value1, key2, ...
    if (Array.isArray(item)) for (let i = item.length - 1; i >= 0; i--) stack.push([item[i], depth + 1]);
    else {
      const keys = Object.keys(item);
      for (let i = keys.length - 1; i >= 0; i--) {
        stack.push([(item as Record<string, unknown>)[keys[i]], depth + 1]);
        stack.push([keys[i], depth + 1]);
      }
    }
  }
  return out;
}

/** Steps 5a, 6, 7, 8 and 9: the checks that also run on the joined strings. */
function leaks(text: string, context: OutputContext): OutputReason | null {
  const flat = text.replace(/[\t\n\r]/g, "");
  if (stripped.some((p) => p.test(flat))) return "LINK";
  if (html.some((p) => p.test(text))) return "HTML";
  if (markdown.some((p) => p.test(text))) return "MARKDOWN_LINK";
  if (context.boundary && text.toLowerCase().includes(context.boundary.toLowerCase())) return "BOUNDARY";
  const secrets = context.secrets.filter((s) => s.length >= OUTPUT_LIMITS.minSecretLength).map((s) => s.normalize("NFKC"));
  if (secrets.some((s) => text.includes(s)) || secretPattern.some((p) => p.test(text))) return "SECRET";
  return null;
}

function checkStrings(strings: string[] | null, context: OutputContext): CheckedOutput | null {
  if (strings === null) return fail("SHAPE");
  const normalised = strings.map((s) => s.normalize("NFKC"));
  for (const s of normalised) {
    if (forbidden.test(s)) return fail("FORBIDDEN_CHAR");
    if (stripped.some((p) => p.test(s.replace(/[\t\n\r]/g, ""))) || asIs.some((p) => p.test(s))) return fail("LINK");
    const reason = leaks(s, context);
    if (reason) return fail(reason);
  }
  const joined = leaks(normalised.join(""), context);
  if (joined) return fail(joined);
  return null;
}

function check(text: string, output: LlmCall["output"], context: OutputContext): CheckedOutput {
  if (isRefusal(text)) return { ok: false, status: "REFUSED", reason: "REFUSAL" };
  let parsed: unknown;
  if (output.kind === "json") {
    try { parsed = JSON.parse(text); } catch { return fail("PARSE"); }
  }
  const failure = checkStrings(output.kind === "json" ? collect(parsed) : [text], context);
  if (failure) return failure;
  if (output.kind === "text") {
    const length = [...text].length;
    return length === 0 || length > output.maxChars ? fail("LENGTH") : { ok: true, value: text };
  }
  const result = (output.schema as SafeParser).safeParse(parsed);
  if (!result.success) return fail("SCHEMA");
  return checkStrings(collect(result.data), context) ?? { ok: true, value: result.data };
}

/** The W3 output guard (spec api.md § checkOutput): the first failing step wins, and it never throws (N1). */
export function checkOutput(text: string, output: LlmCall["output"], context: OutputContext): CheckedOutput {
  try {
    return check(text, output, context);
  } catch {
    return fail("SHAPE");
  }
}
