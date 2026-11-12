# W2 Gateway Runtime and Mock Design

- **Status:** Approved (ludannnn, 2026-11-05)
- **Risk tier:** High - it holds the SoCLaaS key, sends user-derived text to an external model, spends a shared budget, and every AI feature depends on it.
- **Workstream:** W2 | **Plan:** not written yet
- **Constraints consulted:** AD-04, AD-05, AD-16, AD-17, AD-18, AD-19, AD-23a, AD-23b, AD-24, AD-25, AD-26, AD-34, AD-53, AD-58, AD-59, AD-64, AD-66, AD-67, A-07, A-12, A-16, A-18; guardrails Known Gaps (no scheduled jobs) and Binding Decisions (AD-25, AD-32); `conventions/general.md`; `architecture/llm-gateway.md`; contracts.md §1, §3.7, §5.1, §5.3; architecture §4, §5, §8, §10, §11, §12
- **Reviewed by lenses:** Implementer, Tester, Maintainer, Attacker (holds a secret key, sends user-derived text to an external model, spends a shared budget); one round, 5 blocking and about 30 other findings fixed in these files

## 1. Problem
`src/be/llm-gateway` holds only a re-export of the frozen types (`src/be/llm-gateway/src/index.ts`); nothing implements `LlmGateway.run` or `Sessions`. The PM, Dev Lead and Developer features (W7, W8, W9) and the guards (W3) cannot be built or tested, and CI has no mock to run against (AD-26).

Desired: one gateway that every model call goes through. It admits or rejects a call quickly against the limits, records each admitted call in `llm_calls` without prompt or response text, calls SoCLaaS (or a deterministic mock), validates the output and returns the frozen `LlmResult`. Sessions are issued and checked by the server. Mock mode is the default everywhere except deployed dev and prod.

## 2. Goals
Seven functional and five non-functional requirements, with acceptance criteria, in [requirements.md](2026-11-05-w2-gateway-design/requirements.md).

## 3. Non-goals
- Sanitising, PII redaction, the injection flag, the untrusted-data wrapper and the link, HTML and image output rules - W3 (AD-25). W2 provides the guard slot they plug into (SD1).
- Feature prompts, mock responses for each feature and the corpus - W7, W8, W9 (AD-11, AD-26).
- Usage endpoints 56 and 57 and their resolvers - W15; W2 exports the query functions (SD3).
- The generic result cache - behind a flag that stays off until W17 (AD-18, AD-67); the flag state is still recorded on every call.
- The SoCLaaS budget endpoint - its response shape is undocumented (§12); the budget block uses our own cost estimate (SD7).
- Choosing the final model per feature - AD-23b is deferred to the experiments; W2 ships defaults that settings can override.
- Scheduled cleanup of stale sessions or calls - no scheduled jobs (AD-06, guardrails); both are finalised when next read.
- Changing the frozen interfaces in `src/be/contracts/src/frozen.ts` - they change only by agreement of all three owners (AD-11).

## 4. Components
- [Requirements](2026-11-05-w2-gateway-design/requirements.md) - F and N lists with acceptance criteria
- [Data model](2026-11-05-w2-gateway-design/data-model.md) - how W2 uses `ai_sessions`, `llm_calls`, `llm_gateway_state`, `rate_counters`; no schema change
- [API](2026-11-05-w2-gateway-design/api.md) - `run`, `Sessions`, providers, usage queries, settings
- [Conventions](2026-11-05-w2-gateway-design/conventions.md) - placement, settings, configuration values, threat list
- [Edge cases](2026-11-05-w2-gateway-design/edge-cases.md) - failure, limit and abuse behaviour
- [Implementation order](2026-11-05-w2-gateway-design/implementation-order.md) - tasks and waves
- No UI: W2 has no screen; the AI-busy and unreachable states are shown by the features (§13).

## 5. Open questions
| ID | Question | Blocks | Owner |
|---|---|---|---|

External dependency: T5 (limiter) needs W4's `createHit` and `incrementRateCounter`, which are in PR #10; T5 starts after it merges and `development` is merged into this branch.

## 6. Decisions made in this spec
| ID | Decision | Why / rejected alternative | Asked by |
|---|---|---|---|
| SD1 | W2 builds the whole `run` path with a replaceable guard slot; its default guards only parse and schema-check output; W3 replaces them | Lets W7-W9 build on the real path now. Rejected: W2 waiting for W3 | operator, 2026-11-05 |
| SD2 | Mock responses are registered per feature by the feature owners; the mock has no built-in prompts | The gateway must not know feature prompts. Rejected: W2 writing a canned response per feature | operator, 2026-11-05 |
| SD3 | W2 exports `usageSessions`, `usageSummary` and `failureReason`; endpoints 56-57 and their resolvers move with W15 | Endpoint and resolver belong together; W1's handover named W2 only because it owns the tables | operator, 2026-11-05 |
| SD4 | Model capability records, prices, feature settings and limits are a configuration module in the package, with per-feature model overrides from settings. This narrows AD-24 (no runtime read of `/v1/models`, no refresh path) and AD-17 (the token ratio is recalibrated by hand from the logged estimate error, by the W17 experiment owner) | The architecture leaves configuration or table to the spec; a table adds a migration and seed for no gain. Rejected: a table; reading `/v1/models` at runtime (another network call per cold start, and its price fields are unverified) | operator, 2026-11-05 |
| SD5 | `LLM_MODE` selects `mock` or `live`; `test` and `preview` must be `mock`, `local` defaults to `mock`, `dev` and `prod` must set it | CI never calls the live service (AD-26); previews have no credentials (AD-53) | operator, 2026-11-05 |
| SD6 | `@agile/db` marks the transactions it starts with an `AsyncLocalStorage` flag (`isInTransaction()`) so `run` can refuse inside one (contracts §5.1) | Node has no Spring transaction guard. Rejected: trusting callers (conventions say no model call in a transaction, but nothing checks it) | operator, 2026-11-05; Dev Lead reviews the `@agile/db` change in the PR |
| SD7 | The budget block (AD-64) is triggered by our own estimate: when the UTC day's `cost_microusd` sum (in-flight calls counted at a reservation) reaches the spend cap, a block is stored in `llm_gateway_state` for 15 minutes or until UTC midnight, whichever is first, giving `AI_BUSY`; the next call after it re-checks the sum (the probe), so the block decays as AD-64 requires | The budget endpoint's shape is unknown and a SoCLaaS 429 cannot be told apart from a rate limit (§12). Rejected: reading the budget endpoint; treating a 429 as a budget signal (A-12 says a 429 is transient); a plain block until midnight (would not decay, against AD-64) | spec author after the Maintainer review; operator approved the numbers |
| SD8 | `prompt_version` is the first 12 hex characters of the prefix hash (the static sections) | A change to a feature's rules changes the version without editing gateway configuration. Rejected: a version string per feature in gateway configuration | spec author |
| SD9 | `failureReason(callId)` tells a feature whether `AI_UNAVAILABLE` came from an upstream 429 (`UPSTREAM_LIMIT`), because the frozen `LlmResult` has no reason field | Keeps the frozen type unchanged. Rejected: adding `reason` to `LlmResult` (needs all three owners) | spec author |
| SD10 | `createSessions` returns `Sessions & { regenerate(sessionId, userId) }`; the frozen `Sessions` type is unchanged and the extra method is told to the PM and Dev Lead in the PR (AD-11) | The frozen type has no regeneration method but endpoint 39 needs the cap. Rejected: changing the frozen type | spec author |
| SD11 | `Sessions.close` does not check who closes; contracts §5.3's "owner or approving user" is enforced by the calling endpoint's policy (approve, reject, edit, feedback) | `Sessions` cannot see proposals or the approver's role. Rejected: passing the approver rule into `Sessions` | spec author |
| SD12 | The gateway uses its own unfiltered `PrismaClient` for its three tables | Accounting and the lease sweep must see rows of archived projects, which the filtered client hides; the gateway reads no other module's table. Rejected: the filtered client (rows of an archived project could stay `IN_FLIGHT` for ever and drop out of the spend sum); sharing W4's client (`AuthRuntime` does not expose it) | spec author |
| SD13 | Breaker state is read then written without a lock | A lost increment only delays opening; a second probe costs one call. Rejected: a locked update on every call (a hot row on every AI request) | spec author |
| SD14 | `prod` must run `live`; `SOCLAAS_BASE_URL` must be the SoCLaaS URL exactly; the provider refuses redirects | A mock production would look healthy while serving canned output; the key must not be sendable elsewhere. Rejected: a host allow-list setting | spec author after the Attacker review |
