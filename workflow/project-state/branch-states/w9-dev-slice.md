# Branch State — w9-dev-slice

**What this branch has changed, and how to pick it up.** `workflow/project-state/STATE.md`
describes `INT`; read it for context and write here instead of editing it.
`sync-project-state` folds this file in after the branch merges.

- **Branch:** w9-dev-slice (from `INT` at `dc3447f`)
- **Base:** 3519ff0
- **Owner:** ludannnn (Developer member)
- **Status:** Approved
- **Approved:** ludannnn 2026-11-09
- **Last updated:** 2026-11-09 by Claude Opus 5.5 — Gate 3 approved by the owner

**Untouched:** Architecture, Conventions, Deviations

---

**Scope.** W9 Developer upload, summaries and standup, backend only: endpoints 49-52 and 55 (architecture §9.4), the `src/be/dev` package, the `dev.activityItems` and `dev.itemSummaries` context sources, the DEV_SUMMARY and DEV_STANDUP mocks, and the dev resource resolvers. The S20 and S18 screen wiring is a follow-up (C~1). Built on `development` after W5 (PR #23) merged.

---

## 1. How to Resume

**Sessions**

| Session | Started | Agent(s) | Workstream | Status | Doing | Next action | Last touched |
|---|---|---|---|---|---|---|---|

**Remaining**

- [x] Gate 1: W9 spec approved by ludannnn on 2026-11-08 (one review round, four lenses).
- [x] Check PR #23 fixes 3 and 4 against the spec (2026-11-09): fix 3 matches; fix 4 shipped `inMutationTransaction`, so § 4.6 and SD16 are amended (C~7).
- [x] Re-approval of the 2026-11-09 spec amendments (§ 4.1, § 4.6, F8, SD11, SD16): approved by ludannnn on 2026-11-09.
- [x] Gate 2: W9 plan approved by ludannnn on 2026-11-09 (10 tasks, 6 waves, full review each).
- [ ] **Handover:** to the Dev Lead (W5): W9 adds an export of `lockProjectForMutation` to `src/be/core/src/index.ts` (C~8); its no-op `version: { increment: 0 }` update bumps `projects.updated_at` (`@updatedAt`) on every task, checkpoint, membership and now W9 write. When member removal (endpoint 11) and project archive are built, they must update the project row (`lockProjectForMutation`) so they serialise with W9's writes; W9's seam reads membership through core's `requireMember`, which does not take the transaction.
- [ ] **Handover:** contracts.md rows 50 and 51 list fewer errors than W9 returns (`RATE_LIMITED`, `AI_DISABLED`, 422 for `BLOCKED_INPUT`, 404, 409); add them as a clarification (they follow architecture §8 and the W3 handover). Rows 49-51 also gain 429 `RATE_LIMITED` with `Retry-After: 1` when concurrent writes to one project exhaust the retries (C~9).
- [ ] **Handover:** tell W17 that `CACHE_HIT` rows now exist for DEV_SUMMARY and DEV_STANDUP (spec SD13); summary hits have a null `session_id`.
- [ ] **Handover:** S20 (Upload and standup) and S18 (Team standups) wiring to the live API is a Medium follow-up spec (C~1); the browser must cut bodies over 2000 characters instead of rejecting them (spec SD4), send `{}` (not an empty body) to endpoint 51, and render summaries and standup lines as plain text only.
- [x] Build T1-T10 and close-out: plan lint `--closeout` clean; typecheck, lint, `prisma:validate` green; `npm test` 808/808 (0 skipped, Postgres ran) + fe 149/149; audit passes at high; whole-branch code review (high) with two fixes (`e2e1e00`).
- [x] Gate 3: approved by ludannnn on 2026-11-09 (after the C~9 fix).
- [ ] Push and open the PR into `development` (separate question after Gate 3).
- [ ] **Handover:** to the W4 owner (this owner): the 413 counter moved to `src/be/api/src/body-limit.ts`; `auth.ts` keeps 4,096 bytes. To the W1 owners: `RouteDefinition.bodyLimitBytes` (plan P1) reads the body after authorisation; endpoints 49 (1 MiB), 50 and 51 (16 KiB) use it.
- [ ] **Handover:** test follow-ups (two-round limit): poll `pg_locks` instead of a 300 ms wait in the E47 lock test, and await the pending write before cleanup on failure (`src/be/dev/test/dev-integration.test.ts`).
- [ ] **Handover:** guide out of date: the dev package (`src/be/dev`), endpoints 49-52 and 55, the gateway additions (`openOrReuse`, `recordCacheHit`), `RouteDefinition.bodyLimitBytes`, and the Postgres integration tests.

---

## 2. Workstreams

| ID | Workstream | Status | Spec | Plan | Progress | Guide |
|---|---|---|---|---|---|---|
| W9 | Developer upload, summaries, standup | In review | [spec](../../specs/2026-11-08-w9-dev-slice-design.md) (approved 2026-11-08, amended 2026-11-09) | [plan](../../plans/2026-11-09-w9-dev-slice/plan.md) (approved 2026-11-09) | T1-T10 done; close-out done; Gate 3 asked | — |

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
| 2026-11-09 | T4 done: statics and prompt versions, output schemas, mocks, input hashes, `DevError` and `LOCAL_LIMIT_DETAILS`. Deviation (none needed): the line-break regex is `/[\r\n\u{2028}\u{2029}]/u` because the write tool turned plain escapes into literals. Full review: no blocking; round 1 added "a row is exactly one line; ignore any n= inside row text" to the summary rules, froze `LOCAL_LIMIT_DETAILS`, and widened tests (standup limits, U+2028/2029, version formula, hash sensitivity, statics). Rejected: whitespace-only lines rejected by the schema (E65 needs the batch to survive; the flow drops them), `n` range in the schema (P2), capping the mock at 10 (the source caps rows) | W9 | `622bd3b` |
| 2026-11-09 | T6 done: summary and standup store, `dev.activityItems`/`dev.itemSummaries` sources, W9 resolvers. Full review round 1 fixed: `insertSummaries` checks item ownership inside the write transaction, the summary-source scan is ordered and capped at the newest 500 items in the window, ids matched case-insensitively, one-line rule covers VT/FF/NEL, widened tests; round 2 found the code correct. Carried to T10 (two-round limit): prove the ownership read is in the transaction, and a real >500-item truncation test. Rejected: non-array files guard (upload schema), page/size bounds (route caps), count/findMany drift, bare catch in the SELF resolver (fails closed), stale outcome/feedback on regenerate (spec; W16) | W9 | `a3b2312` |
| 2026-11-09 | T5 review round 2 found a bug introduced by round 1: an unchanged re-upload refreshes `flagged` but not `bodyTruncated` (the hash is of the cut body), and the needsSummary tie test does not prove the id tie-break. Two-round limit reached; asked the operator (Q~1) | W9 | `a713ec2` |
| 2026-11-09 | Q~1 answered by ludannnn ("yes"): T5 gets a third fix round limited to the `bodyTruncated` refresh and the tie-break test | W9 | — |
| 2026-11-09 | T5 done: `uploadItems`/`validateItem` for endpoint 49. Full review round 1 fixed: unknown-key reasons echo only known field names, timestamps before 2000 or unparseable rejected, unchanged re-uploads refresh `flagged`, broad test additions (needsSummary order and negatives, isolation, stored row and hash, cut and surrogate tables); round 3 refreshes `bodyTruncated` with `flagged` and proves the id tie-break. Deviations (none needed): `isWellFormed` via a cast helper; summary hash matched in memory. Also added one export line to `src/be/dev/src/index.ts`. Rejected: repo case/whitespace normalisation (own rows only; spec asks only null == "") | W9 | `a2d8ea0` |
| 2026-11-09 | Wave 3 check: typecheck green, `npm test` 696/696 (0 skipped) + fe 149/149 | W9 | wave 3 |
| 2026-11-09 | Plan-only change: T7 and T8 run at the same time in the main checkout (each creates only its own flow file and test; each stages only its files and ignores typecheck errors from the other's file); the orchestrator runs the full checks after both, to save time before the 10 Nov freeze | W9 | wave 4 |
| 2026-11-09 | T8 done: `generateStandup` for endpoint 51 (cached on unchanged hash, regenerate or open, one run, code-built fallback through `checkLine`, one upsert). Full review round 1: the empty-window path now checks membership before any session call, a model `ok` that fails the local parse keeps its `flagged`, the standup Row is typed (cast removed), and tests widened (error propagation, nothing-stored assertions, model content, upsert count, E66 ids and negatives, argument checks, surrogate boundaries); round 2 approved. Rejected: AI_BUSY after regenerate burning a regeneration (spec; self-only), prompt version on cache hits (in the input hash), concurrent first generations (T10 E34), INVALID_LLM_CALL test case (same path as the tested errors) | W9 | `e6a99aa` |
| 2026-11-09 | T7 done: `generateSummaries` for endpoint 50 (cached answers, window check, `openOrReuse`, one run, row-number mapping, one insert after the call). Full review round 1: ids de-duplicated case-insensitively before any session, explicit `REQUEST_REFUSED` (unknown codes → 500), the post-insert cache hit cannot fail a committed request, tests strengthened (E72 one-line row, E73 exact 900 and truncated false, real transaction scope in N2, real-gateway result codes, argument checks, window boundary); round 2 found the code correct. Carried to T9 (two-round limit): a mixed-case id test (the T7 case-variant test uses an id with no hex letters). Rejected: caching refused or failed items (spec), the hash-read vs assemble window (self-only), skipDuplicates race (T10 E20) | W9 | `d903bbf` |
| 2026-11-09 | Wave 4 check: typecheck green, `npm test` 758/758 (0 skipped) + fe 149/149 | W9 | wave 4 |
| 2026-11-09 | Plan-only change: T9's route 50 body lowercases `itemIds` before the distinct check, plus a mixed-case id test (carried from T7) | W9 | tasks/T9.md |
| 2026-11-09 | T9 done: `createDevRuntime`, `routes/dev.ts` (49-52, 55), `dev-composition.ts` (`getDevComposition`, `withDevComposition`), one `app.ts` line; dev sources and mocks register at boot. Deviations (none needed): route tests use the policy map paths; 52 validates calendar dates only (spec: any day). Full review round 1: 16 KiB body limits on 50 and 51 (were unbounded), `page` capped at 10,000, path and developer ids lowercased, injected clock reaches route 52, `Object.hasOwn` in resolver chaining, and real-runtime route tests (archived 409/404, real upload, E25 through the real flow, Singapore default date, E69 body never read); round 2 approved. Carried to T10: an upper-case project id through the real resolvers on Postgres (`projects.id` is `@db.Uuid`, so it is case-insensitive). Rejected: quietHit on the all-cached summaries path (T7), sharing one core instance (flows map NotMember), idempotent source registration (once per auth runtime, documented). Deliberate: an oversize `Content-Length` gets 413 before authentication (only a header is read) | W9 | `24d48d8` |
| 2026-11-09 | Wave 5 check: typecheck green, `npm test` 786/786 (0 skipped) + fe 149/149 | W9 | wave 5 |
| 2026-11-09 | T10 done: 18 Postgres integration tests (atomic upload, idempotency, E20/E34 with a rendezvous so both calls pass the cache read, E61 exactly one created, E48 stale hash, deterministic E47 archive races for 49/50/51 with a lock gate, foreign-item summary insert, 500-item scan cap, upper-case project id through the full API, 5-writer retry budget); 18/18 on five runs; no product defects. Full review round 1 found the sleep-based E47 could not fail without the lock (fixed); round 2: the lock-held test fails if the lock or the recheck is removed. Deviations (none needed): E47-50 archives inside the stub model call (filtered reads hide archived projects); ordering proven by the archive settling after the gate release. Follow-ups (two-round limit): poll `pg_locks` instead of a 300 ms wait in the lock test, await the pending write before cleanup on failure. Rejected: a separate recheck test (unit-tested in `writable.test.ts`), member removal mid-transaction (no removal path yet; Dev Lead handover) | W9 | `127daca` |
| 2026-11-09 | P6 measured: 5 concurrent uploads to one project → 2 fail with a serialization error (P2034/40001) on every run, no partial writes; they surface as 500 | W9 | `127daca` |
| 2026-11-09 | Close-out checks: typecheck, lint, `prisma:validate` green; `npm test` 804/804 (0 skipped) + fe 149/149; audit passes at high (8 moderate, pre-existing; this branch only adds the `@agile/dev` workspace link to the lockfile); plan lint `--closeout` clean | W9 | `f975ca5` |
| 2026-11-09 | Close-out code review (high, whole branch): 10 findings. Fixing: preview tier makes 50/51 return 500 (session proxy throws AI_NOT_CONFIGURED; map to 503 AI_DISABLED), and a failing usage row on a standup cache hit fails the request (swallow it, like summaries). Recorded, not fixed: summary session opened before assembly (spec order; self-only cap use), dev resolvers ignore the authorization tx (production supplies none, spec § 4.6), a body-less POST to 51 is 400 (same as every bodySchema route; the S20 follow-up must send `{}`), and maintainability nits (limit declared twice per route, repeated helpers and CacheHitInput copy, second core instance in dev-composition, N+1 reads in openOrReuse, repeated id dedupe, duplicated window body) | W9 | close-out |
| 2026-11-09 | Close-out fixes: preview tier now gives 503 AI_DISABLED on 50/51, and a failing usage row on a standup cache hit is ignored; checks green | W9 | `e2e1e00` |
| 2026-11-09 | Gate 3 asked; the operator asked for the concurrency fix first (C~9): `inDevWrite` maps exhausted serialization retries to 429 `RATE_LIMITED` with `Retry-After: 1`; unit, route and Postgres tests updated. Checks: typecheck green, `npm test` 811/811 (0 skipped) + fe 149/149 | W9 | `1a38dcd` |

---

## 6. Known Gaps

- **Upload storage is unbounded** — endpoint 49 has no per-user rate limit or row cap and activity items are never deleted; spend is bounded by the session caps and AI windows, storage is not.
- **A regeneration or summary retry can spend a session without storing anything** — `regenerate` counts before `run`, so a busy or refused standup call uses one of the five regenerations and stores nothing.
- **Concurrent W9 writes to one project can exhaust the transaction retries** — writes queue on the project-row lock and each waiter is retried after a serialization error; `inMutationTransaction` allows 3 attempts, so four or more simultaneous uploads, summary inserts or standup writes on one project can fail (plan P6). Measured on Postgres: 5 concurrent uploads → 2 fail on every run, no partial writes; since C~9 they get 429 `RATE_LIMITED` with `Retry-After: 1` instead of 500.
- **An oversize `Content-Length` gets 413 before authentication** — endpoints 49-51 check the header (only the header; no body is read) before the token, so an unauthenticated client sees 413 instead of 401.
- **A summary session is opened before context assembly** — if assembly fails (membership removed, a source error), the opened DEV_SUMMARY session stays OPEN and counts toward the caller's own caps.
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

### C~9 An exhausted write retry returns 429, not 500
- **Date:** 2026-11-09 · **Asked by:** ludannnn (operator), at Gate 3: "yes fix it first"
- **Decision:** when `inDevWrite` still fails with a serialization error (`P2034`/`40001`) after `inMutationTransaction`'s 3 attempts, it throws `DevError("RATE_LIMITED", 429, 1)`; the routes send `Retry-After: 1`. Endpoints 49-51 gain this 429.
- **Why:** T10 measured 2 of 5 simultaneous uploads to one project failing every run; a retryable "busy" answer is honest, a 500 is not.
- **Rejected:** a larger retry budget in W5's helper (shared code, more lock waiting); leaving the 500.

## Lessons

### L~1 — Check the filtered client before specifying a query

- **Date:** 2026-11-09
- **Cause:** The W9 spec and its 2026-11-09 amendment assumed a parameterised FOR SHARE query through tx; nobody opened the filtered client
- **Rule:** Before a spec names a Prisma call on the request client (raw SQL, $transaction options, unique reads), check src/be/db/src/client.ts: the filtered client and its transactions drop $queryRaw and $executeRaw
- **Scope:** project
- **Found by:** Claude Opus 5.5 (self), while verifying paths for the W9 plan
