# Branch State — w11-security-corpus-authorisation-tests

**What this branch has changed, and how to pick it up.** `workflow/project-state/STATE.md`
describes `INT`; read it for context and write here instead of editing it.
`sync-project-state` folds this file in after the branch merges.

- **Branch:** w11-security-corpus-authorisation-tests (from `origin/development` at `3519ff077de611e79be28b1c3743a027675260c9`)
- **Base:** `3519ff077de611e79be28b1c3743a027675260c9`
- **Owner:** Dev Lead
- **Status:** In review
- **Approved:** — (project owner only)
- **Last updated:** 2026-11-09 by Codex — fixed PR #27 workspace CI loader compatibility and reran the full suite

**Untouched:** Architecture, Conventions, Known Gaps, Deviations

---

**Scope.** W11 provides the security corpus and authorisation tests. This branch is currently
at setup and design intake; implementation must wait for the W11 spec and plan approval gates.

---

## 1. How to Resume

**Setup:**

```bash
cd /private/tmp/cs3227-2610-mp4-w11
```

**Sessions** — one row per operator-initiated session, however many agents or subagents it runs.

| Session | Started | Agent(s) | Workstream | Status | Doing | Next action | Last touched |
|---|---|---|---|---|---|---|---|
| — | — | — | — | — | — | — | — |

Session status: `Active` · `Paused` · `Blocked — needs human` (name the question).

**Remaining** — work no session has claimed, in order.

- [x] Approve the W11 spec (Gate 1).
- [x] Approve the W11 implementation plan (Gate 2).
- [ ] Implement and verify the W11 corpus and authorisation tests.

---

## 2. Workstreams

| ID | Workstream | Status | Spec | Plan | Progress | Guide |
|---|---|---|---|---|---|---|
| W11 | Security corpus and authorisation tests | In review | [spec](../../specs/2026-11-09-w11-security-corpus-authorisation-tests-design.md) | [plan](../../plans/2026-11-09-w11-security-corpus-authorisation-tests/plan.md) | T1-T3 done; focused and full verification green; Gate 3 required | — |

---

## 3. Changes

One line per change on this branch: what changed and why, with a commit as the reference.

| Date | What changed | Workstream | Ref |
|---|---|---|---|
| 2026-11-09 | Created an isolated linked worktree and branch from `origin/development` so W11 work does not alter the current checkout | W11 | uncommitted |
| 2026-11-09 | Added and review-tightened the W11 declarative security corpus and policy-derived authorization spec | W11 | uncommitted |
| 2026-11-09 | Added the three-task W11 implementation plan and passed plan lint | W11 | uncommitted |
| 2026-11-09 | Recorded Gate 2 approval and began Wave 1 execution | W11 | uncommitted |
| 2026-11-09 | Completed T1 corpus schema and manifest, including review fixes and validated handover | W11 | 57b889d |
| 2026-11-09 | Completed T3 policy-derived authorization and source-rule tests after two review rounds and final correction | W11 | 53b7195 |
| 2026-11-09 | T2 hardening exercises the real registration seam, barrier release/upstream assertions, and worker timeout, but focused corpus verification fails T1-E2 because the frozen input guard leaves `W11_CANARY_ALPHA` and `<script>`; no production guard change is authorized by T2 | W11 | 6bcd277 |
| 2026-11-09 | Amended T1-E2/T2-E2 to match the frozen guard contract, then passed all focused and full verification suites | W11 | 46d2c0e |
| 2026-11-09 | Fixed E22 worker execution under CI by using the supported `--import=tsx` worker loader form; exact workspace launcher passes locally | W11 | uncommitted |

## 4. Decisions

| ID | Date | Decision | Why / who asked | Source |
|---|---|---|---|---|
| C~1 | 2026-11-09 | Use a declarative corpus with deterministic runners and a policy-derived authorization suite | Operator accepted the approach; disconnected hand-written tests risk policy drift, while one full-stack harness makes failures opaque | [spec §4.1](../../specs/2026-11-09-w11-security-corpus-authorisation-tests-design.md) |
| C~2 | 2026-11-09 | Keep W11 as verification over frozen guard and policy contracts; do not change production guard rules or policy entries | Preserves W1-W4/W6 ownership and `AD-26`/`AD-55`; Codex proposal accepted with the selected approach | [spec §3](../../specs/2026-11-09-w11-security-corpus-authorisation-tests-design.md) |
| C~3 | 2026-11-09 | Keep C~2 and amend T1-E2 to assert the frozen guard's actual contract: PII redaction and injection flagging, without requiring arbitrary non-PII canary/tag removal | Operator asked to proceed with the recommended option; changing W3 guard behavior would expand W11 scope and risk regressions | [spec amendment](../../specs/2026-11-09-w11-security-corpus-authorisation-tests-design.md) |

---

## 5. Deviations / Blockers

| Date | Type | Detail | Decision needed |
|---|---|---|---|
| 2026-11-09 | Resolved deviation | Initial T1-E2 expectation required arbitrary canary/tag removal not provided by the frozen guard; operator approved a spec/task/manifest amendment to test PII redaction and injection flagging instead | None |

## 6. Remaining / Handover

Gate 3: approved by operator. PR [#27](https://github.com/CS3227-2610-MP4-Easel/CS3227-2610-MP4/pull/27) is open against `development`; no merge has been performed.
