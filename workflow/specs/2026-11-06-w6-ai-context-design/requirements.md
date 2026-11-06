# Requirements

Ordered so that a requirement others depend on comes first. Tables, ids and limits are in [api.md](api.md).

## Functional

| ID | Requirement | Acceptance criterion |
|---|---|---|
| F1 | Allow-list: each feature has a fixed list of sections (name, source id, kind, priority, budget, trusted, entity types, scope, limits) in api.md § Allow-list; `assembleWith` calls only those sources and returns sections in that order with those attributes | For each feature, the sources called and every returned section's name, kind, priority, budget and trusted flag equal the api.md table; a source registered for another feature is never called |
| F2 | Input checks: input is validated, then `caller.role` must be the feature's role; violations throw before any core or source call | A `DEVELOPER` asking for `LEAD_DIGEST` throws `ROLE_DENIED` and calls nothing; `DEV_SUMMARY` without `itemIds` throws `INVALID_ASSEMBLE_INPUT` and calls nothing |
| F3 | Membership: `core.requireMember(caller.userId, targetProjectId)` runs before any source and again after all sources settle; its `NotMember` propagates unchanged; any other core error becomes `CORE_FAILED` | A non-member gets `NotMember` and no source is called; a caller removed while sources ran gets `NotMember` and no sections |
| F4 | Row checks: every row is checked against its section's rules (api.md § Row checks, check-major, in the stated order) before any text is used; the first failure throws `ContextScopeViolation` naming the source and the check, and nothing is returned | Each check has a passing and a failing case; the violation names the right check |
| F5 | Cross-project retrieval: `pm.similarItems` rows may come from other projects only if `core.requireMember` succeeds for each distinct project, checked once each, in first-appearance order | A similar item from a project the caller is not a member of throws `ContextScopeViolation` (`check: membership`) |
| F6 | Output and isolation: one section per allow-listed section with at least one row, in allow-list order, text = row texts joined with `\n`; provenance for every row; each source receives its own deep-frozen copy of the options and caller; failures are deterministic (the first failing section in allow-list order wins, whether a rejection or a violation) | E21's exact value; a source cannot change another source's options; two failing sources always give the same error |
| F7 | Registries and exports: `registerContextSource` and `registerCore` refuse unknown ids, non-functions and duplicates; `resetContextRegistries` for tests; `getAiContext()` reads the registries at call time; `createAiContext({ core, sources })` copies its inputs; missing pieces throw fixed errors at call time | E7, E8, E9, E34, E37 |

## Non-functional

| ID | Category | Requirement | Acceptance criterion |
|---|---|---|---|
| N1 | Security | No error message, `cause`, serialised error, log line or warning carries row text, row ids, option values or core/source error details; only fixed codes, the source id and the check name | E28 |
| N2 | Security | Source-scan test (AD-25, A-08), rules in conventions.md § Source-scan rule: a feature file that imports `@agile/llm-gateway` must not reach `@agile/db` or `@prisma/client`, directly or through relative imports; no `.$queryRawUnsafe(` or `.$executeRawUnsafe(` call outside `src/be/db/src`; the scanner is a pure function proven on inline fixtures | E30, E31 |
| N3 | Compatibility | The frozen `AiContext` and `Core` types are unchanged; `getAiContext()` and `createAiContext(...)` satisfy `AiContext`, checked by `tsc` in a source file with a negative control | E32; `git diff` of `src/be/contracts/src/frozen.ts` is empty |
| N4 | Reliability | No partial result: any failure returns nothing; no unhandled rejection from sibling sources | E26, E27, E29, E38 |
| N5 | Maintainability | The allow-list is data in one module; a test pins `FEATURE_ROLES` to the gateway's `FEATURES` both ways, and the trusted sections to the literal list `["lead.facts"]` | E33 |
