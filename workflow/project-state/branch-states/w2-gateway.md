# Branch State — w2-gateway

**What this branch has changed, and how to pick it up.** `workflow/project-state/STATE.md`
describes `INT`; read it for context and write here instead of editing it.
`sync-project-state` folds this file in after the branch merges.

- **Branch:** w2-gateway (from `INT` at `7bd6544`)
- **Base:** 7bd6544
- **Owner:** ludannnn (Developer member)
- **Status:** Draft
- **Approved:** —
- **Last updated:** 2026-11-05 by Claude Opus 5.5 — W2 spec drafted, in review

**Untouched:** Architecture, Conventions, Deviations

---

**Scope.** W2 Gateway runtime and mock: `LlmGateway.run`, `Sessions`, mock mode, the SoCLaaS client and the usage queries in `src/be/llm-gateway`. Mock mode first, because W3, W7, W8 and W9 build against it. W4 (PR #10) is not merged yet; the limiter task waits for it.

---

## 1. How to Resume

**Sessions**

| Session | Started | Agent(s) | Workstream | Status | Doing | Next action | Last touched |
|---|---|---|---|---|---|---|---|
| S1 | 2026-11-05 | Claude Opus 5.5 | W2 | Blocked — needs human | Spec reviewed and revised | Gate 1: operator approves the W2 spec | 2026-11-05 |

**Remaining**

- [x] Spec review (Implementer, Tester, Maintainer, Attacker): findings fixed.
- [ ] Gate 1: operator approves the spec.
- [ ] Plan (Gate 2), then build T1 to T7.
- [ ] Merge `development` into this branch once W4's PR #10 merges (needed by T5).
- [ ] **Handover:** W15 owns endpoints 56 and 57 and their resolvers; W1's handover listed "session and usage" resolvers under W2 (spec SD3).
- [ ] **Handover:** W7, W8 and W9 register their mock responses with `registerMockResponse` at import of their module, put their rules in `STATIC` sections (non-static sections can be dropped when the prompt is over budget), and call `assertStaticSectionsFit` in a test.
- [ ] **Handover:** tell the PM and Dev Lead in the W2 PR that `createSessions` adds `regenerate` beside the frozen `Sessions` type (spec SD10), and that `Sessions.close` leaves the owner-or-approver check to their endpoints (SD11).
- [ ] **Handover:** W13 sets `LLM_MODE`, `SOCLAAS_API_KEY` (dev and prod keys differ, AD-58) and, if SoCLaaS is unreachable from Vercel, `AI_ENABLED=false` per tier.

---

## 2. Workstreams

| ID | Workstream | Status | Spec | Plan | Progress | Guide |
|---|---|---|---|---|---|---|
| W2 | Gateway runtime and mock | Not started | [spec](../../specs/2026-11-05-w2-gateway-design.md) | — | Spec reviewed; Gate 1 pending | — |

---

## 3. Changes

| Date | What changed | Workstream | Ref |
|---|---|---|---|
| 2026-11-05 | W2 spec drafted (7 F, 5 N, T1 to T7) and reviewed by four lenses: 5 blocking findings fixed (row written before its columns exist, fit failures leaving rows, static-section rule conflict, no clock seam, breaker race unstated); the spend cap reworked to keep AD-64's decaying budget block; the key restricted to the SoCLaaS host; 47 edge cases; lint clean | W2 | this commit |

---

## 6. Known Gaps

New entry:

- **A few users can use up the global AI windows** — the per-user windows (6 a minute, 200 a day) limit each user, but four or five active users can exhaust `global:min` (25 a minute) and everyone else gets `AI_BUSY` until the window resets; there is no per-project share.

## 7. Decisions

> Legend: `C` = project decision. AD-nn entries are in docs/architecture.

### C~1 — W2's scope boundaries and starting values

- **Date:** 2026-11-05
- **Who asked:** operator (ludannnn, Developer member), accepting the assumptions proposed before the spec ("im ok")
- **Decision:** W2 builds the whole `run` path with a guard slot W3 fills (spec SD1); feature owners register their own mock responses (SD2); usage endpoints and their resolvers belong to W15 (SD3); model records, prices and limits are a configuration module (SD4); `LLM_MODE` selects mock or live (SD5); `@agile/db` marks its transactions so `run` can refuse inside one (SD6). Starting values: 6 per user and 25 global per minute, 200 per user and 2,000 global per day, a 20,000,000 µ$ daily spend cap, breaker at 5 failures for 60 s, 20 s attempt timeout, 30-minute session inactivity.
- **Why:** W3, W7, W8 and W9 need a working gateway and mock now; the numbers follow MP3's values and the shared key's limits.
- **Rejected:** W2 waiting for W3's guards; W2 writing feature mock responses; a capability table with a migration.
