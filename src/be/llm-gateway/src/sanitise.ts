/** One guard rule as data, so `rulesFingerprint` can hash it (spec api.md § GUARD_VERSION). */
export type Rule = { id: string; source: string; flags: string; replacement?: string };

export const SANITISE_LIMITS = { passCap: 10, d2TagBound: 256 } as const;

/** Spec api.md § Delimiter tags; applied in sequence within a pass. */
export const DELIMITER_RULES: readonly Rule[] = [
  { id: "D1", source: String.raw`</?\s*data-[^<>]*>`, flags: "giu" },
  { id: "D2", source: String.raw`</?\s*(?:system|user|assistant|developer|tool|function|human|context|untrusted|instructions?|s)\b[^<>]{0,${SANITISE_LIMITS.d2TagBound}}>`, flags: "giu" },
  { id: "D3", source: String.raw`<\|[^|<>]{0,32}\|>`, flags: "giu" },
  { id: "D4", source: String.raw`\[/?\s*(?:INST|SYS)\s*\]`, flags: "giu" },
  { id: "D5", source: String.raw`<</?\s*SYS\s*>>`, flags: "giu" },
];

/** Spec api.md § PII, in this order. */
export const PII_RULES: readonly Rule[] = [
  { id: "P1", source: String.raw`[\p{L}\p{N}._%+\-]{1,254}@[\p{L}\p{N}.\-]{1,253}\.\p{L}{2,24}(?!\p{L})`, flags: "giu", replacement: "[email]" },
  { id: "P2", source: String.raw`(?<![\p{L}\p{N}])[STFGM]\d{7}[A-Z](?![\p{L}\p{N}])`, flags: "giu", replacement: "[id]" },
  { id: "P3", source: String.raw`(?<![\p{L}\p{N}])A\d{7}[A-Z](?![\p{L}\p{N}])`, flags: "giu", replacement: "[id]" },
  { id: "P4", source: String.raw`(?<![\p{L}\p{N}])E\d{7}(?![\p{L}\p{N}])`, flags: "giu", replacement: "[id]" },
  { id: "P5", source: String.raw`(?<![0-9a-f]{4})(?<!\p{N})(?:\+65[ .\-]*)?[689](?:[ .\-]?\d){7}(?![0-9a-f]{4})(?!\p{N})`, flags: "giu", replacement: "[phone]" },
  { id: "P6", source: String.raw`(?<!\d)\+\d{1,3}(?:[ \-]?\d){7,14}(?![\p{L}\p{N}])`, flags: "giu", replacement: "[phone]" },
];

/** Spec api.md § Injection patterns; I6 runs on the newline-keeping match copy, the rest on the flattened one. */
export const INJECTION_RULES: readonly Rule[] = [
  { id: "I1", source: String.raw`\b(?:ignore|disregard|forget|override|bypass) ?(?:all |any |the |your )?(?:previous|prior|above|earlier|preceding|system) ?(?:instructions?|rules|prompts?|messages?|directions)\b`, flags: "iu" },
  { id: "I2", source: String.raw`\b(?:reveal|print|repeat|leak|tell me) (?:me )?(?:your|the) (?:system prompt|prompt|instructions|rules)\b`, flags: "iu" },
  { id: "I3", source: String.raw`\b(?:you are now (?:a|an) |from now on,? you (?:are|will|must)\b|pretend (?:to be|you are)\b)`, flags: "iu" },
  { id: "I4", source: String.raw`\bact as (?:an? )?(?:different|new|unrestricted|jailbroken)\b`, flags: "iu" },
  { id: "I5", source: String.raw`\b(?:system prompt|developer mode|jailbreak|do anything now)\b`, flags: "iu" },
  { id: "I6", source: String.raw`(?:^|\n) ?(?:system|assistant) ?:`, flags: "iu" },
  { id: "I7", source: String.raw`\bnew instructions? ?:`, flags: "iu" },
];

/** Every Cc except newline and tab, every Cf, Co and Cs, variation selectors and Hangul fillers (spec api.md § Invisible characters). */
export const INPUT_INVISIBLE_SOURCE = String.raw`(?![\n\t])[\p{Cc}\p{Cf}\p{Co}\p{Cs}\u{FE00}-\u{FE0F}\u{E0100}-\u{E01EF}\u{115F}\u{1160}\u{3164}\u{FFA0}]`;

/** Cyrillic and Greek lookalikes folded for flag matching only; keys are code points in hex. */
export const CONFUSABLES: Readonly<Record<string, string>> = {
  "430": "a", "441": "c", "435": "e", "456": "i", "43e": "o", "440": "p", "455": "s", "445": "x", "443": "y",
  "3b1": "a", "3bf": "o", "3c1": "p", "3c5": "y",
};

export const SANITISE_STEPS = ["cut", "nfkc", "fold-digits-and-dots", "cut-again", "line-endings", "invisibles", "delimiter-tags", "pii", "injection-flag"] as const;

const compile = (rule: Rule) => new RegExp(rule.source, rule.flags);
const delimiters = DELIMITER_RULES.map(compile);
const pii = PII_RULES.map((rule) => ({ pattern: compile(rule), replacement: rule.replacement as string }));
const injections = INJECTION_RULES.map((rule) => ({ id: rule.id, pattern: compile(rule) }));
const invisible = new RegExp(INPUT_INVISIBLE_SOURCE, "gu");
const confusable = new RegExp(`[${Object.keys(CONFUSABLES).map((hex) => `\\u{${hex}}`).join("")}]`, "gu");
const nonAsciiDigit = /(?![0-9])\p{Nd}/gu;
const isDigit = /^\p{Nd}$/u;
const digitValues = new Map<number, string>();

/** JS has no digit-value lookup: a digit's value is its distance from the start of its contiguous \p{Nd} block, mod 10. */
function asciiDigit(char: string): string {
  const cp = char.codePointAt(0) as number;
  let value = digitValues.get(cp);
  if (value === undefined) {
    let start = cp;
    while (isDigit.test(String.fromCodePoint(start - 1))) start--;
    value = String((cp - start) % 10);
    digitValues.set(cp, value);
  }
  return value;
}

/** Cut to `max` code points without building an array for short text. */
function cut(text: string, max: number): string {
  if (text.length <= max) return text;
  let end = 0;
  for (let count = 0; count < max && end < text.length; count++) end += (text.codePointAt(end) as number) > 0xffff ? 2 : 1;
  return text.slice(0, end);
}

const lineEndings = (text: string) => text.replace(/\r\n?|[\u{2028}\u{2029}]/gu, "\n");

/** Up to `passCap` passes of D1-D5; if every pass changed the text, no bracket survives. */
function removeTags(text: string): { text: string; removed: boolean } {
  let removed = false;
  for (let pass = 0; pass < SANITISE_LIMITS.passCap; pass++) {
    const before = text;
    for (const pattern of delimiters) text = text.replace(pattern, "");
    if (text === before) return { text, removed };
    removed = true;
  }
  return { text: text.replace(/[<>[\]]/g, ""), removed };
}

/** Steps 2-4 only: for trusted non-static sections, which are the feature's own text but must still not carry tags. */
export function cleanTrustedText(text: string): string {
  return removeTags(lineEndings(text).replace(invisible, "")).text;
}

/** True when an I1-I7 pattern matches; the match copies are never sent anywhere (spec api.md § Injection patterns). */
export function injectionFlag(text: string): boolean {
  const folded = text.replace(confusable, (char) => CONFUSABLES[(char.codePointAt(0) as number).toString(16)]);
  const flat = folded.replace(/\s+/gu, " ");
  const lines = folded.replace(/[ \t]+/g, " ");
  return injections.some(({ id, pattern }) => pattern.test(id === "I6" ? lines : flat));
}

/** The W3 input guard (spec api.md § sanitiseInput); pure, never throws. */
export function sanitiseInput(text: string, maxChars = Infinity): { text: string; flagged: boolean; blocked: boolean; cut: boolean } {
  let out = cut(text, maxChars);
  let wasCut = out !== text;
  out = out.normalize("NFKC").replace(nonAsciiDigit, asciiDigit).replace(/[\u{3002}\u{FF61}]/gu, ".");
  const recut = cut(out, maxChars);
  wasCut ||= recut !== out;
  out = lineEndings(recut).replace(invisible, "");
  const tags = removeTags(out);
  out = tags.text;
  for (const { pattern, replacement } of pii) out = out.replace(pattern, replacement);
  if (/\S/u.test(text) && !/\S/u.test(out)) return { text: "", flagged: false, blocked: true, cut: wasCut };
  return { text: out, flagged: tags.removed || injectionFlag(out), blocked: false, cut: wasCut };
}
