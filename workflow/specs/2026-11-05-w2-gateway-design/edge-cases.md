# Edge Cases and Non-Happy Paths

IDs are permanent: never reuse or renumber. Every F requirement and every error appears in at least one row. Time-dependent rows use the fake clock (conventions.md § Tests).

## Settings
| ID | Requirement | Scenario | Expected behaviour (exact) | Why it matters | Test layer |
|---|---|---|---|---|---|
| E1 | N2, N3 | `APP_TIER` `test` or `preview` with `LLM_MODE=live`; `prod` with `LLM_MODE=mock` or unset | load throws `Invalid setting LLM_MODE` | CI and previews never call the live service; production never serves canned output | unit |
| E2 | N2 | `dev` without `LLM_MODE`; `LLM_MODE` `Live`, empty or ` live`; `live` without `SOCLAAS_API_KEY` or with whitespace in it; `SOCLAAS_BASE_URL` with another host, `http://`, a port, userinfo, a query, a fragment or a trailing slash; `AI_ENABLED` `yes` or `TRUE`; `LLM_MODEL_DEV_STANDUP` naming an unknown model | load throws `Invalid setting <NAME>` naming that setting; the message never contains the value | Unsafe deploys refuse to start; the key only goes to SoCLaaS | unit |
| E3 | F1 | `APP_TIER=local` with no gateway settings | mock mode, AI enabled, default models | Works out of the box locally | unit |
| E40 | N2 | `APP_TIER` missing or `staging` | load throws `Invalid setting APP_TIER` | Tier drives every other rule | unit |

## Admission
| ID | Requirement | Scenario | Expected behaviour (exact) | Why it matters | Test layer |
|---|---|---|---|---|---|
| E4 | F2 | A `DEVELOPER` caller on `PM_PLAN_OUTLINE`; a `PM` on `DEV_STANDUP` | `{ ok: false, code: "ROLE_DENIED" }`; no row; provider not called; no `hit` | Role per feature | service |
| E5 | F2 | `run` inside `inMutationTransaction`, `inCoreTransaction` or the filtered client's `$transaction` callback; and right after such a callback returns | inside: throws `Error("LLM_CALL_IN_TRANSACTION")`, no row; after: runs normally | No model call in a transaction | integration |
| E6 | F2 | `LlmCall` with an unknown field, a non-uuid session id, or `kind: "json"` without a `safeParse` schema | throws `Error("INVALID_LLM_CALL")`; no row; no database write at all | A server bug fails loudly | unit |
| E7 | F2 | `AI_ENABLED=false`, in mock or live mode | `{ ok: false, code: "AI_DISABLED" }`; no row; no `hit` | AD-66 switch | service |
| E8 | F2 | A user's 7th call within one minute (fake `hit` refuses `user:<id>:min` with `retryAfterSeconds` 37) | `{ ok: false, code: "AI_BUSY", retryAfterSeconds: 37 }`; no row; `user:<id>:day` and the global keys are not hit | Per-user window | service |
| E9 | F2 | Fake `hit` refuses `global:min` with 12 | `AI_BUSY` with 12; `user:<id>:min` and `user:<id>:day` were hit and stay counted; `global:day` not hit | Shared key protection; stated consumption | service |
| E10 | F2 | Today's UTC sum reaches 20,000,000 at 10:00:00; a call at 10:05:00; a call at 10:15:00 with the sum unchanged; a call at 23:55:00 with the sum still over | 10:00: block written until 10:15:00, `AI_BUSY` 900; 10:05: `AI_BUSY` 600 without summing; 10:15: re-summed, blocked again until 10:30:00; 23:55: blocked until 00:00:00, `AI_BUSY` 300 | AD-64 decaying block | integration |
| E47 | F2 | Two `IN_FLIGHT` rows carrying reservations that take the sum over the cap; a `TIMEOUT` row with no token counts | the reservations count, so the next call is blocked; the `TIMEOUT` row keeps its reservation in the sum | The cap cannot be dodged by calls in flight or failures | integration |
| E11 | F2 | `hit` throws (database down) | `run` rejects with that error; no row; provider not called | Limiter fails closed | service |
| E12 | F1 | Mock mode and no response registered for the feature | throws `Error("NO_MOCK_RESPONSE")`; no row | A missing fixture fails visibly (a preview route returns 500) | service |
| E41 | F2 | Two conditions fail at once: invalid call and in a transaction; in a transaction and wrong role; wrong role and missing session; missing session and `AI_DISABLED`; `AI_DISABLED` and budget block; budget block and `hit` refusal; `hit` refusal and open breaker | the earlier step in api.md wins each pair: `INVALID_LLM_CALL`, `LLM_CALL_IN_TRANSACTION`, `ROLE_DENIED`, `NOT_FOUND`, `AI_DISABLED`, `AI_BUSY` without `hit`, `AI_BUSY` with the breaker untouched | Admission order is a contract | service |
| E42 | F2 | Session opened for project A, `run` with `projectId` B; session with null project and a non-null `projectId` | throws `Error("NOT_FOUND")`; no row | A session cannot be reused for another project | service |
| E43 | F2, F5 | Breaker open, `openUntil` passed, but `hit` refuses | `AI_BUSY`; `openUntil` unchanged (no probe is spent) | The probe is reserved only for an admitted call | service |

## Sessions
| ID | Requirement | Scenario | Expected behaviour (exact) | Why it matters | Test layer |
|---|---|---|---|---|---|
| E13 | F2, F6 | `run` or `assertUsable` with a missing session, another user's session, a session of another feature, or a session of another tier's `env` | throws `Error("NOT_FOUND")`; no row | Server-issued, owner-bound sessions (AD-19) | integration |
| E14 | F6 | Session closed; idle 30 min 1 s; idle 29 min 59 s; `touch` and `regenerate` on an `ABANDONED` session | closed -> `CONFLICT_STATE`; over 30 min -> outcome `ABANDONED`, `ended_at` = now, `CONFLICT_STATE`; under -> passes; `touch` changes nothing; `regenerate` throws `CONFLICT_STATE`, count unchanged | Inactivity rule | integration |
| E15 | F6 | 4th `OPEN` session for one feature (oldest `last_activity_at` 10 min ago); 21st session in one Singapore day; both caps at once; 3 open sessions of which one is idle 31 min | `SessionCapReached` 1200; `SessionCapReached` with seconds to Singapore midnight; the day cap wins; the idle one becomes `ABANDONED` and the new session opens | Caps (A-07) | integration |
| E16 | F6 | `close` twice with different outcomes; `close` with `OPEN`; `close` of a missing id; `close` with `actorId` `x` | second call changes nothing, first outcome kept; `Error("INVALID_OUTCOME")`; `Error("NOT_FOUND")`; `Error("INVALID_ACTOR")` | Idempotent close | integration |
| E26 | F6 | 6th `regenerate`; two concurrent `regenerate` calls at count 4 | `SessionCapReached` with 1800; exactly one fulfils, one rejects with `SessionCapReached`, the count ends at 5 | Regeneration cap | integration |
| E37 | F6 | Two concurrent `open` calls with 2 open sessions for the feature | the number of `OPEN` sessions afterwards is 3 or 4, never more | Bounded, accepted overshoot (count then insert) | integration |

## Provider failures
| ID | Requirement | Scenario | Expected behaviour (exact) | Why it matters | Test layer |
|---|---|---|---|---|---|
| E17 | F5 | 5 consecutive calls end `UPSTREAM_ERROR` or `TIMEOUT` | breaker opens at the 5th; `llm_breaker_open` logged once; the 6th call returns `AI_UNAVAILABLE` with no row and no provider call | Outage does not pile up | service |
| E18 | F5 | Sequences: fail x4, `SCHEMA_FAIL`, fail; fail x4, `OK`, fail; 60 s after opening a probe succeeds; a probe fails; a call with two failed attempts | opens on the 6th call (count 5); count 1 after the `OK`; probe success writes `{ 0, null }`; probe failure re-opens for 60 s and logs again; two attempts add 1 | Exact counting (A-12) | service |
| E19 | F5, F7 | 429 then 200; 429 twice; 429 then 5xx; 5xx then 200; 5xx twice | `OK`, `attempts` 2, a 2 s wait; `RATE_LIMITED`, `AI_UNAVAILABLE` with `callId`, `failureReason` `UPSTREAM_LIMIT`, breaker unchanged; `UPSTREAM_ERROR`, breaker +1; `OK`, no wait; `UPSTREAM_ERROR`, `attempts` 2, breaker +1 | Retry rule | service |
| E20 | F5, N5 | Provider never answers | status `TIMEOUT` when the fake clock reaches 20 s, not retried, `AI_UNAVAILABLE` | Function time limit | service |
| E21 | F5 | A 5xx at 17 s; at 17.1 s; a 429 at 15 s; at 15.1 s | 5xx at 17: retried with timeout 8 s; at 17.1: not retried; 429 at 15: waits 2 s, retried with timeout 8 s; at 15.1: not retried | Exact deadline arithmetic | service |
| E22 | F3 | A row left `IN_FLIGHT` with its lease passed; a call whose row was swept while its provider attempt ran | the next admitted `run` finalises it `TIMEOUT` (breaker untouched, reservation kept); the running call's finalise matches no row and it returns `AI_UNAVAILABLE` with its `callId` | Killed functions cleaned up when next read (architecture §10) | integration |
| E23 | F3 | Provider response without `usage` | tokens null on the row, cost stays the reservation; result tokens 0, `costMicroUsd` = the reservation | Missing usage does not break the call or the cap | service |
| E39 | F5 | SoCLaaS client: 401, 503, body without a string `choices[0].message.content`, fetch rejects, a 302 redirect, abort | `HTTP_5XX`, `HTTP_5XX`, `HTTP_5XX`, `NETWORK`, `NETWORK`, `TIMEOUT`; the request carries `Authorization: Bearer <key>` and `redirect: "error"`; `reasoning_effort` absent for `llama3.1:8b`, `none` for `qwen3.5:9b`; no `UpstreamError` has a `cause` | Provider mapping | unit |

## Output, guards and mock
| ID | Requirement | Scenario | Expected behaviour (exact) | Why it matters | Test layer |
|---|---|---|---|---|---|
| E24 | F4 | json output that is not JSON; JSON that fails the schema; text output empty or over `maxChars` code points | status `SCHEMA_FAIL`; `AI_UNAVAILABLE` with `callId`; breaker unchanged | Validated before return | service |
| E27 | F4 | Replacement guards: input returns changed text; input `blocked`; input `flagged`; output `refused` | the provider receives the changed text; `BLOCKED_INPUT` with `callId`, `attempts` 0, cost 0, provider not called, the four `hit` keys counted; success with `flagged: true` on result and row; `REQUEST_REFUSED`, status `REFUSED` | W3 plugs in without changing `run` | service |
| E45 | F1 | Live mode with a response registered; a mock `respond` throwing `UpstreamError` `HTTP_5XX`; a `respond` throwing `Error("secret")` | live mode never calls `respond`; `UPSTREAM_ERROR`; `UPSTREAM_ERROR` with the thrown error replaced by `MOCK_RESPONSE_FAILED` and "secret" absent from logs and results | The registry cannot affect live calls | service |
| E46 | N3 | The whole test suite with a spy on `globalThis.fetch` | the gateway's tests make no request | CI never calls SoCLaaS | service |
| E25 | N1 | Marker text in every section, a marker key, a marker in a provider error body, a marker in a value a zod schema rejects, through `OK`, `SCHEMA_FAIL`, `UPSTREAM_ERROR`, `TIMEOUT`, `RATE_LIMITED`, `BLOCKED_INPUT`, `REFUSED`, every admission refusal and every thrown error | markers absent from every `llm_calls` and `ai_sessions` column, every `console.log/info/warn/error/debug` call, every error message and every result | No text stored or logged | integration |

## Budget and accounting
| ID | Requirement | Scenario | Expected behaviour (exact) | Why it matters | Test layer |
|---|---|---|---|---|---|
| E28 | F3 | A non-static section over its own `budgetTokens`, including text with emoji (astral code points) | cut to the largest code-point prefix whose rendered estimate fits; no split surrogate; `truncated` true; `section_tokens` holds the fitted estimate | AD-17 | unit |
| E29 | F3 | Total over `maxPromptTokens`; two non-static sections with equal priority | highest `priority` number dropped first, the later of equal ones first; dropped sections show 0; static sections untouched | AD-17; rules cannot be pushed out | unit |
| E30 | N4 | A static section over its own budget; static sections together over `maxPromptTokens` | `assertStaticSectionsFit` and `run` throw `STATIC_SECTION_OVER_BUDGET:<name>` (the offending section; the last static one for the total); `run` writes no row and makes no `hit` | Static sections must fit | unit |
| E31 | F1, F3 | Successful call; then an `UPSTREAM_ERROR` call | row `OK`, `lease_expires_at` null, `prompt_version` = first 12 hex of `prefix_hash`, `experiment` `{ resultCache: false, llmMode }`, session `last_activity_at` = now; mock run twice gives identical value and tokens; the failed call leaves `last_activity_at` unchanged | Baseline | integration |
| E32 | F3 | Cost for 1,000 prompt and 333 completion tokens on `llama3.1:8b`; reservation for `DEV_STANDUP`; a model override from settings | `ceil(20 + 9.99)` = 30 µ$; reservation `ceil(4000 * 0.02 + 800 * 0.03)` = 104 µ$; the row's `model` is the override | AD-24 | unit |

## Usage
| ID | Requirement | Scenario | Expected behaviour (exact) | Why it matters | Test layer |
|---|---|---|---|---|---|
| E33 | F7 | Two users' sessions; a session started exactly at `to`; a page past the end; `size` 0 or 101; `page` -1 | only the caller's sessions, newest first; the one at `to` excluded; empty `items` with the real `total`; `RangeError`; `RangeError` | SELF scope; half-open range; paging convention | integration |
| E34 | F7 | Rows of two features and two models, one of another `env`, one exactly at `to` | one row per (feature, model) for this tier; the other `env` and the row at `to` excluded; `estimateErrorPercent` and `avgLatencyMs` match the formulas to 2 decimals; no user id in the output | Aggregate only | integration |
| E35 | F7 | `failureReason` for an `OK` call, an unknown id, and another user's `RATE_LIMITED` call | null for all three | Only the owner sees the reason | integration |

## Concurrency
| ID | Requirement | Scenario | Expected behaviour (exact) | Why it matters | Test layer |
|---|---|---|---|---|---|
| E36 | F5 | The breaker state is read then written without a lock | documented, not asserted under real concurrency: the service tests drive the state sequentially; a lost increment or a second probe is accepted (SD13) | No lock on the hot path | service |

## What could corrupt data
- A call finalised twice: the finalising update matches only `status = 'IN_FLIGHT'`, so a lease sweep racing the call's own finalisation leaves exactly one final status (E22).
- A session reopened: `close` and abandonment update only `outcome = 'OPEN'` rows (E16).
- Regeneration count above 5: one conditional update (E26).
- Prompt text in the database: no column accepts it; E25 checks every column.
- A row stuck `IN_FLIGHT` for an archived project: the gateway's client is unfiltered, so the sweep sees it (SD12).
