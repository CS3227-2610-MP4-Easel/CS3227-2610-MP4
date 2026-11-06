# Conventions

Applies W2's `conventions.md` (package layout, no raw SQL, clock seam); only the rules W3 adds are listed.

## Placement
- `src/be/llm-gateway/src/sanitise.ts` - input rule data (D, P, I, invisible characters, confusables) and `sanitiseInput`.
- `src/be/llm-gateway/src/output-check.ts` - output rule data and `checkOutput`.
- `src/be/llm-gateway/src/guards.ts` - `GuardPipeline` types, `defaultGuards`, `GUARD_LIMITS`, `GUARD_VERSION`, `rulesFingerprint`.
- Rules are exported `const` arrays of `{ id, source, flags, replacement? }`; `RegExp` objects are built once from them and never carry the `g` flag when used with `.test`.

## Rules for features (handover to W6, W7, W8, W9)
- A section is `trusted: true` only if every character comes from server code or computed values (numbers, ids, enum names, dates). Anything a user typed, anything uploaded, and **any stored model output reused as input** (a summary feeding the standup) is `trusted: false` (architecture §7, C-09).
- `STATIC` sections are always `trusted: true` (`run` throws `INVALID_LLM_CALL` otherwise) and hold the feature's rules and output instructions. Section `name`s are literals, never user text.
- Budgets: each untrusted section's `budgetTokens` must leave room for the wrapper (49 characters plus the name line), and the static total must leave room for the suffix (about 280 characters with its blank line); divide by the model's token ratio (`config.ts`) for tokens.
- A feature that rejects empty input before calling `run` uses `sanitiseInput(text).blocked`. A `BLOCKED_INPUT` from `run` maps to 422 `VALIDATION_FAILED` (architecture §8, "empty input after sanitising").
- `REQUEST_REFUSED` maps to 422 `REQUEST_REFUSED` on PM endpoints and to the degraded 200 on Dev Lead and Developer endpoints (§8).
- W9 stores `flagged` per item and per summary: it calls `sanitiseInput` on each item to get that item's flag, rather than reusing the call's OR-ed `LlmResult.flagged`. W9 imports `GUARD_VERSION`, never copies it, and puts it in the `item_summaries` unique key (AD-67).
- Output schemas must not need URLs, angle brackets, HTML entities, `](` or `![`, `data:`-style schemes or dotted-quad numbers; any such string fails `checkOutput` (F6).
- A flagged item shown to a reader carries its flag (T2); a poisoned item can make the model refuse (`REQUEST_REFUSED`) for that project's call - accepted, see Known limits.

## Logging and errors
- Guards never log or throw. `run`'s `llm_call_failed` warning carries only `callId` and status. Reason codes are for tests and W11; `run` drops them.

## GUARD_VERSION bump checklist
Bump `GUARD_VERSION` and add its `KNOWN` entry when a change alters what any input sanitises to or any output's verdict, including changes the fingerprint cannot see: the order of steps inside a function, the pass loop, the join used for cross-field checks, the cut rule, or which sections get which steps. Refactors with identical results need no bump.

## Tests
- Unit tests in `src/be/llm-gateway/test/`: `sanitise.test.ts`, `output-check.test.ts`, `guards.test.ts` (fingerprint, `KNOWN`, pipeline); wrapping tests extend `fit.test.ts` and `run.test.ts`.
- Each rule ID (D1-D5, P1-P6, I1-I7, output steps 1-11) has at least one positive and one negative case named with its ID. Timing tests warm up once and take the minimum of 3 runs.

## Known limits (accepted)
- NFKC does not fold every confusable; the lookalike map covers common Cyrillic and Greek letters for the flag only. Obfuscated PII ("a at b dot com") is not redacted.
- Removing `Cf` on input deletes ZWJ and ZWNJ, which damages emoji sequences and some Persian and Indic text sent to the model. Output allows U+FE0F and emoji ZWJ sequences but rejects other zero-width characters, including ZWNJ (architecture §7).
- False positives pinned in E14, E17, E56 (8-digit numbers split by a space, UUID segments, "system prompt" in prose, four-part version numbers, `<a ` in prose). Generics like `Promise<void>` pass because step 6 matches only a list of HTML tag names.
- The confusable map covers common Cyrillic and Greek lookalikes only (for example Greek nu is not mapped); the flag is advisory.
- A poisoned item can make the model answer `{"refusal":true}` for that call; refusals do not trip the breaker, and the flag is shown to the reader.

## Threat list

| Actor | Abuse | Mitigation | Status / edge case |
|---|---|---|---|
| Project member | Task title "ignore previous instructions" (T3) | wrapped, flagged, closed schema | E19, E22 |
| Project member | Instruction split across title and description | joined match copy | E18 |
| Developer | Commit text closing the wrapper (T2) | random B drawn after sanitising; tag removal to stability | E3, E4, E6, E22 |
| Developer | Homoglyph or zero-width-split injection | NFKC, invisible-character removal, lookalike map, optional spaces in I1 | E1, E2, E15 |
| Developer | Hidden text via variation selectors, fillers, U+2028 | invisible-character set | E5 |
| Developer | Huge upload or NFKC expansion to burn CPU (T7) | cap at `budgetTokens * 8` before and after NFKC | E8, E43 |
| Feature author | Mislabelled `trusted` or untrusted `STATIC` section | STATIC must be trusted; trusted sections still lose tags and invisibles | E31, E32 |
| Test author | Boundary seam returning a malformed value | validated on every draw | E30 |
| Any user | Link, image, HTML or entity in output (T5) | steps 5-7 on each string and on their join, whitespace removed for schemes | E46-E49 |
| Any user | Deep or wide output to crash the guard | iterative walk, limits, no-throw wrapper | E45 |
| Any user | Echo of the key or the wrapper (T6) | steps 8-9 with secrets from `runtime.ts`; short secrets ignored | E53 |
| Any user | Personal data to SoCLaaS (T11) | P1-P6 after digit and dot folding | E10-E14 |
| Any user | Regex denial of service | no nested quantifiers, delimiter-bounded scans, input cap | E34, E35 |
| Any user | Poisoned item that makes the model refuse | refusals do not trip the breaker; flag shown | accepted (Known limits) |
| Maintainer | Rule change without a cache bump | fingerprint over all rule data plus `KNOWN` map; checklist | E39, E41 |
| Any user | Probing which rule fired | reasons not returned or stored | E36 |
