# W7b PM Plan Editing Implementation Plan

- **Status:** Approved (Xiao-Congchen, 2026-11-09)
- **Format:** v2
- **Spec:** [W7b PM plan editing design](../../specs/2026-11-09-w7b-pm-plan-editing-design.md) | **Spec hash:** 5548258be805
- **Workstream:** W7b

> **For the orchestrator:** this file is your router. Do not open task files yourself except to
> dispatch them; implementers read their own task file and the Shared context below, nothing else.
> You alone write this file's Status column, the branch state and `STATE`-level records.

## Scope
**Goal:** a PM edits, adds, deletes and regenerates the generated checkpoints, epics and tasks of a pending plan proposal, and lists earlier proposals (endpoints 36, 38, 39 and new 58, 59, 60), backend only.
**In scope:** F1-F8, N1-N4, E1-E60.
**Non-goals:** chat refinement; reordering; the screens; the other W16 endpoints; a creator check on approve and reject; index-only addressing of endpoint 37. Known Gaps not to touch: "Typed SQL is disabled", "Unvalidated relation filters are unsafe", "Nested writes require explicit authorization".
**Risk tier:** Medium - tasks on a security surface (policy map entries, ownership checks, body limits, session caps) are reviewed `full` with the Attacker lens; the rest `light`.
**Not blocking, tracked as Handover:** the Dev Lead and Developer owners agree to endpoints 58-60 and to the changed responses of 38 and 39 (AD-11).

## Shared context
**Commands**
- Build: `npm run typecheck` and `npm run lint` (`tsc -b`); schema `npm --workspace @agile/db run prisma:validate`.
- Test one file (a local Postgres runs in Docker, migrated; `.ws/w7.env` holds `DATABASE_URL` and `W1_INTEGRATION_DATABASE_URL`): `node --env-file .ws/w7.env --import tsx --import ./tests/setup-auth-env.ts --test <path>`. All: `node --env-file .ws/w7.env scripts/discover-tests.mjs`. Integration tests must RUN, not skip: report pass/fail/skipped counts. If `.ws/w7.env` or the database is missing, stop and report `blocked`.
- After any `npm install`, run `npm --workspace @agile/db run prisma:generate`.

**Rules for every task** (ID - rule)
- C8 - all source under `src/`; `src/fe` never imports Prisma or `@agile/db`; `src/be/api` imports no database client.
- AD-55 - authorisation only through the policy map; handlers never check roles. The proposal store checks the creator itself (404 for anyone else).
- Filtered client - use the `FilteredDbClient` of `@agile/db`; no `$queryRaw*`, no typed SQL, no relation filters relied on to hide rows.
- Locking (W7 SD6) - a writer first `update`s the proposal row's `updatedAt` by unique id (`lockProposal`), re-reads it, and decides from what it reads; epic rows are locked only afterwards, in ascending index order (`lockEpic`). No conditional `updateMany` claims.
- No model call inside a transaction. Files that call `LlmGateway.run` import no database client and no `@agile/proposals` (types are mirrored in `pm/src/plan-flow.ts`).
- zod: contract schemas use `import { z } from "zod/v3"`; strict objects; follow the file you edit.
- Stored checkpoints and tasks are the output of the strict parse, never a raw body.
- Test titles start with `W7b E<n>` (the W7 plan reused E numbers); a test cites the row it covers.
- Commits: `type: what and why (W7b)` with `Workstream: W7b` and `Task: Tn` trailers; never a provisional ID (`C~n`). End with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

**Boundaries.** You do not read `STATE.md`, `guardrails.md`, the branch state or the spec. You commit
only your own task's files. Contract tests marked read-only are not edited.

## Task order
| Task | File | Depends on | Concurrent with | Wave | Weight | Review | Status |
|---|---|---|---|---|---|---|---|
| T1 Contracts: policy 58-60, schemas, openapi, docs | `tasks/T1.md` | - | T2, T5, T6 | 1 | standard | full | Not started |
| T2 Proposals: edit store (epic, checkpoints) | `tasks/T2.md` | - | T1, T5, T6 | 1 | complex | full | Not started |
| T5 Proposals: approve closes EDITED or ACCEPTED | `tasks/T5.md` | - | T1, T2, T6 | 1 | standard | light | Not started |
| T6 Proposals: list store | `tasks/T6.md` | - | T1, T2, T5 | 1 | standard | light | Not started |
| T3 Proposals: add and delete epic | `tasks/T3.md` | T2 | T4 | 2 | complex | full | Not started |
| T4 Proposals: regenerate claim, store flag, pre-check | `tasks/T4.md` | T2 | T3 | 2 | complex | full | Not started |
| T7 pm: plan flow additions and runtime binding | `tasks/T7.md` | T2, T3, T4, T5, T6 | - | 3 | complex | full | Not started |
| T8 API: routes, composition, route and end-to-end tests | `tasks/T8.md` | T1, T7 | - | 4 | complex | full | Not started |

Bundles: none. Same-wave tasks share no file: T1 touches contracts and docs; T2 `proposals/src/{errors,edit-common,edit-store,index}.ts` and `test/edit-helpers.ts`; T5 `decide.ts`; T6 `view.ts` (exports unchanged at every commit); T3 `epic-list.ts` and `index.ts` (T2 edits `index.ts` in wave 1, T3 in wave 2); T4 `expand-store.ts`.

## Traceability
| Requirement | Task(s) | Verified by |
|---|---|---|
| F1 | T2, T3, T7, T8 | `edit-store.test.ts`, `epic-list.test.ts`, `pm-edit-routes.test.ts` |
| F2 | T2, T8 | `edit-store.test.ts` E10-E18 |
| F3 | T2, T8 | `edit-store.test.ts` E19-E30 |
| F4 | T3, T8 | `epic-list.test.ts` E31-E37 |
| F5 | T4, T7 | `regenerate-store.test.ts`, `plan-flow.test.ts` |
| F6 | T6, T8 | `list.test.ts`, `pm-edit-routes.test.ts` |
| F7 | T5 | `decide.test.ts` |
| F8 | T2, T3, T8 | `edit-store.test.ts` E59, `pm-edit-e2e.test.ts` |
| N1 | T7 | `plan-flow.test.ts` call counts |
| N2 | T2, T3 | `edit-store.test.ts` E58, `epic-list.test.ts` |
| N3 | T6 | `list.test.ts` query count |
| N4 | T8 | close-out matrix of E and T rows |
| E1 | T2, T3, T7 | stale version on 38, 58, 59, 60, 39 |
| E2 | T2 | `edit-store.test.ts` |
| E3 | T2, T3, T4, T7 | `edit-store.test.ts`, `epic-list.test.ts`, `regenerate-store.test.ts` |
| E4 | T2, T3, T4, T8 | `edit-store.test.ts`, `regenerate-store.test.ts`, `pm-edit-e2e.test.ts` |
| E5 | T8 | `pm-edit-routes.test.ts` |
| E6 | T8 | `pm-edit-routes.test.ts` |
| E7 | T1, T8 | `pm-edit-schemas.test.ts`, `pm-edit-routes.test.ts` |
| E8 | T2 | `edit-store.test.ts` |
| E9 | T8 | `pm-edit-routes.test.ts` |
| E10 | T2 | `edit-store.test.ts` |
| E11 | T2 | `edit-store.test.ts` |
| E12 | T2 | `edit-store.test.ts` |
| E13 | T2 | `edit-store.test.ts` |
| E14 | T1, T2 | `pm-edit-schemas.test.ts`, `edit-store.test.ts` |
| E15 | T2 | `edit-store.test.ts` |
| E16 | T2 | `edit-store.test.ts` |
| E17 | T2 | `edit-store.test.ts` |
| E18 | T2 | `edit-store.test.ts` |
| E19 | T2 | `edit-store.test.ts` |
| E20 | T2 | `edit-store.test.ts` |
| E21 | T2 | `edit-store.test.ts` |
| E22 | T2 | `edit-store.test.ts` |
| E23 | T2 | `edit-store.test.ts` |
| E24 | T1 | `pm-edit-schemas.test.ts` |
| E25 | T1 | `pm-edit-schemas.test.ts` |
| E26 | T2 | `edit-store.test.ts` |
| E27 | T8 | `pm-edit-routes.test.ts` |
| E28 | T2 | `edit-store.test.ts` |
| E29 | T2, T4, T7 | `edit-store.test.ts`, `regenerate-store.test.ts`, `plan-flow.test.ts` |
| E30 | T2 | `edit-store.test.ts` |
| E31 | T3 | `epic-list.test.ts` |
| E32 | T3 | `epic-list.test.ts` |
| E33 | T3 | `epic-list.test.ts` |
| E34 | T3 | `epic-list.test.ts` |
| E35 | T3 | `epic-list.test.ts` |
| E36 | T8 | `pm-edit-routes.test.ts` |
| E37 | T3 | `epic-list.test.ts` |
| E38 | T4, T7 | `regenerate-store.test.ts`, `plan-flow.test.ts` |
| E39 | T7 | `plan-flow.test.ts` |
| E40 | T7 | `plan-flow.test.ts` |
| E41 | T4, T7 | `regenerate-store.test.ts`, `plan-flow.test.ts` |
| E42 | T4, T7 | `regenerate-store.test.ts`, `plan-flow.test.ts` |
| E43 | T4, T7 | `regenerate-store.test.ts`, `plan-flow.test.ts` |
| E44 | T7 | `plan-flow.test.ts` |
| E45 | T7 | `plan-flow.test.ts` |
| E46 | T5 | `decide.test.ts` |
| E47 | T7 | `plan-flow.test.ts` |
| E48 | T6 | `list.test.ts` |
| E49 | T1, T8 | `pm-edit-schemas.test.ts`, `pm-edit-routes.test.ts` |
| E50 | T6 | `list.test.ts` |
| E51 | T6 | `list.test.ts` |
| E52 | T6 | `list.test.ts` |
| E53 | T8 | `pm-edit-routes.test.ts` |
| E54 | T5, T8 | `decide.test.ts`, `pm-edit-e2e.test.ts` |
| E55 | T5 | `decide.test.ts` |
| E56 | T5 | `decide.test.ts` |
| E57 | T2, T5 | `edit-store.test.ts`, `decide.test.ts` |
| E58 | T2, T3 | `edit-store.test.ts`, `epic-list.test.ts` |
| E59 | T2, T8 | `edit-store.test.ts`, `pm-edit-e2e.test.ts` |
| E60 | T2, T3, T4 | `edit-store.test.ts`, `epic-list.test.ts`, `regenerate-store.test.ts` |

Threat coverage (spec § 6): ownership (IDOR) E4; stale or replayed requests E1, E2, E42; edit versus approve race E57; edit or delete under an in-flight call E28, E29, E35, E37; oversized bodies E9; regeneration loop E39, E42; index confusion E33; list size E48 and N3; whole-plan validity E59. Accepted without a test: hand-written text reaching other roles' AI contexts; approve and reject staying member-wide.

## Close-out
Run by the orchestrator (no task file):
- [ ] `lint.mjs plan <plan.md> --closeout` has no errors; every Done task has a valid handover.
- [ ] `npm run typecheck`, `npm run lint`, `npm run contract`, `npm test` green (integration tests run with `W1_INTEGRATION_DATABASE_URL` set); each F/N has a passing test or a recorded manual check; every E and T row is covered (N4).
- [ ] Code review of the branch diff (`code-review` skill); confirmed findings fixed or recorded as Deviations.
- [ ] Branch state: workstream `In review`, session rows removed, Changes lines, Handover (other owners' sign-off on endpoints 58-60 and the changed responses of 38 and 39; `docs/architecture` text that says 57 endpoints; the UI reminder of SD10; creator-only edits versus member-wide approve), `guide out of date: pm, proposals, contracts`.
- [ ] Ask the operator to review the branch (`AGENTS.md` § 8, gate 3); `Approved` only on their yes;
      never push, open a PR or merge before it.
