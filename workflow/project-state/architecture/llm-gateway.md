# Architecture — LLM gateway and AI context

> Legend: `C` = project decision. `AD-nn` = architecture decision, recorded in [decision-log.md](../../../docs/architecture/decision-log.md). This area's **Now** is replaced wholesale when a branch changes it; the decisions table only grows.

## Now

`src/be/llm-gateway` (`@agile/llm-gateway`) is built except the guards (W3) and `ai-context` (W6). `getLlmGateway().run(call)` is the one path for every model call. It admits a call by checking, in order, the call shape, that no `@agile/db` transaction is open, the caller's role for the feature, the session (owner, feature, open, project), `AI_ENABLED`, the mock registration, that the feature's static sections fit, the AD-64 budget block (the tier's UTC-day `cost_microusd` against a 20,000,000 µ$ cap, blocking for 15 minutes or until UTC midnight), the four AD-59 windows through `auth`'s `hit`, and the breaker. An admitted call sweeps expired leases, runs the input guard, fits the sections to the token budget (AD-17), writes an `llm_calls` row `IN_FLIGHT` with a lease and a cost reservation, calls the provider with one retry inside a 25-second deadline, runs the output guard, and finalises the row only if it is still `IN_FLIGHT`. No prompt, response, section text or key is stored or logged. The provider is the deterministic mock (`registerMockResponse` per feature) or SoCLaaS, chosen by `LLM_MODE`; `test` and `preview` must be mock and `prod` must be live, and the key goes only to the exact SoCLaaS URL with redirects refused. `getSessions()` issues and checks AI sessions (AD-19) with the contracts §5.3 caps and a 30-minute inactivity rule, plus `regenerate` for the five-regeneration cap. `usageSessions`, `usageSummary` and `failureReason` serve W15. Model records, prices and limits are one configuration module (`config.ts`); every time comes from an injectable clock. The guard slot passes input through and only parses and schema-checks output until W3 fills it.

## Paths

| Path | Role |
|---|---|
| `src/be/llm-gateway/src/gateway.ts` | `createLlmGateway`: admission, execution, row lifecycle |
| `src/be/llm-gateway/src/settings.ts`, `config.ts` | settings per tier; features, models, prices, limits |
| `src/be/llm-gateway/src/budget.ts` | token estimate, section fitting, cost and reservation |
| `src/be/llm-gateway/src/providers.ts` | mock registry and provider, SoCLaaS provider, `UpstreamError` |
| `src/be/llm-gateway/src/sessions.ts` | `createSessions`, `SessionCapReached` |
| `src/be/llm-gateway/src/limits.ts`, `breaker.ts` | budget block, windows, breaker |
| `src/be/llm-gateway/src/guards.ts` | the guard slot and W2's default guards |
| `src/be/llm-gateway/src/usage.ts` | usage queries for endpoints 56-57 |
| `src/be/llm-gateway/src/runtime.ts` | `getLlmGateway`, `getSessions` |
| `src/be/ai-context (planned)` | the one membership-scoped context-assembly function (W6) |

## Decisions

Architecture decisions that shaped this area (`AD-nn`, full reasoning in the decision log). Project decisions (`C<n>`) are added here when they land.

| ID | Date | One-line decision | File |
|---|---|---|---|
| AD-04 | 2026-10-29 | Port the MP3 gateway to a TypeScript package | [decision-log](../../../docs/architecture/decision-log.md) |
| AD-16 | 2026-10-29 | DB-backed limiter that rejects fast (mechanism amended by AD-59) | [decision-log](../../../docs/architecture/decision-log.md) |
| AD-17 | 2026-10-29 | Per-feature context sections with token budgets | [decision-log](../../../docs/architecture/decision-log.md) |
| AD-24 | 2026-10-29 | llm_calls.cost_microusd estimate | [decision-log](../../../docs/architecture/decision-log.md) |
| AD-25 | 2026-10-29 | Full untrusted-text pipeline; one membership-scoped context function | [decision-log](../../../docs/architecture/decision-log.md) |
| AD-26 | 2026-10-29 | Four test layers; CI never calls the live service | [decision-log](../../../docs/architecture/decision-log.md) |
| C27 | 2026-11-05 | W2's scope boundaries and starting values | [C27](../decisions/C27.md) |

## Target Link and Drift

Realises [architecture §7, §12, contracts.md §5](../../../docs/architecture/agile-platform-architecture.md); work package C (guards), D (runtime), F (usage), J (ai-context) in [delivery-plan.md](../../../docs/architecture/delivery-plan.md). Drift: AD-24's price refresh and AD-17's automatic ratio calibration are not built (W2 spec SD4); the guards are W3's. See [D6](../deviations/D6.md), [D7](../deviations/D7.md).
