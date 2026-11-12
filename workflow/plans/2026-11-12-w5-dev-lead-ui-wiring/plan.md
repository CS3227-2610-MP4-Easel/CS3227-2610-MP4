# W5 Dev Lead UI wiring implementation plan

- **Status:** Approved (project operator, 2026-11-12)
- **Format:** v2
- **Spec:** [W5 design](../../specs/2026-11-12-w5-dev-lead-ui-design.md) | **Spec hash:** 47a4c0c68bb6
- **Workstream:** W5

## Scope
**Goal:** Wire W5 Dev Lead project pages to live UUID APIs while preserving prototype routes.
**In scope:** F1-F8, N1-N3, E1-E15.
**Non-goals:** W14 sprints/re-plan, W16 member removal, PM project create/archive, backend contract changes.
**Risk tier:** High - authenticated routing, tenancy, mutations and shared error handling.

## Shared context
**Commands**
- Build: `npm run typecheck`
- Test: `npm --workspace easel-fe run test -- --run`
- Style/lint: `npm --workspace easel-fe run lint`

**Rules for every task**
- UUID routes use `apiFetch`; non-UUID routes stay on the prototype store.
- Only the route adapter checks UUID syntax; project screens consume route context and adapter clients.
- W5 never sends `sprintId`; W14 owns sprint assignment.
- Backend authorization and tenancy remain authoritative; no frontend role bypass or database imports.
- Use safe fixed error messages; never render arbitrary server error text.
- Every focused test names its F/N/E requirement ID.

**Boundaries.** Implementers read only their task file plus this context. They commit only their task's
files and write the named handover JSON. No task changes backend contracts or Prisma.

## Task order
| Task | File | Depends on | Concurrent with | Wave | Weight | Review | Status |
|---|---|---|---|---|---|---|---|
| T1 Route identity and shared error seam | `tasks/T1.md` | - | - | 1 | complex | full | Done |
| T2 W5 typed API clients and DTOs | `tasks/T2.md` | - | - | 1 | complex | full | Done |
| T3 Project list and overview surfaces | `tasks/T3.md` | T1,T2 | - | 2 | complex | full | Not started |
| T4 Board, backlog, checkpoints, members and task mutations | `tasks/T4.md` | T1,T2 | - | 2 | complex | full | Not started |
| T5 Focused integration verification and closeout repairs | `tasks/T5.md` | T3,T4 | - | 3 | complex | full | Not started |

Bundles: none; T3 and T4 touch separate screen files but share T1/T2 handovers.

## Traceability
| Requirement | Task(s) | Verified by |
|---|---|---|
| F1 | T2,T3 | project API and live project state tests |
| F2 | T2,T3 | project API and live project state tests |
| F3 | T2,T4 | endpoint and mutation state tests |
| F4 | T2,T4 | endpoint and mutation state tests |
| F5 | T2,T4 | endpoint and mutation state tests |
| F6 | T2,T4 | endpoint and mutation state tests |
| F7 | T1,T3,T4 | prototype-route regression tests |
| F8 | T1,T3,T4,T5 | error and page-state tests |
| N1 | T1,T4,T5 | role and tenancy tests |
| N2 | T1,T5 | source-rule tests |
| N3 | T5 | requirement-labelled focused suite |
| E1 | T3,T4 | page tests |
| E2 | T3,T4 | loading tests |
| E3 | T1,T3,T4 | error tests |
| E4 | T2,T4 | validation tests |
| E5 | T4 | conflict tests |
| E6 | T4 | filter tests |
| E7 | T1,T3,T4 | prototype regression tests |
| E8 | T1,T5 | source/API tests |
| E9 | T2,T4 | stale-write tests |
| E10 | T4,T5 | mutation failure tests |
| E11 | T2,T4 | member dedupe tests |
| E12 | T2,T4 | timeout tests |
| E13 | T2,T4 | task tenancy tests |
| E14 | T1,T3,T4 | adapter tests |
| E15 | T2,T4 | nested tenancy tests |

## Close-out
- [ ] `lint.mjs plan ... --closeout` passes with valid handovers.
- [ ] Frontend tests, typecheck and lint pass.
- [ ] Branch diff reviewed; blockers fixed or recorded.
- [ ] Branch state set to In review with W5 Changes and handover.
- [ ] Ask the operator for Gate 3 branch review approval.
