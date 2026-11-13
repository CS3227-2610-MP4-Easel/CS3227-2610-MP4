# Branch State — w12-ci-regression-env

**What this branch has changed, and how to pick it up.** `workflow/project-state/STATE.md` describes `INT`; read it for context and write here instead of editing it.
`sync-project-state` folds this file in after the branch merges.

- **Branch:** `w12-ci-regression-env` (from `INT` at `7fbd131`)
- **Base:** `7fbd131`
- **Owner:** repo owner
- **Status:** In review
- **Approved:** —
- **Last updated:** 2026-11-08 by Codex — CI service port fixed

**Untouched:** Architecture, Conventions, Known Gaps, Decisions, Deviations

---

**Scope.** Make the W5 real-database regression mandatory in CI and remove the W13 development Vercel verification check, as requested by the owner.

---

## 1. How to Resume

**Sessions** — none.

**Remaining**

- [ ] Gate 3: obtain the required independent GitHub review for [PR #22](https://github.com/CS3227-2610-MP4-Easel/CS3227-2610-MP4/pull/22) before merge.

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
| 2026-11-08 | Opened [PR #22](https://github.com/CS3227-2610-MP4-Easel/CS3227-2610-MP4/pull/22) against `development`. | W12 / W13 | `4271566` |
| 2026-11-08 | Published the CI Postgres service port to the runner so migrations and integration tests can reach it. | W12 | this commit |

## Folded record: `codex/w12-paths` (W12-paths)

Folded here on 2026-11-13 from `codex-w12-paths.md` (branch fully merged into `development`; owner Xiao-Congchen). W12 spec: [process-security paths](../../specs/2026-11-11-process-security-paths-design.md).

- **Change (2026-11-11, `122e83c`):** extracted from W7c the approved literal external-path fix to `scripts/agent-pre-tool-hook.mjs` (`isExternalPath`) and its regression tests; focused hook suite 19 passed, none skipped. Plan skipped by the operator.
- **Decision:** the operator approved the narrowed security spec and directed implementation without a separate plan; security tests and review stayed required. Recorded on the W7c branch as C~7 — keep one entry at fold, attributed to W12-paths.
- **Handover — shell working-directory assumption:** relative paths resolve against the Git root without an authoritative shell cwd; compound commands may change directory. Follow up with a cwd contract and tests.
- **Handover — other shell-mediation limits:** command-script effects, shell expansion, symlinks and normalisation of absolute protected write targets are not comprehensively handled; absolute repository paths may miss root-relative protected-path matching. The literal-path fix does not close these gaps.

## 7. Decisions

> Legend: `C` = project decision. AD-nn entries are in docs/architecture.

| ID | Date | Decision | Why / who asked | Source |
|---|---|---|---|---|
| C~1 | 2026-11-08 | Target this follow-up PR at `development`, not W5. | Owner selected `development` because the W5 branch is local-only and cannot be a GitHub PR base. | chat |
