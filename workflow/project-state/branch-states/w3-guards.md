# Branch State — w3-guards

**What this branch has changed, and how to pick it up.** `workflow/project-state/STATE.md`
describes `INT`; read it for context and write here instead of editing it.
`sync-project-state` folds this file in after the branch merges.

- **Branch:** w3-guards (started stacked on `w2-gateway`; `development` merged in at `46b33b1` after PR #14 merged)
- **Base:** 46b33b1
- **Owner:** ludannnn (Developer member)
- **Status:** Approved
- **Approved:** ludannnn 2026-11-06
- **Last updated:** 2026-11-06 by Claude Opus 5.5 — Gate 3 approved; waits for PR #14

**Untouched:** Conventions, Deviations

---

**Scope.** W3 Guards (the untrusted-text pipeline, AD-25): fill the guard slot W2 left in `src/be/llm-gateway/src/guards.ts` with the real input and output guards. Stacked on W2 so it can start before PR #14 merges (operator's choice, 2026-11-06).

---

## 1. How to Resume

**Sessions**

| Session | Started | Agent(s) | Workstream | Status | Doing | Next action | Last touched |
|---|---|---|---|---|---|---|---|

**Remaining**

- [x] Gate 1: W3 spec approved by ludannnn on 2026-11-06, including NUSNET redaction (SD4) and the known limits.
- [x] Gate 2: W3 plan approved by ludannnn on 2026-11-06.
- [x] Close-out: branch-diff review (Attacker, Tester); findings fixed or recorded in Changes.
- [x] Gate 3: operator approved the branch (ludannnn, 2026-11-06).
- [ ] **Handover:** W6, W7, W8, W9 follow W3's rules for sections (spec conventions.md § Rules for features): `trusted: true` only for server-built text; anything users typed or uploaded, and any stored model output reused as input, is `trusted: false`; `STATIC` sections are always trusted (`run` throws `INVALID_LLM_CALL` otherwise) and section names are literals; each untrusted section's budget leaves room for the 49-character wrapper plus its name line, and the statics leave room for the ~280-character suffix.
- [ ] **Handover:** W7 checks "empty after sanitising" with `sanitiseInput(text).blocked`; every feature maps `BLOCKED_INPUT` to 422 `VALIDATION_FAILED`; PM endpoints map `REQUEST_REFUSED` to 422, Dev Lead and Developer endpoints to the degraded 200 (architecture §8).
- [ ] **Handover:** W9 calls `sanitiseInput` per item to store each item's and summary's own `flagged`, and imports `GUARD_VERSION` (never copies it) into the `item_summaries` unique key (AD-67).
- [ ] **Handover:** W9 and W7 output schemas must not need URLs, angle brackets, HTML entities, `](`, `![`, `scheme:` values or dotted-quad numbers; such strings fail the output guard.
- [ ] **Handover:** W11's corpus can read the rule tables (`DELIMITER_RULES`, `PII_RULES`, `INJECTION_RULES`, `OUTPUT_RULES`) and the `reason` codes from `checkOutput`; per AD-26 the corpus is reviewed by a different owner than the guards' author (Developer).
- [ ] **Handover:** whoever changes a guard rule bumps `GUARD_VERSION` and adds its `KNOWN` entry in `src/be/llm-gateway/test/guards.test.ts` (spec conventions.md § bump checklist).
- [x] While stacked: `w2-gateway`'s review fixes merged in (`7c76405`).
- [x] After PR #14 merged (`46b33b1`, a merge commit): `development` merged into this branch, `Base` moved.
- [ ] GATE: operator pushes `w3-guards` and opens the W3 PR into `development`.

---

## 2. Workstreams

| ID | Workstream | Status | Spec | Plan | Progress | Guide |
|---|---|---|---|---|---|---|
| W3 | Guards (untrusted-text pipeline) | In review | [spec](../../specs/2026-11-06-w3-guards-design.md) | [plan](../../plans/2026-11-06-w3-guards.md) | Approved at Gate 3; PR after PR #14 merges; guide out of date: llm-gateway | — |

---

## 3. Changes

| Date | What changed | Workstream | Ref |
|---|---|---|---|
| 2026-11-06 | Merged `development` after PR #14 merged (`46b33b1`); no conflicts; `STATE.md` and `guardrails.md` unchanged since the old base; 372 tests, 372 pass, none skipped | W3 | this commit |
| 2026-11-06 | Merged `w2-gateway` (PR #14 review fixes: follow-up writes after a final row no longer lose the answer; W1's Prisma 7 test fixed, so D~1 is resolved); one conflict in `run.test.ts`'s `world()` signature, both sides' options kept; no W3 code changed. 372 tests, 372 pass, none skipped | W3 | 7c76405 |
| 2026-11-06 | Gate 3: operator approved the branch | W3 | b88572e |
| 2026-11-06 | Close-out review of the branch diff (Attacker, Tester). Fixed: **blocking** — `wrapSection` used `String.replace`, so `$'` or `` $` `` in user text forged a real closing or opening `<data-B>` tag (text outside the wrapper) and a literal `{B}` revealed the boundary; now a template literal, with a regression test (fails on the old code) and a test that it matches `WRAPPER_TEMPLATE` (fingerprint unchanged; `GUARD_VERSION` not bumped, as nothing has cached a summary yet). Test gaps: a vacuous E32 assertion, joined-string checks for HTML, Markdown, boundary and secret, M3 alone, a bare ZWJ, I5 negatives, the short-secret and NFKC-secret rules, E36 payload contents, E43 cap through `run`, E26 suffix arithmetic, E51 written as JSON escapes. Not taken: database or replacement-guard errors before the insert still propagate unwrapped (W2 behaviour, programmer errors per SD11; no prompt text is in those rows); W3 test titles share some E numbers with W2's, told apart by their F IDs. 371 tests, 370 pass, 1 fails (D~1), none skipped | W3 | f9d32cf |
| 2026-11-06 | T3: guards live in `run`. `guards.ts` (slot with `maxChars` and `OutputContext`, optional `reason`, `defaultGuards`, `GUARD_LIMITS`, wrapper and suffix templates, `fingerprintParts`/`rulesFingerprint`, `GUARD_VERSION` "1"); `budget.ts` (untrusted sections wrapped, suffix always last, budget counted on the strings as sent, `security-suffix` static check); `gateway.ts` (untrusted STATIC refused, input cap, trusted sections cleaned, joined injection flag, validated boundary with collision redraw, `secrets` to the output guard); `settings.ts` `gatewaySecrets`, wired in `runtime.ts`. W2 tests changed only as the spec listed (`fit.test.ts`, `run.test.ts:49`, `:304`); 21 new tests (E18-E33, E36, E39-E43, E53, F7, SD8). Steps run implementation-first, then tests, against the plan's order (all tests written before commit). 367 tests, 366 pass, 1 fails (D~1), none skipped | W3 | cc32b13 |
| 2026-11-06 | T2: `output-check.ts`: `checkOutput` (exact refusal, parse, iterative document-order walk with depth and count limits, forbidden characters allowing emoji sequences, links with and without whitespace, an HTML tag-name list and entities, Markdown links, boundary, secrets and the `sk-` pattern, each string then their join, raw-length check, schema; never throws); 17 unit tests (E33, E35, E37, E44-E56, document order); 343 tests, 342 pass, 1 fails (D~1), none skipped | W3 | aca25b6 |
| 2026-11-06 | T1: `sanitise.ts`: `sanitiseInput` (cut, NFKC with digit and dot folding, line endings, invisible characters, delimiter tags to stability with the 10-pass bracket strip, PII P1-P6, flag), `injectionFlag` (two match copies, confusable map), `cleanTrustedText`; rule data as `{ id, source, flags }`; 21 unit tests (E1-E17, E34, E37, F4); 326 tests, 325 pass, 1 fails (D~1 from W2), none skipped | W3 | adae4a9 |
| 2026-11-06 | Plan written (T1-T3, close-out), reviewed (Implementer lens: no blocking, 2 major and 3 minor, all fixed: testable fingerprint, `gatewaySecrets` helper, wave-1 imports, traversal order, line ranges) and approved at Gate 2 | W3 | 0c71e8d |
| 2026-11-06 | Spec wording: two edge-case strings reworded (`e123456`, the LANGUAGE TAG character) so the plan lint does not read them as edge-case IDs; meaning unchanged; logged as skill feedback | W3 | 0fef63a |
| 2026-11-06 | Spec approved at Gate 1 by the operator | W3 | a01418f |
| 2026-11-06 | W3 spec drafted (7 F, 5 N, E1-E56, T1-T3) and reviewed in two rounds (Implementer, Tester, Maintainer, Attacker; then Implementer, Attacker): about 10 distinct blocking findings fixed, among them a blind `GUARD_VERSION` fingerprint, a key check that could never fire in production, newline- and field-split injection, uncapped input, a throwing output walk, PII and link bypasses, and false positives on emoji, generics and headings; lint clean | W3 | 53488a7 |
| 2026-11-06 | Branch created from `w2-gateway` at `f8e5e0f` (stacked, so W3 can start before PR #14 merges) | W3 | b2a82d5 |

---

## 4. Architecture

> Legend: `C` = project decision. AD-nn entries are in docs/architecture.

### 4.1 LLM gateway and AI context (`architecture/llm-gateway.md`)

Replaces W2's proposed Now (W2 branch state §4.1); fold W2's first, then this.

**Now (proposed):** `src/be/llm-gateway` (`@agile/llm-gateway`) is built except `ai-context` (W6). `getLlmGateway().run(call)` is the one path for every model call. It admits a call by checking, in order, the call shape (a STATIC section must be trusted), that no `@agile/db` transaction is open, the caller's role for the feature, the session (owner, feature, open, project), `AI_ENABLED`, the mock registration, that the feature's static sections and the security suffix fit, the AD-64 budget block (the tier's UTC-day `cost_microusd` against a 20,000,000 µ$ cap, blocking for 15 minutes or until UTC midnight), the four AD-59 windows through `auth`'s `hit`, and the breaker. An admitted call sweeps expired leases, then runs the W3 input guard on each untrusted section: cut to eight times its token budget, NFKC with digit and full-stop folding, invisible and control characters removed, delimiter tags removed until stable, emails, phone numbers and NRIC, FIN, matric and NUSNET ids redacted, and injection patterns flagged (also across sections); a section emptied by this is `BLOCKED_INPUT`, a flag only marks the call. Trusted non-static sections lose tags and invisible characters only. It then draws a random 16-hex boundary absent from every section, fits the sections to the token budget (AD-17) with each untrusted section wrapped in `<data-B>` tags and a fixed security suffix always last in the user message, writes an `llm_calls` row `IN_FLIGHT` with a lease and a cost reservation, calls the provider with one retry inside a 25-second deadline, runs the output guard (exact `{"refusal":true}` is `REFUSED`; any string or the concatenation of all strings containing forbidden characters, links, HTML, Markdown links or images, the boundary or the key is `SCHEMA_FAIL`; then length or schema), and finalises the row only if it is still `IN_FLIGHT`. No prompt, response, section text, boundary or key is stored or logged. The provider is the deterministic mock (`registerMockResponse` per feature) or SoCLaaS, chosen by `LLM_MODE`; `test` and `preview` must be mock and `prod` must be live, and the key goes only to the exact SoCLaaS URL with redirects refused, and separately to the output guard as a secret. `GUARD_VERSION` names the guard rules for W9's summary cache and is pinned to a fingerprint of them by a test. `getSessions()` issues and checks AI sessions (AD-19) with the contracts §5.3 caps and a 30-minute inactivity rule, plus `regenerate` for the five-regeneration cap. `usageSessions`, `usageSummary` and `failureReason` serve W15. Model records, prices and limits are one configuration module (`config.ts`); every time comes from an injectable clock.

| Path | Role |
|---|---|
| `src/be/llm-gateway/src/gateway.ts` | `createLlmGateway`: admission, input guard loop, boundary, execution, row lifecycle |
| `src/be/llm-gateway/src/settings.ts`, `config.ts` | settings per tier, `gatewaySecrets`; features, models, prices, limits |
| `src/be/llm-gateway/src/budget.ts` | token estimate, section fitting with wrapper and suffix, cost and reservation |
| `src/be/llm-gateway/src/providers.ts` | mock registry and provider, SoCLaaS provider, `UpstreamError` |
| `src/be/llm-gateway/src/sessions.ts` | `createSessions`, `SessionCapReached` |
| `src/be/llm-gateway/src/limits.ts`, `breaker.ts` | budget block, windows, breaker |
| `src/be/llm-gateway/src/sanitise.ts` | input rules and `sanitiseInput`, `injectionFlag`, `cleanTrustedText` |
| `src/be/llm-gateway/src/output-check.ts` | output rules and `checkOutput` |
| `src/be/llm-gateway/src/guards.ts` | the guard slot, `defaultGuards`, `GUARD_LIMITS`, templates, `rulesFingerprint`, `GUARD_VERSION` |
| `src/be/llm-gateway/src/usage.ts` | usage queries for endpoints 56-57 |
| `src/be/llm-gateway/src/runtime.ts` | `getLlmGateway`, `getSessions` |
| `src/be/ai-context (planned)` | the one membership-scoped context-assembly function (W6) |

| ID | Date | Decision | Why / who asked | Source |
|---|---|---|---|---|
| C~2 | 2026-11-06 | W3's scope: High tier, block only emptied input, wrap after fitting with the suffix in the user message, the PII list | operator's four answers before the spec | spec SD1 to SD4 |

Drift: AD-24's price refresh and AD-17's automatic ratio calibration are not built (W2 spec SD4).

---

## 6. Known Gaps

New entries (spec conventions.md § Known limits, accepted at Gate 1):

- **The injection flag is a floor, not a proof** — NFKC and a small lookalike map do not fold every confusable (Greek nu, Cyrillic k and others evade the patterns), and obfuscated personal data ("a at b dot com") is not redacted. The wrapper, the closed output formats and human approval are the real safeguards (AD-25, architecture §7).
- **Zero-width characters are lost on input** — removing every format character deletes ZWJ and ZWNJ, damaging emoji sequences and some Persian and Indic text sent to the model; output keeps only emoji ZWJ sequences and U+FE0F.
- **Guard false positives** — an 8-digit number split by a space (`8901 2345`) and some UUID segments are redacted as phones; "system prompt" in prose is flagged; four-part version numbers (`10.0.0.1`) and `<a ` in prose fail the output guard.
- **A poisoned item can make the model refuse** — text that steers the model to `{"refusal":true}` fails that call with `REQUEST_REFUSED`; refusals do not trip the breaker and the item's flag is shown to the reader.

---

## 7. Decisions

> Legend: `C` = project decision. AD-nn entries are in docs/architecture.

### C~1 — W3 starts stacked on `w2-gateway`

- **Date:** 2026-11-06
- **Who asked:** operator (ludannnn), "lets do it", after asking whether W3 had to wait for PR #14
- **Decision:** branch W3 from `w2-gateway`, keep `Base` at the last `INT` sha W2 contains, merge `development` in after PR #14 merges, and open W3's PR only then. W3 edits W2's `guards.ts`, `budget.ts` and `gateway.ts` (spec SD7).
- **Why:** the 10 Nov freeze; W3's spec and code depend on W2's slot, not on its merge.
- **Rejected:** waiting for PR #14 to merge.

### C~2 — W3's scope choices

- **Date:** 2026-11-06
- **Who asked:** operator (ludannnn), choosing the recommended option in four questions before the spec
- **Decision:** risk tier High with four lenses (SD1); block only input emptied by sanitising, flag never blocks (SD2); the gateway wraps untrusted sections after fitting and appends the security suffix to the user message, and `output` gets the boundary and key (SD3); redact emails, phones, NRIC/FIN and NUS matric (SD4, NUSNET ids added by the author under T11, confirmed at Gate 1).
- **Why:** architecture §7 and C-09 (truncate before wrapping; flagged input is marked, not blocked); T11.
- **Rejected:** Medium tier; never blocking; blocking on injection (would reverse §7); wrapping inside `input`; redacting long digit runs (damages commit SHAs).
