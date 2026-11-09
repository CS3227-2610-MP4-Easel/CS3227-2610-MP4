# Branch State — w9-dev-slice

**What this branch has changed, and how to pick it up.** `workflow/project-state/STATE.md`
describes `INT`; read it for context and write here instead of editing it.
`sync-project-state` folds this file in after the branch merges.

- **Branch:** w9-dev-slice (from `INT` at `dc3447f`)
- **Base:** 3519ff0
- **Owner:** ludannnn (Developer member)
- **Status:** Draft
- **Approved:** —
- **Last updated:** 2026-11-09 by Claude Opus 5.5 — merged `development` (W5, W4 sign-in); spec amended, re-approval pending

**Untouched:** Architecture, Conventions, Deviations

---

**Scope.** W9 Developer upload, summaries and standup, backend only: endpoints 49-52 and 55 (architecture §9.4), the `src/be/dev` package, the `dev.activityItems` and `dev.itemSummaries` context sources, the DEV_SUMMARY and DEV_STANDUP mocks, and the dev resource resolvers. The S20 and S18 screen wiring is a follow-up (C~1). W5 (PR #23) is open: the spec is written now, while building waits for W5 to merge (C~4).

---

## 1. How to Resume

**Sessions**

| Session | Started | Agent(s) | Workstream | Status | Doing | Next action | Last touched |
|---|---|---|---|---|---|---|---|
| S2 | 2026-11-09 | Claude Opus 5.5 (lead) | W9 | Active | Executing the W9 plan (`executing-plans-lite-v2`), orchestrator; waves 1-2 done | Dispatch wave 3 (T4, T5, T6) | 2026-11-09 |

**Remaining**

- [x] Gate 1: W9 spec approved by ludannnn on 2026-11-08 (one review round, four lenses).
- [x] Check PR #23 fixes 3 and 4 against the spec (2026-11-09): fix 3 matches; fix 4 shipped `inMutationTransaction`, so § 4.6 and SD16 are amended (C~7).
- [x] Re-approval of the 2026-11-09 spec amendments (§ 4.1, § 4.6, F8, SD11, SD16): approved by ludannnn on 2026-11-09.
- [x] Gate 2: W9 plan approved by ludannnn on 2026-11-09 (10 tasks, 6 waves, full review each).
- [ ] **Handover:** to the Dev Lead (W5): W9 adds an export of `lockProjectForMutation` to `src/be/core/src/index.ts` (C~8); its no-op `version: { increment: 0 }` update bumps `projects.updated_at` (`@updatedAt`) on every task, checkpoint, membership and now W9 write. When member removal (endpoint 11) and project archive are built, they must update the project row (`lockProjectForMutation`) so they serialise with W9's writes; W9's seam reads membership through core's `requireMember`, which does not take the transaction.
- [ ] **Handover:** contracts.md rows 50 and 51 list fewer errors than W9 returns (`RATE_LIMITED`, `AI_DISABLED`, 422 for `BLOCKED_INPUT`, 404, 409); add them as a clarification (they follow architecture §8 and the W3 handover).
- [ ] **Handover:** tell W17 that `CACHE_HIT` rows now exist for DEV_SUMMARY and DEV_STANDUP (spec SD13); summary hits have a null `session_id`.
- [ ] **Handover:** S20 (Upload and standup) and S18 (Team standups) wiring to the live API is a Medium follow-up spec (C~1); the browser must cut bodies over 2000 characters instead of rejecting them (spec SD on truncation).

---

## 2. Workstreams

| ID | Workstream | Status | Spec | Plan | Progress | Guide |
|---|---|---|---|---|---|---|
| W9 | Developer upload, summaries, standup | Building | [spec](../../specs/2026-11-08-w9-dev-slice-design.md) (approved 2026-11-08, amended 2026-11-09) | [plan](../../plans/2026-11-09-w9-dev-slice/plan.md) (approved 2026-11-09) | Wave 3/6: T4, T5, T6 next; T1-T3 done | — |

---

## 3. Changes

| Date | What changed | Workstream | Ref |
|---|---|---|---|
| 2026-11-08 | Branch state created; W9 spec written, reviewed (four lenses) and approved | W9 | `6148492` |
| 2026-11-09 | Merged `development` at `3519ff0` (W5 PR #23, W4 sign-in PR #25), no conflicts; Base moved | W9 | `6334f78` |
| 2026-11-09 | Spec checked against W5's merged code and amended: writes run in `inMutationTransaction` with W9's own `FOR SHARE` lock (SD16); wiring is two lines in `app.ts` (SD11); F8's boot test also covers the core sources; W7 runtime reference dropped (C~7) | W9 | `365f001` |
| 2026-11-09 | Plan path check found the filtered client drops raw SQL, so the `FOR SHARE` lock cannot run; SD16 and § 4.6 amended to W5's exported `lockProjectForMutation` (C~8, L~1) | W9 | `ebdb865` |
| 2026-11-09 | Plan drafted: 10 tasks in 6 waves, all full review; plan-level choices P1 (`RouteDefinition.bodyLimitBytes`, since handlers get no raw `Request`), P2 (any-integer `n` so E65 holds), P3 (ISO timestamp in the item hash), P4 (summary cache-hit hash); lint clean | W9 | plan folder |
| 2026-11-09 | Plan review round 1 (Implementer lens): 1 blocking (`AI_BUSY` details must be the envelope's `{ field, message }[]`, P5), 6 should-fix (same-wave execution rule, registry resets in tests, E44 assertion, stale task references, upsert is not native so the lock is the guarantee (P6), retry-safe `mutate`), 7 nits; all applied; lint clean | W9 | plan folder |
| 2026-11-09 | Plan approved at Gate 2; baseline before T1: typecheck green, `npm test` 562/562 (Postgres ran, 0 skipped) + fe 149/149. Wave 1 run one task after another in the main checkout (branch unpushed, so worktrees from the remote base would miss it) | W9 | `a15242f` |
| 2026-11-09 | T1 done: `standupActivityWindowFor` (contracts now re-exports `date-rules.js`), `body-limit.ts` (auth.ts uses it), `RouteDefinition.bodyLimitBytes` read after authorization, `lockProjectForMutation` exported. Full review: no blocking; round 1 fixed content type checked before the limited read, BOM stripped (TextDecoder), header-path, `bodyTooLarge` and route 413/400/422 tests; round 2 approved. Rejected nits: invisible BOM literal in a test, extra rollback assertions, stream-cancel memory test, Mon-Thu loop for E23 | W9 | `7e008d9` |
| 2026-11-09 | T2 done: `GatewaySessions.openOrReuse` (newest usable OPEN session for user, feature, project and tier, else `open`), `recordCacheHit`/`createCacheHits` (one `CACHE_HIT` row; validates ids, role and hex hashes; a non-null session must belong to the caller, tier and feature). Full review round 1 fixed: catch only NOT_FOUND/CONFLICT_STATE, `projectId ?? null`, session ownership and input validation, API key no longer captured by the cache-hit writer, non-DB reuse tests, cap/ordering/preview/limiter tests; round 2 approved. Rejected: tie `recordCacheHit`'s `projectId` to the session's (W9 callers pass the authorised path project and the session opened for it; recorded for T7/T8), recording on closed sessions (harmless), preview Proxy `then` trap, three test nits; concurrent `openOrReuse` race (soft-cap Known Gap), no rate limit on cache-hit rows (routes sit behind the AI windows), reuse just under the idle cutoff, absolute session age | W9 | `9ec8195` |
| 2026-11-09 | Wave 1 check: typecheck green, `npm test` 592/592 (0 skipped) + fe 149/149, plan lint clean | W9 | wave 1 |
| 2026-11-09 | T3 done: `@agile/dev` package (wired into api), `gateway-binding.ts`, `inDevWrite`/`assertDevWriteAllowed` (W5 lock, P2025→CONFLICT_STATE, then ACTIVE check, then membership). Full review: no blocking; round 1 tightened the seam tests (rethrow identity, NOT_FOUND branch, missing project, rollback/attempt counts, lock target). Rejected: passing `tx` to `requireMember` (frozen `Core`; no member-removal or archive path exists yet, handover), NOT_FOUND vs CONFLICT_STATE probing (spec: archived beats non-member; middleware 404s non-members first), lock before authorisation (same as W5), `registerMockResponse` in the binding (spec § 4.1; read only in mock mode) | W9 | `324da17` |
| 2026-11-09 | Wave 2 check: typecheck green, `npm test` 602/602 (0 skipped) + fe 149/149 | W9 | wave 2 |

---

## 6. Known Gaps

- **Upload storage is unbounded** — endpoint 49 has no per-user rate limit or row cap and activity items are never deleted; spend is bounded by the session caps and AI windows, storage is not.
- **A regeneration or summary retry can spend a session without storing anything** — `regenerate` counts before `run`, so a busy or refused standup call uses one of the five regenerations and stores nothing.
- **Concurrent W9 writes to one project can exhaust the transaction retries** — writes queue on the project-row lock and each waiter is retried after a serialization error; `inMutationTransaction` allows 3 attempts, so four or more simultaneous uploads, summary inserts or standup writes on one project can return 500 (plan P6).
- **A Developer on four or more projects can hit the 3-open DEV_STANDUP cap** — W9 leaves standup sessions open for W16's edit and accept (53, 54), so a fourth standup within 30 minutes gets 429 `RATE_LIMITED`.

---

## 7. Decisions

> Legend: `C` = project decision. AD-nn entries are in docs/architecture.

### C~1 W9 is backend only; screen wiring is a follow-up
- **Date:** 2026-11-08 · **Asked by:** ludannnn (operator)
- **Decision:** this spec covers endpoints 49-52 and 55 and the `dev` package; wiring S20 and S18 to the live API gets its own Medium spec after the backend merges.
- **Why:** the backend can merge sooner and the UI change is lower risk; feature freeze is 10 Nov (AD-69).
- **Rejected:** one spec and PR for backend and UI (larger review, later merge).

### C~2 The standup activity window is anchored to the standup date
- **Date:** 2026-11-08 · **Asked by:** ludannnn (operator), closing the W10 handover on future standup dates
- **Decision:** the window runs from 00:00 (Asia/Singapore) of the working day before the standup date to now (AD-44 applied per date).
- **Why:** a standup prepared for tomorrow should cover today, not the day before as well.
- **Rejected:** keeping `standupActivityWindow(now)`, which ignores the date.

### C~3 W9 is High risk
- **Date:** 2026-11-08 · **Asked by:** ludannnn (operator)
- **Decision:** High tier: Implementer, Tester, Maintainer and Attacker lenses.
- **Why:** untrusted uploaded text, per-developer ownership, a cross-role read (Dev Lead reads standups) and membership checks.
- **Rejected:** Medium.

### C~4 Spec now, build after W5 merges
- **Date:** 2026-11-08 · **Asked by:** ludannnn (operator)
- **Decision:** write and approve the spec while PR #23 is in review; plan and build after it merges.
- **Why:** W9 uses W5's `requireMember`, `assertWritable`, resolver pattern, `request.userId` and the core context sources; only the writable check may change shape under the review (fix 4), and the spec isolates it behind one seam.
- **Rejected:** branching from `w5-core-planning` now (rebase churn while W5 changes).

### C~5 An unchanged input hash returns the stored standup, even when degraded
- **Date:** 2026-11-08 · **Asked by:** ludannnn (operator), after the Maintainer review flagged a contract conflict
- **Decision:** follow contracts row 51, architecture §9.4 and AD-06: the same hash returns the stored row with `cached: true`.
- **Why:** contracts remain normative (C20); no amendment needed.
- **Rejected:** retrying the model on degraded rows (needs a contracts.md amendment agreed by all owners).

### C~6 W9 adds `recordCacheHit` and `openOrReuse` to the gateway
- **Date:** 2026-11-08 · **Asked by:** ludannnn (operator, also the W2 owner)
- **Decision:** W9 adds two additive functions to `src/be/llm-gateway`: `recordCacheHit` writes the `CACHE_HIT` rows AD-18 requires; `openOrReuse` lets summary batches share one session.
- **Why:** `usage.ts` counts `CACHE_HIT` rows but nothing wrote them, and W17 needs hit-rate evidence; one session per batch would use half the daily cap on a 100-item upload.
- **Rejected:** deferring `CACHE_HIT` to W17 with a Deviation.

### C~7 Amend the spec to W5's merged code before planning
- **Date:** 2026-11-09 · **Asked by:** ludannnn (operator): "check the current w9 spec and make sure it matches what we have so far before continuing"
- **Decision:** W9 writes use W5's `inMutationTransaction` with W9's own `FOR SHARE` lock; the dev wiring changes the two `getCoreComposition` lines in `app.ts`; F8's boot test also asserts the core sources and core.
- **Why:** W5's fix 4 shipped a retrying transaction helper (the case § 4.6 anticipated); its own lock is not exported and bumps `projects.updated_at`.
- **Rejected:** W5's `lockProjectForMutation`; keeping a bare `$transaction` without the retry.
- **Superseded in part by C~8:** the `FOR SHARE` lock cannot run through the filtered client.

### C~8 W9 writes lock with W5's exported `lockProjectForMutation`
- **Date:** 2026-11-09 · **Asked by:** ludannnn (operator): "lets amend it with the recommended option i think the queue is negligible"
- **Decision:** `@agile/core`'s `index.ts` gains one export line for `lockProjectForMutation`; W9 calls it as the `lock` step of `inMutationTransaction` and maps its `P2025` to `CONFLICT_STATE` (spec SD16, § 4.6).
- **Why:** the filtered client and its transactions drop raw SQL (`src/be/db/src/client.ts`), so C~7's `FOR SHARE` query is impossible; reusing W5's lock keeps one lock that archive and every write contend on.
- **Rejected:** copying the no-op update into `@agile/dev` (two copies of one lock).
- **Accepted cost:** each W9 write bumps `projects.updated_at`, and writes to one project queue for one short transaction.

## Lessons

### L~1 — Check the filtered client before specifying a query

- **Date:** 2026-11-09
- **Cause:** The W9 spec and its 2026-11-09 amendment assumed a parameterised FOR SHARE query through tx; nobody opened the filtered client
- **Rule:** Before a spec names a Prisma call on the request client (raw SQL, $transaction options, unique reads), check src/be/db/src/client.ts: the filtered client and its transactions drop $queryRaw and $executeRaw
- **Scope:** project
- **Found by:** Claude Opus 5.5 (self), while verifying paths for the W9 plan
