# Branch State — w12-ci-secret-scan-retry

**What this branch has changed, and how to pick it up.** `workflow/project-state/STATE.md`
describes `INT`; read it for context and write here instead of editing it.

- **Branch:** w12-ci-secret-scan-retry (from `INT` at `dc3447f`)
- **Base:** dc3447f
- **Owner:** operator / Codex
- **Status:** In review
- **Approved:** —
- **Last updated:** 2026-11-08 by Codex — adding resilient Gitleaks download retries

**Untouched:** Architecture, Conventions, Known Gaps, Decisions, Deviations

---

**Scope.** W12 CI/process-security reliability: make the pinned Gitleaks download tolerate transient HTTP 504 responses without weakening checksum verification or skipping the scan.

---

## 1. How to Resume

**Sessions**

| Session | Started | Agent(s) | Workstream | Status | Doing | Next action | Last touched |
|---|---|---|---|---|---|---|---|
| 2026-11-08 CI retry | 2026-11-08 | Codex | W12 | Done | Added bounded curl retries while preserving the pinned Gitleaks checksum | Owner review of the CI follow-up branch | 2026-11-08 |

**Remaining**

- [x] Add retry flags to the pinned Gitleaks download, validate, commit, and push.

---

## 2. Workstreams

| ID | Workstream | Status | Spec | Plan | Progress | Guide |
|---|---|---|---|---|---|---|
| W12 | CI and process security | In review | [spec](../../specs/2026-11-02-w12-ci-process-security-design.md) | [plan](../../plans/2026-11-02-w12-ci-process-security-plan.md) | Secret-scan reliability follow-up in flight | — |

---

## 3. Changes

| Date | What changed | Workstream | Ref |
|---|---|---|---|
| 2026-11-08 | Started a CI-only follow-up from `origin/development` after repeated Gitleaks release-download 504 failures | W12 | working tree |
| 2026-11-08 | Added five retries, retry-on-all-errors, bounded timeouts, and delay to Gitleaks download; checksum verification remains unchanged | W12 | this commit |
