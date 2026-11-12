# Branch State — w14-sprints-velocity-replan

**What this branch has changed, and how to pick it up.** `workflow/project-state/STATE.md`
describes `INT`; read it for context and write here instead of editing it.
`sync-project-state` folds this file in after the branch merges.

- **Branch:** w14-sprints-velocity-replan (from W8 at `6db7a0021c75c83fe89739961a9bdfac3f6607d9`)
- **Base:** 2c5dd9f0b1c8f23610af5b6638818110f3bc5b02
- **Owner:** operator / repository owner
- **Status:** Draft
- **Approved:** —
- **Last updated:** 2026-11-12 by Codex — final review found cross-workstream blockers

**Untouched:** Architecture, Conventions, Known Gaps, Deviations

---

**Scope.** W14 Sprints, velocity and re-plan: endpoints 27–32 and 46–48, building on the W8 Dev Lead facts/digest branch and its W5 base.

---

## 1. How to Resume

**Setup**

```bash
cd /Users/trevortan/.codex/worktrees/w14-sprints-velocity-replan/CS3227-2610-MP4
```

**Sessions**

| Session | Started | Agent(s) | Workstream | Status | Doing | Next action | Last touched |
|---|---|---|---|---|---|---|---|
| S1 | 2026-11-12 | Codex | W14 | Blocked — needs human | Final review found proposal/session and existing-contract conflicts | Owner resolves the listed W14 contract questions before the spec can reach Gate 1 | 2026-11-12 |

Session status: `Active` · `Paused` · `Blocked — needs human`.

**Remaining**

- [ ] Draft, review and obtain Gate 1 approval for the W14 design spec.
- [ ] Produce the implementation plan after spec approval.
- [x] **Q~1:** Resolved by C~1: reverse C20 narrowly for W14 endpoint 27 and add bounded pagination.
- [ ] **Q~2:** Keep the existing 0–100 progress contract used by W8 and `ProgressSchema`, or approve a project-wide ratio change.
- [ ] **Q~3:** Choose proposal/session closure semantics: add a transaction-aware gateway seam, or accept post-commit idempotent retry/reconciliation.
- [ ] **Q~4:** Decide whether endpoint 48 is restricted to the session owner or whether the session contract expands to permit any authorized project Dev Lead to reject.
- [ ] **Q~5:** Approve the W14 refactor that moves `ai_proposals` validation/status access out of `Core.applyReplan` into the new proposals owner.

---

## 2. Workstreams

| ID | Workstream | Status | Spec | Plan | Progress | Guide |
|---|---|---|---|---|---|---|
| W14 | Sprints, velocity and re-plan | Spec'd | [spec](../../specs/2026-11-12-w14-sprints-velocity-replan-design.md) | — | Drafting spec under approved core/lead split | — |

## 3. Changes

| Date | What changed | Workstream | Ref |
|---|---|---|---|
| 2026-11-12 | Created isolated W14 worktree and branch from W8 tip `6db7a00`; verified W5 base is present | W14 | this commit |
| 2026-11-12 | Operator approved the architecture-aligned split: `core` owns sprint/progress/velocity and `lead` owns forecast/re-plan | W14 | this commit |
| 2026-11-12 | Operator approved C~1: reverse C20 narrowly for W14 endpoint 27 and add bounded pagination | W14 | this commit |
| 2026-11-12 | Merged `origin/development` at `2c5dd9f`, including W8 PR #28, with no conflicts | W14 | merge commit |
| 2026-11-12 | Amended W14 after review: endpoint-27 pagination, proposal service ownership, shared locks, session closure, exact errors and zero-velocity behavior | W14 | this commit |
| 2026-11-12 | Final review found blockers: existing 0–100 progress behavior, proposal-table access in `Core.applyReplan`, and unresolved session/authorization atomicity | W14 | this commit |

## 4. Decisions

> Legend: `C` = project decision. AD-nn entries are in docs/architecture.

| ID | Date | Decision | Why / who asked | Source |
|---|---|---|---|---|
| C~1 | 2026-11-12 | Reverse C20 narrowly for W14 endpoint 27: add standard bounded pagination rather than preserve the unpaginated sprint list. | Operator chose this after review identified unbounded read/response work; all other existing contracts remain governed by C20. | W14 spec Gate 1 preparation |
