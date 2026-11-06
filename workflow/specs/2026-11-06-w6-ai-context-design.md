# W6 AI Context Assembly Design

Amended 2026-11-06: see branch state C~3 (source-scan rules 1, 3 and 4 tightened after the close-out Attacker review).

- **Status:** Approved (ludannnn, 2026-11-06)
- **Risk tier:** High - it is the tenancy control for every AI prompt: it decides which project's data, and whose, can reach a model (threat T4, C-05, C-28).
- **Workstream:** W6 | **Plan:** not written yet
- **Constraints consulted:** AD-25, AD-27, AD-28, AD-56 (A-08), AD-11, AD-17, A-03, A-18; architecture §4 (components, table ownership, dependency direction), §7 (trust boundaries), §11; contracts §5.2 (`AiContext.assemble`), §5.4 (`Core.requireMember`); concerns C-05, C-13, C-28; guardrails Binding Decisions (AD-25, AD-55), Known Gaps (typed SQL disabled, unvalidated relation filters); W3 spec conventions.md § Rules for features
- **Reviewed by lenses:** Implementer, Tester, Maintainer, Attacker (tenancy and untrusted text); round 1: about 13 distinct blocking findings, all fixed in these files or settled below (one by the operator under AD-11, SD4); round 2 (Implementer, Attacker): 3 blocking and 7 other findings, all fixed (SD13). Round cap reached; no open questions

## 1. Problem
Contracts §5.2 freezes `AiContext.assemble(caller, feature, targetProjectId): Promise<ContextSections>` and an allow-list of entity types per feature, but nothing implements it (`src/be/ai-context` does not exist). Without it, W7, W8 and W9 would each query data for their prompts, and nothing would stop a prompt for project B from carrying project A's tasks, another developer's activity, or standup text the caller may not read (T4, C-05).

The data W6 assembles belongs to other modules (architecture §4: no module queries another's tables): project briefs, checkpoints, tasks and events to `core` (W5), activity items and summaries to `dev` (W9), facts and digests to `lead` (W8), similar-item search to `pm` (W7). None of them exists yet; W5 has not started.

Desired: one package, `@agile/ai-context`, that owns the per-feature allow-list (which sections, which entity types, trusted or not, budgets), checks the caller's membership through the frozen `Core.requireMember`, calls a **source** function per section that the owning module registers, verifies every returned row against the allow-list and the caller's scope before any text is used, and returns the sections in the W3-ready shape. W6 ships with fake sources in tests, so W7-W9 can build against it now and register their real sources when they land.

## 2. Goals
Seven functional and five non-functional requirements, with acceptance criteria, in [requirements.md](2026-11-06-w6-ai-context-design/requirements.md).

## 3. Non-goals
- Querying any table: every row comes from a registered source owned by the table's module (§4, A-03; operator, SD1).
- Implementing `Core.requireMember` or any source: W5 (core sources, membership), W7 (`pm.similarItems`, its full-text search and index, C-13), W8 (`lead.*`), W9 (`dev.*`). W6 defines their contracts.
- Prompts, static sections, request-input sections (the PM's idea, the epic being expanded) and model calls: the features (W7-W9) and the gateway (W2, W3).
- Sanitising text: the gateway's W3 pipeline does that for every `trusted: false` section.
- Changing the frozen `AiContext` or `Core` types (AD-11): W6 adds a sibling `assembleWith` for per-feature options (SD4).
- Standups as context for any feature (contracts §5.2): no allow-list contains the `STANDUP` entity type.
- The overload fact's cross-project computation: W8, over the caller's member projects (C-28).

## 4. Components
- [Requirements](2026-11-06-w6-ai-context-design/requirements.md) - F and N lists with acceptance criteria
- [API](2026-11-06-w6-ai-context-design/api.md) - `assemble`, `assembleWith`, the allow-list, the source and core registries, row checks, errors
- [Conventions](2026-11-06-w6-ai-context-design/conventions.md) - package layout, rules for source owners and features, the source-scan rule, threat list
- [Edge cases](2026-11-06-w6-ai-context-design/edge-cases.md) - scope, rows, options, registry, failure, scan
- [Implementation order](2026-11-06-w6-ai-context-design/implementation-order.md) - T1 to T3
- No data-model changes: W6 owns no table and writes nothing.
- No UI changes.

## 5. Open questions
| ID | Question | Blocks | Owner |
|---|---|---|---|

## 6. Decisions made in this spec
| ID | Decision | Why / rejected alternative | Asked by |
|---|---|---|---|
| SD1 | Source registry: W6 owns the allow-list and the checks; each section's rows come from a source function the owning module registers by id | Keeps §4 table ownership (A-03) and lets W6 ship before W5, W7-W9. Rejected: W6 reading every table through the filtered client (duplicates W5's and W8's logic, pulls W7's search and index into W6, reverses §4) | operator, 2026-11-06 |
| SD2 | Membership through the frozen `Core.requireMember`, registered by W5 with `registerCore`; `createAiContext({ core })` takes it directly in tests | W5 owns `project_members` and `requireMember` (W1 handover). Rejected: W6 writing its own member lookup | operator, 2026-11-06 |
| SD3 | Risk tier High, four lenses | slicing.md: "Big, high"; tenancy | operator, 2026-11-06 |
| SD4 | `assembleWith(caller, feature, targetProjectId, options)` is exported beside the frozen `assemble`, which equals `assembleWith(..., {})` and therefore throws for `DEV_SUMMARY` and `DEV_STANDUP`; it also returns provenance. This narrows what contracts §5.2 promises for `assemble`, so it is a deviation the W6 PR puts to the PM and the Dev Lead for sign-off under AD-11, with a contracts §5.2 follow-up naming `assembleWith` | The frozen signature cannot carry the summary item ids, the standup window or the PM's query, nor return provenance (C-13). Rejected: amending the frozen type first (W6 would wait on two owners); keeping it without a deviation (narrows a frozen promise silently) | operator, 2026-11-06 (keep, sign-off at PR) |
| SD5 | Registries follow W2's `registerMockResponse` pattern: role modules register their sources at load; the API composition root registers the core and the `core.*` sources, so `core` never imports `ai-context` | Keeps §4's direction (`ai-context` uses `core`, roles use `ai-context`) without W6 importing either. Rejected: W5's `core` registering itself (adds a core → ai-context edge, found by the Maintainer lens) | author |
| SD6 | A row that fails any scope check fails the whole call (`ContextScopeViolation`); nothing is dropped silently | A dropped row hides a source bug that leaks data on the next change. Rejected: filtering bad rows out | author |
| SD7 | Sources run with `Promise.allSettled`; sections are then judged in allow-list order, so the first failing section wins, whether it rejected or broke a check | `Promise.all` made the surfacing error timing-dependent (Implementer, Tester, Attacker lenses) | author |
| SD8 | Membership is checked again after the sources settle | A member removed while sources read would still get the data (Attacker lens). The gap between `assembleWith` returning and the model call is accepted | author |
| SD9 | The trusted `lead.facts` section is one `key=value` row per fact, checked by the `format` rule (number, uuid, date, UPPER_SNAKE enum or `null`) | It skips the W3 pipeline, so free text there is an unsanitised injection path (T3; Attacker and Maintainer lenses). Rejected: trusting W8's convention alone | author |
| SD10 | A duplicate registration throws; tests use `resetContextRegistries()` | A silent replacement lets a load-order bug swap the core or a source (Attacker lens). Rejected: replacing outside tests only via `NODE_ENV` (hidden mode switch) | author |
| SD11 | `requireMember` follows the frozen contract (`Core`, §5.4), although architecture §4 lists it under `auth`; W5's owner confirms | The frozen contract wins over the narrative table; the conflict is a handover, not a W6 decision (Maintainer lens) | author |
| SD12 | Findings not taken: banning newlines in untrusted rows; banning `$queryRaw` (the parameterised form) outside `src/be/db/src` | Untrusted rows are data inside the W3 wrapper, and activity bodies are multi-line, so a forged "row" has no effect; W7's full-text search needs the parameterised `$queryRaw` (A-08), which W1's raw-query boundary already governs | author |
| SD13 | Round 2 (Attacker): rows are snapshotted to frozen plain strings before checks; `resetContextRegistries` and `createAiContext` move to a `testing` subpath kept out of production by scan rule 3; the trusted section uses a closed `FACT_KEYS` vocabulary; the scan parses imports with `ts.preProcessFile`, allows only three workspace packages in gateway files, and bans non-literal imports and any mention of the `…Unsafe` methods outside `src/be/db/src`; a 10 s deadline per source; a source's or core's `NotMember` is replaced by a fresh one | Each closed a concrete bypass: rows changed after checking, a production reset, instruction text in enum-shaped facts, package hops and computed imports, bracket access to unsafe methods, hung sources, content carried on a lookalike error | author |
