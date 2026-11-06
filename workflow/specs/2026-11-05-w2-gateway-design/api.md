# API

W2 adds no HTTP endpoint. Its interface is the exported functions of `@agile/llm-gateway` (`src/be/llm-gateway`) and one function in `@agile/db`. Callers are feature modules (W7, W8, W9, W15) running server-side under an authorised principal; nothing here is reachable from the browser.

Every time-dependent function takes a `clock: { now(): Date; sleep(ms: number): Promise<void> }` (default: the system clock and `setTimeout`). All timestamps W2 writes or compares (`created_at`, `lease_expires_at`, `started_at`, `last_activity_at`, `ended_at`, breaker and budget state, day boundaries) come from `clock.now()`, never from the database clock, so tests use a fake clock and never wait. The one exception is `hit`, which uses the database clock by design (AD-59).

## `run(call: LlmCall): Promise<LlmResult>` (frozen, contracts §5.1)

### Admission, in this order; the first failure ends the call with no row and no provider call

| Step | Check | Outcome on failure |
|---|---|---|
| 1 | `LlmCallSchema.parse(call)`; `output.kind = "json"` needs a `schema` with a `safeParse` function | throws `Error("INVALID_LLM_CALL")` |
| 2 | `isInTransaction()` is false | throws `Error("LLM_CALL_IN_TRANSACTION")` |
| 3 | `caller.role` is allowed for `feature` (conventions.md § Features) | `{ ok: false, code: "ROLE_DENIED" }` |
| 4 | The session passes `assertUsable(sessionId, caller.userId, feature)` and its `project_id` equals `call.projectId` (both null counts as equal) | `assertUsable`'s error propagates (`NOT_FOUND`, `CONFLICT_STATE`); a project mismatch throws `Error("NOT_FOUND")` |
| 5 | `AI_ENABLED` is true | `{ ok: false, code: "AI_DISABLED" }` |
| 6 | Mock mode only: a response is registered for `feature` | throws `Error("NO_MOCK_RESPONSE")` |
| 7 | Static sections fit (conventions.md § Token budget) | throws `Error("STATIC_SECTION_OVER_BUDGET:<name>")` |
| 8 | Budget block (below) is not in force | `{ ok: false, code: "AI_BUSY", retryAfterSeconds }` |
| 9 | `hit` on `user:<userId>:min`, `user:<userId>:day`, `global:min`, `global:day`, in that order, stopping at the first refusal; keys already hit stay counted | `{ ok: false, code: "AI_BUSY", retryAfterSeconds }` from the refusing `hit` |
| 10 | Breaker (below) admits the call | `{ ok: false, code: "AI_UNAVAILABLE" }` |

A database failure in any step propagates (the feature's route returns 500) and nothing is admitted.

**Budget block (AD-64, SD7).** State `llm_gateway_state` key `budget`, value `{ "blockedUntil": instant or null }`. If `blockedUntil` is after now: refuse with `retryAfterSeconds` = `ceil((blockedUntil - now) / 1000)`, at least 1. Otherwise sum `cost_microusd` over this tier's `llm_calls` rows created since the start of the current UTC day (rows in flight carry their reservation, data-model.md). If the sum is at or above the spend cap, write `blockedUntil` = the earlier of now + 15 minutes and the next UTC midnight, and refuse with that wait. When the 15 minutes pass, the next call re-checks the sum: that is the probe, and the block decays at UTC midnight when the day's sum restarts.

**Breaker (A-12).** State key `breaker`, value `{ "failures": int, "openUntil": instant or null }`; a missing row is `{ 0, null }`. Closed (`openUntil` null): admit. Open and `openUntil` after now: refuse. Open and `openUntil` passed: this call is the probe; write `openUntil` = now + 60 s before calling the provider, then admit.

### Execution (admitted calls only)

1. Finalise every row with status `IN_FLIGHT` and `lease_expires_at` before now as `TIMEOUT` (one `updateMany` on the indexed lease column). This does not touch the breaker.
2. Input guard on each `trusted: false` section, in list order; its returned `text` replaces the section's text. `blocked` from any section: insert the row directly with status `BLOCKED_INPUT`, `attempts` 0, `cost_microusd` 0, `estimated_prompt_tokens` 0, `section_tokens` `{}`, `truncated` false, and return `{ ok: false, code: "BLOCKED_INPUT", callId }`. `flagged` from any section sets `flagged`.
3. Fit the sections (conventions.md § Token budget) and assemble the messages: one system message of the `STATIC` sections and one user message of the others, each ordered by ascending `priority` (ties: list order), each section rendered as `## <name>`, a newline, then its text, sections joined by a blank line. An empty user message is sent as an empty string.
4. Insert the row `IN_FLIGHT` with every column of data-model.md, including the cost reservation and `lease_expires_at` = now + 60 s.
5. Provider attempts. The deadline is 25 s after the first attempt starts. Attempt 1 timeout: 20 s. After a failed attempt, retry once only if the failure is `HTTP_429` (wait 2 s first) or `HTTP_5XX` or `NETWORK` (no wait), and only if `25 s - elapsed - wait >= 8 s`, with elapsed measured when the failure arrives; the retry's timeout is `25 s - elapsed - wait`. `TIMEOUT` is never retried. The final status comes from the last attempt.
6. Output guard on the text: `ok` -> `OK`; default-guard failure -> `SCHEMA_FAIL`; replacement guard `refused` -> `REFUSED`.
7. Finalise with one update that matches only `status = 'IN_FLIGHT'`: status, tokens, cost, `latency_ms` (now minus `created_at`), `attempts`, `lease_expires_at` null. If it matches no row (the lease sweep got there first), return `{ ok: false, code: "AI_UNAVAILABLE", callId }`.
8. On `OK`, set the session's `last_activity_at` (other outcomes leave it). Update the breaker, return the result.

Success: `{ ok: true, value, callId, flagged, truncated, cacheHit: false, promptTokens, completionTokens, costMicroUsd }` (tokens 0 when the provider gave none; `costMicroUsd` is the row's final cost as a number). Failure after the row: `{ ok: false, code, callId }` per data-model.md's status table.

**Breaker update.** A call ending `UPSTREAM_ERROR` or `TIMEOUT` adds 1 to `failures` once, however many attempts it made; if `failures` is then 5 or more, write `openUntil` = now + 60 s and log `llm_breaker_open` (on every opening, including a failed probe). `OK` writes `{ 0, null }`. Every other status leaves the state unchanged. The update is a read then a write without a lock; concurrent calls can lose an increment or both probe, which delays opening or adds a probe and is accepted (SD13).

Transaction boundary: none. Idempotency: none; each call is a new row and is counted (architecture §10). `inputHash` is recorded as given; features compute it (contracts §5.1).

## `Sessions` (frozen, contracts §5.3) and `regenerate` (SD10)

`createSessions({ db, settings, clock })`. Every count below is over sessions with the current tier's `env`.

| Function | Behaviour | Errors |
|---|---|---|
| `open({ feature, userId, projectId })` | First marks the user's `OPEN` sessions whose `last_activity_at` is over 30 minutes ago `ABANDONED` (`ended_at` = now). Then checks the day cap, then the open cap, then inserts and returns the id | `SessionCapReached`: 20 sessions with `started_at` in the current Asia/Singapore day -> `retryAfterSeconds` to the next Singapore midnight; 3 `OPEN` sessions for this feature -> seconds until the one with the oldest `last_activity_at` reaches 30 minutes idle, at least 1 |
| `assertUsable(sessionId, userId, feature)` | Passes for an `OPEN` session of the current tier owned by `userId` for `feature` with `last_activity_at` within 30 minutes | `Error("NOT_FOUND")`: missing, other owner or other feature. `Error("CONFLICT_STATE")`: closed, or idle over 30 minutes (marked `ABANDONED` first) |
| `touch(sessionId)` | Sets `last_activity_at` = now if `OPEN`; otherwise nothing | none |
| `close(sessionId, outcome, actorId)` | `outcome` is `ACCEPTED`, `EDITED`, `REJECTED` or `ABANDONED`; sets it and `ended_at` with one update matching `outcome = 'OPEN'`; a closed session is unchanged (idempotent). Who may close is enforced by the calling endpoint's policy, not here (SD11) | `Error("NOT_FOUND")`: missing session. `Error("INVALID_OUTCOME")`: `OPEN` or any other value. `Error("INVALID_ACTOR")`: `actorId` not a uuid |
| `regenerate(sessionId, userId)` | `assertUsable` for the session's own feature (an idle session is abandoned and the count is unchanged), then one update adding 1 to `regenerate_count` and setting `last_activity_at`, matching only `outcome = 'OPEN'` and `regenerate_count < 5` | as `assertUsable`; `SessionCapReached` with `retryAfterSeconds` 1800 when no row matched (the inactivity period: after it the session is abandoned and a new flow may start) |

`SessionCapReached` (exported class, `message` `"RATE_LIMITED"`, `retryAfterSeconds` integer >= 1): features map it to 429 `RATE_LIMITED` with `Retry-After` (contracts §3).

## Providers

| Export | Behaviour |
|---|---|
| `LlmProvider` | `complete({ model, messages, maxTokens, temperature, reasoningEffort?, timeoutMs })` -> `{ text, promptTokens: number or null, completionTokens: number or null }`; throws `UpstreamError` |
| `UpstreamError` | fields `kind` (`HTTP_429`, `HTTP_5XX`, `NETWORK`, `TIMEOUT`) and `status` (number or null); `message` is `UPSTREAM_<kind>`; never carries a `cause`, URL, header or body |
| `registerMockResponse(feature, respond)` | `respond(call: LlmCall) => string`; registers or replaces the feature's mock in the process-wide registry. Feature modules call it at import, beside their prompt. It may throw `UpstreamError` to simulate a failure; any other thrown error becomes `Error("MOCK_RESPONSE_FAILED")` with no original message |
| `createMockProvider(registry)` | returns the registered text; `promptTokens` = the prompt estimate, `completionTokens` = `ceil(code points of text / tokenRatio)` |
| `createSoclaasProvider({ baseUrl, apiKey })` | `POST {baseUrl}/chat/completions` with `Authorization: Bearer <key>`, `redirect: "error"`, and `{ model, messages, max_tokens, temperature, reasoning_effort? }`; reads `choices[0].message.content` and `usage.prompt_tokens` / `usage.completion_tokens` (absent or non-integer -> null). 429 -> `HTTP_429`; any other non-2xx, or a body without a string `choices[0].message.content` -> `HTTP_5XX`; fetch rejection (including a redirect) -> `NETWORK`; abort at `timeoutMs` -> `TIMEOUT`. The key is held only inside this provider |

In live mode the registry is never read.

## Guard slot

`GuardPipeline = { input(text: string): { text: string; flagged: boolean } | { blocked: true }; output(text: string, output: LlmCall["output"]): { ok: true; value: unknown } | { ok: false; status: "SCHEMA_FAIL" | "REFUSED" } }`.
Default (W2): `input` returns the text unchanged with `flagged: false`. `output` for `json` runs `JSON.parse`, then `schema.safeParse`, returning `SCHEMA_FAIL` on either failure without keeping the error; for `text` it returns `SCHEMA_FAIL` when the text is empty or longer than `maxChars` code points, else the text. W3 supplies a replacement through `createLlmGateway({ guards })`.

## Construction and usage queries

| Export | Behaviour |
|---|---|
| `loadGatewaySettings(env)` | conventions.md § Settings; throws `Invalid setting <NAME>` |
| `createLlmGateway({ settings, db, hit, sessions, provider, guards?, clock? })` | returns `LlmGateway`; `db` is an unfiltered `PrismaClient` (SD12); `hit` is `auth`'s `Hit` |
| `createSessions({ db, settings, clock? })` | returns `Sessions & { regenerate }` |
| `getLlmGateway()`, `getSessions()` | process-wide instances, created on the first call from `process.env` (settings validated then), with `getAuthRuntime().hit`, one `PrismaClient` for the gateway's tables, and the mock or SoCLaaS provider per `LLM_MODE`. Feature route modules call them at module load so a bad setting stops startup, as W4's settings do |
| `assertStaticSectionsFit(feature, sections, model?)` | throws `Error("STATIC_SECTION_OVER_BUDGET:<name>")` under the rule in conventions.md § Token budget |
| `usageSessions(db, userId, { from?, to?, feature?, page, size })` | the caller's sessions of the current tier with `started_at` in `[from, to)`, newest first, `id` as tie-breaker; per session `calls` = number of `llm_calls` rows, token sums, `cost_microusd` sum (as a number), `elapsedSeconds` = `ended_at - started_at` or null; returns `{ items, page, size, total }`; `page` >= 0 and `size` 1 to 100, else `RangeError` |
| `usageSummary(db, { from?, to? })` | one row per (feature, model) over this tier's `llm_calls` with `created_at` in `[from, to)`: `calls`, token and cost sums, `cacheHits` (status `CACHE_HIT`), `avgLatencyMs` (mean over rows with latency, 0 if none), `schemaFailures` (status `SCHEMA_FAIL`), `estimateErrorPercent` = mean of `abs(estimated - prompt_tokens) / prompt_tokens * 100` over rows with `prompt_tokens` > 0, else 0, both means rounded to 2 decimals; no user ids |
| `failureReason(db, callId, userId)` | `"UPSTREAM_LIMIT"` if the row belongs to `userId` and its status is `RATE_LIMITED`; null otherwise, including an unknown id |

`@agile/db` adds `isInTransaction(): boolean`, backed by an `AsyncLocalStorage` flag that `inCoreTransaction`, `inMutationTransaction` and the filtered client's callback `$transaction` set for the duration of their callback (SD6). A `$transaction` called directly on an unfiltered `PrismaClient` is not marked; conventions.md forbids that in request code.

## Security per operation

| Operation | Principal and authorisation | Never logged or returned | Input trust |
|---|---|---|---|
| `run` | Server code for an authorised principal; role per feature (step 3); session owner, feature and project (step 4); projects scoped by W6's `AiContext` | prompt, section and response text; the key; provider error details | `trusted: false` sections pass the input guard; the `LlmCall` is server-built and schema-checked |
| `Sessions` | Server code passes the authorised user's id; ownership checked on every use; who may close is the endpoint's policy | nothing sensitive | ids are server-issued, never from the client (AD-19) |
| SoCLaaS provider | key held in the provider only, sent only to the allowed host, redirects refused | the key, request and response bodies | responses are untrusted until the output guard passes |
| Usage queries | 56 passes the caller's own id (SELF); 57 is aggregate only; `failureReason` checks the owner | per-user rows in `usageSummary` | `from`, `to`, `page`, `size` are parsed by W15's schemas |
