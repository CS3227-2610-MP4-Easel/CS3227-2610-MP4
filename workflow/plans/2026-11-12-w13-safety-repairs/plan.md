# W13 Safety Repairs Implementation Plan

- **Status:** Approved (operator, 2026-11-12)
- **Format:** v2
- **Spec:** [W13 safety repairs](../../specs/2026-11-12-w13-safety-repairs-design.md) | **Spec hash:** 83f153d1e802
- **Workstream:** W13

## Scope

**Goal:** Bind recovery writes to the confirmed Neon target and restore AD-32-compliant migration-before-deployment CI.
**In scope:** F1-F5, N1-N2, E1-E10.
**Non-goals:** Neon API integration, schema changes, new dependencies, Vercel API tokens, and production secret values.
**Risk tier:** High - database targeting, production migration, deployment sequencing, and secrets.

## Shared context

**Commands**
- Focused tests: `npm test -- --test-name-pattern='tier|seed|workflow|migration|production'`
- Full tests: `npm test`
- Static checks: `npm run typecheck`, `npm run lint`, `npm run contract`, `git diff --check`
- Workflow checks: `npm run check:workflows -- --base-sha <sha> --base-branch development --pr-number 26`

**Rules for every task**
- AD-32/C~12: production migration and deployment run only from protected CI.
- C~13: recovery is exactly `falling-rice-06970921 / w13-recovery-baseline / ep-purple-shape-aohygd1w.c-2.ap-southeast-1.aws.neon.tech / neondb`.
- C~15: production runtime remains pooled at `ep-summer-heart-b3767eul-pooler.c-4.ap-southeast-1.aws.neon.tech`; production migrations use direct host `ep-summer-heart-b3767eul.c-4.ap-southeast-1.aws.neon.tech`.
- No secret or credential values in source, tests, logs, or evidence.
- The production workflow uses only pinned approved Actions and no pull-request or manual-dispatch production path.

**Boundaries.** Implementers read only their task file and this Shared context. They do not read state files or the spec. Each task commits only its own files and writes its own handover.

## Task order

| Task | File | Depends on | Concurrent with | Wave | Weight | Review | Status |
|---|---|---|---|---|---|---|---|
| T1 Exact recovery target binding | `tasks/T1.md` | - | - | 1 | complex | full | Done |
| T2 Workflow checker contracts | `tasks/T2.md` | - | - | 1 | complex | full | Done |
| T3 Protected production workflow | `tasks/T3.md` | T2 | - | 2 | complex | full | In progress |
| T4 Runbook and migration regression coverage | `tasks/T4.md` | T1, T3 | - | 3 | standard | full | Done |

## Traceability

| Requirement | Task(s) | Verified by |
|---|---|---|
| F1 | T1 | exact target and zero-client recovery tests |
| F2 | T3 | protected workflow contract and failure-order tests |
| F3 | T3, T4 | wrapper invocation and runbook static tests |
| F4 | T2, T3 | checker baseline/production-contract tests |
| F5 | T1, T2, T3, T4 | focused and full test suites |
| N1 | T1, T3, T4 | zero-client, no-hook, and failure tests |
| N2 | T3, T4 | child environment and secret-boundary tests |
| E1 | T1 | wrong recovery host test |
| E2 | T1 | wrong recovery identity test |
| E3 | T1 | malformed/pooled/production recovery URL test |
| E4 | T3, T4 | migration and hook failure tests |
| E5 | T2, T3 | trigger and protection tests |
| E6 | T3 | concurrency contract test |
| E7 | T4 | wrapper-only runbook test |
| E8 | T2 | dead-exemption regression test |
| E9 | T2, T3 | action pin and production contract tests |
| E10 | T3, T4 | secret-boundary tests |

## Close-out

- [ ] `lint.mjs plan <plan.md> --closeout` has no errors; every Done task has a valid handover.
- [ ] Full tests, typecheck, lint, contract, workflow checker, secret scan, and diff check pass.
- [ ] Branch diff review confirms all four reported findings are fixed.
- [ ] Branch state is `In review`, session rows are reconciled, Changes and any Deviations are recorded.
- [ ] Ask the operator for Gate 3 branch review before push or merge.
