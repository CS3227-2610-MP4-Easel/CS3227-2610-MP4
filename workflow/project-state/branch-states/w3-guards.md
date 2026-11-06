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
| S1 | 2026-11-06 | Claude Opus 5.5 | W3 | Active | T1 done; T2 next | T2 step 1: write failing `src/be/llm-gateway/test/output-check.test.ts` per the plan | 2026-11-06 |

**Remaining**

- [x] Gate 1: W3 spec approved by ludannnn on 2026-11-06, including NUSNET redaction (SD4) and the known limits.
- [x] Gate 2: W3 plan approved by ludannnn on 2026-11-06.
- [ ] While stacked: if `w2-gateway` gets more review fixes, merge it into this branch (watch `guards.ts`).
- [ ] After PR #14 merges: merge `development` into this branch, move `Base`, and only then open the W3 PR into `development`. If W2 was squash-merged, rebase onto `development` instead.

---

## 2. Workstreams

| ID | Workstream | Status | Spec | Plan | Progress | Guide |
|---|---|---|---|---|---|---|
| W3 | Guards (untrusted-text pipeline) | Building | [spec](../../specs/2026-11-06-w3-guards-design.md) | [plan](../../plans/2026-11-06-w3-guards.md) | Task 1/3 done; T2 output guard next | — |

---

## 3. Changes

| Date | What changed | Workstream | Ref |
|---|---|---|---|
| 2026-11-06 | T1: `sanitise.ts`: `sanitiseInput` (cut, NFKC with digit and dot folding, line endings, invisible characters, delimiter tags to stability with the 10-pass bracket strip, PII P1-P6, flag), `injectionFlag` (two match copies, confusable map), `cleanTrustedText`; rule data as `{ id, source, flags }`; 21 unit tests (E1-E17, E34, E37, F4); 326 tests, 325 pass, 1 fails (D~1 from W2), none skipped | W3 | this commit |
| 2026-11-06 | Plan written (T1-T3, close-out), reviewed (Implementer lens: no blocking, 2 major and 3 minor, all fixed: testable fingerprint, `gatewaySecrets` helper, wave-1 imports, traversal order, line ranges) and approved at Gate 2 | W3 | this commit |
| 2026-11-06 | Spec wording: two edge-case strings reworded (`e123456`, the LANGUAGE TAG character) so the plan lint does not read them as edge-case IDs; meaning unchanged; logged as skill feedback | W3 | this commit |
| 2026-11-06 | Spec approved at Gate 1 by the operator | W3 | a01418f |
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
