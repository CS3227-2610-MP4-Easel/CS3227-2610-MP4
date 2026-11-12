# Conventions

Applies `conventions/general.md` (no model call in a transaction; never log prompt or response text; tests use the mock gateway; instants UTC, calendar days `Asia/Singapore`). New or applied-here rules below.

## Placement
- All gateway code lives in `src/be/llm-gateway` (`@agile/llm-gateway`), which depends on `@agile/contracts`, `@agile/db`, `@agile/auth` (for `hit`, AD-59; `rate_counters` stays `auth`'s table), `@prisma/client` and `zod`. It reads and writes only `ai_sessions`, `llm_calls` and `llm_gateway_state`.
- It uses an unfiltered `PrismaClient` for those three tables (SD12) and only Prisma model methods (`create`, `update`, `updateMany`, `aggregate`, `groupBy`, `findMany`, `findUnique`, `count`, `upsert`); no raw SQL and no typed SQL (guardrails), and no request-derived relation filter.
- `src/be/api` never imports `@agile/llm-gateway`; features call `run` and `Sessions` from their own modules.
- The configuration values below live in one module, `src/be/llm-gateway/src/config.ts` (SD4). Changing a number there is a code change with a test. A test checks `maxPromptTokens + maxTokens <= contextTokens` for every feature's default model.

## Tiers
Each tier (`local`, `dev`, `prod`, and the test database) has its own database and its own SoCLaaS key (AD-58: one dev key, one production key; previews run mock with no credentials, AD-53). So `rate_counters` keys and `llm_gateway_state` keys carry no tier prefix, and the spend cap is per tier, which for dev and prod is also per key. `env` on every row is still filtered, so evaluation runs tagged with another `env` are kept apart (AD-26).

## Settings
Validated by `loadGatewaySettings` when `getLlmGateway()` or `getSessions()` is first called. Errors name the setting, never its value. Values are case-sensitive and not trimmed.

| Setting | Values | Rule |
|---|---|---|
| `APP_TIER` | `local`, `dev`, `preview`, `prod`, `test` | required (same values as W4) |
| `LLM_MODE` | `mock`, `live` | unset = `mock` on `local`, `test`, `preview`; `test` and `preview` must not be `live`; `prod` must be `live`; `dev` must be set |
| `AI_ENABLED` | `true`, `false` | unset = `true` |
| `SOCLAAS_API_KEY` | non-empty, no whitespace | required when `LLM_MODE=live`; ignored in mock mode |
| `SOCLAAS_BASE_URL` | `https://soclaas-api.comp.nus.edu.sg/v1` exactly, or unset (= that value) | any other host, scheme, port, userinfo, query, fragment or trailing slash is invalid, so the key can only go to SoCLaaS |
| `LLM_MODEL_<FEATURE>` (e.g. `LLM_MODEL_DEV_STANDUP`) | a model id in § Models | unset = the feature's default |

## Features
| Feature | Allowed role | Default model | `maxTokens` | `maxPromptTokens` | `temperature` | `reasoningEffort` |
|---|---|---|---|---|---|---|
| `PM_PLAN_OUTLINE` | `PM` | `qwen3.5:9b` | 2000 | 6000 | 0.2 | `none` |
| `PM_PLAN_EXPAND` | `PM` | `llama3.1:8b` | 1500 | 4000 | 0.2 | `none` |
| `LEAD_DIGEST` | `DEV_LEAD` | `llama3.1:8b` | 1200 | 6000 | 0.2 | `none` |
| `DEV_SUMMARY` | `DEVELOPER` | `llama3.1:8b` | 600 | 4000 | 0.2 | `none` |
| `DEV_STANDUP` | `DEVELOPER` | `llama3.1:8b` | 800 | 4000 | 0.2 | `none` |

`reasoningEffort` is sent only when the model's record accepts that value.

## Models (capability records, AD-23a, AD-24)
| Model | `contextTokens` | accepts `reasoningEffort` | `tokenRatio` (code points per token) | price in / out (µ$ per million tokens) |
|---|---|---|---|---|
| `llama3.1:8b` | 65,536 | none (field omitted) | 4.0 | 20,000 / 30,000 |
| `qwen3.5:9b` | 65,536 | `none` | 3.7 | 100,000 / 150,000 |
| `gemma4:26b` | 131,072 | none (field omitted) | 3.7 | 60,000 / 300,000 |

Ratios come from the 2026-10-28 probe (4,725 tokens on `llama3.1:8b`, about 5,115 on the others for the same text). Every row stores the estimate beside the real count, and `usageSummary`'s `estimateErrorPercent` shows the drift; recalibrating is a config change by whoever runs the W17 experiments (AD-17 narrowed: no automatic calibration). Prices are the integration guide's; `GET /v1/models` is not read at runtime (AD-24 narrowed: no refresh path) (SD4).

## Token estimate and budget (AD-17)
- Estimate of a text = `ceil(code points / tokenRatio)` for the model in use. A section's estimate covers its rendered form (`## <name>`, newline, text).
- `STATIC` sections are never cut or dropped. If one exceeds its own `budgetTokens`, or the static sections together exceed the feature's `maxPromptTokens`, `assertStaticSectionsFit` and `run` (admission step 7, before any row) throw `Error("STATIC_SECTION_OVER_BUDGET:<name>")`, naming the first offending section, or the last static section when only the total is over.
- Each other section over its own `budgetTokens` has its text cut to the largest code-point prefix whose rendered estimate fits. Then, while the total exceeds `maxPromptTokens`, the non-static section with the highest `priority` number is dropped (ties: the later one in the list). Any cut or drop sets `truncated`; dropped sections show 0 in `section_tokens`.

## Cost (AD-24)
`cost = ceil(promptTokens * priceIn / 1,000,000 + completionTokens * priceOut / 1,000,000)`. A model without a record uses 260,000 / 900,000 (the guide's highest), so the estimate is never low. The reservation uses `maxPromptTokens` and `maxTokens`.

## Limits (AD-59, A-07, AD-64)
| Key | Window | Limit |
|---|---|---|
| `user:<userId>:min` | 60 s | 6 |
| `user:<userId>:day` | 86,400 s | 200 |
| `global:min` | 60 s | 25 |
| `global:day` | 86,400 s | 2,000 |
| Spend cap: sum of `cost_microusd` over this tier's `llm_calls` since the start of the UTC day | UTC day | 20,000,000 µ$ |

Budget block 15 minutes. Breaker: 5 failures, open 60 s, one probe. Lease 60 s. Attempt timeout 20 s; deadline 25 s; 429 backoff 2 s; retry needs 8 s left. Session inactivity 30 minutes. Session caps from `SESSION_CAPS` in `frozen.ts`.

The spend cap is soft: calls admitted at the same moment each see the sum before the others' reservations, so the day can overshoot by at most the reservations of the calls in flight at once (at most 25 a minute).

## Which day
| Rule | Day | Why |
|---|---|---|
| Spend cap and budget block | UTC day | SoCLaaS's own day is UTC (§12) |
| `rate_counters` day windows | 86,400 s from the window's first hit | AD-59's fixed windows; not a calendar day |
| Session day cap (20 a day) | Asia/Singapore day | a user-facing calendar day (`conventions/general.md`) |

## Errors
Request-path failures use the W1 convention: plain `Error("NOT_FOUND")` and `Error("CONFLICT_STATE")`, which `errorResponse` maps to 404 and 409; other thrown errors are programming errors and become 500. `SessionCapReached` is the one typed error; features map it to 429.

## Logging
The gateway logs only `console.warn("llm_breaker_open", { failures })` and `console.warn("llm_call_failed", { callId, status })` for `UPSTREAM_ERROR`, `TIMEOUT` and `RATE_LIMITED`. No text, key, model output, provider error, URL or header.

## Tests
- Unit and service tests build the gateway with `createLlmGateway`, a fake clock whose `sleep` advances `now` without waiting, and in-memory fakes for `db`, `hit` and the provider (the provider fake honours `timeoutMs` against the fake clock). Integration tests use real Postgres (`W1_INTEGRATION_DATABASE_URL`) with the same fake clock, so idle and lease times are set by the clock, not by back-dating rows.
- The test setup sets `LLM_MODE=mock` where unset (W4's `tests/setup-auth-env.ts` once PR #10 has merged; until then a W2 setup file imported the same way), so the process-wide gateway in the suite is always the mock. A suite-wide test spies on `globalThis.fetch` and asserts the gateway's tests make no request.
- Concurrency tests (E26, E37) run the calls with `Promise.all` against real Postgres; the conditional updates make the result deterministic.

## Threat list
| Actor | Abuse | Mitigation | Test |
|---|---|---|---|
| A user | Spends the shared key by calling an AI endpoint in a loop | per-user and global windows, spend cap with budget block | E8, E9, E10 |
| A few users | Use up the global windows so everyone else gets `AI_BUSY` | none beyond the per-user windows; accepted (Known Gap) | - |
| A user | Uses another user's session, a session of another feature or of another project | `assertUsable` checks owner, feature, state; `run` checks the session's project | E13, E14 |
| A user | Calls a feature their role may not use through some route | role check per feature in `run` | E4 |
| A user | Fills untrusted fields so the feature's rules are dropped from the prompt | static sections are never cut or dropped; features must put their rules in `STATIC` sections (handover) | E29 |
| A user | Puts text in a field to make the model leak its rules or the key | the key is never in a prompt; W3's guards; output validation | E24, E25 |
| A misconfigured deploy | Runs live calls from a preview or CI, or serves canned mock output in production | `test`/`preview` refuse `live`; `prod` refuses `mock` | E1, E2 |
| A poisoned setting | Points `SOCLAAS_BASE_URL` at another host to receive the key | the base URL must be the SoCLaaS URL exactly; redirects refused | E2, E39 |
| An outage | 5xx or timeouts make every request wait | breaker opens, rejections are immediate | E17, E18 |
| A user | Sends long inputs that time out to open the breaker for everyone | prompts are capped at `maxPromptTokens`; per-user window limits attempts to 6 a minute; accepted residual | E17 |
| A log reader | Reads prompts or the key from logs, rows or errors | nothing textual stored or logged; `UpstreamError` carries no provider detail | E25 |
