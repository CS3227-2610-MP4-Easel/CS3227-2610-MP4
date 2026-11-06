# Implementation Order

| Task | Outcome | Others rely on | Satisfies |
|---|---|---|---|
| T1 Settings and configuration | `loadGatewaySettings`, `config.ts` (features, models, limits), cost and token estimate | every later task | N2, N3 |
| T2 Transaction marker | `isInTransaction()` in `@agile/db`, set by its transaction helpers and the filtered client's callback `$transaction` | T6 | F2 (step 2) |
| T3 Providers and mock mode | `LlmProvider`, `UpstreamError`, mock registry and `createMockProvider`, `createSoclaasProvider` | T6; W3, W7-W9 register mocks | F1 |
| T4 Sessions | `createSessions` with caps, abandonment, `regenerate`, `SessionCapReached` | T6 | F6 |
| T5 Limiter and budget block | admission steps 8-9: budget block over `llm_calls` and `llm_gateway_state`, windows over `auth`'s `hit` (needs PR #10 merged) | T6 | F2 (steps 8-9) |
| T6 `run` | admission, guard slot, token budget, execution, breaker, row lifecycle, fake clock seam, `getLlmGateway()` | W3, W7-W9 | F2, F3, F4, F5, N1, N4, N5 |
| T7 Usage queries | `usageSessions`, `usageSummary`, `failureReason` | W15 | F7 |

| Task | Depends on | Can run concurrently with | Wave |
|---|---|---|---|
| T1 Settings and configuration | - | T2 | 1 |
| T2 Transaction marker | - | T1 | 1 |
| T3 Providers and mock mode | T1 | T4 | 2 |
| T4 Sessions | T1 | T3 | 2 |
| T5 Limiter and budget block | T1 | - | 3 |
| T6 `run` | T2, T3, T4, T5 | - | 4 |
| T7 Usage queries | T6 | - | 5 |

Notes:
- T5 waits for W4's PR #10 (external): merge `development` into this branch first. If it has not merged when T3 and T4 are done, T6's admission is built against a `hit` fake and T5 is wired in afterwards; the dependency stays.
- T3, T4 and T5 all add exports to `src/be/llm-gateway/src/index.ts`; serialize the edits to that one file.
- T2 edits W1's `@agile/db`; the Dev Lead reviews it in the PR (SD6).
- Mock mode first: T3 is the earliest task W3, W7, W8 and W9 can register against; its exports are stable from T3 on.
