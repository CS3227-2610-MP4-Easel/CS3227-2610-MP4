# W5 Core Planning Implementation Plan

- **Status:** Approved (operator, 2026-11-08)
- **Format:** v2
- **Spec:** [W5 design](../../specs/2026-11-07-w5-core-planning-design.md) | **Spec hash:** 988caf67f8ca
- **Workstream:** W5

> **For the orchestrator:** dispatch one task file at a time. Implementers read only their task file and this plan's shared context.

## Scope
**Goal:** Deliver the core planning domain and Tier 1 project, checkpoint, epic, and task API routes.
**In scope:** F1-F8, N1-N4, E1-E38.
**Non-goals:** schema changes; endpoints 8, 11, 14-15, 18-19, 25-33; UI; proposal routes; raw SQL or maintenance access.
**Risk tier:** High — tenancy, role authorization, transactions, and shared API composition require full review.

## Shared context
**Commands**
- Build/lint: `npm run typecheck` and `npm run lint`
- Tests: `npm test -- <target>`
- Schema check: `npm --workspace @agile/db run prisma:validate`

**Rules for every task**
- AD-55 — handlers never check roles; the policy map remains unchanged.
- N1/N3 — API does no table queries; core uses the filtered client, no raw SQL or maintenance client.
- N2 — mutations use `inMutationTransaction`, RepeatableRead, and commit rows plus task events together.
- SD3 — do not alter the Prisma schema or migrations.
- SD4 — `requireMember` treats archived projects as non-members; writes preserve the 404/409 anti-oracle precedence.
- SD5 — core registers only `core.projectBrief`, `core.checkpoints`, `core.taskEvents`, and `core.blockedTasks`.

**Boundaries.** Do not edit frozen contracts, policy-map entries, migrations, or another task's handover. Commit only files assigned to your task.

## Task order
| Task | File | Depends on | Concurrent with | Wave | Weight | Review | Status |
|---|---|---|---|---|---|---|---|
| T1 Core package and authorization seams | `tasks/T1.md` | - | - | 1 | complex | full | Done |
| T2 Projects, membership, and checkpoints | `tasks/T2.md` | T1 | - | 2 | complex | full | Done |
| T3 Epics and task lifecycle | `tasks/T3.md` | T1, T2 | - | 3 | complex | full | Done |
| T4 Derived functions, apply seams, and context sources | `tasks/T4.md` | T1, T3 | - | 4 | complex | full | Done |
| T5 API composition and Tier 1 route registration | `tasks/T5.md` | T2, T3, T4 | - | 5 | complex | full | Done |
| T6 End-to-end authorization and transaction regression suite | `tasks/T6.md` | T5 | - | 6 | complex | full | Done |

Bundles: none.

## Traceability
| Requirement | Task(s) | Verified by |
|---|---|---|
| F1 | T1, T4, T6 | core seam tests |
| F2 | T1 | membership tests |
| F3 | T2, T5 | project route tests |
| F4 | T2 | checkpoint tests |
| F5 | T3 | epic tests |
| F6 | T3 | task tests |
| F7 | T1, T4, T5 | resolver and boot tests |
| F8 | T4, T6 | apply tests |
| N1 | T1, T2, T3, T4, T5, T6 | tenancy tests |
| N2 | T2, T3, T6 | transaction tests |
| N3 | T1, T5 | boundary tests |
| N4 | T4 | derived tests |
| E1 | T1 | core seam test |
| E2 | T2 | project test |
| E3 | T2 | member test |
| E4 | T2 | member test |
| E5 | T2 | member test |
| E6 | T1 | resolver test |
| E7 | T2, T5 | archived mutation test |
| E8 | T3 | epic test |
| E9 | T3 | task test |
| E10 | T3 | task test |
| E11 | T3 | task test |
| E12 | T3 | task test |
| E13 | T3 | task test |
| E14 | T3 | task test |
| E15 | T3 | task test |
| E16 | T3 | task test |
| E17 | T3 | route test |
| E18 | T2, T5 | API validation test |
| E19 | T4, T5 | boot test |
| E20 | T4 | apply test |
| E21 | T1, T5 | import-boundary test |
| E22 | T4 | derived test |
| E23 | T1 | typecheck fixture |
| E24 | T4 | apply test |
| E25 | T4 | apply test |
| E26 | T3 | task transaction test |
| E27 | T2 | membership concurrency test |
| E28 | T3 | epic concurrency test |
| E29 | T3 | API validation test |
| E30 | T3 | task relation test |
| E31 | T4 | source test |
| E32 | T4 | source test |
| E33 | T4 | snapshot test |
| E34 | T2, T5 | authorization test |
| E35 | T1, T5 | resolver test |
| E36 | T4 | apply test |
| E37 | T3 | core actor test |
| E38 | T4 | source test |

## Close-out
- [ ] `node .claude/skills/writing-specs-lite-v2/scripts/lint.mjs plan workflow/plans/2026-11-08-w5-core-planning/plan.md --closeout` passes.
- [ ] `npm test`, `npm run typecheck`, `npm run lint`, and Prisma validation are green.
- [ ] Full Implementer, Tester, and Attacker review is complete; findings are fixed or recorded.
- [ ] Branch state is reconciled and Gate 3 branch review is requested before a PR or merge.
