# Branch State — w6-ai-context

**What this branch has changed, and how to pick it up.** `workflow/project-state/STATE.md`
describes `INT`; read it for context and write here instead of editing it.
`sync-project-state` folds this file in after the branch merges.

- **Branch:** w6-ai-context (from `INT` at `46b33b1`)
- **Base:** 46b33b1
- **Owner:** ludannnn (Developer member)
- **Status:** Draft
- **Approved:** —
- **Last updated:** 2026-11-06 by Claude Opus 5.5 — branch created, spec starting

**Untouched:** Architecture, Conventions, Known Gaps, Deviations

---

**Scope.** W6 AI context assembly: `AiContext.assemble(caller, feature, targetProjectId)` (contracts §5.2, A-08, AD-56), the one membership-scoped function every AI feature uses to build its context sections, plus the source-scan test that stops features building their own context queries (AD-25). W6 does not need W3's code, only its section rules (W3 spec conventions.md), so it branches from `development`, not from `w3-guards`.

---

## 1. How to Resume

**Sessions**

| Session | Started | Agent(s) | Workstream | Status | Doing | Next action | Last touched |
|---|---|---|---|---|---|---|---|
| S1 | 2026-11-06 | Claude Opus 5.5 | W6 | Active | Gate 1 approved; writing the plan | Write `workflow/plans/2026-11-06-w6-ai-context.md` with `writing-plans-lite` (T1-T3), review it, then ask Gate 2 | 2026-11-06 |

**Remaining**

- [x] Gate 1: W6 spec approved by ludannnn on 2026-11-06.
- [ ] Gate 2: W6 plan approved by the operator.
- [ ] The operator is asking W5's owner (Dev Lead) for a delivery estimate; W6's membership check and its core-owned sections depend on W5.

---

## 2. Workstreams

| ID | Workstream | Status | Spec | Plan | Progress | Guide |
|---|---|---|---|---|---|---|
| W6 | AI context assembly | Spec'd | [spec](../../specs/2026-11-06-w6-ai-context-design.md) | — | Spec approved at Gate 1; plan next | — |

---

## 3. Changes

| Date | What changed | Workstream | Ref |
|---|---|---|---|
| 2026-11-06 | Spec approved at Gate 1 by the operator | W6 | this commit |
| 2026-11-06 | W6 spec drafted (7 F, 5 N, E1-E45, T1-T3) and reviewed in two rounds (Implementer, Tester, Maintainer, Attacker; then Implementer, Attacker): about 16 distinct blocking findings fixed, among them the core → ai-context dependency inversion, the frozen `assemble` narrowing (operator: sign-off at PR, C~2), nondeterministic failures, a membership race, free text in the trusted facts section, rows changed after checking, production reset of the registries, and source-scan bypasses; lint clean | W6 | this commit |
| 2026-11-06 | Branch created from `development` at `46b33b1` (after PR #14 merged) | W6 | this commit |

---

## 7. Decisions

> Legend: `C` = project decision. AD-nn entries are in docs/architecture.

### C~1 — W6's scope choices

- **Date:** 2026-11-06
- **Who asked:** operator (ludannnn), choosing the recommended option in three questions before the spec
- **Decision:** W6 is a source registry: it owns the per-feature allow-list, the membership check and per-row scope checks, and each section's rows come from a source function the owning module registers (spec SD1); membership goes through the frozen `Core.requireMember`, registered by W5 (SD2); risk tier High with four lenses (SD3).
- **Why:** architecture §4 table ownership (A-03); W5 has not started, so W6 must ship without it; W6 is the tenancy control (T4, C-05).
- **Rejected:** W6 reading every table directly through the filtered client; W6 writing its own member lookup; three lenses.

### C~2 — Keep the frozen `assemble`; sign off `assembleWith` at the PR (AD-11)

- **Date:** 2026-11-06
- **Who asked:** operator (ludannnn), "Keep + sign-off at PR", after the Maintainer and Implementer lenses showed that the frozen `assemble` cannot serve `DEV_SUMMARY` or `DEV_STANDUP`
- **Decision:** the frozen `AiContext` type stays as it is; `assembleWith` is added beside it; `assemble` throws `INVALID_ASSEMBLE_INPUT` for the two Developer features. This is recorded as a deviation from contracts §5.2's promise, and the W6 PR asks the PM and the Dev Lead to sign off under AD-11, with a contracts §5.2 follow-up naming `assembleWith` (spec SD4).
- **Why:** the frozen signature cannot carry item ids, the standup window or the PM's query; AD-11 needs all three owners for any change to a frozen interface.
- **Rejected:** amending the frozen type first (W6 waits on two owners); keeping it without a deviation (narrows a frozen promise silently).
