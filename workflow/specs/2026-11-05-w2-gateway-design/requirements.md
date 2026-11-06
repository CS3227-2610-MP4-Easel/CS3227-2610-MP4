# Requirements

Ordered so that a requirement others depend on comes first.

## Functional

| ID | Requirement | Acceptance criterion |
|---|---|---|
| F1 | Mock mode: a deterministic provider that returns the response a feature registered for its `feature`, with token counts and cost computed as for a live call | Given `LLM_MODE=mock` and a registered response, when a feature calls `run`, then the result is `ok: true` with the parsed value, `promptTokens` equal to the estimate, and an `llm_calls` row with status `OK`; the same call twice gives the same value; no network request is made |
| F2 | Admission: `run` checks, in the order of api.md § Admission, the call shape, the transaction guard, the role for the feature, the session (owner, feature, state, project), `AI_ENABLED`, the mock registration, the static-section fit, the budget block, the four window limits and the breaker, and rejects at the first failure | Given each failing condition alone, and each adjacent pair together, `run` returns or throws exactly the outcome in api.md, writes no `llm_calls` row, and the provider is not called |
| F3 | Call execution: an admitted call sweeps expired leases, runs the input guard, fits the sections into the token budget, writes an `IN_FLIGHT` row with a lease and a cost reservation, calls the provider with a timeout and the retry rule, and finalises the row with status, tokens, cost, latency and attempts | Given a successful provider response, the row ends `OK` with `lease_expires_at` null, token counts from the provider, `cost_microusd` from conventions.md § Cost, and the session's `last_activity_at` updated; an `IN_FLIGHT` row whose lease has passed is finalised `TIMEOUT` by the next `run` |
| F4 | Output validation through the guard slot: the default guards parse JSON output and check it against the call's schema, or check text length against `maxChars`; W3 can replace both guards without changing `run` | Given output that fails the schema, the result is `AI_UNAVAILABLE`, the row is `SCHEMA_FAIL`, and the breaker count does not change; given a replacement guard that returns `blocked` or `refused`, the result is `BLOCKED_INPUT` or `REQUEST_REFUSED` |
| F5 | Provider failures: a call ending in a 5xx, network error or timeout adds one to the breaker; a SoCLaaS 429 is retried once after a 2 s backoff and never counts; the breaker opens after 5 consecutive upstream failures for 60 seconds, then lets one probe through | Given 5 consecutive upstream failures, the 6th call returns `AI_UNAVAILABLE` without a provider call or row; 60 seconds later one call reaches the provider; a success closes the breaker |
| F6 | `Sessions`: `open`, `assertUsable`, `touch`, `close` and `regenerate`, with the caps of contracts §5.3 and the 30-minute inactivity rule | Given 3 OPEN sessions for one feature, a 4th `open` throws `SessionCapReached`; given a session idle for 31 minutes, `assertUsable` marks it `ABANDONED` and throws `CONFLICT_STATE`; `close` on a closed session changes nothing |
| F7 | Usage queries: `usageSessions` and `usageSummary` return the contract shapes of endpoints 56 and 57; `failureReason` returns `UPSTREAM_LIMIT` for a call that ended on an upstream 429 | Given seeded rows, `usageSessions` returns only the caller's sessions with per-session sums, newest first; `usageSummary` returns one row per (feature, model) with no user ids |

## Non-functional

| ID | Requirement | Acceptance criterion |
|---|---|---|
| N1 | No prompt text, response text, section text or SoCLaaS key is stored or logged (AD-25, conventions) | A test sends marker text in every section and a marker key, through every outcome; the markers are absent from every `llm_calls` and `ai_sessions` column, every log line, every thrown error message and every returned failure |
| N2 | Settings are validated when the module loads: unsafe or missing settings stop startup and name the setting, never its value | Each rule in conventions.md § Settings has a test that the load throws `Invalid setting <NAME>` |
| N3 | Tests and CI never call the live service (AD-26) | With `APP_TIER=test`, `LLM_MODE=live` fails the load; a fetch spy over the suite records no gateway request (E46) |
| N4 | Every feature's static sections fit their budget; a build test fails otherwise (AD-17) | `assertStaticSectionsFit(feature, sections)` is exported and a test calls it for each registered feature's static sections once those exist; for W2 it is tested with fixtures |
| N5 | Reject fast: admission adds no waiting; the only deliberate wait is the single 2-second backoff after an upstream 429; provider attempts end within 25 seconds of the first attempt starting | With the fake clock, rejections never call `sleep`; a provider that never answers ends `TIMEOUT` at 20 s; no retry starts with less than 8 s left (E20, E21) |
