# Architecture — LLM gateway and AI context

> Legend: `C` = project decision. `AD-nn` = architecture decision, recorded in [decision-log.md](../../../docs/architecture/decision-log.md). This area's **Now** is replaced wholesale when a branch changes it; the decisions table only grows.

## Now

Nothing built yet *(planned)*. Every model call goes through `LlmGateway.run`; the browser never calls SoCLaaS and the key never enters a prompt. Untrusted text passes the full pipeline (sanitise, boundary, flag, output validation). Limits come from `rate_counters`. `llm_calls` never stores prompt or response text. Mock mode is the CI default (CI never calls the live service).

## Paths

| Path | Role |
|---|---|
| `packages/llm-gateway (planned)` | guards, limiter, SoCLaaS client, model records, mock mode, llm_calls, ai_sessions |
| `packages/ai-context (planned)` | the one membership-scoped context-assembly function |

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

## Target Link and Drift

Realises [architecture §7, §12, contracts.md §5](../../../docs/architecture/agile-platform-architecture.md); work package C (guards), D (runtime), F (usage), J (ai-context) in [delivery-plan.md](../../../docs/architecture/delivery-plan.md). Drift: none known (nothing is built).
