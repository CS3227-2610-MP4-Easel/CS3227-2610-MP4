# Branch State — dev-lead-pages-wiring

**What this branch has changed, and how to pick it up.** `workflow/project-state/STATE.md`
describes `INT`; read it for context and write here instead of editing it.
`sync-project-state` folds this file in after the branch merges.

- **Branch:** dev-lead-pages-wiring (from `INT` at `2c5dd9f`)
- **Base:** 2c5dd9f
- **Owner:** project operator
- **Status:** In review
- **Approved:** —
- **Last updated:** 2026-11-12 by Codex — operator retained the existing local/dev tier boundary

**Untouched:** Architecture, Conventions, Known Gaps, Decisions, Deviations

---

**Scope.** Extend the existing Dev Lead frontend wiring from W8 Health to W5 core-planning
pages. W14 sprint/re-plan interactions remain out of scope.

---

## 1. How to Resume

**Sessions** — one row per operator-initiated session.

| Session | Started | Agent(s) | Workstream | Status | Doing | Next action | Last touched |
|---|---|---|---|---|---|---|---|
| S1 | 2026-11-12 | Codex | W5/W8 | Active | Modal, overview, local digest runtime, and role-home fixes complete | Owner review | 2026-11-12 |

Session status: `Active` · `Paused` · `Blocked — needs human` (name the question).

**Remaining** — work no session has claimed, in order.

- [x] Obtain Gate 1 approval for the revised W5 UI design spec covering blockers 1–7.
- [x] Obtain Gate 2 approval for the five-task W5 implementation plan.
- [x] Implement approved W5 frontend API clients and screen wiring.
- [x] Resolve browser-found overview, digest, and modal defects; rerun focused tests and browser retest.
- [ ] **Handover:** Add focused frontend coverage and rerun the required typechecks after the managed worktree permits `src/fe/tsconfig.tsbuildinfo` writes.

## 2. Workstreams

| ID | Workstream | Status | Spec | Plan | Progress | Guide |
|---|---|---|---|---|---|---|
| W5 | Core planning (projects to tasks) | In review | `workflow/specs/2026-11-12-w5-dev-lead-ui-design.md` (approved 2026-11-12) | `workflow/plans/2026-11-12-w5-dev-lead-ui-wiring/plan.md` (approved 2026-11-12) | Implementation and T5 closeout verification complete; awaiting Gate 3 review | — |
| W8 | Dev Lead facts and digest | In review | — | — | Existing Health wiring retained on branch | — |

## 3. Changes

One line per change on this branch: what changed and why, with a commit as the reference.

| Date | What changed | Workstream | Ref |
|---|---|---|---|
| 2026-11-12 | Renamed the frontend integration branch to cover Dev Lead W5 and W8 page wiring | W5/W8 | this commit |
| 2026-11-12 | Approved the W5 Dev Lead UI design after blocker review; plan is now the next gate | W5 | this commit |
| 2026-11-12 | Completed and reviewed Wave 1 route/error and typed-client tasks; Wave 2 is unblocked | W5 | this commit |
| 2026-11-12 | Completed and reviewed Wave 2 project, board, backlog, checkpoint, member, and task wiring; T5 is now in flight | W5 | 8cdbff5 |
| 2026-11-12 | Added the F1-F8/N1-N3/E1-E15 verification matrix; required typechecks pass with repository cache-write access | W5 | 560ac31 |
| 2026-11-12 | Kept live project overview data independent per request and moved W5 route dialogs onto their base pages with Escape/X close behavior | W5/W8 | working tree |
| 2026-11-12 | Routed authenticated root visits to the role home; Dev Leads now land on `/lead/overview` and stale Projects-list copy was removed | W8 | working tree |
| 2026-11-12 | Restricted the PM `/projects` list to PMs and redirected authenticated non-PM visitors to their role home | W8 | working tree |

## Decisions

### C~2 — Keep local/dev environment binding

- **Decision:** Keep `APP_TIER=local` bound to local Firebase/Postgres resources; `agile-platform-dev` remains valid only with `APP_TIER=dev` and the dev Neon target.
- **Why:** The operator chose to preserve the existing tier-safety boundary after considering local Postgres with the shared dev Firebase project.
- **Decided by:** project operator, 2026-11-12.

## Deviations

### Q~1 — Typecheck cannot write managed-worktree build info

- **What:** `npm --prefix src/fe run typecheck` and `npm run typecheck` fail with TS5033/EPERM opening `src/fe/tsconfig.tsbuildinfo`.
- **Consequence:** The managed sandbox required escalated repository cache-write access; the commands pass when run with that access.
- **What was done:** The focused matrix, full frontend tests, frontend lint, root lint, and non-incremental frontend typecheck pass; no production repair was made.

### Q~2 — Local digest POST returned HTTP 500 before local AI mode was set

- **What:** `LLM_MODE=live` caused local lead-runtime initialization to fail with `Invalid setting SOCLAAS_API_KEY`; the safe API mapping exposed only HTTP 500.
- **Consequence:** Facts and digest reads failed before reaching their database logic.
- **What was done:** Set local `.env.local` to `LLM_MODE=mock`; direct verification now returns facts and persists a degraded digest. Restart the dev server to reload it.
