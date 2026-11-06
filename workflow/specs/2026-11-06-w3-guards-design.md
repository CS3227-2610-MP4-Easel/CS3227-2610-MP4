# W3 Guards (Untrusted-Text Pipeline) Design

- **Status:** In review
- **Risk tier:** High - it is the control between user-written text and an external model (prompt injection, exfiltration through output, personal data sent to SoCLaaS), and every AI feature relies on it.
- **Workstream:** W3 | **Plan:** not written yet
- **Constraints consulted:** AD-25, AD-26, AD-64 (A-12), AD-67 (A-09); architecture §7 (trust boundaries, pipeline additions), §8; concern C-09; contracts §5.1; guardrails Binding Decisions (AD-25) and Out of Scope (A-07); `architecture/llm-gateway.md`; W2 spec SD1 and api.md § Guard slot
- **Reviewed by lenses:** Implementer, Tester, Maintainer, Attacker (untrusted user text crosses into an external model); round 1: 17 blocking findings (about 9 after merging duplicates) and about 40 others; round 2 (Implementer, Attacker): 1 blocking (newline-split injection) and 9 major or minor, mostly false positives (emoji, generics, headings). All fixed in these files or recorded below and in conventions.md § Known limits; round cap reached, no open questions

## 1. Problem
W2 left a guard slot (`src/be/llm-gateway/src/guards.ts`). Its default `input` returns untrusted text unchanged with `flagged: false`, and its default `output` only parses JSON and checks the schema, or checks text length. So today a task title saying "ignore previous instructions" reaches the model unmarked, an email address in a commit message is sent to SoCLaaS, untrusted text is not delimited, and a model answer containing a link, HTML or the key is returned to the feature.

The slot also cannot do what §7 and C-09 require: untrusted text must be wrapped in a random per-call boundary *after* truncation, with a fixed security suffix that is never cut, and the output guard must check the boundary did not leak. The input guard runs on one section before fitting and sees no call context.

Desired: every `trusted: false` section is capped, normalised, stripped of invisible characters and delimiter tags, redacted of personal data and flagged for injection patterns before fitting; after fitting, the gateway wraps each untrusted section in `<data-B>`...`</data-B>` with a fresh random `B` and always appends the security suffix; every model answer is rejected if any of its strings, or their concatenation, contains forbidden characters, links, HTML, Markdown links or images, the boundary or the key, before the length and schema checks.

**Stacking.** This branch is stacked on `w2-gateway` (SD7). W3's PR is opened into `development` only after PR #14 merges and `development` is merged in. W3's proposed `architecture/llm-gateway.md` Now will be W2's proposed Now (W2 branch state §4.1) with the guard sentence replaced and `sanitise.ts` and `output-check.ts` added to the paths, so the fold applies W2's then W3's in order.

## 2. Goals
Seven functional and five non-functional requirements, with acceptance criteria, in [requirements.md](2026-11-06-w3-guards-design/requirements.md).

## 3. Non-goals
- Blocking on injection patterns - a flagged input is still sent, marked (architecture §7; operator, SD2).
- Redacting long digit runs or card numbers - would damage commit SHAs and ids in uploads (operator, SD4).
- The security corpus (about 20 cases per feature), the canary cases and the generated authorisation test - W11 (AD-26 layers 2 and 3). W3 delivers layer 1, unit tests for each guard.
- Live corpus runs and model comparison - W17 (AD-26 layer 4).
- `AiContext.assemble` and which sections are `trusted` - W6 (contracts §5.2); the rule for features is in conventions.md.
- Feature prompts, the "answer `{"refusal":true}`" instruction and output schemas - W7, W8, W9.
- Plain-text rendering and the CSP - `web` (architecture §7, A-15).
- Changing the frozen interfaces in `src/be/contracts` - `LlmCall`, `LlmResult` and `ContextSections` are unchanged (AD-11).
- Any client-controlled guard setting (guardrails, A-07).

## 4. Components
- [Requirements](2026-11-06-w3-guards-design/requirements.md) - F and N lists with acceptance criteria
- [API](2026-11-06-w3-guards-design/api.md) - the changed `GuardPipeline`, `sanitiseInput`, `checkOutput`, wrapping in `fitSections` and `run`, `secrets`, `GUARD_VERSION`; rule tables
- [Conventions](2026-11-06-w3-guards-design/conventions.md) - rules for features, bump checklist, known limits, threat list
- [Edge cases](2026-11-06-w3-guards-design/edge-cases.md) - input, PII, flag and block, wrapping, output, safety and versioning
- [Implementation order](2026-11-06-w3-guards-design/implementation-order.md) - T1 to T3
- No data-model changes: `llm_calls.flagged` and `item_summaries.guard_version` already exist (W1 schema); W3 only fills them.
- No UI changes: rendering is `web`'s.

## 5. Open questions
| ID | Question | Blocks | Owner |
|---|---|---|---|

## 6. Decisions made in this spec
| ID | Decision | Why / rejected alternative | Asked by |
|---|---|---|---|
| SD1 | Risk tier High, four lenses | slicing.md records W3 as "Big, high"; untrusted text reaches an external model. Rejected: Medium with three lenses | operator, 2026-11-06 |
| SD2 | The input guard blocks only when a non-empty untrusted section is empty after sanitising; injection patterns only set `flagged` | Architecture §7: flagged input is marked, not blocked; the closed output formats and human approval are the safeguards. Rejected: never block (features would each re-check emptiness); block on injection (reverses §7) | operator, 2026-11-06 |
| SD3 | The gateway wraps untrusted sections after fitting and appends the security suffix to the end of the user message; `output` receives the boundary and key as a third argument | Truncation must happen before wrapping and never cut the suffix (§7, C-09); the suffix sits in the user message so the system prompt and `prefix_hash` stay stable across calls. Rejected: wrapping inside `input` (truncation could cut the closing tag) | operator, 2026-11-06 |
| SD4 | Redact emails, phone numbers, NRIC/FIN and NUS matric; also NUSNET ids | T11 asks for "emails, phone numbers and ID-like strings". Rejected: also long digit runs | operator, 2026-11-06; NUSNET added by the author, to confirm at Gate 1 |
| SD5 | Output checks run on every string in the parsed JSON (keys and values) and on their concatenation, not on the raw text | JSON escapes (`<`) would hide `<` and `:` from a raw-text scan; a link can be split across fields. Rejected: raw-text scan only | author; split-field case from the Attacker lens |
| SD6 | `GUARD_VERSION` is a manual string; a test requires it to be a key of a `KNOWN` map whose value is `rulesFingerprint()` over all rule data, limits, templates and step orders | W9's summary cache key includes it (AD-67, C-06). Rejected: hashing at runtime (any refactor would invalidate every cache); hashing `JSON.stringify` of `RegExp` objects (serialises to `{}`, found by all four lenses) | author |
| SD8 | The key reaches the output guard through a new `secrets` dependency that `runtime.ts` fills; the gateway's settings keep `apiKey: null` | W2 removes the key from the gateway's settings so it cannot be logged (Implementer and Tester lenses found the check was dead). Rejected: putting the key back into settings; dropping the exact-key check | author |
| SD9 | An untrusted STATIC section is a programmer error (`INVALID_LLM_CALL`); trusted non-static sections still lose tags and invisible characters | Wrapping a STATIC section would put a random boundary in the system message (breaks `prefix_hash`); leaving it unwrapped puts user text in the system prompt. Rejected: either of those | author, from Implementer and Attacker lenses |
| SD10 | Each untrusted section is capped at `budgetTokens * 8` code points before sanitising and again after NFKC | Sanitising an uncapped upload blocks the event loop (Attacker lens); the cap is far above any budget, so fitting still decides. Rejected: no cap | author |
| SD11 | `BOUNDARY_COLLISION` and `BOUNDARY_INVALID` are thrown like W2's `INVALID_LLM_CALL` | Programmer-error throws, not `LlmResult` codes: four independent 64-bit draws all appearing in the call's text is negligible; a malformed value comes only from a test seam. Rejected: a new `LlmResult` code (changes a frozen contract, AD-11) | author, from Maintainer lens |
| SD12 | Findings not taken: keeping ZWJ and ZWNJ on input; dropping the `BOUNDARY` output check; mapping every confusable | §7 requires removing zero-width characters (output keeps only emoji ZWJ and U+FE0F, SD13); the boundary check is cheap defence in depth; the flag is advisory | author |
| SD13 | Output allows U+FE0F and emoji ZWJ sequences; HTML is a tag-name list, not any `<letter`; `scheme:` checks keep whitespace; the Markdown reference-definition rule is dropped | Round-2 Attacker lens showed each would fail ordinary standups and plans (`⚠️`, `Promise<void>`, "user data:\n1.", "[PROJ-12]: fixed"). Rejected: accepting those failures as availability cost | author, from Attacker lens |
| SD7 | This branch is stacked on `w2-gateway` and edits W2's `guards.ts`, `budget.ts` and `gateway.ts` | Same owner; the slot change is internal to `@agile/llm-gateway` | operator, 2026-11-06 |
