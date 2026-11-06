# Conventions

## Placement
- New workspace `src/be/ai-context` (`@agile/ai-context`), laid out like `@agile/llm-gateway`:
  - `package.json`: `name`, `private`, `main`/`types` `dist/…`, `exports` `./src/index.ts`, script `typecheck`; dependencies `@agile/contracts` and `zod` ^4.6.6 (`import { z } from "zod"`); devDependency `@agile/llm-gateway` (only `allow-list.test.ts` imports its `FEATURES`).
  - `tsconfig.json`: a copy of the gateway's (`composite`, `rootDir: src`, `include: src/**/*.ts`, a reference to `../contracts`).
  - A reference in the root `tsconfig.json`; `package-lock.json` updated by `npm install` and committed with T1, so CI's `npm ci` passes.
- `src/allow-list.ts` (data: `ALLOW_LIST`, `SOURCE_IDS`, `FEATURE_ROLES`, `FACT_KEYS`, option schemas), `src/registry.ts` (both registries and the reset), `src/assemble.ts` (`createAiContext`, `getAiContext`, snapshots, row checks), `src/errors.ts` (`ContextScopeViolation`), `src/testing.ts` (the `@agile/ai-context/testing` subpath: `resetContextRegistries`, `createAiContext`), `src/type-checks.ts` (compile-time only: `AiContext` assignments and one `@ts-expect-error` negative control, so `tsc` proves the frozen type is met; tests are not type-checked by `tsc`).
- Tests in `src/be/ai-context/test/`: `allow-list.test.ts`, `assemble.test.ts`, `source-scan.test.ts`. Fake core and fake sources only; every test that registers calls `resetContextRegistries()` in `afterEach`.
- `@agile/ai-context` imports no role module, no `core`, no `@agile/db`, no Prisma and no `@agile/llm-gateway` at runtime.

## Wiring (handover to W5 and to whoever owns `src/be/api` wiring)
- The API composition root calls `registerCore(core)` and registers `core.projectBrief`, `core.checkpoints`, `core.taskEvents` and `core.blockedTasks`; `core` does not import `@agile/ai-context` (keeps §4's direction).
- A boot test in the API composition root asserts that the core and all ten source ids are registered once every module has loaded, so a missing registration fails CI rather than a request.
- Architecture §4 puts `requireMember` in `auth`; contracts §5.4 (frozen) puts it in `Core`. W6 follows the frozen contract; W5's owner confirms where it lives. `requireMember` throws `NotMember` for an archived project or a non-member (contracts §5.2); this is core behaviour W6 cannot test.

## Rules for source owners (handover to W5, W7, W8, W9)
- Read through the filtered client, so deleted rows and archived projects are excluded (A-13); never `$queryRawUnsafe`; raw SQL only parameterised with project ids (guardrails: typed SQL disabled).
- One row per entity, with `projectId`, `ref`, and `ownerId` for **own** sections as defined in api.md § Types (actor for `TASK_EVENT`, assignee for `TASK`, uploader for `ACTIVITY_ITEM` and `ITEM_SUMMARY`). Rows most important first. `text` is the one line the prompt shows.
- W6 catches **inconsistent** rows (wrong project, owner, type, size), not a source that lies about them; each owner's own tests must prove the rows are what they claim.
- `pm.similarItems` filters by the caller's member project ids **before** searching, so W6's membership check is a backstop; titles only, at most 5, `websearch_to_tsquery` or `plainto_tsquery` on `options.query` (C-13); `[]` with no query or the AD-28 flag off.
- `lead.facts` returns one `key=value` row per fact, with keys only from `FACT_KEYS` (api.md § Fact keys) and values of that key's kind; repeated keys group per checkpoint or person in order (for example `overloaded_user=<uuid>` followed by its `overloaded_user_open_points=…`). New keys are added to `FACT_KEYS` by PR. Titles, names and descriptions go in `lead.changes`. W8 tests that the overload fact covers only the caller's member projects (C-28). W8 derives "changes since the previous digest" itself from its own `project_digests`.
- `dev.itemSummaries` returns per-item summaries only, never standup text; W9 tests this. `dev.activityItems` returns only the requested items. `dev.itemSummaries`, `core.taskEvents` and `core.blockedTasks` return only the caller's rows inside `options.window` where it applies; W6 cannot see row timestamps, so the window is the source's duty.

## Rules for features (W7, W8, W9)
- Get stored data for a prompt only from `assembleWith` (the frozen `assemble` throws for `DEV_SUMMARY` and `DEV_STANDUP`); add request-input sections (the PM's idea, the epic being expanded) yourself, always `trusted: false`.
- Do not catch and retry `ContextScopeViolation` or `CONTEXT_SOURCE_*`: they are bugs and map to 500. `NotMember` maps to 404; `ROLE_DENIED` cannot happen behind the policy map and maps to 500.
- Store `provenance` where the feature must show it (the plan's retrieved items, C-13). The gateway's `LlmCall` has no provenance field, so W6 cannot prove at run time that a prompt came from `assembleWith`; the source-scan rule is the guard.

## Source-scan rule (N2)
- Extensions: `.ts`, `.tsx`, `.mts`, `.cts`, `.js`, `.mjs`. Never scanned: `node_modules`, `dist`, `test` directories.
- Imports are read with TypeScript's `ts.preProcessFile` (the root devDependency), so multi-line, `export … from`, `import()` and `require()` forms are all seen, and type-only imports count like any other.
- Rule 1 (files under `src/be/*/src/` except `src/be/db`, `src/be/llm-gateway`, `src/be/proposals`, allowed both by §4, and `src/be/ai-context`): a file that imports `@agile/llm-gateway` may import, among workspace packages, only `@agile/contracts`, `@agile/ai-context` and `@agile/llm-gateway`; every relative file it imports, transitively, is held to the same rule. Any `@agile/*` data package (`@agile/db`, `@agile/core`, `@agile/auth`, …) or `@prisma/client` reached that way is a finding.
- Rule 2 (files under `src/be/*/src/` and `src/fe/` except `src/be/db/src/`): the identifiers `$queryRawUnsafe` and `$executeRawUnsafe` do not appear at all, in any form (property, bracket string, destructuring), since only `src/be/db/src` needs to name them.
- Rule 3 (files under `src/be/*/src/` and `src/fe/` except `src/be/api/src/`, the composition root): no import of `@agile/ai-context/testing`.
- Rule 4 (same files as rule 1): no `import()` or `require()` whose argument is not a string literal.
- The scanner is a pure function over a map of path to content, returning `{ filesScanned, findings: { file, line, rule }[] }`; fixtures are inline strings, so the repository scan never sees fixture text. Until W7-W9 land, rule 1 has no file to check: the repository test asserts `filesScanned > 0` and no findings.
- Residual, accepted: a route file can query in one module and pass plain values into a gateway file it does not import; the runtime checks and code review cover that pattern.

## Logging and errors
- Only `context_scope_violation` with `{ sourceId, check }` is logged, exactly once per violation. Errors carry fixed codes, a source id or a check name, never row content, and never a `cause`.

## Threat list

| Actor | Abuse | Mitigation | Edge case |
|---|---|---|---|
| Member of project A | Gets A's data into a prompt for project B | membership before sources; target scope on rows | E5, E13 |
| Removed member | Keeps reading while removed mid-call | membership re-checked after the sources | E36 |
| Developer in project A | Plants a task title that ranks for the PM's idea in project B (C-05) | member scope per project; titles only, ≤ 200 chars, ≤ 5 | E18, E19, E20 |
| Developer | Gets another developer's activity or events into their standup | own scope on every developer section | E14, E15 |
| Developer | Asks for a summary of items they did not request | requested scope | E16, E17 |
| Buggy W8 source | Puts a title or name into the trusted facts section, skipping W3 (T3) | `format` check on trusted rows | E35 |
| Buggy source (any owner) | Returns another project's rows, forbidden types, extra or oversized rows | per-row checks; whole call fails | E10-E13, E39 |
| Load-order bug | Replaces the core or a source with another module's | duplicate registration throws | E37 |
| Any module | Resets the registries, or builds a context over a permissive core | both live only in the `testing` subpath, kept out of production by scan rule 3 | E30 |
| Buggy or hostile source | Changes rows after they are checked, or returns getters | rows snapshotted to frozen plain strings before checks; output built from snapshots | E44 |
| Slow source | Holds the request open | 10 s deadline per source | E45 |
| Feature author | Builds a prompt from its own queries | source-scan rule (transitive) | E30, E31 |
| Anyone reading logs | Learns row content from errors | fixed codes, no `cause` | E28 |
| Accepted | A source that lies about `projectId` or `ownerId`; the gap between `assembleWith` returning and the model call | owners' own tests; short-lived | - |
