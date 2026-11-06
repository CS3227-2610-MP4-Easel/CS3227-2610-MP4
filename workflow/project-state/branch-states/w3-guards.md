# Branch State — w3-guards

**What this branch has changed, and how to pick it up.** `workflow/project-state/STATE.md`
describes `INT`; read it for context and write here instead of editing it.
`sync-project-state` folds this file in after the branch merges.

- **Branch:** w3-guards (stacked on `w2-gateway` at `f8e5e0f`, whose last `INT` merge is `94ebc77`)
- **Base:** 94ebc77
- **Owner:** ludannnn (Developer member)
- **Status:** Draft
- **Approved:** —
- **Last updated:** 2026-11-06 by Claude Opus 5.5 — branch created, spec starting

**Untouched:** Architecture, Conventions, Known Gaps, Deviations

---

**Scope.** W3 Guards (the untrusted-text pipeline, AD-25): fill the guard slot W2 left in `src/be/llm-gateway/src/guards.ts` with the real input and output guards. Stacked on W2 so it can start before PR #14 merges (operator's choice, 2026-11-06).

---

## 1. How to Resume

**Sessions**

| Session | Started | Agent(s) | Workstream | Status | Doing | Next action | Last touched |
|---|---|---|---|---|---|---|---|
| S1 | 2026-11-06 | Claude Opus 5.5 | W3 | Blocked — needs human | Spec reviewed (2 rounds), lint clean; Gate 1 asked | On the operator's yes: set the index `Status: Approved (ludannnn, <date>)`, run `lint.mjs spec … --approved`, mark W3 `Spec'd`, then start `writing-plans-lite` | 2026-11-06 |

**Remaining**

- [ ] Gate 1: W3 spec approved by the operator.
- [ ] Gate 2: W3 plan approved by the operator.
- [ ] While stacked: if `w2-gateway` gets more review fixes, merge it into this branch (watch `guards.ts`).
- [ ] After PR #14 merges: merge `development` into this branch, move `Base`, and only then open the W3 PR into `development`. If W2 was squash-merged, rebase onto `development` instead.

---

## 2. Workstreams

| ID | Workstream | Status | Spec | Plan | Progress | Guide |
|---|---|---|---|---|---|---|
| W3 | Guards (untrusted-text pipeline) | Not started | [spec](../../specs/2026-11-06-w3-guards-design.md) (in review) | — | Spec reviewed, awaiting Gate 1; stacked on W2 | — |

---

## 3. Changes

| Date | What changed | Workstream | Ref |
|---|---|---|---|
| 2026-11-06 | W3 spec drafted (7 F, 5 N, E1-E56, T1-T3) and reviewed in two rounds (Implementer, Tester, Maintainer, Attacker; then Implementer, Attacker): about 10 distinct blocking findings fixed, among them a blind `GUARD_VERSION` fingerprint, a key check that could never fire in production, newline- and field-split injection, uncapped input, a throwing output walk, PII and link bypasses, and false positives on emoji, generics and headings; lint clean | W3 | 53488a7 |
| 2026-11-06 | Branch created from `w2-gateway` at `f8e5e0f` (stacked, so W3 can start before PR #14 merges) | W3 | this commit |

---

## 7. Decisions

> Legend: `C` = project decision. AD-nn entries are in docs/architecture.

### C~1 — W3 starts stacked on `w2-gateway`

- **Date:** 2026-11-06
- **Who asked:** operator (ludannnn), "lets do it", after asking whether W3 had to wait for PR #14
- **Decision:** branch W3 from `w2-gateway`, keep `Base` at the last `INT` sha W2 contains, merge `development` in after PR #14 merges, and open W3's PR only then. W3 edits W2's `guards.ts`, `budget.ts` and `gateway.ts` (spec SD7).
- **Why:** the 10 Nov freeze; W3's spec and code depend on W2's slot, not on its merge.
- **Rejected:** waiting for PR #14 to merge.

### C~2 — W3's scope choices

- **Date:** 2026-11-06
- **Who asked:** operator (ludannnn), choosing the recommended option in four questions before the spec
- **Decision:** risk tier High with four lenses (SD1); block only input emptied by sanitising, flag never blocks (SD2); the gateway wraps untrusted sections after fitting and appends the security suffix to the user message, and `output` gets the boundary and key (SD3); redact emails, phones, NRIC/FIN and NUS matric (SD4, NUSNET ids added by the author under T11).
- **Why:** architecture §7 and C-09 (truncate before wrapping; flagged input is marked, not blocked); T11.
- **Rejected:** Medium tier; never blocking; blocking on injection (would reverse §7); wrapping inside `input`; redacting long digit runs (damages commit SHAs).
