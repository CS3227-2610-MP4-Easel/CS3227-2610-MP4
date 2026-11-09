# Branch State — w8-dev-lead-facts-digest

**What this branch has changed, and how to pick it up.** `workflow/project-state/STATE.md`
describes `INT`; read it for context and write here instead of editing it.
`sync-project-state` folds this file in after the branch merges.

- **Branch:** w8-dev-lead-facts-digest (from `INT` at `b95546f`)
- **Base:** b95546f
- **Owner:** project operator
- **Status:** In review
- **Approved:** Gate 1 spec, Gate 2 plan, and Gate 3 branch review — project operator, 2026-11-09
- **Last updated:** 2026-11-09 by Codex — operator authorized auth/parser compatibility correction

**Untouched:** Architecture, Conventions, Known Gaps, Decisions, Deviations

---

**Scope.** W8 Dev Lead facts and digest: endpoints 42, 44 and 45, the `lead` context
sources, and their guarded gateway integration.

---

## 1. How to Resume

**Sessions** — one row per operator-initiated session.

| Session | Started | Agent(s) | Workstream | Status | Doing | Next action | Last touched |
|---|---|---|---|---|---|---|---|
| S1 | 2026-11-09 | Codex (orchestrator) | W8 | Active | T1 Facts package and deterministic forecast (Wave 1) | Validate T1 handover; full review and wave check | 2026-11-09 |
| S2 | 2026-11-09 | Codex (orchestrator) | W8 | Active | T1 deterministic-pagination follow-up | Validate repaired handover and repeat targeted review | 2026-11-09 |
| S3 | 2026-11-09 | Codex (orchestrator) | W8 | Blocked — needs human | T1 attacker review found unbounded endpoint-42 caller scope | Decide complete aggregation versus an explicit endpoint-42 resource budget | 2026-11-09 |
| S4 | 2026-11-09 | Codex (orchestrator) | W8 | Active | T1 complete bounded aggregation repair | Validate handover and repeat Wave 1 review | 2026-11-09 |
| S5 | 2026-11-09 | Codex (orchestrator) | W8 | Active | T2 Context sources and digest flow (Wave 2) | Validate T2 handover; full review and wave check | 2026-11-09 |
| S6 | 2026-11-09 | Codex (orchestrator) | W8 | Active | W8 close-out complete | Await Gate 3 branch review; do not push or merge | 2026-11-09 |

Session status: `Active` · `Paused` · `Blocked — needs human` (name the question).

**Remaining** — work no session has claimed, in order.

- [x] Write and review the W8 design spec; obtain Gate 1 approval.
- [x] Obtain Gate 2 approval of the W8 implementation plan before coding.
- [ ] Execute T1-T3 with task reviews and wave checks.

---

## 2. Workstreams

| ID | Workstream | Status | Spec | Plan | Progress | Guide |
|---|---|---|---|---|---|---|
| W8 | Dev Lead facts and digest | In review | [spec](../../specs/2026-11-09-w8-dev-lead-facts-digest-design.md) (approved 2026-11-09) | [plan](../../plans/2026-11-09-w8-dev-lead-facts-digest/plan.md) (approved 2026-11-09) | Auth/parser compatibility correction complete; verification passed | lead API routes; guide update after merge |

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

## 4. Deviations

| ID | What diverged | Consequence | Action / decision needed |
|---|---|---|---|
| D~1 | Complete facts retrieval removed silent query caps, leaving large-project reads unbounded; second review also found the missing one/two-sprint regression. | A large tenant can cause excessive memory/work; a short nonzero history regression remains unguarded. | Operator authorized repair. Pagination was insufficient because it still retained all history; final repair fetches only the newest three closed sprints per included project and strengthens its regression tests. |
| D~2 | Endpoint-42 caller facts aggregate every active member project and assigned task while the approved contract requires complete caller-member coverage. | A caller with many projects/tasks can cause unbounded total work; adding a cap would silently omit facts and alter digest/hash semantics. | Resolved 2026-11-09: operator chose complete aggregation with bounded concurrency and incremental pagination; no silent omission or new response behavior. |
| D~3 | A reviewer requested a hard total-row budget for complete caller aggregation. | A hard budget would omit caller-member facts or introduce a new degraded response not in the approved contract. | Accepted 2026-11-09 under the operator's complete-aggregation decision: pagination bounds peak batch size and concurrency, while total work remains proportional to complete input. Independent checkpoint pagination and active-project filtering are still required. |
| 2026-11-09 | Operator chose complete aggregation with bounded concurrency and incremental pagination; no silent omission or new response behavior | W8 | pending follow-up commit |
| D~4 | No real lead database fixture exists for transaction/concurrency integration tests. | Deterministic transaction fixtures cover control flow, but Prisma rollback/schema/concurrent visibility remain unverified locally. | Carry as a close-out deviation; add a database-backed fixture when the repository integration database is available. |
| D~5 | W8 changed the shared JSON parser to return 415/422 for lead-route semantics, while existing auth tests expect 400. | Four auth-route assertions fail; the behavior change is a cross-route compatibility issue, not an unrelated failure. | Resolved 2026-11-09: parser defaults to auth's legacy 400 mappings; W8 lead routes explicitly opt into 415/422. |

## 5. Close-out evidence

- `npm run typecheck`: pass
- `npm run lint`: pass
- `npm run contract`: 7 pass
- `npm test`: 597 total, 569 pass, 28 skipped, 0 fail
- Focused auth/lead/input-parser tests: 41 pass
- Plan/handover lint: pass
- Full branch review: Implementer/Tester/Attacker task reviews completed; close-out tenancy finding repaired

## 6. Handover items

- Standardize HTTP body error mappings across auth and lead routes (`415` unsupported media type, `400` malformed JSON, `422` semantic validation) in a follow-up contract change; update affected tests and clients together. Resolved by preserving auth's legacy 400 behavior and opting W8 lead routes into strict 415/422 parsing.

- Immediate correction: preserve auth's legacy `400` parser behavior and make strict `415`/`422` mapping opt-in for W8 lead routes; rerun CI before merge. Resolved in this branch.

