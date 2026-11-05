# Branch State — w2-gateway

**What this branch has changed, and how to pick it up.** `workflow/project-state/STATE.md`
describes `INT`; read it for context and write here instead of editing it.
`sync-project-state` folds this file in after the branch merges.

- **Branch:** w2-gateway (from `INT` at `7bd6544`; `development` merged in at `dc55769` after W4 and W12 merged, and at `e568668` after the W12 policy PR #13)
- **Base:** 94ebc77
- **Owner:** ludannnn (Developer member)
- **Status:** Approved
- **Approved:** ludannnn 2026-11-05
- **Last updated:** 2026-11-06 by Claude Opus 5.5 — merged `development` (policy PR #13); PR into `development` not opened yet

**Untouched:** Conventions

---

**Scope.** W2 Gateway runtime and mock: `LlmGateway.run`, `Sessions`, mock mode, the SoCLaaS client and the usage queries in `src/be/llm-gateway`. Mock mode first, because W3, W7, W8 and W9 build against it. W4 is merged, so the limiter is available.

---

## 1. How to Resume

**Sessions**

| Session | Started | Agent(s) | Workstream | Status | Doing | Next action | Last touched |
|---|---|---|---|---|---|---|---|


**Remaining**

- [x] Spec review (Implementer, Tester, Maintainer, Attacker): findings fixed.
- [x] Gate 1: spec approved by ludannnn on 2026-11-05.
- [x] Gate 2: plan approved by ludannnn on 2026-11-05.
- [x] Merge `development` into this branch after W4's PR #10 merged (`dc55769`).
- [x] Build T1 to T7, then close-out (Attacker and Tester lenses; findings fixed or recorded below).
- [x] Gate 3: operator approved the branch (ludannnn, 2026-11-05).
- [ ] GATE: operator pushes `w2-gateway` and opens the PR into `development`, on a separate yes.
- [ ] **Handover:** W15 calls `usageSummary` with a date range (it reads every matching row to compute the means) and gates endpoint 57 by role; both usage queries take `settings.tier`.
- [ ] **Handover:** the endpoints that call `Sessions.open` check the caller's project membership, and those that call `close` check owner or approver (SD11); `Sessions` does neither.
- [ ] **Handover:** the W2 integration tests skip without `W1_INTEGRATION_DATABASE_URL`, and W12's CI does not set it; whoever owns CI should give it a Postgres 16 so they run there.
- [x] Agent policy narrowed on its own branch, `w12-agent-policy-scope` (operator's decision; its C~1), merged as PR #13; the uncommitted local copies were discarded and `development` merged in (`e568668`, C~2).
- [ ] **Handover:** W15 owns endpoints 56 and 57 and their resolvers; W1's handover listed "session and usage" resolvers under W2 (spec SD3).
- [ ] **Handover:** W7, W8 and W9 register their mock responses with `registerMockResponse` at import of their module, put their rules in `STATIC` sections (non-static sections can be dropped when the prompt is over budget), and call `assertStaticSectionsFit` in a test.
- [ ] **Handover:** tell the PM and Dev Lead in the W2 PR that `createSessions` adds `regenerate` beside the frozen `Sessions` type (spec SD10), and that `Sessions.close` leaves the owner-or-approver check to their endpoints (SD11).
- [ ] **Handover:** W13 sets `LLM_MODE`, `SOCLAAS_API_KEY` (dev and prod keys differ, AD-58) and, if SoCLaaS is unreachable from Vercel, `AI_ENABLED=false` per tier.
- [ ] **Handover:** since the Prisma 7 merge, `npm test` (its `pretest` runs `prisma generate`) fails without `DATABASE_URL` set; tell the team to export it locally.

---

## 2. Workstreams

| ID | Workstream | Status | Spec | Plan | Progress | Guide |
|---|---|---|---|---|---|---|
| W2 | Gateway runtime and mock | In review | [spec](../../specs/2026-11-05-w2-gateway-design.md) | [plan](../../plans/2026-11-05-w2-gateway.md) | T1–T7 done; approved at Gate 3; `development` merged; PR not opened | guide out of date: llm-gateway |

---

## 3. Changes

| Date | What changed | Workstream | Ref |
|---|---|---|---|
| 2026-11-06 | Merged `development` (W12 agent policy PR #13) into the branch after discarding the uncommitted policy copies; 305 tests, 304 pass, 1 fails (D~1), none skipped | W2 | e568668 |
| 2026-11-05 | Close-out: Attacker and Tester lenses on the branch diff, no blocking findings. Fixed: the SoCLaaS timeout now covers the response body, bodies over 1 MB and absurd token counts are refused; a throw after the row is written finalises it `UPSTREAM_ERROR` and leaves only `LLM_CALL_FAILED`; internal (non-upstream) errors no longer count towards the breaker (D~2); the budget sum gets an upper bound on the UTC day (a real bug: later-dated rows counted, which also let parallel test files block each other); the gateway's settings no longer carry the key; usage queries refuse invalid dates and pages over 10,000; tests added for timeouts and network failures counting, early-retry timeouts, static over budget at `run`, model override and reasoning effort, live mode without a mock, exact `maxChars`, the Singapore-day edge, `from` inclusive, a lease ending exactly now, and E22 with an isolated breaker row; E25 gained five admission paths. 301 tests, 297 pass, 4 fail (same as T5), none skipped, run twice | W2 | 26ec4f8 |
| 2026-11-05 | T7: `usage.ts`: `usageSessions` (caller's sessions in this tier, `[from, to)`, newest first, per-session call sums, paging with `RangeError` on bad page or size), `usageSummary` (per feature and model, no user data, means rounded to 2 decimals), `failureReason` (owner-only `UPSTREAM_LIMIT`); both usage queries take the tier as an argument; 3 integration tests; 294 tests, 290 pass, 4 fail (same as T5), none skipped | W2 | ae5ec76 |
| 2026-11-05 | T6: `createLlmGateway` (`run`: ten admission steps in spec order, lease sweep, input guard, fit, `IN_FLIGHT` row with a cost reservation, one retry within the 25 s deadline, output guard, guarded finalise, session touch, breaker), `guards.ts` (default guards), `breaker.ts`, `runtime.ts` (`getLlmGateway`, `getSessions`); 20 service tests over in-memory fakes and 5 integration tests including the E25 leak check across seven statuses; 291 tests, 287 pass, 4 fail (D~1 and the three old W12 hook tests, as at T5), none skipped | W2 | 6f1cb13 |
| 2026-11-05 | T5: `limits.ts`: `checkBudget` (AD-64 decaying block in `llm_gateway_state`, UTC-day sum including in-flight reservations and failed calls, 15 minutes or UTC midnight) and `checkWindows` (four AD-59 windows over `auth`'s `hit`, stopping at the first refusal); 2 integration and 4 unit tests; 265 tests, 261 pass, 4 fail (D~1 and three old W12 hook tests failing only against the uncommitted new hook), none skipped | W2 | 85ed506 |
| 2026-11-05 | T4: `createSessions` (open with idle abandonment, Singapore-day and open-per-feature caps, `assertUsable`, `touch`, idempotent `close`, conditional `regenerate`) and `SessionCapReached`; all times from the injected clock, all queries limited to the tier's `env`; 6 integration tests on Postgres; 259 tests, 258 pass, 1 fails (D~1), none skipped | W2 | 7c7a338 |
| 2026-11-05 | T3: `providers.ts`: `LlmProvider`, `UpstreamError` (kind and status only), the process-wide mock registry (`registerMockResponse`, `hasMockResponse`), `createMockProvider` (estimated tokens, foreign errors become `MOCK_RESPONSE_FAILED`), `createSoclaasProvider` (key only to the pinned URL, `redirect: "error"`, abort timeout); 253 tests, 252 pass, 1 fails (D~1), none skipped | W2 | 648ddf5 |
| 2026-11-05 | T2: `isInTransaction()` in `@agile/db` (new `transaction-scope.ts`, an `AsyncLocalStorage` entered by `inCoreTransaction`, `inMutationTransaction` and the filtered client's callback `$transaction`); W1 files, for the Dev Lead to review (SD6); 248 tests, 247 pass, 1 fails (D~1), none skipped | W2 | c85f739 |
| 2026-11-05 | T1: `loadGatewaySettings` (tier rules, exact SoCLaaS URL, model overrides), `config.ts` (features, models, limits), token estimate, cost and reservation, section fitting, `assertStaticSectionsFit`, fake clock; `tests/setup-auth-env.ts` defaults `LLM_MODE=mock` and blocks requests to SoCLaaS; 246 tests, 245 pass, 1 fails (D~1), none skipped | W2 | b55aeed |
| 2026-11-05 | Plan written (T1 to T7, close-out), reviewed (Implementer lens: no blocking, 9 minor, all fixed), updated after merging `development` (W4 merged, Prisma 7 adapter, test runner through `tests/setup-auth-env.ts`, W12 agent policy) and approved at Gate 2 | W2 | c37ff6e |
| 2026-11-05 | Merged `development` (W4 PR #10, W12 PR #9) into the branch | W2 | dc55769 |
| 2026-11-05 | Spec approved at Gate 1 by the operator | W2 | efdb802 |
| 2026-11-05 | W2 spec drafted (7 F, 5 N, T1 to T7) and reviewed by four lenses: 5 blocking findings fixed (row written before its columns exist, fit failures leaving rows, static-section rule conflict, no clock seam, breaker race unstated); the spend cap reworked to keep AD-64's decaying budget block; the key restricted to the SoCLaaS host; 47 edge cases; lint clean | W2 | a40f7f8 |

---

## 4. Architecture

> Legend: `C` = project decision. AD-nn entries are in docs/architecture.

### 4.1 LLM gateway and AI context (`architecture/llm-gateway.md`)

**Now (proposed):** `src/be/llm-gateway` (`@agile/llm-gateway`) is built except the guards (W3) and `ai-context` (W6). `getLlmGateway().run(call)` is the one path for every model call. It admits a call by checking, in order, the call shape, that no `@agile/db` transaction is open, the caller's role for the feature, the session (owner, feature, open, project), `AI_ENABLED`, the mock registration, that the feature's static sections fit, the AD-64 budget block (the tier's UTC-day `cost_microusd` against a 20,000,000 µ$ cap, blocking for 15 minutes or until UTC midnight), the four AD-59 windows through `auth`'s `hit`, and the breaker. An admitted call sweeps expired leases, runs the input guard, fits the sections to the token budget (AD-17), writes an `llm_calls` row `IN_FLIGHT` with a lease and a cost reservation, calls the provider with one retry inside a 25-second deadline, runs the output guard, and finalises the row only if it is still `IN_FLIGHT`. No prompt, response, section text or key is stored or logged. The provider is the deterministic mock (`registerMockResponse` per feature) or SoCLaaS, chosen by `LLM_MODE`; `test` and `preview` must be mock and `prod` must be live, and the key goes only to the exact SoCLaaS URL with redirects refused. `getSessions()` issues and checks AI sessions (AD-19) with the contracts §5.3 caps and a 30-minute inactivity rule, plus `regenerate` for the five-regeneration cap. `usageSessions`, `usageSummary` and `failureReason` serve W15. Model records, prices and limits are one configuration module (`config.ts`); every time comes from an injectable clock. The guard slot passes input through and only parses and schema-checks output until W3 fills it.

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

| ID | Date | Decision | Why / who asked | Source |
|---|---|---|---|---|
| C~1 | 2026-11-05 | Scope boundaries and starting values | Operator accepted the proposed assumptions | spec SD1 to SD6 |

Drift: AD-24's price refresh and AD-17's automatic ratio calibration are not built (spec SD4); the guards are W3's.

### 4.2 Foundation (`architecture/foundation.md`)

**Now (proposed, addition only):** `src/be/db` also exposes `isInTransaction()`, true inside `inCoreTransaction`, `inMutationTransaction` and the filtered client's callback `$transaction`, so the gateway can refuse a model call inside a transaction (spec SD6). The rest of the area's Now is unchanged by this branch.

---

## 6. Known Gaps

New entry:

- **A few users can use up the global AI windows** — the per-user windows (6 a minute, 200 a day) limit each user, but four or five active users can exhaust `global:min` (25 a minute) and everyone else gets `AI_BUSY` until the window resets; there is no per-project share. A call refused by the breaker has already counted against the windows.
- **AI session caps and the spend cap are soft** — `Sessions.open` counts then inserts, so concurrent opens can pass both the open-per-feature and the daily cap (bounded by how many arrive at once); calls admitted together each see the spend sum before the others' reservations (bounded by `global:min`).

## 7. Decisions

> Legend: `C` = project decision. AD-nn entries are in docs/architecture.

### C~1 — W2's scope boundaries and starting values

- **Date:** 2026-11-05
- **Who asked:** operator (ludannnn, Developer member), accepting the assumptions proposed before the spec ("im ok")
- **Decision:** W2 builds the whole `run` path with a guard slot W3 fills (spec SD1); feature owners register their own mock responses (SD2); usage endpoints and their resolvers belong to W15 (SD3); model records, prices and limits are a configuration module (SD4); `LLM_MODE` selects mock or live (SD5); `@agile/db` marks its transactions so `run` can refuse inside one (SD6). Starting values: 6 per user and 25 global per minute, 200 per user and 2,000 global per day, a 20,000,000 µ$ daily spend cap, breaker at 5 failures for 60 s, 20 s attempt timeout, 30-minute session inactivity.
- **Why:** W3, W7, W8 and W9 need a working gateway and mock now; the numbers follow MP3's values and the shared key's limits.
- **Rejected:** W2 waiting for W3's guards; W2 writing feature mock responses; a capability table with a migration.

### C~2 — Under the W12 agent policy, the operator runs git and places workflow files

- **Date:** 2026-11-05
- **Who asked:** operator (ludannnn), after W12's agent hook (`scripts/agent-pre-tool-hook.mjs`, `workflow/agent-permissions.json`) began denying the agent's shell writes, `node` scripts, commands naming `DATABASE_URL`, and edits under `workflow/`
- **Decision:** the agent edits `src/` and `tests/` and runs `npm test`, `npm run typecheck` and `npm run lint`; it drafts `workflow/` files in the git-ignored `.ws/` folder; the operator copies them into place and runs `git add`/`git commit`, `npm install` and `docker`. The policy itself is unchanged.
- **Why:** the policy is a team control just merged in W12; changing or bypassing it is not this branch's call.
- **Rejected:** disabling hooks locally (sidesteps a team control); editing the policy on this branch (W12 owner's file, review required).
- **Superseded (2026-11-06):** the operator narrowed the policy on `w12-agent-policy-scope`, merged as PR #13. The agent now commits and writes `workflow/` records; the operator still pushes and writes the process-control files.

## 8. Deviations

- **D~1 — A W1 integration test fails under Prisma 7, left failing on purpose (T1):** `src/be/db/test/visibility-integration.test.ts:10` builds `new PrismaClient({ datasourceUrl: url })`, an option Prisma 7 removed, so it fails with "Unknown property datasourceUrl" whenever `W1_INTEGRATION_DATABASE_URL` is set. CI sets no database, so it skips there; the Prisma 7 merge (`9077725`) updated W4's tests but not this one. Not caused by W2. The operator chose to leave it failing (2026-11-05); the fix is the `PrismaPg` adapter pattern W4's tests use. Consequence: `npm test` with a database shows 1 failure on this branch until W1's owner fixes it.
- **D~2 — Internal errors do not count towards the breaker (close-out):** spec api.md § Breaker update says every call ending `UPSTREAM_ERROR` adds one. A provider error that is not an `UpstreamError` (for example a mock that throws, or a bug) is still recorded as `UPSTREAM_ERROR` but no longer counts, because the Attacker review showed one user's input could otherwise trip the breaker for everyone. Real 5xx, network and timeout failures still count.
- **D~3 — Small interface adaptations (T6, T7):** `createLlmGateway` takes two extra optional seams, `mockResponses` and `stateKeyPrefix` (test isolation); `usageSessions` and `usageSummary` take the tier as an explicit argument; `run` throws `LLM_CALL_FAILED` (row finalised `UPSTREAM_ERROR`) when something throws after its row is written, a case the spec did not list. No frozen interface changed.
