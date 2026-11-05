# Branch State — w2-gateway

**What this branch has changed, and how to pick it up.** `workflow/project-state/STATE.md`
describes `INT`; read it for context and write here instead of editing it.
`sync-project-state` folds this file in after the branch merges.

- **Branch:** w2-gateway (from `INT` at `7bd6544`; `development` merged in at `dc55769` after W4 and W12 merged)
- **Base:** 90e1e9c
- **Owner:** ludannnn (Developer member)
- **Status:** Draft
- **Approved:** —
- **Last updated:** 2026-11-05 by Claude Opus 5.5 — plan approved; starting T1

**Untouched:** Architecture, Conventions, Deviations

---

**Scope.** W2 Gateway runtime and mock: `LlmGateway.run`, `Sessions`, mock mode, the SoCLaaS client and the usage queries in `src/be/llm-gateway`. Mock mode first, because W3, W7, W8 and W9 build against it. W4 is merged, so the limiter is available.

---

## 1. How to Resume

**Sessions**

| Session | Started | Agent(s) | Workstream | Status | Doing | Next action | Last touched |
|---|---|---|---|---|---|---|---|
| S1 | 2026-11-05 | Claude Opus 5.5 | W2 | Active | Executing plan inline | Plan T1 step 1: failing `settings.test.ts`, `config.test.ts`, `fit.test.ts`, `no-network.test.ts`; needs `DATABASE_URL` in the agent's shell for `npm test` | 2026-11-05 |

**Remaining**

- [x] Spec review (Implementer, Tester, Maintainer, Attacker): findings fixed.
- [x] Gate 1: spec approved by ludannnn on 2026-11-05.
- [x] Gate 2: plan approved by ludannnn on 2026-11-05.
- [x] Merge `development` into this branch after W4's PR #10 merged (`dc55769`).
- [ ] Build T1 to T7, then close-out.
- [ ] Ask teleifo (W12 owner) to let agents write `workflow/specs/`, `workflow/plans/` and `workflow/project-state/branch-states/`, and run `git add`/`git commit` and `node` scripts (C~2).
- [ ] **Handover:** W15 owns endpoints 56 and 57 and their resolvers; W1's handover listed "session and usage" resolvers under W2 (spec SD3).
- [ ] **Handover:** W7, W8 and W9 register their mock responses with `registerMockResponse` at import of their module, put their rules in `STATIC` sections (non-static sections can be dropped when the prompt is over budget), and call `assertStaticSectionsFit` in a test.
- [ ] **Handover:** tell the PM and Dev Lead in the W2 PR that `createSessions` adds `regenerate` beside the frozen `Sessions` type (spec SD10), and that `Sessions.close` leaves the owner-or-approver check to their endpoints (SD11).
- [ ] **Handover:** W13 sets `LLM_MODE`, `SOCLAAS_API_KEY` (dev and prod keys differ, AD-58) and, if SoCLaaS is unreachable from Vercel, `AI_ENABLED=false` per tier.
- [ ] **Handover:** since the Prisma 7 merge, `npm test` (its `pretest` runs `prisma generate`) fails without `DATABASE_URL` set; tell the team to export it locally.

---

## 2. Workstreams

| ID | Workstream | Status | Spec | Plan | Progress | Guide |
|---|---|---|---|---|---|---|
| W2 | Gateway runtime and mock | Planned | [spec](../../specs/2026-11-05-w2-gateway-design.md) | [plan](../../plans/2026-11-05-w2-gateway.md) | Plan approved; T1 next | — |

---

## 3. Changes

| Date | What changed | Workstream | Ref |
|---|---|---|---|
| 2026-11-05 | Plan written (T1 to T7, close-out), reviewed (Implementer lens: no blocking, 9 minor, all fixed), updated after merging `development` (W4 merged, Prisma 7 adapter, test runner through `tests/setup-auth-env.ts`, W12 agent policy) and approved at Gate 2 | W2 | this commit |
| 2026-11-05 | Merged `development` (W4 PR #10, W12 PR #9) into the branch | W2 | dc55769 |
| 2026-11-05 | Spec approved at Gate 1 by the operator | W2 | efdb802 |
| 2026-11-05 | W2 spec drafted (7 F, 5 N, T1 to T7) and reviewed by four lenses: 5 blocking findings fixed (row written before its columns exist, fit failures leaving rows, static-section rule conflict, no clock seam, breaker race unstated); the spend cap reworked to keep AD-64's decaying budget block; the key restricted to the SoCLaaS host; 47 edge cases; lint clean | W2 | a40f7f8 |

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

### C~2 — Under the W12 agent policy, the operator runs git and places workflow files

- **Date:** 2026-11-05
- **Who asked:** operator (ludannnn), after W12's agent hook (`scripts/agent-pre-tool-hook.mjs`, `workflow/agent-permissions.json`) began denying the agent's shell writes, `node` scripts, commands naming `DATABASE_URL`, and edits under `workflow/`
- **Decision:** the agent edits `src/` and `tests/` and runs `npm test`, `npm run typecheck` and `npm run lint`; it drafts `workflow/` files in the git-ignored `.ws/` folder; the operator copies them into place and runs `git add`/`git commit`, `npm install` and `docker`. The policy itself is unchanged.
- **Why:** the policy is a team control just merged in W12; changing or bypassing it is not this branch's call.
- **Rejected:** disabling hooks locally (sidesteps a team control); editing the policy on this branch (W12 owner's file, review required).
