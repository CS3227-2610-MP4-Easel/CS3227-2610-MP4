# W7 PM Plan Flow Implementation Plan

- **Status:** Approved (Xiao-Congchen, 2026-11-07)
- **Format:** v2
- **Spec:** [W7 PM plan flow design](../../specs/2026-11-07-w7-pm-plan-flow-design.md) | **Spec hash:** dbc96810e885
- **Workstream:** W7

> **For the orchestrator:** this file is your router. Do not open task files yourself except to
> dispatch them; implementers read their own task file and the Shared context below, nothing else.
> You alone write this file's Status column, the branch state and `STATE`-level records.

## Scope
**Goal:** a PM turns an idea into a reviewed plan proposal (endpoints 34, 35, 37, 40, 41) that is created in one transaction on approval, behind the gateway, backend only.
**In scope:** F1-F9, N1-N5, E1-E56.
**Non-goals:** endpoints 36, 38, 39 and `EDITED` outcomes (W16); the New Plan screen; `SUPERSEDED`; W5's core CRUD, `requireMember`, `assertWritable`, project resolver; full-text search, new index or migration; usage views. Known Gaps not to touch: "Typed SQL is disabled", "Unvalidated relation filters are unsafe", "AI context checks rows, not sources".
**Risk tier:** High - every task is reviewed `full`; tasks on a security surface or a path in `security-sensitive-paths.json` add the Attacker lens. Tasks touching `src/be/*/test/**` hit the manifest, so all do.
**Preconditions before Gate 2:** the Developer (W2 owner) has agreed to the `Sessions` change of T1 (AD-11); T1 holds a `GATE:` step to record it.

## Shared context
**Commands**
- Build: `npm run typecheck` and `npm run lint` (`tsc -b`); schema `npm --workspace @agile/db run prisma:validate`.
- Test one file: `node --import tsx --import ./tests/setup-auth-env.ts --test <path>`. All: `npm test`.
- After any `npm install`, run `npm --workspace @agile/db run prisma:generate` (install removes the generated client and `tsc -b` then fails).
- Integration tests need `DATABASE_URL` and `W1_INTEGRATION_DATABASE_URL` exported; they skip without the second (pattern: `{ skip: !integrationUrl }`).

**Rules for every task** (ID - rule)
- C8 - all source lives under `src/`; new backend packages are `src/be/<name>` workspaces named `@agile/<name>` (C51), `exports: { ".": "./src/index.ts" }`.
- AD-01b - `src/fe` never imports Prisma or `@agile/db`; `src/be/api` imports no database client.
- AD-55 - authorisation only through the policy map; handlers never check roles.
- AD-25 - untrusted text goes through the gateway pipeline; no prompt text is stored or logged. Logs carry ids and codes only.
- Filtered client - use `createDbClient()` from `@agile/db`; it hides raw SQL, deleted rows and archived projects. No `$queryRaw*`, no typed SQL, no relation filters relied on to hide soft-deleted rows.
- Nested writes - authorise every connected id inside the transaction; a mutation validates its payload with a strict schema.
- W6 source scan - files that call `LlmGateway.run` import no database client (`@agile/db`, `@prisma/client`); never catch `ContextScopeViolation`.
- Locking (spec SD6) - a claim is: inside one transaction `update` the row's `updatedAt` by unique selector (takes the lock), re-read the row, decide from what it reads. No conditional `updateMany` claims.
- No model call inside a transaction. Test files name the E IDs they cover in the test title.
- zod: contract schemas use `import { z } from "zod/v3"`; follow the file you edit.
- Commits: `type: what and why (W7)` with `Workstream: W7` and `Task: Tn` trailers; never a provisional ID (`C~n`).

**Boundaries.** You do not read `STATE.md`, `guardrails.md`, the branch state or the spec. You commit
only your own task's files. Contract tests marked read-only are not edited.

## Task order
| Task | File | Depends on | Concurrent with | Wave | Weight | Review | Status |
|---|---|---|---|---|---|---|---|
| T1 Session feature map and contract text | `tasks/T1.md` | - | T2, T3 | 1 | standard | full | Done |
| T2 Scaffold core, proposals, pm workspaces | `tasks/T2.md` | - | T1, T3 | 1 | trivial | full | Done |
| T3 Contract schemas for endpoints 34-41 | `tasks/T3.md` | - | T1, T2 | 1 | standard | full | Done |
| T4 applyPlan in core | `tasks/T4.md` | T2 | T5, T8, T9 | 2 | complex | full | Not started |
| T5 Proposals: create, view, resolvers | `tasks/T5.md` | T2, T3 | T4, T8, T9 | 2 | complex | full | Not started |
| T6 Proposals: expand claim and store | `tasks/T6.md` | T5 | - | 3 | complex | full | Not started |
| T7 Proposals: approve and reject | `tasks/T7.md` | T4, T5, T6 | - | 4 | complex | full | Not started |
| T8 pm: similar-items source and settings | `tasks/T8.md` | T2 | T4, T5, T9 | 2 | standard | full | Not started |
| T9 pm: schemas, sections, mocks | `tasks/T9.md` | T2 | T4, T5, T8 | 2 | standard | full | Not started |
| T10 pm: plan flow | `tasks/T10.md` | T1, T5, T6, T7, T8, T9 | - | 5 | complex | full | Not started |
| T11 API routes, wiring, end to end | `tasks/T11.md` | T3, T10 | - | 6 | complex | full | Not started |

Bundles: none.

## Traceability
| Requirement | Task(s) | Verified by |
|---|---|---|
| F1 | T1 | `session-feature-map.test.ts` |
| F2 | T4 | `apply-plan.test.ts` |
| F3 | T8 | `similar-items.test.ts` |
| F4 | T10 | `plan-flow.test.ts` (create) |
| F5 | T11 | `pm-routes.test.ts` (read) |
| F6 | T10 | `plan-flow.test.ts` (expand) |
| F7 | T7 | `decide.test.ts` (approve) |
| F8 | T7 | `decide.test.ts` (reject) |
| F9 | T11 | `pm-e2e.test.ts` |
| N1 | T10 | `plan-flow.test.ts` call counts |
| N2 | T7 | `decide.test.ts` E53 |
| N3 | T8, T11 | `similar-items.test.ts` E12, E13 |
| N4 | T2, T11 | close-out matrix of E rows |
| N5 | T9 | `prompts.test.ts` E46 |
| E1 | T1 | `session-feature-map.test.ts` |
| E2 | T1 | `session-feature-map.test.ts` |
| E3 | T11 | `pm-routes.test.ts` |
| E4 | T10 | `plan-flow.test.ts` |
| E5 | T11 | `pm-routes.test.ts` |
| E6 | T10 | `plan-flow.test.ts` |
| E7 | T5 | `create.test.ts` |
| E8 | T10 | `plan-flow.test.ts` |
| E9 | T10, T11 | `plan-flow.test.ts` |
| E10 | T10 | `plan-flow.test.ts` |
| E11 | T5 | `create.test.ts` |
| E12 | T8, T11 | `similar-items.test.ts` |
| E13 | T8 | `similar-items.test.ts` |
| E14 | T8 | `similar-items.test.ts` |
| E15 | T8 | `similar-items.test.ts` |
| E16 | T8 | `similar-items.test.ts` |
| E17 | T10, T11 | `plan-flow.test.ts` |
| E18 | T8 | `settings.test.ts` |
| E19 | T11 | `pm-routes.test.ts` |
| E20 | T5 | `view.test.ts` |
| E21 | T11 | `pm-routes.test.ts` |
| E22 | T6, T10 | `expand-store.test.ts` |
| E23 | T6, T10 | `expand-store.test.ts` |
| E24 | T6, T10 | `expand-store.test.ts` |
| E25 | T6, T10 | `expand-store.test.ts` |
| E26 | T10 | `plan-flow.test.ts` |
| E27 | T6 | `expand-store.test.ts` |
| E28 | T10 | `plan-flow.test.ts` |
| E29 | T10 | `plan-flow.test.ts` |
| E30 | T7 | `decide.test.ts` |
| E31 | T7 | `decide.test.ts` |
| E32 | T7 | `decide.test.ts` |
| E33 | T7 | `decide.test.ts` |
| E34 | T7 | `decide.test.ts` |
| E35 | T7 | `decide.test.ts` |
| E36 | T11 | `pm-routes.test.ts` |
| E37 | T7 | `decide.test.ts` |
| E38 | T4 | `apply-plan.test.ts` |
| E39 | T4 | `apply-plan.test.ts` |
| E40 | T4 | `apply-plan.test.ts` |
| E41 | T4 | `apply-plan.test.ts` |
| E42 | T7 | `decide.test.ts` |
| E43 | T7 | `decide.test.ts` |
| E44 | T7 | `decide.test.ts` |
| E45 | T11 | `pm-e2e.test.ts` |
| E46 | T9 | `prompts.test.ts` |
| E47 | T3, T11 | `pm-routes.test.ts` |
| E48 | T7 | `decide.test.ts` |
| E49 | T10 | `plan-flow.test.ts` |
| E50 | T10 | `plan-flow.test.ts` |
| E51 | T5 | `view.test.ts` |
| E52 | T10, T11 | `plan-flow.test.ts` |
| E53 | T7 | `decide.test.ts` |
| E54 | T4 | `apply-plan.test.ts` |
| E55 | T4 | `apply-plan.test.ts` |
| E56 | T7 | `decide.test.ts` |

## Close-out
Run by the orchestrator (no task file):
- [ ] `lint.mjs plan <plan.md> --closeout` has no errors; every Done task has a valid handover.
- [ ] `npm run typecheck`, `npm run lint`, `npm test` green (integration tests run with `W1_INTEGRATION_DATABASE_URL` set); each F/N has a passing test or a recorded manual check; every E row has a passing test (N4).
- [ ] Code review of the branch diff (`code-review` skill); confirmed findings fixed or recorded as Deviations.
- [ ] Branch state: workstream `In review`, session rows removed, Changes lines, new Known Gaps (keyword retrieval) / Deviations (archived project answers 404) / Architecture Now blocks for `pm`, `core` / `proposals`, `Post-merge` items written as Handover (W5 and Developer notes), `guide out of date: pm, core, proposals`.
- [ ] Ask the operator to review the branch (`AGENTS.md` § 8, gate 3); `Approved` only on their yes;
      never push, open a PR or merge before it.
