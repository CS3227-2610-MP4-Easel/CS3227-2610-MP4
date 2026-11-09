# W9 Developer Upload, Summaries and Standup Implementation Plan

- **Status:** Approved (ludannnn, 2026-11-09)
- **Format:** v2
- **Spec:** [W9 dev slice design](../../specs/2026-11-08-w9-dev-slice-design.md) | **Spec hash:** a52c1ff8380d
- **Workstream:** W9

> **For the orchestrator:** this file is your router. Do not open task files yourself except to
> dispatch them; implementers read their own task file and the Shared context below, nothing else.
> You alone write this file's Status column, the branch state and `STATE`-level records.

## Scope
**Goal:** a `src/be/dev` package (`@agile/dev`) and routes for endpoints 49-52 and 55: Developers upload activity, get cached one-line summaries and one standup per project and day (code-built when the model fails); Dev Leads page current developers' standups.
**In scope:** F1-F9, N1-N5.
**Non-goals:** S20/S18 UI wiring (C~1); endpoints 53/54 (W16); scheduled work (AD-06); GitHub import or an `author` field (AD-20, AD-60); the generic result cache (W17); holidays (AD-44); changing any frozen signature (AD-11); a per-user upload rate limit (Known Gap **Upload storage is unbounded**).
**Risk tier:** High - untrusted uploaded text reaches the model, rows are per developer, the Dev Lead reads others' standups, and most files sit on security-sensitive paths (`src/be/contracts/**`, `src/be/*/test/**`, `package.json`, `package-lock.json`), so every task gets full review with the Attacker lens.

## Shared context
**Commands** (from the repo root; export `DATABASE_URL` first, `npm test`'s `pretest` needs it)
- Install: `npm install` after editing any `package.json`.
- One test file: `node --import tsx --import ./tests/setup-auth-env.ts --test <path/to/file.test.ts>`.
- All tests: `npm test`. Postgres tests run only when `W1_INTEGRATION_DATABASE_URL` is set (the operator's local `agile-pg-test` container); otherwise they skip.
- Typecheck: `npm run typecheck`. Schema: `npm --workspace @agile/db run prisma:validate`.

**Rules for every task** (ID - rule)
- C51 - feature modules are workspace packages; W9's is `src/be/dev`, name `@agile/dev`, ESM with `.js` relative imports.
- AD-55 - authorisation is the policy map's job; handlers and stores never check roles.
- AD-25 - item text is stored raw and only the gateway sanitises what reaches the model; no prompt, response, item title/body, one-liner or standup line is ever logged or put in an error message.
- AD-11 - frozen signatures (`Core`, `Sessions`, `LlmGateway`, `AiContext`, `standupActivityWindow`) do not change; shared-package additions are additive.
- Source scan rule 1 - only `src/be/dev/src/gateway-binding.ts` imports `@agile/llm-gateway`, and it imports nothing else from `@agile/*` except `@agile/contracts` and `@agile/ai-context` (the scan follows its relative imports, so it has none). Rule 2 - never `$queryRawUnsafe`/`$executeRawUnsafe`. Rule 3 - `@agile/ai-context/testing` only in tests.
- Filtered client - the request client is `FilteredDbClient` from `@agile/db` (`auth.db`). It and its transactions have no raw SQL, and reads hide archived projects and every row of an archived project.
- Guardrails - request-derived `where` clauses must not rely on relation filters to hide rows; every connected resource is validated inside the mutation transaction.
- No model call (`run`) inside a database transaction; the gateway throws `LLM_CALL_IN_TRANSACTION`.
- Zod - route bodies and queries use `zod/v3` (like `src/be/api/src/routes/register.ts`); schemas from `@agile/contracts` are used as exported.
- Tests - `node:test` and `node:assert/strict`, in the package's `test/` folder, `*.test.ts`; each test name cites its E/F/N ID. Postgres tests import `integrationUrl` and `withIntegrationDb` from `src/be/llm-gateway/test/fakes.ts` and pass `{ skip: !integrationUrl }`.
- Style - match surrounding code: double quotes, 2-space indent, semicolons, compact functions; at most one-line comments, only for a non-obvious rule.
- Commits - one per task, `type: what and why (W9)`, one trailer block: `Workstream: W9`, `Task: Tn`, `Co-Authored-By:` line last. Stage your own files by path, never `git add -A`.

**Boundaries.** You do not read `STATE.md`, `guardrails.md`, the branch state or the spec. You commit
only your own task's files. Contract tests marked read-only are not edited.

## Task order
| Task | File | Depends on | Concurrent with | Wave | Weight | Review | Status |
|---|---|---|---|---|---|---|---|
| T1 Shared additions: date window, body limits, lock export | `tasks/T1.md` | - | T2 | 1 | standard | full | Done |
| T2 Gateway: `openOrReuse` and `recordCacheHit` | `tasks/T2.md` | - | T1 | 1 | standard | full | Done |
| T3 Dev package, gateway binding, write seam | `tasks/T3.md` | T1, T2 | - | 2 | standard | full | Done |
| T4 AI definitions: prompts, schemas, mocks, hashes, errors | `tasks/T4.md` | T3 | T5, T6 | 3 | standard | full | Done |
| T5 Upload store (49) | `tasks/T5.md` | T1, T3 | T4, T6 | 3 | complex | full | Done |
| T6 Summary and standup store, sources, resolvers | `tasks/T6.md` | T3 | T4, T5 | 3 | complex | full | Done |
| T7 Summary flow (50) | `tasks/T7.md` | T1, T4, T6 | T8 | 4 | complex | full | Not started |
| T8 Standup flow (51) | `tasks/T8.md` | T1, T4, T6 | T7 | 4 | complex | full | Not started |
| T9 Runtime, routes and composition | `tasks/T9.md` | T1, T5, T7, T8 | - | 5 | complex | full | Not started |
| T10 Postgres integration and concurrency | `tasks/T10.md` | T9 | - | 6 | complex | full | Not started |

Full review = Implementer + Tester + Attacker lenses (untrusted text, ownership, membership, security-sensitive paths).

Bundles: none.

**Same-wave execution (orchestrator).** Run same-wave tasks in parallel only in separate git worktrees branched from this branch's local tip; otherwise run them one after another in the main checkout. The orchestrator alone runs `ws task start/done` bookkeeping order and merges or serialises the commits; after each wave it runs the full `npm run typecheck` and `npm test` before dispatching the next.

## Traceability
| Requirement | Task(s) | Verified by |
|---|---|---|
| F1 | T5, T9, T10 | `src/be/dev/test/items.test.ts`; `src/be/api/test/dev-routes.test.ts`, `src/be/api/test/dev-boot.test.ts`, `src/be/ai-context/test/source-scan.test.ts`; `src/be/dev/test/dev-integration.test.ts` |
| F2 | T5 | `src/be/dev/test/items.test.ts` |
| F3 | T4, T7, T10 | `src/be/dev/test/ai.test.ts`; `src/be/dev/test/summary-flow.test.ts`; `src/be/dev/test/dev-integration.test.ts` |
| F4 | T4, T8, T10 | `src/be/dev/test/ai.test.ts`; `src/be/dev/test/standup-flow.test.ts`; `src/be/dev/test/dev-integration.test.ts` |
| F5 | T8 | `src/be/dev/test/standup-flow.test.ts` |
| F6 | T6, T9 | `src/be/dev/test/{resolvers,sources,summaries-store,standups-store}.test.ts`; `src/be/api/test/dev-routes.test.ts`, `src/be/api/test/dev-boot.test.ts`, `src/be/ai-context/test/source-scan.test.ts` |
| F7 | T6, T9 | `src/be/dev/test/{resolvers,sources,summaries-store,standups-store}.test.ts`; `src/be/api/test/dev-routes.test.ts`, `src/be/api/test/dev-boot.test.ts`, `src/be/ai-context/test/source-scan.test.ts` |
| F8 | T6, T9 | `src/be/dev/test/{resolvers,sources,summaries-store,standups-store}.test.ts`; `src/be/api/test/dev-routes.test.ts`, `src/be/api/test/dev-boot.test.ts`, `src/be/ai-context/test/source-scan.test.ts` |
| F9 | T2, T7, T8 | `src/be/llm-gateway/test/cache-hit.test.ts`; `src/be/dev/test/summary-flow.test.ts`; `src/be/dev/test/standup-flow.test.ts` |
| N1 | T1, T9 | `src/be/contracts/test/date-rules.test.ts`, `src/be/api/test/body-limit.test.ts`, `src/be/api/test/register-route.test.ts`; `src/be/api/test/dev-routes.test.ts`, `src/be/api/test/dev-boot.test.ts`, `src/be/ai-context/test/source-scan.test.ts` |
| N2 | T7, T8, T10 | `src/be/dev/test/summary-flow.test.ts`; `src/be/dev/test/standup-flow.test.ts`; `src/be/dev/test/dev-integration.test.ts` |
| N3 | T9 | `src/be/api/test/dev-routes.test.ts`, `src/be/api/test/dev-boot.test.ts`, `src/be/ai-context/test/source-scan.test.ts` |
| N4 | T7, T8 | `src/be/dev/test/summary-flow.test.ts`; `src/be/dev/test/standup-flow.test.ts` |
| N5 | T9 | `src/be/api/test/dev-routes.test.ts`, `src/be/api/test/dev-boot.test.ts`, `src/be/ai-context/test/source-scan.test.ts` |
| E1 | T9 | `src/be/api/test/dev-routes.test.ts`, `src/be/api/test/dev-boot.test.ts`, `src/be/ai-context/test/source-scan.test.ts` |
| E2 | T9 | `src/be/api/test/dev-routes.test.ts`, `src/be/api/test/dev-boot.test.ts`, `src/be/ai-context/test/source-scan.test.ts` |
| E3 | T9 | `src/be/api/test/dev-routes.test.ts`, `src/be/api/test/dev-boot.test.ts`, `src/be/ai-context/test/source-scan.test.ts` |
| E4 | T5 | `src/be/dev/test/items.test.ts` |
| E5 | T5 | `src/be/dev/test/items.test.ts` |
| E6 | T5 | `src/be/dev/test/items.test.ts` |
| E7 | T5 | `src/be/dev/test/items.test.ts` |
| E8 | T5 | `src/be/dev/test/items.test.ts` |
| E9 | T5 | `src/be/dev/test/items.test.ts` |
| E10 | T5 | `src/be/dev/test/items.test.ts` |
| E11 | T9 | `src/be/api/test/dev-routes.test.ts`, `src/be/api/test/dev-boot.test.ts`, `src/be/ai-context/test/source-scan.test.ts` |
| E12 | T5 | `src/be/dev/test/items.test.ts` |
| E13 | T5 | `src/be/dev/test/items.test.ts` |
| E14 | T9 | `src/be/api/test/dev-routes.test.ts`, `src/be/api/test/dev-boot.test.ts`, `src/be/ai-context/test/source-scan.test.ts` |
| E15 | T7 | `src/be/dev/test/summary-flow.test.ts` |
| E16 | T7 | `src/be/dev/test/summary-flow.test.ts` |
| E17 | T7 | `src/be/dev/test/summary-flow.test.ts` |
| E18 | T7 | `src/be/dev/test/summary-flow.test.ts` |
| E19 | T7 | `src/be/dev/test/summary-flow.test.ts` |
| E20 | T10 | `src/be/dev/test/dev-integration.test.ts` |
| E21 | T7 | `src/be/dev/test/summary-flow.test.ts` |
| E22 | T7 | `src/be/dev/test/summary-flow.test.ts` |
| E23 | T1 | `src/be/contracts/test/date-rules.test.ts`, `src/be/api/test/body-limit.test.ts`, `src/be/api/test/register-route.test.ts` |
| E24 | T1 | `src/be/contracts/test/date-rules.test.ts`, `src/be/api/test/body-limit.test.ts`, `src/be/api/test/register-route.test.ts` |
| E25 | T9 | `src/be/api/test/dev-routes.test.ts`, `src/be/api/test/dev-boot.test.ts`, `src/be/ai-context/test/source-scan.test.ts` |
| E26 | T8 | `src/be/dev/test/standup-flow.test.ts` |
| E27 | T8 | `src/be/dev/test/standup-flow.test.ts` |
| E28 | T8 | `src/be/dev/test/standup-flow.test.ts` |
| E29 | T8 | `src/be/dev/test/standup-flow.test.ts` |
| E30 | T8 | `src/be/dev/test/standup-flow.test.ts` |
| E31 | T8 | `src/be/dev/test/standup-flow.test.ts` |
| E32 | T8 | `src/be/dev/test/standup-flow.test.ts` |
| E33 | T8 | `src/be/dev/test/standup-flow.test.ts` |
| E34 | T10 | `src/be/dev/test/dev-integration.test.ts` |
| E35 | T9 | `src/be/api/test/dev-routes.test.ts`, `src/be/api/test/dev-boot.test.ts`, `src/be/ai-context/test/source-scan.test.ts` |
| E36 | T6 | `src/be/dev/test/{resolvers,sources,summaries-store,standups-store}.test.ts` |
| E37 | T6 | `src/be/dev/test/{resolvers,sources,summaries-store,standups-store}.test.ts` |
| E38 | T6 | `src/be/dev/test/{resolvers,sources,summaries-store,standups-store}.test.ts` |
| E39 | T9 | `src/be/api/test/dev-routes.test.ts`, `src/be/api/test/dev-boot.test.ts`, `src/be/ai-context/test/source-scan.test.ts` |
| E40 | T3, T6 | `src/be/dev/test/writable.test.ts`; `src/be/dev/test/{resolvers,sources,summaries-store,standups-store}.test.ts` |
| E41 | T9 | `src/be/api/test/dev-routes.test.ts`, `src/be/api/test/dev-boot.test.ts`, `src/be/ai-context/test/source-scan.test.ts` |
| E42 | T6 | `src/be/dev/test/{resolvers,sources,summaries-store,standups-store}.test.ts` |
| E43 | T6 | `src/be/dev/test/{resolvers,sources,summaries-store,standups-store}.test.ts` |
| E44 | T9 | `src/be/api/test/dev-routes.test.ts`, `src/be/api/test/dev-boot.test.ts`, `src/be/ai-context/test/source-scan.test.ts` |
| E45 | T9 | `src/be/api/test/dev-routes.test.ts`, `src/be/api/test/dev-boot.test.ts`, `src/be/ai-context/test/source-scan.test.ts` |
| E46 | T10 | `src/be/dev/test/dev-integration.test.ts` |
| E47 | T10 | `src/be/dev/test/dev-integration.test.ts` |
| E48 | T10 | `src/be/dev/test/dev-integration.test.ts` |
| E49 | T5 | `src/be/dev/test/items.test.ts` |
| E50 | T5 | `src/be/dev/test/items.test.ts` |
| E51 | T5 | `src/be/dev/test/items.test.ts` |
| E52 | T5 | `src/be/dev/test/items.test.ts` |
| E53 | T7 | `src/be/dev/test/summary-flow.test.ts` |
| E54 | T7 | `src/be/dev/test/summary-flow.test.ts` |
| E55 | T7 | `src/be/dev/test/summary-flow.test.ts` |
| E56 | T8 | `src/be/dev/test/standup-flow.test.ts` |
| E57 | T9 | `src/be/api/test/dev-routes.test.ts`, `src/be/api/test/dev-boot.test.ts`, `src/be/ai-context/test/source-scan.test.ts` |
| E58 | T9 | `src/be/api/test/dev-routes.test.ts`, `src/be/api/test/dev-boot.test.ts`, `src/be/ai-context/test/source-scan.test.ts` |
| E59 | T9 | `src/be/api/test/dev-routes.test.ts`, `src/be/api/test/dev-boot.test.ts`, `src/be/ai-context/test/source-scan.test.ts` |
| E60 | T7 | `src/be/dev/test/summary-flow.test.ts` |
| E61 | T10 | `src/be/dev/test/dev-integration.test.ts` |
| E62 | T7 | `src/be/dev/test/summary-flow.test.ts` |
| E63 | T8 | `src/be/dev/test/standup-flow.test.ts` |
| E64 | T8 | `src/be/dev/test/standup-flow.test.ts` |
| E65 | T4, T7 | `src/be/dev/test/ai.test.ts`; `src/be/dev/test/summary-flow.test.ts` |
| E66 | T8 | `src/be/dev/test/standup-flow.test.ts` |
| E67 | T7 | `src/be/dev/test/summary-flow.test.ts` |
| E68 | T7 | `src/be/dev/test/summary-flow.test.ts` |
| E69 | T9 | `src/be/api/test/dev-routes.test.ts`, `src/be/api/test/dev-boot.test.ts`, `src/be/ai-context/test/source-scan.test.ts` |
| E70 | T8 | `src/be/dev/test/standup-flow.test.ts` |
| E71 | T8 | `src/be/dev/test/standup-flow.test.ts` |
| E72 | T4, T7 | `src/be/dev/test/ai.test.ts`; `src/be/dev/test/summary-flow.test.ts` |
| E73 | T7 | `src/be/dev/test/summary-flow.test.ts` |
| E74 | T6 | `src/be/dev/test/{resolvers,sources,summaries-store,standups-store}.test.ts` |
| E75 | T7 | `src/be/dev/test/summary-flow.test.ts` |
| E76 | T1, T8 | `src/be/contracts/test/date-rules.test.ts`, `src/be/api/test/body-limit.test.ts`, `src/be/api/test/register-route.test.ts`; `src/be/dev/test/standup-flow.test.ts` |

## Close-out
Run by the orchestrator (no task file):
- [ ] `lint.mjs plan <plan.md> --closeout` has no errors; every Done task has a valid handover.
- [ ] `npm run typecheck`, `npm test` (with `W1_INTEGRATION_DATABASE_URL` set), `npm run lint`, `prisma:validate`, `npm run audit:dependencies` green; each F/N has a passing test.
- [ ] Code review of the branch diff (`code-review` skill); confirmed findings fixed or recorded as Deviations.
- [ ] Branch state: workstream `In review`, session rows removed, Changes lines, Known Gaps (the three in the spec § 6, plus P6's retry exhaustion), `guide out of date: dev package, endpoints 49-52 and 55, gateway additions`.
- [ ] Handover items: contracts rows 50/51 error clarification; W17 `CACHE_HIT` rows; S20/S18 follow-up; Dev Lead `lockProjectForMutation` export; W4 owner `body-limit.ts`; W1 owners `RouteDefinition.bodyLimitBytes` (plan deviation P1).

## Plan-level choices (recorded at Gate 2)
- **P1** - route handlers get no raw `Request`, so the spec's "handler reads the body with the limited reader after authorisation" is done by an optional `RouteDefinition.bodyLimitBytes` read in `registerRoute` after `authorizeRequest` (T1); route 49 then uses a strict `{ items }` `bodySchema`.
- **P2** - the summary output schema accepts any integer `n` (the spec writes 1-10) so E65's out-of-range entries are ignored by the flow instead of failing the batch.
- **P3** - the item `content_hash` hashes `new Date(timestamp).toISOString()` so the same instant in two offsets hashes the same.
- **P4** - the summary cache-hit `inputHash` is SHA-256 of `[[itemId, contentHash], ...]` for the cached items (the spec does not define it).
- **P5** - the `LOCAL_LIMIT` reason travels as `details: [{ field: "reason", message: "LOCAL_LIMIT" }]`, the only `details` shape the error envelope allows (`ErrorSchema.details` is `{ field, message }[]`); both 50 and 51 send it on `AI_BUSY` (architecture §8).
- **P6** - concurrency on W9 writes rests on the project-row lock plus `inMutationTransaction`'s 3 attempts, not on a native upsert (the filtered client's project filter disables it); four or more simultaneous W9 writes to one project can exhaust the retries and get 500. Accepted as a Known Gap; T10 measures three-way concurrency.
- [ ] Ask the operator to review the branch (`AGENTS.md` § 8, gate 3); `Approved` only on their yes;
      never push, open a PR or merge before it.
