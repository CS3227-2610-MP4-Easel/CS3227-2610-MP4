# Branch State — w12-ci-regression-env

**What this branch has changed, and how to pick it up.** `workflow/project-state/STATE.md` describes `INT`; read it for context and write here instead of editing it.
`sync-project-state` folds this file in after the branch merges.

- **Branch:** `w12-ci-regression-env` (from `INT` at `7fbd131`)
- **Base:** `7fbd131`
- **Owner:** repo owner
- **Status:** In review
- **Approved:** —
- **Last updated:** 2026-11-08 by Codex — Vercel check removed

**Untouched:** Architecture, Conventions, Known Gaps, Decisions, Deviations

---

**Scope.** Make the W5 real-database regression mandatory in CI and remove the W13 development Vercel verification check, as requested by the owner.

---

## 1. How to Resume

**Sessions** — none.

**Remaining**

- [ ] **Handover:** Merge this branch into W5 before continuing that workstream.

---

## 2. Workstreams

| ID | Workstream | Status | Spec | Plan | Progress | Guide |
|---|---|---|---|---|---|---|
| W12 | CI and process security | In review | — | — | CI Postgres regression follow-up complete | — |
| W13 | Environments, seed data and deployment | In review | — | — | Development verification workflow removed | — |

---

## 3. Changes

| Date | What changed | Workstream | Ref |
|---|---|---|---|
| 2026-11-08 | Added a pinned Postgres 16 CI service, migrated it before tests, and made the W1 integration database required. | W12 | this commit |
| 2026-11-08 | Removed the W13 protected Environment binding so development verification runs automatically. | W13 | this commit |
| 2026-11-08 | Removed the W13 development verification workflow and its workflow-only test; workflow policy now rejects replacement push workflows. | W13 | this commit |
