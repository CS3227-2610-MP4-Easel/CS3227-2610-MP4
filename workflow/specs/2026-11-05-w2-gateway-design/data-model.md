# Data Model

No schema change. The gateway reads and writes its three tables through one unfiltered `PrismaClient` (SD12): accounting must include rows of archived projects, which the filtered client hides and could leave `IN_FLIGHT` for ever. It never reads another module's table. W1's migration already created every table and enum W2 uses (`src/be/db/prisma/schema.prisma`: `AiSession`, `LlmCall`, `LlmGatewayState`, `RateCounter`; enums `Feature`, `SessionOutcome`, `LlmCallStatus`). No migration, no seed data, nothing to roll back.

## `llm_calls` (owned by `llm-gateway`)

One row per admitted call. Rejections at admission (F2) write no row. All timestamps come from the injected clock (api.md).

| Column | W2's value |
|---|---|
| `session_id`, `user_id`, `role`, `project_id`, `feature` | from the `LlmCall` |
| `env` | the `APP_TIER` value |
| `model` | the model used for the feature after the settings override |
| `prompt_version` | first 12 hex characters of `prefix_hash` (SD8) |
| `status` | written `IN_FLIGHT`; finalised to one of the statuses below |
| `created_at` | `clock.now()` at insert |
| `lease_expires_at` | created_at + 60 s while `IN_FLIGHT`; null once finalised |
| `prompt_tokens`, `completion_tokens`, `total_tokens` | from the provider's `usage` when present; in mock mode, the estimate and `ceil(code points / tokenRatio)`; null when the provider gave none |
| `attempts` | provider attempts made, 0 when the call ended before the provider (input blocked) |
| `latency_ms` | milliseconds from `created_at` to finalisation |
| `estimated_prompt_tokens` | conventions.md § Token estimate, over both assembled messages |
| `section_tokens` | JSON object, section name to estimated tokens after fitting; dropped sections have 0 |
| `prefix_hash` | SHA-256 hex of the system message (the static sections) |
| `input_hash` | from the `LlmCall` |
| `flagged` | from the input guard (default guards: false) |

`cost_microusd` is a `BigInt` column; values stay far below 2^53 and are converted with `Number()` for results and sums.
| `truncated` | true if any section was cut or dropped |
| `cost_microusd` | at insert, the reservation: the cost of `maxPromptTokens` prompt and `maxTokens` completion tokens at the model's price (conventions.md § Cost); at finalisation, the actual cost when the provider gave both token counts, otherwise the reservation stays (the provider may still have charged); 0 for `BLOCKED_INPUT` |
| `experiment` | `{ "resultCache": false, "llmMode": "mock" or "live" }` |

Status meaning and the result each gives:

| Status | When | `LlmResult` |
|---|---|---|
| `OK` | output passed the output guard | `ok: true` |
| `SCHEMA_FAIL` | output failed the default parse or schema check | `AI_UNAVAILABLE` |
| `UPSTREAM_ERROR` | 5xx or network error on the last attempt | `AI_UNAVAILABLE` |
| `TIMEOUT` | the last attempt timed out, or the lease expired before finalisation (a sweep `TIMEOUT` does not touch the breaker) | `AI_UNAVAILABLE` |
| `RATE_LIMITED` | SoCLaaS returned 429 on the last attempt (the last attempt decides: 429 then 5xx is `UPSTREAM_ERROR`) | `AI_UNAVAILABLE`; `failureReason` gives `UPSTREAM_LIMIT` |
| `REFUSED` | a replacement output guard returned `refused` | `REQUEST_REFUSED` |
| `BLOCKED_INPUT` | a replacement input guard returned `blocked` | `BLOCKED_INPUT` |
| `BUDGET_BLOCKED`, `CACHE_HIT` | not written by W2 (budget-block rejections write no row; the result cache is off) | - |

Lifecycle: `IN_FLIGHT` -> exactly one final status; a final status never changes. Never stores prompt text, response text, section text or the key (N1).

## `ai_sessions` (owned by `llm-gateway`)

| Column | W2's value |
|---|---|
| `feature`, `user_id`, `project_id` | from `open` |
| `env` | `APP_TIER` |
| `started_at`, `last_activity_at` | set by `open`; `last_activity_at` updated by `touch`, `regenerate` and every `OK` call |
| `outcome`, `ended_at` | `OPEN`, null until closed |
| `regenerate_count` | 0 to 5 |
| `feedback` | not written by W2 (W9's endpoint 54) |

State machine: `OPEN` -> `ACCEPTED` / `EDITED` / `REJECTED` / `ABANDONED` (by `close`), or `OPEN` -> `ABANDONED` when read with `last_activity_at` older than 30 minutes. A closed session never changes. Rows are never deleted.

## `llm_gateway_state` (owned by `llm-gateway`)

Two rows: key `breaker`, value `{ "failures": int, "openUntil": ISO-8601 instant or null }`; key `budget`, value `{ "blockedUntil": ISO-8601 instant or null }` (AD-64). A missing row means the zero value.

## `rate_counters` (owned by `auth`)

W2 does not touch the table; it calls `auth`'s `hit(key, windowSeconds, limit)` -> `{ allowed, retryAfterSeconds }` with the keys in conventions.md § Limits. Keys carry no tier prefix because each tier has its own database (conventions.md § Tiers).

## Architecture areas changed
- `architecture/llm-gateway.md` - Now and Paths: the gateway runtime, mock mode, sessions and usage queries are built; guards still W3; `ai-context` still W6.
- `architecture/foundation.md` - `@agile/db` exposes `isInTransaction()` (SD6).
- Architecture §5's `llm_gateway_state` row already names breaker and budget-block state; no change.
