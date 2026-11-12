# W14 Sprints, Velocity and Re-plan Implementation Plan

- **Status:** Approved (operator, 2026-11-13)
- **Format:** v2
- **Spec:** [W14 design](../../specs/2026-11-12-w14-sprints-velocity-replan-design.md) | **Spec hash:** a4a3b3b5b8ef
- **Workstream:** W14

## Scope

**Goal:** Deliver endpoints 27–33 and 46–48 with architecture-aligned sprint, progress, velocity, forecast and proposal ownership.
**In scope:** F1–F10, N1–N5, E1–E27.
**Non-goals:** schema migrations/new logical entities, PM/Developer sprint mutations, LLM-derived calculations, background jobs, and new UI screens.
**Risk tier:** High — role-gated multi-user transactions, tenancy, session ownership and task history.

## Shared context

**Commands**
- Build: `npm run typecheck`
- Test: `npm test` and the touched workspace test command
- Style/lint: `git diff --check`; `node .claude/skills/writing-specs-lite-v2/scripts/lint.mjs plan workflow/plans/2026-11-12-w14-sprints-velocity-replan/plan.md`

**Rules for every task**
- C20: existing architecture contracts remain normative except the scoped endpoint-27 pagination reversal C~1.
- C~2/SD2: progress remains 0–100 percentage points.
- C~3/C~7: proposal, domain and session outcomes are atomic through the exact transaction-aware gateway.
- C~4: endpoint 48 requires the proposal session owner.
- C~5: `Core.applyReplan` owns domain validation/mutation but never `ai_proposals` lifecycle.
- C~6/C~8: REPLAN locks are project → proposal → session → referenced domain rows; validate current state; bound page/carry-over work.
- Route authorization remains policy-map-only; actor IDs come from the authenticated principal.
- Every mutation uses the W5 `inMutationTransaction` RepeatableRead helper and bounded retry policy.

**Boundaries.** Implementers read only their task file plus this context. They do not read state files or the spec. Each task commits only its files and writes its handover.

## Task order

| Task | File | Depends on | Concurrent with | Wave | Weight | Review | Status |
|---|---|---|---|---|---|---|---|
| T1 Shared W14 contracts and route metadata | `tasks/T1.md` | - | - | 1 | complex | full | Done |
| T2 Core sprint lifecycle, progress and velocity | `tasks/T2.md` | T1 | - | 2 | complex | full | Done |
| T3 Proposal owner, atomic session seam and domain-only re-plan | `tasks/T3.md` | T1 | - | 2 | complex | full | Done |
| T4 W8 digest persistence through ProposalService | `tasks/T4.md` | T3 | - | 3 | complex | full | Done |
| T5 API routes, composition and integration contracts | `tasks/T5.md` | T2, T3, T4 | - | 4 | complex | full | Not started |
| T6 Frontend API types and pagination consumers | `tasks/T6.md` | T1, T5 | - | 5 | standard | full | Not started |

Bundles: none. Shared API composition is deliberately delayed until both service owners are available.

## Traceability

| Requirement | Task(s) | Verified by |
|---|---|---|
| F1 | T1,T2,T5,T6 | core, route and client tests |
| F2 | T2,T5 | sprint create tests |
| F3 | T2,T5 | sprint patch tests |
| F4 | T2,T5 | sprint start race tests |
| F5 | T2,T5 | sprint close tests |
| F6 | T2,T5 | sprint delete tests |
| F7 | T2,T5,T6 | progress/velocity/client tests |
| F8 | T1,T4,T5,T6 | proposal list/digest/client tests |
| F9 | T3,T5 | proposal approval tests |
| F10 | T3,T5 | proposal rejection tests |
| N1 | T3,T5 | authorization/source-scan tests |
| N2 | T2,T3,T4,T5 | rollback/race tests |
| N3 | T1,T5,T6 | schema/bound/client tests |
| N4 | T3,T4,T5 | ownership/source-scan tests |
| N5 | T5 | request-id/redaction tests |
| E1 | T2,T5 | named sprint case |
| E2 | T2,T5 | named sprint case |
| E3 | T2,T5 | named sprint case |
| E4 | T2,T5 | named sprint case |
| E5 | T2,T5 | named sprint case |
| E6 | T2,T5 | named sprint case |
| E7 | T2,T5 | named sprint case |
| E8 | T2,T5 | named sprint case |
| E9 | T2,T5 | named sprint case |
| E10 | T2,T5 | named derived case |
| E11 | T2,T5 | named derived case |
| E12 | T5 | hidden-resource route case |
| E13 | T3,T5 | proposal conflict case |
| E14 | T3,T5 | proposal race case |
| E15 | T3,T5 | replay case |
| E16 | T3,T5 | authorization case |
| E17 | T3,T5 | tenancy case |
| E18 | T2,T5 | rollback case |
| E19 | T1,T5,T6 | bound case |
| E20 | T5 | source-scan case |
| E21 | T2,T5,T6 | pagination case |
| E22 | T2,T5 | progress case |
| E23 | T3,T5 | atomicity case |
| E24 | T5 | observability case |
| E25 | T4,T5 | zero-velocity forecast case |
| E26 | T2,T5 | source-task case |
| E27 | T3,T4,T5 | digest/approval race case |

## Close-out

- [ ] `lint.mjs plan ... --closeout` has no errors; every Done task has a valid handover.
- [ ] `npm test`, `npm run typecheck`, `npm run contract`, and Prisma validation pass.
- [ ] Branch diff receives code review with security findings resolved or recorded.
- [ ] Branch state moves W14 to `In review`, records changes and handovers, and asks for Gate 3 branch review.
