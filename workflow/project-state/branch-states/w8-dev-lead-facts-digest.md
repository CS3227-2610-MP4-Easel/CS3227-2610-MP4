# Branch State — w8-dev-lead-facts-digest

**What this branch has changed, and how to pick it up.** `workflow/project-state/STATE.md`
describes `INT`; read it for context and write here instead of editing it.
`sync-project-state` folds this file in after the branch merges.

- **Branch:** w8-dev-lead-facts-digest (from `INT` at `b95546f`)
- **Base:** b95546f
- **Owner:** project operator
- **Status:** In review
- **Approved:** Gate 1 spec, Gate 2 plan, and Gate 3 branch review — project operator, 2026-11-09
- **Last updated:** 2026-11-10 by Codex — committed and pushed the verified W8 blocker repairs as `9975055`

**Untouched:** Architecture, Conventions, Known Gaps, Decisions, Deviations

---

**Scope.** W8 Dev Lead facts and digest: endpoints 42, 44 and 45, the `lead` context
sources, and their guarded gateway integration.

---

## 1. How to Resume

**Sessions** — one row per operator-initiated session.

| Session | Started | Agent(s) | Workstream | Status | Doing | Next action | Last touched |
|---|---|---|---|---|---|---|---|
| S1 | 2026-11-09 | Codex (orchestrator) | W8 | Complete | T1 Facts package and deterministic forecast (Wave 1) | — | 2026-11-09 |
| S2 | 2026-11-09 | Codex (orchestrator) | W8 | Complete | T1 deterministic-pagination follow-up | — | 2026-11-09 |
| S3 | 2026-11-09 | Codex (orchestrator) | W8 | Complete | T1 attacker review found unbounded endpoint-42 caller scope; operator chose complete aggregation | — | 2026-11-09 |
| S4 | 2026-11-09 | Codex (orchestrator) | W8 | Complete | T1 complete bounded aggregation repair | — | 2026-11-09 |
| S5 | 2026-11-09 | Codex (orchestrator) | W8 | Complete | T2 Context sources and digest flow (Wave 2) | — | 2026-11-09 |
| S6 | 2026-11-09 | Codex (orchestrator) | W8 | Complete | Two post-review lead digest blockers fixed and verified | — | 2026-11-09 |
| S7 | 2026-11-09 | Codex (orchestrator) | W8 | Complete | Fresh T2 tester-lens review and blocker repair | — | 2026-11-09 |
| S8 | 2026-11-09 | Codex (orchestrator) | W8 | Complete | Latest digest requires indexed persisted ordering | Record the approved migration and amend the spec/plan | 2026-11-09 |
| S9 | 2026-11-09 | Codex (orchestrator) | W8 | Complete | Amended W8 for durable `factsAsOf` ordering and migration | Owner review of the uncommitted change set | 2026-11-09 |
| S10 | 2026-11-09 | Codex (orchestrator) | W8 | Complete | Implementer, tester, and attacker reviews of schema, migrations, and digest flow | — | 2026-11-09 |
| S11 | 2026-11-10 | Codex (orchestrator) | W8 | Complete | Final verification and owner handover | Request final Gate 3 review and monitor PR CI | 2026-11-10 |
| S12 | 2026-11-12 | Codex | W8 | Active | Repairing five PR #28 review findings and diagnosing the failing CI check | Reproduce the failing check, add red regressions, then implement and verify repairs | 2026-11-12 |

Session status: `Active` · `Paused` · `Blocked — needs human` (name the question).

**Remaining** — work no session has claimed, in order.

- [x] Write and review the W8 design spec; obtain Gate 1 approval.
- [x] Obtain Gate 2 approval of the W8 implementation plan before coding.
- [x] Execute T1-T3 with task reviews and wave checks.

---

## 2. Workstreams

| ID | Workstream | Status | Spec | Plan | Progress | Guide |
|---|---|---|---|---|---|---|
| W8 | Dev Lead facts and digest | In review | [spec](../../specs/2026-11-09-w8-dev-lead-facts-digest-design.md) (approved/amended 2026-11-09) | [plan](../../plans/2026-11-09-w8-dev-lead-facts-digest/plan.md) (approved/amended 2026-11-09) | `factsAsOf` migration, bounded ordering, `previousDigest`, session-cap mapping, compatibility trigger, and final verification complete | final Gate 3 review and PR CI |

## 3. Changes

One line per change on this branch: what changed and why, with a commit as the reference.

| Date | What changed | Workstream | Ref |
|---|---|---|---|
| 2026-11-09 | W8 Big design spec drafted, linted, reviewed, and amended with the shared-digest overload privacy decision | W8 | this commit |
| 2026-11-09 | W8 spec approved at Gate 1 by project operator | W8 | this commit |
| 2026-11-09 | W8 three-task implementation plan drafted, linted, independently reviewed, and tightened for self-contained contracts plus transaction/concurrency evidence | W8 | this commit |
| 2026-11-09 | Project operator approved the W8 implementation plan at Gate 2 | W8 | this commit |
| 2026-11-09 | Execution baseline passed: typecheck, lint, contract and 534 tests (28 integration skips); T1 started under S2 | W8 | pending task commit |
| 2026-11-09 | T1 repair cycle fixed membership, cross-project velocity, deterministic ordering, and hash tests; review still requires bounded facts reads and a short-history regression | W8 | pending operator direction |
| 2026-11-09 | Project operator chose deterministic pagination and a short-history regression test over accepting a bounded-read limitation | W8 | pending follow-up commit |
| 2026-11-09 | Preserved auth parser 400 mappings and made strict 415/422 body parsing opt-in for W8 lead routes; focused and full verification passed | W8 | pending task commit |
| 2026-11-09 | Started post-review blocker repair: latest digest selection and admitted-session degraded close semantics | W8 | this commit |
| 2026-11-09 | Added regressions and minimal fixes for complete latest-digest selection and gateway-exception session persistence | W8 | this commit |
| 2026-11-09 | Added red regressions and minimal fixes so endpoint 42 uses target-only facts and cached/latest digests expose only public fields | W8 | pending task commit |
| 2026-11-09 | Operator approved amending W8 to persist `Facts.asOf` as `ProjectDigest.factsAsOf` with a composite latest-order index; spec and T2 plan are being regenerated before implementation | W8 | pending task commit |
| 2026-11-09 | Implementer/tester/attacker lenses found rollout, invalid-backfill, rollback, and bounded-query gaps; spec and T2 were amended with expand/contract phases and explicit regression requirements | W8 | pending task commit |
| 2026-11-09 | Attacker review found the two migration phases still deploy together before the new writer and the documented production path has no down migration; query bounds, tenant scoping, and session-cap mapping otherwise passed | W8 | pending task commit |
| 2026-11-09 | Resolved review findings with compatibility-triggered expand/contract migration, forward-only restore recovery, offset-bearing backfill validation, final non-null Prisma shape, migration manifest updates, and a CI-gated PostgreSQL migration regression; full suite passed | W8 | 9975055 |

## 4. Deviations

| ID | What diverged | Consequence | Action / decision needed |
|---|---|---|---|
| D~1 | Complete facts retrieval removed silent query caps, leaving large-project reads unbounded; second review also found the missing one/two-sprint regression. | A large tenant can cause excessive memory/work; a short nonzero history regression remains unguarded. | Operator authorized repair. Pagination was insufficient because it still retained all history; final repair fetches only the newest three closed sprints per included project and strengthens its regression tests. |
| D~2 | Endpoint-42 caller facts aggregate every active member project and assigned task while the approved contract requires complete caller-member coverage. | A caller with many projects/tasks can cause unbounded total work; adding a cap would silently omit facts and alter digest/hash semantics. | Resolved 2026-11-09: operator chose complete aggregation with bounded concurrency and incremental pagination; no silent omission or new response behavior. |
| D~3 | A reviewer requested a hard total-row budget for complete caller aggregation. | A hard budget would omit caller-member facts or introduce a new degraded response not in the approved contract. | Accepted 2026-11-09 under the operator's complete-aggregation decision: pagination bounds peak batch size and concurrency, while total work remains proportional to complete input. Independent checkpoint pagination and active-project filtering are still required. |
| 2026-11-09 | Operator chose complete aggregation with bounded concurrency and incremental pagination; no silent omission or new response behavior | W8 | pending follow-up commit |
| D~4 | No real lead database fixture exists for transaction/concurrency integration tests. | Deterministic transaction fixtures cover control flow, but Prisma rollback/schema/concurrent visibility remain unverified locally. | Carry as a close-out deviation; add a database-backed fixture when the repository integration database is available. |
| D~5 | W8 changed the shared JSON parser to return 415/422 for lead-route semantics, while existing auth tests expect 400. | Four auth-route assertions fail; the behavior change is a cross-route compatibility issue, not an unrelated failure. | Resolved 2026-11-09: parser defaults to auth's legacy 400 mappings; W8 lead routes explicitly opt into 415/422. |
| D~6 | Latest-digest correctness requires durable ordering by `facts.asOf`, but JSON facts are not indexable in the current schema and bounded createdAt candidates can be wrong. | Endpoint 45 currently scans all project digests; fixing this correctly requires a `factsAsOf` scalar/index or equivalent latest pointer, outside the original no-migration scope. | Resolved 2026-11-09: operator approved the expand/contract `factsAsOf` field, validated backfill, and composite index; spec and T2 plan amended before implementation. |

## 4a. Decisions recorded on this branch

| ID | Decision | Why | Rejected | Who / when |
|---|---|---|---|---|
| C~1 | Persist `Facts.asOf` in `ProjectDigest.factsAsOf` and index `(projectId, factsAsOf DESC, createdAt DESC, id DESC)` | Endpoint 45 must return the newest facts snapshot without scanning unbounded append-only history; `createdAt` is not a safe proxy | In-memory full-history sorting, a bounded `createdAt` candidate window, or an unindexed latest pointer | project operator, 2026-11-09 |

## 5. Close-out evidence

- `npm run typecheck`: pass
- `npm run lint`: pass
- `npm run contract`: 7 pass
- `npm test`: 604 total, 575 pass, 29 skipped, 0 fail
- Focused auth/lead/input-parser tests: 41 pass
- Plan/handover lint: pass
- Full branch review: Implementer/Tester/Attacker task reviews completed; close-out tenancy finding repaired
- CI-gated migration regression: skips without `W1_INTEGRATION_DATABASE_URL`; executes the expand/contract backfill, rollback, index, and `NOT NULL` checks when Postgres is configured

## 6. Handover items

- Standardize HTTP body error mappings across auth and lead routes (`415` unsupported media type, `400` malformed JSON, `422` semantic validation) in a follow-up contract change; update affected tests and clients together. Resolved by preserving auth's legacy 400 behavior and opting W8 lead routes into strict 415/422 parsing.

- Immediate correction: preserve auth's legacy `400` parser behavior and make strict `415`/`422` mapping opt-in for W8 lead routes; rerun CI before merge. Resolved in this branch.

