# W8 Dev Lead Facts and Digest Implementation Plan

- **Status:** Approved (project operator, 2026-11-09)
- **Format:** v2
- **Spec:** [W8 design](../../specs/2026-11-09-w8-dev-lead-facts-digest-design.md) | **Spec hash:** e91d703e0378
- **Workstream:** W8
- **Review:** Independent plan review completed 2026-11-09; four findings incorporated before Gate 2.

> **For the orchestrator:** dispatch task files in order. Implementers read only their task file and
> the Shared context; the orchestrator owns this file and the branch state.

## Scope

**Goal:** Deliver backend facts and safe Dev Lead digest generation for endpoints 42, 44 and 45.
**In scope:** F1-F8, N1-N4, E1-E30.
**Non-goals:** endpoint 43, endpoints 46-48, UI, migrations, scheduled work, and applying suggestions.
**Risk tier:** High - authorization, project tenancy, untrusted model text and persisted AI output require full reviews.

## Shared context

**Commands**

- Build/style: `npm run typecheck && npm run lint`
- Focused test: `node --import tsx --test <test-file>`
- Whole suite: `npm test`
- Contract check: `npm run contract`

**Rules for every task**

- AD-55: policy map is the only role gate; handlers do not check roles.
- AD-25/W3: user or model text is untrusted; STATIC sections are literal/trusted; never log prompt or response text.
- W6: call `assembleWith`; source rows are target-scoped and bounded; gateway-calling files do not import `@agile/db`.
- AD-22/SD5: endpoint 42 overload uses caller-member projects; persisted digest overload is target-project-only.
- No model call may run in a database transaction. No raw/typed SQL.
- Commit only the task's files with `Workstream: W8` and its `Task:` trailer.

**Boundaries.** Do not read project state or the W8 spec. Do not edit contracts, Prisma schema, or UI;
those already contain the frozen W8 shapes.

## Task order

| Task | File | Depends on | Concurrent with | Wave | Weight | Review | Status |
|---|---|---|---|---|---|---|---|
| T1 Facts package and deterministic forecast | `tasks/T1.md` | - | - | 1 | complex | full | Not started |
| T2 Context sources and digest flow | `tasks/T2.md` | T1 | - | 2 | complex | full | Not started |
| T3 Lead routes and API composition | `tasks/T3.md` | T1, T2 | - | 3 | complex | full | Not started |

Bundles: none.

## Traceability

| Requirement | Task(s) | Verified by |
|---|---|---|
| F1 | T1 | facts tests |
| F2 | T3 | lead route tests |
| F3 | T2 | context-source tests |
| F4 | T2,T3 | flow/route tests |
| F5 | T2 | transaction tests |
| F6 | T2,T3 | degraded-flow/route tests |
| F7 | T2,T3 | latest service/route tests |
| F8 | T2 | output validation tests |
| N1 | T1,T3 | tenant/authorization tests |
| N2 | T2 | source-scan test |
| N3 | T1 | hash tests |
| N4 | T2,T3 | logging/error tests |
| E1 | T1 | facts test |
| E2 | T1 | facts test |
| E3 | T1 | facts test |
| E4 | T1 | facts test |
| E5 | T1 | facts test |
| E6 | T1 | facts test |
| E7 | T3 | route test |
| E8 | T3 | authorization test |
| E9 | T2 | source test |
| E10 | T2 | source test |
| E11 | T2 | source test |
| E12 | T2 | flow test |
| E12a | T2 | flow test |
| E13 | T2 | flow test |
| E14 | T2 | transaction test |
| E15 | T2 | flow test |
| E16 | T2 | flow test |
| E17 | T2,T3 | service/route test |
| E18 | T2,T3 | service/route test |
| E19 | T2 | output test |
| E20 | T2 | flow test |
| E21 | T2 | logging test |
| E22 | T2 | transaction test |
| E23 | T2 | validation test |
| E24 | T2 | concurrency test |
| E25 | T1 | tenant test |
| E26 | T3 | authorization test |
| E27 | T2 | guard test |
| E28 | T3 | validation test |
| E29 | T2 | concurrency test |
| E30 | T2 | source test |

## Close-out

- [ ] `lint.mjs plan <plan.md> --closeout` passes and every task handover exists.
- [ ] `npm run typecheck`, `npm run lint`, `npm run contract`, and `npm test` are green or documented.
- [ ] Full branch review includes Implementer, Tester and Attacker lenses; fixed findings or Deviations recorded.
- [ ] Branch state is updated to `In review`; developer-guide impact is recorded as `lead` and API routes.
- [ ] Ask the operator for Gate 3 review; do not push, open a PR, or merge first.
