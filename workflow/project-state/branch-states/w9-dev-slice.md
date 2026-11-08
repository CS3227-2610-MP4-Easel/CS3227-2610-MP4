# Branch State — w9-dev-slice

**What this branch has changed, and how to pick it up.** `workflow/project-state/STATE.md`
describes `INT`; read it for context and write here instead of editing it.
`sync-project-state` folds this file in after the branch merges.

- **Branch:** w9-dev-slice (from `INT` at `dc3447f`)
- **Base:** dc3447f
- **Owner:** ludannnn (Developer member)
- **Status:** Draft
- **Approved:** —
- **Last updated:** 2026-11-08 by Claude Opus 5.5 — spec approved at Gate 1

**Untouched:** Architecture, Conventions, Deviations

---

**Scope.** W9 Developer upload, summaries and standup, backend only: endpoints 49-52 and 55 (architecture §9.4), the `src/be/dev` package, the `dev.activityItems` and `dev.itemSummaries` context sources, the DEV_SUMMARY and DEV_STANDUP mocks, and the dev resource resolvers. The S20 and S18 screen wiring is a follow-up (C~1). W5 (PR #23) is open: the spec is written now, while building waits for W5 to merge (C~4).

---

## 1. How to Resume

**Sessions**

| Session | Started | Agent(s) | Workstream | Status | Doing | Next action | Last touched |
|---|---|---|---|---|---|---|---|
| S1 | 2026-11-08 | Claude Opus 5.5 (lead) + 4 read-only reviewers (Explore; the repo `reviewer` agent was not loaded) | W9 | Paused | Spec approved (Gate 1); waiting for PR #23 | When W5 merges: merge `development` into this branch, move Base, re-check § 4.6 against W5's final files (fixes 3 and 4), then run `writing-plans-lite-v2` on the spec | 2026-11-08 |

**Remaining**

- [x] Gate 1: W9 spec approved by ludannnn on 2026-11-08 (one review round, four lenses).
- [ ] Check PR #23 fixes 3 (membership in `core.taskEvents` / `core.blockedTasks`) and 4 (archive check inside the mutation transaction); if fix 4 changes `assertWritable`, amend the spec's writable seam (SD in § 8).
- [ ] Gate 2: W9 plan (after W5 merges, rebase onto `development`).
- [ ] **Handover:** contracts.md rows 50 and 51 list fewer errors than W9 returns (`RATE_LIMITED`, `AI_DISABLED`, 422 for `BLOCKED_INPUT`, 404, 409); add them as a clarification (they follow architecture §8 and the W3 handover).
- [ ] **Handover:** tell W17 that `CACHE_HIT` rows now exist for DEV_SUMMARY and DEV_STANDUP (spec SD13); summary hits have a null `session_id`.
- [ ] **Handover:** S20 (Upload and standup) and S18 (Team standups) wiring to the live API is a Medium follow-up spec (C~1); the browser must cut bodies over 2000 characters instead of rejecting them (spec SD on truncation).

---

## 2. Workstreams

| ID | Workstream | Status | Spec | Plan | Progress | Guide |
|---|---|---|---|---|---|---|
| W9 | Developer upload, summaries, standup | Spec'd | [spec](../../specs/2026-11-08-w9-dev-slice-design.md) (approved 2026-11-08) | — | Spec approved; plan waits on W5 merge (C~4) | — |

---

## 3. Changes

| Date | What changed | Workstream | Ref |
|---|---|---|---|
| 2026-11-08 | Branch state created; W9 spec written, reviewed (four lenses) and approved | W9 | this commit |

---

## 6. Known Gaps

- **Upload storage is unbounded** — endpoint 49 has no per-user rate limit or row cap and activity items are never deleted; spend is bounded by the session caps and AI windows, storage is not.
- **A regeneration or summary retry can spend a session without storing anything** — `regenerate` counts before `run`, so a busy or refused standup call uses one of the five regenerations and stores nothing.
- **A Developer on four or more projects can hit the 3-open DEV_STANDUP cap** — W9 leaves standup sessions open for W16's edit and accept (53, 54), so a fourth standup within 30 minutes gets 429 `RATE_LIMITED`.

---

## 7. Decisions

> Legend: `C` = project decision. AD-nn entries are in docs/architecture.

### C~1 W9 is backend only; screen wiring is a follow-up
- **Date:** 2026-11-08 · **Asked by:** ludannnn (operator)
- **Decision:** this spec covers endpoints 49-52 and 55 and the `dev` package; wiring S20 and S18 to the live API gets its own Medium spec after the backend merges.
- **Why:** the backend can merge sooner and the UI change is lower risk; feature freeze is 10 Nov (AD-69).
- **Rejected:** one spec and PR for backend and UI (larger review, later merge).

### C~2 The standup activity window is anchored to the standup date
- **Date:** 2026-11-08 · **Asked by:** ludannnn (operator), closing the W10 handover on future standup dates
- **Decision:** the window runs from 00:00 (Asia/Singapore) of the working day before the standup date to now (AD-44 applied per date).
- **Why:** a standup prepared for tomorrow should cover today, not the day before as well.
- **Rejected:** keeping `standupActivityWindow(now)`, which ignores the date.

### C~3 W9 is High risk
- **Date:** 2026-11-08 · **Asked by:** ludannnn (operator)
- **Decision:** High tier: Implementer, Tester, Maintainer and Attacker lenses.
- **Why:** untrusted uploaded text, per-developer ownership, a cross-role read (Dev Lead reads standups) and membership checks.
- **Rejected:** Medium.

### C~4 Spec now, build after W5 merges
- **Date:** 2026-11-08 · **Asked by:** ludannnn (operator)
- **Decision:** write and approve the spec while PR #23 is in review; plan and build after it merges.
- **Why:** W9 uses W5's `requireMember`, `assertWritable`, resolver pattern, `request.userId` and the core context sources; only the writable check may change shape under the review (fix 4), and the spec isolates it behind one seam.
- **Rejected:** branching from `w5-core-planning` now (rebase churn while W5 changes).

### C~5 An unchanged input hash returns the stored standup, even when degraded
- **Date:** 2026-11-08 · **Asked by:** ludannnn (operator), after the Maintainer review flagged a contract conflict
- **Decision:** follow contracts row 51, architecture §9.4 and AD-06: the same hash returns the stored row with `cached: true`.
- **Why:** contracts remain normative (C20); no amendment needed.
- **Rejected:** retrying the model on degraded rows (needs a contracts.md amendment agreed by all owners).

### C~6 W9 adds `recordCacheHit` and `openOrReuse` to the gateway
- **Date:** 2026-11-08 · **Asked by:** ludannnn (operator, also the W2 owner)
- **Decision:** W9 adds two additive functions to `src/be/llm-gateway`: `recordCacheHit` writes the `CACHE_HIT` rows AD-18 requires; `openOrReuse` lets summary batches share one session.
- **Why:** `usage.ts` counts `CACHE_HIT` rows but nothing wrote them, and W17 needs hit-rate evidence; one session per batch would use half the daily cap on a 100-item upload.
- **Rejected:** deferring `CACHE_HIT` to W17 with a Deviation.
