# Branch State — w6-ai-context

**What this branch has changed, and how to pick it up.** `workflow/project-state/STATE.md`
describes `INT`; read it for context and write here instead of editing it.
`sync-project-state` folds this file in after the branch merges.

- **Branch:** w6-ai-context (from `INT` at `46b33b1`)
- **Base:** 46b33b1
- **Owner:** ludannnn (Developer member)
- **Status:** Approved
- **Approved:** ludannnn 2026-11-06
- **Last updated:** 2026-11-06 by Claude Opus 5.5 — Gate 3 approved; PR next

**Untouched:** Conventions

---

**Scope.** W6 AI context assembly: `AiContext.assemble(caller, feature, targetProjectId)` (contracts §5.2, A-08, AD-56), the one membership-scoped function every AI feature uses to build its context sections, plus the source-scan test that stops features building their own context queries (AD-25). W6 does not need W3's code, only its section rules (W3 spec conventions.md), so it branches from `development`, not from `w3-guards`.

---

## 1. How to Resume

**Sessions**

| Session | Started | Agent(s) | Workstream | Status | Doing | Next action | Last touched |
|---|---|---|---|---|---|---|---|

**Remaining**

- [x] Gate 1: W6 spec approved by ludannnn on 2026-11-06.
- [x] Gate 2: W6 plan approved by ludannnn on 2026-11-06.
- [ ] The operator is asking W5's owner (Dev Lead) for a delivery estimate; W6's membership check and its core-owned sections depend on W5.
- [x] Close-out: branch-diff review (Attacker, Tester); findings fixed (C~3 for the scanner).
- [x] Gate 3: operator approved the branch (ludannnn, 2026-11-06).
- [ ] GATE: the operator pushes `w6-ai-context` and opens the PR into `development`, asking the PM and the Dev Lead to sign off SD4 / D~1 under AD-11.
- [ ] **Handover (PM, Dev Lead):** sign off spec SD4 under AD-11 in the W6 PR: the frozen `assemble` stays, `assembleWith` is added, and `assemble` throws for `DEV_SUMMARY` and `DEV_STANDUP` (D~1). Then a contracts §5.2 follow-up names `assembleWith` as the entry point.
- [ ] **Handover (W5):** confirm where `requireMember` lives (architecture §4 says `auth`, frozen contracts §5.4 says `Core`; W6 follows §5.4) and that it throws `NotMember` for archived projects. The API composition root calls `registerCore(core)` and registers `core.projectBrief`, `core.checkpoints`, `core.taskEvents`, `core.blockedTasks`; `core` must not import `@agile/ai-context`. Add a boot test there asserting the core and all ten source ids are registered.
- [ ] **Handover (W7, W8, W9):** register your sources at module load with `registerContextSource` (rules in the W6 spec conventions.md § Rules for source owners: `ownerId` meanings, rows most important first, filtered client, no unsafe raw SQL); call `assembleWith`, not `assemble`; keep gateway-calling files free of database imports (the source scan enforces it); never catch `ContextScopeViolation`. W7: `pm.similarItems` filters by the caller's member projects before searching, titles only, at most 5. W8: `lead.facts` emits only `FACT_KEYS` rows (add keys to `allow-list.ts` by PR, and update `facts`' max chars, which a test pins); test that the overload fact covers only member projects (C-28). W9: `dev.itemSummaries` never returns standup text.
- [ ] **Handover (slicing):** `workflow/specs/slicing.md` lists W8's dependencies as W2, W3, W5; it also depends on W6.

---

## 2. Workstreams

| ID | Workstream | Status | Spec | Plan | Progress | Guide |
|---|---|---|---|---|---|---|
| W6 | AI context assembly | In review | [spec](../../specs/2026-11-06-w6-ai-context-design.md) | [plan](../../plans/2026-11-06-w6-ai-context.md) | Approved at Gate 3; PR next; guide out of date: llm-gateway | — |

---

## 3. Changes

| Date | What changed | Workstream | Ref |
|---|---|---|---|
| 2026-11-06 | Gate 3: operator approved the branch | W6 | this commit |
| 2026-11-06 | Close-out review of the branch diff (Attacker, Tester). Fixed in code: a source array with a throwing getter, a revoked Proxy or a huge length could leak its own error or spin (rows are now read only up to `maxRows + 1` inside a guard); a rejection whose prototype lookup throws escaped the `NotMember` check (`isNotMember` guard). Fixed in the scanner (spec amended, C~3): concatenated and template-hidden computed imports, unresolved and out-of-`src` relative imports, deep `ai-context` imports, gateway subpaths. Tests strengthened: E28 now covers every error code (input, role, core, missing, failed, timeout, lookalike, both core failures) and asserts each violation's check name, with `console.error` spied; E44 proves the change happened and covers a throwing getter; E36, E25, E34, E18, E45, E39 assert more. 381 tests, 381 pass, none skipped | W6 | a6068c1 |
| 2026-11-06 | T2: `assemble.ts`: `getAiContext` and `createAiContext` (the `testing` subpath) with the nine steps (input, role, core, membership, missing sources, `allSettled` behind a 10 s deadline with per-source frozen copies, snapshots and check-major row checks in allow-list order, membership re-check, build from snapshots); fresh `NotMember`, fixed codes, no `cause`; `type-checks.ts` proves the frozen `AiContext` type (its negative control was shown live by disarming it); 39 tests (E1-E29, E34-E45); removing the re-check was shown to fail 6 of them; 368 tests, 368 pass, none skipped | W6 | 3107b5a |
| 2026-11-06 | T3: `source-scan.test.ts`: a pure scanner (imports read with `ts.preProcessFile`) for rules 1-4 (gateway files reach only `@agile/contracts`, `@agile/ai-context`, `@agile/llm-gateway`, followed through relative imports; no `…Unsafe` raw methods outside `src/be/db/src`; the `testing` subpath only in `src/be/api/src`; no computed imports in gateway files); 17 fixture tests (E30) and the repository scan (E31, no findings); 329 tests, 329 pass, none skipped | W6 | 1f8d2b6 |
| 2026-11-06 | T1: new `@agile/ai-context` workspace (package, tsconfig, root reference, lockfile via `npm install`); `allow-list.ts` (allow-list, source ids, feature roles, `FACT_KEYS`, option schemas), `errors.ts`, `registry.ts` (duplicates refused), `testing.ts` subpath with the reset; 5 tests (allow-list and fact keys pinned, E9, E33, E37); 311 tests, 311 pass, none skipped | W6 | 38f74de |
| 2026-11-06 | Plan written (T1-T3, close-out), reviewed (Implementer lens: 1 blocking, 5 other, all fixed: rule-1 packages, synchronous source throws, per-source option copies, the single warning, rule-4 file set, a stub-first scan test) and approved at Gate 2 | W6 | 460691a |
| 2026-11-06 | Spec approved at Gate 1 by the operator | W6 | cb00e15 |
| 2026-11-06 | W6 spec drafted (7 F, 5 N, E1-E45, T1-T3) and reviewed in two rounds (Implementer, Tester, Maintainer, Attacker; then Implementer, Attacker): about 16 distinct blocking findings fixed, among them the core → ai-context dependency inversion, the frozen `assemble` narrowing (operator: sign-off at PR, C~2), nondeterministic failures, a membership race, free text in the trusted facts section, rows changed after checking, production reset of the registries, and source-scan bypasses; lint clean | W6 | this commit |
| 2026-11-06 | Branch created from `development` at `46b33b1` (after PR #14 merged) | W6 | this commit |

---

## 4. Architecture

> Legend: `C` = project decision. AD-nn entries are in docs/architecture.

### 4.1 LLM gateway and AI context (`architecture/llm-gateway.md`)

**Now (proposed, addition only):** fold after W2's and W3's proposed Now for this area, replacing "except `ai-context` (W6)" with "complete", and add: `src/be/ai-context` (`@agile/ai-context`) is built. `getAiContext().assembleWith(caller, feature, targetProjectId, options)` (beside the frozen `assemble`, which serves only features without required options) returns the stored-data sections a feature may use and their provenance. It checks the input, the caller's role for the feature and the caller's membership of the target project through the frozen `Core.requireMember`, then calls every allow-listed source of the feature at once (each with its own frozen copy of the options, behind a 10-second deadline), snapshots each source's rows and checks them in allow-list order (shape, count, type, length, the closed `key=value` vocabulary for the one trusted section, project, owner, requested items, and per-project membership for the PM's cross-project retrieval), checks membership again, and builds the sections from the snapshots. Any failure returns nothing. Sources are registered by the owning modules (`registerContextSource`; the API composition root registers the core and the `core.*` sources), so `ai-context` imports no other module. A source-scan test keeps gateway-calling files away from database packages and unsafe raw queries.

| Path | Role |
|---|---|
| `src/be/ai-context/src/allow-list.ts` | per-feature allow-list, source ids, feature roles, `FACT_KEYS`, option schemas |
| `src/be/ai-context/src/assemble.ts` | `getAiContext`, `createAiContext`, snapshots and row checks |
| `src/be/ai-context/src/registry.ts` | source and core registries |
| `src/be/ai-context/src/testing.ts` | `@agile/ai-context/testing` (reset, `createAiContext`), kept out of production by the source scan |

| ID | Date | Decision | Why / who asked | Source |
|---|---|---|---|---|
| C~1 | 2026-11-06 | Source registry; membership through the frozen `Core`; High tier | operator's three answers | spec SD1-SD3 |
| C~2 | 2026-11-06 | Keep the frozen `assemble`; `assembleWith` signed off at the PR (AD-11) | operator | spec SD4 |

---

## 7. Decisions

> Legend: `C` = project decision. AD-nn entries are in docs/architecture.

### C~1 — W6's scope choices

- **Date:** 2026-11-06
- **Who asked:** operator (ludannnn), choosing the recommended option in three questions before the spec
- **Decision:** W6 is a source registry: it owns the per-feature allow-list, the membership check and per-row scope checks, and each section's rows come from a source function the owning module registers (spec SD1); membership goes through the frozen `Core.requireMember`, registered by W5 (SD2); risk tier High with four lenses (SD3).
- **Why:** architecture §4 table ownership (A-03); W5 has not started, so W6 must ship without it; W6 is the tenancy control (T4, C-05).
- **Rejected:** W6 reading every table directly through the filtered client; W6 writing its own member lookup; three lenses.

### C~2 — Keep the frozen `assemble`; sign off `assembleWith` at the PR (AD-11)

- **Date:** 2026-11-06
- **Who asked:** operator (ludannnn), "Keep + sign-off at PR", after the Maintainer and Implementer lenses showed that the frozen `assemble` cannot serve `DEV_SUMMARY` or `DEV_STANDUP`
- **Decision:** the frozen `AiContext` type stays as it is; `assembleWith` is added beside it; `assemble` throws `INVALID_ASSEMBLE_INPUT` for the two Developer features. This is recorded as a deviation from contracts §5.2's promise, and the W6 PR asks the PM and the Dev Lead to sign off under AD-11, with a contracts §5.2 follow-up naming `assembleWith` (spec SD4).
- **Why:** the frozen signature cannot carry item ids, the standup window or the PM's query; AD-11 needs all three owners for any change to a frozen interface.
- **Rejected:** amending the frozen type first (W6 waits on two owners); keeping it without a deviation (narrows a frozen promise silently).

### C~3 — Source-scan rules tightened after the close-out review (spec amendment)

- **Date:** 2026-11-06
- **Who asked:** author, from the close-out Attacker lens; the operator approved the spec's intent (no feature builds its own context queries) at Gate 1
- **Decision:** rule 1 also triggers on gateway subpaths, follows relative imports into `test` directories and outside `src`, and fails closed on an unresolved relative import; rule 3 covers every `@agile/ai-context/` subpath and relative paths into the package (except the package itself and the API composition root); rule 4 is found by parsing with TypeScript rather than by regex.
- **Why:** each was a working bypass: `import("@" + "agile/db")`, a template literal containing `//` hiding a computed import, a query moved to `../lib` or `./test`, and deep imports reaching `resetContextRegistries` or the raw registries.
- **Rejected:** keeping the spec's narrower wording (the bypasses defeat N2).

## 6. Known Gaps

New entries:

- **AI context checks rows, not sources** — `assembleWith` catches inconsistent rows (wrong project, owner, type, size, unrequested items, free text in facts), not a source that lies about a row's `projectId` or `ownerId`; each source owner's tests must prove their rows (W5, W7-W9).
- **The source scan cannot see data passed between unrelated files** — a route can query in one module and pass plain values into a gateway-calling file it does not import; review and the runtime checks cover it.
- **The gap between `assembleWith` and the model call** — membership is checked before and after the reads, not at `run` time.

## 8. Deviations

- **D~1 — The frozen `assemble` serves only features without required options (spec SD4):** contracts §5.2 promises `AiContext.assemble` for every feature; `DEV_SUMMARY` and `DEV_STANDUP` need item ids or a window that its frozen signature cannot carry, so for them it throws `INVALID_ASSEMBLE_INPUT` and features call `assembleWith`. The frozen type itself is unchanged. The operator chose to keep it and seek the PM's and Dev Lead's sign-off in the W6 PR (C~2).
