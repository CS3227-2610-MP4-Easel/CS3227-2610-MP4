# W7c Story Points 1-20 and Plan-Wide Expansion Implementation Plan

- **Status:** Approved (Xiao-Congchen, 2026-11-10)
- **Format:** v2
- **Spec:** [W7c points and plan-wide expansion design](../../specs/2026-11-10-w7c-points-and-plan-expand-design.md) | **Spec hash:** a6fe52ca6200
- **Workstream:** W7c

> **For the orchestrator:** this file is your router. Do not open task files yourself except to
> dispatch them; implementers read their own task file and the Shared context below, nothing else.
> You alone write this file's Status column, the branch state and `STATE`-level records.

## Scope
**Goal:** story points become any whole number 1 to 20 everywhere (reversing AD-12), and "Confirm and Expand Epics" writes every epic's tasks in one model call through a new endpoint 61, while endpoints 37 and 39 send the rest of the plan.
**In scope:** F1-F8, N1-N5, E1-E36.
**Non-goals:** a new Feature enum value or migration; chat refinement; streaming or `response_format`; changing velocity or forecast formulas; backfilling rows; a per-feature `minRetryMs`. Known Gaps not to touch: "Typed SQL is disabled", "Unvalidated relation filters are unsafe", "Nested writes require explicit authorization".
**Risk tier:** Medium - tasks on a security surface (policy entry, ownership and locking, untrusted text in prompts, spend and timeout limits) are reviewed `full` with the Attacker lens; the rest `light`.
**Before dispatching T1:** the orchestrator commits the pending front-end work (project flow, live backlog, plan editing) and the branch-state edits as their own commit, so T8's "no uncommitted edit under `src/fe/`" holds, and copies `.ws/w7.env` into this worktree.
**Plan corrections:** the spec's E21 and the endpoint-61 error table list `RATE_LIMITED`, but no expand path can raise it (the gateway result codes exclude it); T6 reports it as a deviation. Logging of written and skipped counts (spec § 4.2, § 6) is owned by T6 (`onExpandAll`).
**Not blocking, tracked as Handover:** AD-11 sign-offs by the W2 owner (per-feature limits and lease) and the W5 owner (points range on task create and patch); Vercel `maxDuration` 60 s unverified for this project (W13).

## Shared context
**Commands**
- Build: `npm run typecheck` (also type-checks `src/fe`), `npm run lint` (`tsc -b`), `npm run contract`, `npm --workspace @agile/db run prisma:validate`.
- Test one file (local Postgres `w7-pg` in Docker on port 5440, migrated; `.ws/w7.env` holds `DATABASE_URL` and `W1_INTEGRATION_DATABASE_URL`; if it is missing in this worktree, copy it from `S:\CS3227\CS3227-2610-MP4\.ws\w7.env`; never print it): `node --env-file .ws/w7.env --import tsx --import ./tests/setup-auth-env.ts --test <path>`. All: `node --env-file .ws/w7.env scripts/discover-tests.mjs`. Integration tests must RUN, not skip: report pass, fail and skipped counts. If the file or database is missing, stop and report `blocked`.
- After any `npm install`, run `npm --workspace @agile/db run prisma:generate`.
- Never read or print `src/fe/.env.local` (it holds a live key); tests run in mock mode through `tests/setup-auth-env.ts`.

**Rules for every task** (ID - rule)
- C8 - all source under `src/`; `src/fe` never imports Prisma or `@agile/db`; `src/be/api` imports no database client.
- AD-55 - authorisation only through the policy map; handlers never check roles. The proposal store checks the creator itself (404 for anyone else).
- Filtered client - use the `FilteredDbClient` of `@agile/db`; no `$queryRaw*`, no typed SQL.
- Locking (W7 SD6) - a writer first locks the proposal row (`lockProposal`), re-reads it and decides from what it reads; epic rows are locked only afterwards, in ascending index order (`lockEpic`).
- No model call inside a transaction. Files that call `LlmGateway.run` import no database client and no `@agile/proposals`; the store types are mirrored in `pm/src/plan-flow.ts` (W6 source scan).
- zod: contract schemas use `import { z } from "zod/v3"`; strict objects; follow the file you edit.
- Story points are validated only through `StoryPointsSchema` of `@agile/contracts` (whole number 1 to 20); never a local list or union.
- Prompt text from users or earlier model output is `trusted: false`; static sections are the feature's own text.
- Test titles start with `W7c E<n>` (earlier plans reused E numbers); a test cites the row it covers.
- Commits: `type: what and why (W7c)` with `Workstream: W7c` and `Task: Tn` trailers; never a provisional ID (`C~n`). End with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

**Boundaries.** You do not read `STATE.md`, `guardrails.md`, the branch state or the spec. You commit
only your own task's files. Contract tests marked read-only are not edited.

## Task order
| Task | File | Depends on | Concurrent with | Wave | Weight | Review | Status |
|---|---|---|---|---|---|---|---|
| T1 Contracts: points schema, endpoint 61 policy and openapi | `tasks/T1.md` | - | T3 | 1 | standard | full | Done |
| T3 Gateway: per-feature limits for PM_PLAN_EXPAND | `tasks/T3.md` | - | T1 | 1 | complex | full | Done |
| T2 Points: core, api routes, pm schemas, proposals types | `tasks/T2.md` | T1 | - | 2 | standard | light | Done |
| T4 PM: prompts, bulk and single layouts, schemas, mock | `tasks/T4.md` | T2, T3 | T5 | 3 | complex | full | Done |
| T5 Proposals: others context, bulk claim, store and fail | `tasks/T5.md` | T2 | T4 | 3 | complex | full | Done |
| T6 PM: expandAll, rest-of-plan context, runtime binding | `tasks/T6.md` | T4, T5 | - | 4 | complex | full | Done |
| T7 API: route 61, resolver, maxDuration, route and e2e tests | `tasks/T7.md` | T1, T6 | T8 | 5 | complex | full | In progress |
| T8 Front end: bulk expand wiring and points number inputs | `tasks/T8.md` | T1 | T7 | 5 | standard | light | Done |
| T9 Docs: AD-12 reversal, contracts text, old-list scan | `tasks/T9.md` | T1, T2, T4, T7, T8 | - | 6 | standard | light | Not started |

Bundles: none. Same-wave tasks share no file: T1 touches `contracts/src/*`, `contracts/test/*` and the three policy count tests; T3 `llm-gateway/src/{config,gateway}.ts` and its tests. T4 touches `pm/src/{sections,schemas,mocks}.ts` and `pm/test/prompts.test.ts`; T5 `proposals/src/*` and `proposals/test/*`. T7 touches `api/src/*`, `api/test/*` and the FE route file; T8 `src/fe/lib/*` and `src/fe/components/*`. T2 (wave 2) and T4, T6 edit `pm/src/schemas.ts` and `pm/src/plan-flow.ts` in different waves, never together.

## Traceability
| Requirement | Task(s) | Verified by |
|---|---|---|
| F1 | T1, T2 | `pm-edit-schemas.test.ts`, `points-schema.test.ts`, `points-range.test.ts` |
| F2 | T9 | `points-docs-scan.test.ts` |
| F3 | T3 | `feature-limits.test.ts` |
| F4 | T5, T6, T7 | `bulk-store.test.ts`, `plan-flow.test.ts`, `pm-expand-all-e2e.test.ts` |
| F5 | T4, T5, T6 | `bulk-prompts.test.ts`, `bulk-store.test.ts`, `plan-flow.test.ts` |
| F6 | T4, T5, T6 | `bulk-prompts.test.ts`, `bulk-store.test.ts`, `plan-flow.test.ts` |
| F7 | T4 | `bulk-prompts.test.ts` |
| F8 | T8 | manual checklist (no front-end test runner) |
| N1 | T6 | `plan-flow.test.ts` call counts |
| N2 | T3 | `feature-limits.test.ts` |
| N3 | T5, T7 | `bulk-store.test.ts` barrier tests, `pm-expand-all-e2e.test.ts` |
| N4 | T7 | `route-max-duration.test.ts` |
| N5 | T4 | `bulk-prompts.test.ts` |
| E1 | T1, T2 | `points-schema.test.ts`, `points-range.test.ts` |
| E2 | T1, T2 | `points-schema.test.ts`, `points-range.test.ts` |
| E3 | T1, T2 | `points-schema.test.ts`, `points-range.test.ts` |
| E4 | T2 | `apply-plan.test.ts` |
| E5 | T2 | `derived.test.ts` |
| E6 | T1 | `points-schema.test.ts` |
| E7 | T9 | `points-docs-scan.test.ts` |
| E8 | T3 | `feature-limits.test.ts` |
| E9 | T3 | `feature-limits.test.ts` |
| E10 | T6, T7 | `plan-flow.test.ts`, `pm-expand-all-e2e.test.ts` |
| E11 | T5, T6 | `bulk-store.test.ts`, `plan-flow.test.ts` |
| E12 | T5, T6 | `bulk-store.test.ts`, `plan-flow.test.ts` |
| E13 | T5 | `bulk-store.test.ts` |
| E14 | T5 | `bulk-store.test.ts` |
| E15 | T5, T7 | `bulk-store.test.ts`, `pm-expand-all-e2e.test.ts` |
| E16 | T4, T6 | `bulk-prompts.test.ts`, `plan-flow.test.ts` |
| E17 | T4 | `bulk-prompts.test.ts` |
| E18 | T5 | `bulk-store.test.ts` |
| E19 | T5 | `bulk-store.test.ts` |
| E20 | T5 | `bulk-store.test.ts` |
| E21 | T5, T6 | `bulk-store.test.ts`, `plan-flow.test.ts` |
| E22 | T5, T6 | `bulk-store.test.ts`, `plan-flow.test.ts` |
| E23 | T4, T5 | `bulk-prompts.test.ts`, `bulk-store.test.ts` |
| E24 | T4 | `bulk-prompts.test.ts` |
| E25 | T4 | `bulk-prompts.test.ts` |
| E26 | T5, T7 | `bulk-store.test.ts`, `pm-expand-all-e2e.test.ts` |
| E27 | T5 | `bulk-store.test.ts` |
| E28 | T7 | `pm-expand-all-routes.test.ts` |
| E29 | T1, T7 | `points-schema.test.ts`, `pm-expand-all-routes.test.ts` |
| E30 | T5 | `bulk-store.test.ts` |
| E31 | T5 | `bulk-store.test.ts` |
| E32 | T4 | `bulk-prompts.test.ts` |
| E33 | T4 | `bulk-prompts.test.ts` |
| E34 | T4, T6, T7 | `bulk-prompts.test.ts`, `plan-flow.test.ts`, `pm-expand-all-e2e.test.ts` |
| E35 | T7 | `route-max-duration.test.ts` |
| E36 | T8 | manual checklist in `tasks/T8.md`, run by the orchestrator at close-out after T7 |

Threat coverage (spec § 6): ownership E28; stale or replayed requests E15, E18; forged labels and untrusted text E32, E16; forged or shifted index E16, E19; repeated clicks E26; killed function and leases E13, E31; out-of-range points E1, E5; longer deadline E8, E9, E35; proposal-level edits during a call (accepted) E18.

## Close-out
Run by the orchestrator (no task file):
- [ ] `lint.mjs plan <plan.md> --closeout` has no errors; every Done task has a valid handover.
- [ ] `npm run typecheck`, `npm run lint`, `npm run contract`, `npm test` green (integration tests run with `W1_INTEGRATION_DATABASE_URL` set); each F/N has a passing test or a recorded manual check; every E and T row is covered.
- [ ] Manual run of the T8 checklist against the real app (`LLM_MODE=live`, `APP_TIER=local`) recorded in the branch state, including one live bulk expand of a 10-epic plan with its time and token counts.
- [ ] Code review of the branch diff (`code-review` skill); confirmed findings fixed or recorded as Deviations.
- [ ] Branch state: workstream `In review`, session rows removed, Changes lines, Known Gap (rollback after points outside 1, 2, 3, 5, 8, 13), Handover (W2 and W5 owner sign-offs, `maxDuration` 60 unverified, `docs/architecture` endpoint counts), `guide out of date: pm, proposals, contracts, llm-gateway`.
- [ ] Ask the operator to review the branch (`AGENTS.md` § 8, gate 3); `Approved` only on their yes;
      never push, open a PR or merge before it.
