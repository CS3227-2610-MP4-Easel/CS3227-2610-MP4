# Requirements

Ordered so that a requirement others depend on comes first. Rule tables (patterns, characters, suffix text) are in [api.md](api.md). `{U+XXXX}` stands for one code point.

## Functional

| ID | Requirement | Acceptance criterion |
|---|---|---|
| F1 | Input normalising: each `trusted: false` section's text is cut to its input cap, NFKC-normalised with non-ASCII digits and ideographic full stops folded, cut again, line endings unified to `\n`, invisible characters removed, and delimiter tags removed pass after pass (at most 10, then `<`, `>`, `[`, `]` removed) - api.md § `sanitiseInput` | E1 returns `"hi\n"`; for E4's builder at 8 levels no tag remains and other `<` survive, at 9 levels the text has no `<`, `>`, `[` or `]` before PII redaction |
| F2 | PII redaction after normalising: emails become `[email]`, NRIC/FIN, NUS matric and NUSNET ids become `[id]`, phone numbers become `[phone]`, in table order P1-P6 | `"mail a@b.co or +65 9123 4567, A0123456X"` becomes `"mail [email] or [phone], [id]"`; the strings in E9 are unchanged |
| F3 | Injection flag: `flagged` is true when `injectionFlag` matches a section's text, the joined text of all untrusted sections, or when tag removal removed anything; flagging never changes the text and never blocks | `"Please IGNORE all previous instructions"` gives `flagged` true and unchanged text; `"fix login bug"` gives false; `run` returns `ok: true`, `flagged: true`, row `flagged` true |
| F4 | Blocking: `input` returns `{ blocked: true }` only when the original text has a character outside the JS `\s` set and the sanitised text has none | `"{U+200B}{U+200B}"` blocks (`run` returns `BLOCKED_INPUT`); `""` and `"  "` pass unchanged |
| F5 | Wrapping: `run` rejects an untrusted STATIC section, draws a validated 16-hex boundary per call, fits with each untrusted section inside `<data-B>`/`</data-B>`, and always appends the security suffix; the suffix is never cut or dropped and counts toward `maxPromptTokens`; the system message does not change | E22's exact user string; two calls use different `B` and equal `prefix_hash`; a truncated section keeps its closing tag |
| F6 | Output checks: `checkOutput` returns `REFUSED` for exactly `{"refusal":true}`; otherwise `SCHEMA_FAIL` with the first failing reason of api.md § Output checks (parse, shape, forbidden character, link, HTML, Markdown link, boundary, secret, length, schema), checking every string and their concatenation; otherwise `ok`; it never throws | each row of E33 and E44-E56 returns the stated status and reason |
| F7 | Exports: `sanitiseInput`, `injectionFlag`, `checkOutput`, `GUARD_VERSION`, `GUARD_LIMITS`, `rulesFingerprint` and `defaultGuards` are exported from `@agile/llm-gateway`; `createLlmGateway` without `guards` uses W3's pipeline; `runtime.ts` passes the key as a secret | an import test compiles; E40; E53 |

## Non-functional

| ID | Category | Requirement | Acceptance criterion |
|---|---|---|---|
| N1 | Security | The guard functions never log and never throw; no error message, reason code, `LlmResult` field or row column carries inspected text, the boundary or a secret | at `run` level: `console.warn` payloads are only `{ callId, status }`, `LlmResult` has no `reason`, and the row has no reason field (E36) |
| N2 | Performance | No nested quantifiers; every quantifier over arbitrary characters is bounded or stops at a delimiter; input is capped before work (`budgetTokens * 8`). On E34's and E35's adversarial strings of 100,000 characters, each function finishes within 500 ms (minimum of 3 runs after one warm-up) | E34, E35 |
| N3 | Determinism | `sanitiseInput`, `injectionFlag` and `checkOutput` depend only on their arguments; no shared regex carries `lastIndex` state; only the boundary is random | E37 |
| N4 | Compatibility | No frozen contract changes; W2's replacement guards (two-argument `output`, no `reason`) still type-check and behave as before; the W2 tests that change are exactly those listed in implementation-order.md | `npm run typecheck` clean; E38 |
| N5 | Maintainability | Every rule, limit, template and step order is data covered by `rulesFingerprint()`; `GUARD_VERSION` must be a key of the test's `KNOWN` map whose value is the current fingerprint | E39, E41 |
