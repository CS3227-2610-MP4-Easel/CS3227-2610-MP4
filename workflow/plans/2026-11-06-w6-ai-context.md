# W6 AI Context Assembly Implementation Plan

- **Status:** Approved (ludannnn, 2026-11-06)

> **For agents:** tick `- [ ]` -> `- [x]` as you finish each step, in this file, in the same commit as the work. Keep the branch state's Progress cell current. Spec: [W6 AI context design](../specs/2026-11-06-w6-ai-context-design.md).

**Commands** (`STATE.md` §2, `workflow/config.json`): `<TEST>` = `npm test` (its `pretest` runs `prisma generate`, so `DATABASE_URL` must be exported). `<BUILD>` = `npm run typecheck`, then `npm run lint`, then `npm --workspace @agile/db run prisma:validate`. The agent commits; the operator pushes. Source code writes `\u{XXXX}` escapes or `String.fromCodePoint`, never 4-digit `\uXXXX` (the file tools turn those into raw characters; W3 lesson).

## Scope
**Goal:** build `@agile/ai-context`: the allow-listed, membership-checked, row-checked `assembleWith` (and the frozen `assemble`) that every AI feature uses for stored context, plus the AD-25 source-scan test.
**In scope:** F1-F7, N1-N5.
**Non-goals:** querying any table; implementing `Core.requireMember` or any source (W5, W7, W8, W9); prompts and model calls; sanitising (W3); changing the frozen types (AD-11; SD4 is signed off at the PR); standups as context; the overload fact's computation (W8).
**Risk tier:** High - every row check has a passing and failing test; the close-out runs the Attacker and Tester lenses on the branch diff.

## Task order
| Task | Depends on | Can run concurrently with | Wave | Status |
|---|---|---|---|---|
| T1 Package and allow-list | - | T3 | 1 | Done |
| T2 Assembly | T1 | - | 2 | Not started |
| T3 Source scan | - | T1 | 1 | Done |

## Traceability
| Requirement | Task(s) | Verified by |
|---|---|---|
| F1 | T1, T2 | `allow-list.test.ts` (data); `assemble.test.ts` E1, E2 |
| F2 | T2 | `assemble.test.ts` E3, E4, E40 |
| F3 | T2 | `assemble.test.ts` E5, E6, E36, E41 |
| F4 | T2 | `assemble.test.ts` E10-E17, E35, E39, E42, E44 |
| F5 | T2 | `assemble.test.ts` E18, E19, E20, E43 |
| F6 | T2 | `assemble.test.ts` E21-E25, E44 |
| F7 | T1, T2 | `allow-list.test.ts` E9, E37; `assemble.test.ts` E7, E8, E34 |
| N1 | T2 | `assemble.test.ts` E27, E28 |
| N2 | T3 | `source-scan.test.ts` E30, E31 |
| N3 | T2 | `src/type-checks.ts` under `npm run typecheck` (E32); `git diff` of `frozen.ts` empty |
| N4 | T2 | `assemble.test.ts` E26, E27, E29, E38, E45 |
| N5 | T1 | `allow-list.test.ts` E33 |
| E1, E2, E3, E4, E40 | T2 | `assemble.test.ts` "input and allow-list" |
| E5, E6, E36, E41 | T2 | `assemble.test.ts` "membership" |
| E7, E8, E34 | T2 | `assemble.test.ts` "registries" |
| E9, E37 | T1 | `allow-list.test.ts` "registries" |
| E10, E11, E12, E13, E14, E15, E16, E17, E35, E39, E42 | T2 | `assemble.test.ts` "row checks" |
| E18, E19, E20, E43 | T2 | `assemble.test.ts` "cross-project" |
| E21, E22, E23, E24, E25 | T2 | `assemble.test.ts` "output" |
| E26, E27, E28, E29, E38, E44, E45 | T2 | `assemble.test.ts` "failure and logging" |
| E30, E31 | T3 | `source-scan.test.ts` |
| E32 | T2 | `npm run typecheck` |
| E33 | T1 | `allow-list.test.ts` |

## Verification gates
- Per task: `npm test`, `npm run typecheck`, `npm run lint`.
- After wave 1 and at close-out: `<BUILD>` and `npm test`, nothing skipped in `src/be/ai-context`.

---

### T1: Package and allow-list
**Delivers:** the ids and types W5, W7-W9 register against; a buildable package | **Satisfies:** F1, F7, N5 | **Depends on:** - | **Wave:** 1

**Files**
| Action | Path | What changes |
|---|---|---|
| Create | `src/be/ai-context/package.json` | `@agile/ai-context`, `private`, `main`/`types` `dist/…`, `exports` `{ ".": "./src/index.ts", "./testing": "./src/testing.ts" }`, script `typecheck`; dependencies `@agile/contracts`, `zod` ^4.6.6; devDependency `@agile/llm-gateway` (conventions.md § Placement) |
| Create | `src/be/ai-context/tsconfig.json` | copy of the gateway's with `references: [{ "path": "../contracts" }]` |
| Modify | `tsconfig.json` (`references`) | add `{ "path": "src/be/ai-context" }` |
| Modify | `package-lock.json` | `npm install` links the new workspace (CI's `npm ci` needs it) |
| Create | `src/be/ai-context/src/allow-list.ts` | `EntityType`, `SourceId`, `ALLOW_LIST` (api.md § Allow-list, exactly), `SOURCE_IDS`, `FEATURE_ROLES`, `FACT_KEYS` (api.md § Fact keys), per-feature option schemas (api.md § Options) |
| Create | `src/be/ai-context/src/errors.ts` | `ContextScopeViolation` (api.md § Types) |
| Create | `src/be/ai-context/src/registry.ts` | source and core registries, `registerContextSource`, `registerCore`, `resetContextRegistries` (api.md § Registries) |
| Create | `src/be/ai-context/src/index.ts`, `src/testing.ts` | main entry exports and the `testing` subpath (`resetContextRegistries`; `createAiContext` is added in T2) |
| Test | `src/be/ai-context/test/allow-list.test.ts` | E9, E33, E37; the allow-list table pinned field by field |

**Checklist**
- [x] 1. Create the package files and the root reference; run `npm install` to update `package-lock.json` (GATE: if the agent policy refuses it, ask the operator to run `npm install` and stop until done).
- [x] 2. Write failing `allow-list.test.ts`: the 13 allow-list rows field by field; `FEATURE_ROLES` equal to the gateway's `FEATURES[f].role` both ways and trusted sources `["lead.facts"]` (E33); registry errors and reset (E9 first two cases, E37). Run `npm test`; expect FAIL (modules missing).
- [x] 3. Implement `allow-list.ts`, `errors.ts`, `registry.ts`, `index.ts`, `testing.ts`.
- [x] 4. `npm test`, `npm run typecheck`, `npm run lint` green.
- [x] 5. Update branch state: Progress `T1/3 done`, Changes line.
- [x] 6. Commit: `feat: add the ai-context package with the per-feature allow-list and registries, so owners can register their sources (W6)`.

**Notes for next task:** the contracts use `zod/v3`; `ai-context` uses `zod` v4 for its own option schemas and only `import type`s from contracts. `npm install` was allowed for the agent. A second test also pins `facts`' max chars to the longest valid `FACT_KEYS` row.

### T2: Assembly
**Delivers:** `assemble` and `assembleWith` for W7-W9 | **Satisfies:** F2, F3, F4, F5, F6, F7, N1, N3, N4 | **Depends on:** T1 | **Wave:** 2

**Files**
| Action | Path | What changes |
|---|---|---|
| Create | `src/be/ai-context/src/assemble.ts` | `createAiContext({ core, sources, sourceTimeoutMs })`, `getAiContext()`, the nine steps of api.md § assembleWith, snapshots, check-major row checks, fresh `NotMember`, no `cause` |
| Create | `src/be/ai-context/src/type-checks.ts` | `const a: AiContext = getAiContext()`; the same for `createAiContext(…)`; one `@ts-expect-error` call with a number as `feature` (E32) |
| Modify | `src/be/ai-context/src/index.ts`, `src/testing.ts` | export `getAiContext`, `assembleWith` types; `createAiContext` from `testing` only |
| Test | `src/be/ai-context/test/assemble.test.ts` | E1-E8, E10-E29, E34-E36, E38-E45 |

Intended shape of steps 6-9 (adapt to tests):
```ts
// argsFor(s): { caller: Object.freeze({ ...caller }), projectId, options: deepFreeze(structuredClone(validatedOptions)) }, fresh per source.
// The async wrapper turns a synchronous throw or a non-promise return into a settled result, so ordering rules still hold.
const settled = await Promise.allSettled(sections.map((s) => withDeadline((async () => source(s.sourceId)(argsFor(s)))(), sourceTimeoutMs)));
for (const [i, section] of sections.entries()) {
  const result = settled[i];
  if (result.status === "rejected") throw result.reason instanceof NotMember ? new NotMember() : new Error(`CONTEXT_SOURCE_FAILED:${section.sourceId}`);
  rows[i] = snapshot(section, result.value);        // frozen plain strings, read once; non-plain -> shape
  await checkSection(section, rows[i], caller, target, options, core);   // check-major; throws ContextScopeViolation
}
await requireMember(core, caller.userId, target);  // step 8: fresh NotMember or CORE_FAILED
return build(sections, rows);                       // step 9: from snapshots only
```
`withDeadline` clears its timer when the source settles, and a late rejection is already handled by `allSettled` (E38: no unhandled rejection).

**Checklist**
- [ ] 1. Write failing `assemble.test.ts` with a fake core (sequence-numbered calls, per-project and per-call throws) and fake sources (sequence numbers, recorded options): input and allow-list (E1-E4, E40), membership (E5, E6, E36, E41), registries (E7, E8, E9 late-source case, E34), row checks (E10-E17, E35, E39 generated from `ALLOW_LIST`, E42, E44), cross-project (E18-E20, E43), output (E21-E25), failure and logging (E26-E29, E38, E45). Every test that registers calls `resetContextRegistries()` in `afterEach`. Run `npm test`; expect FAIL.
- [ ] 2. Implement steps 1-5 (validation, role, core, membership, missing sources) in `assemble.ts`.
- [ ] 3. Implement steps 6-9: per-source `argsFor` (frozen caller copy, deep-frozen `structuredClone` of the options), the async wrapper and deadline, `allSettled`, snapshots, row checks in check-major order with one `console.warn("context_scope_violation", { sourceId, check })` at the single place that throws `ContextScopeViolation`, the re-check, the build; then the frozen `assemble`.
- [ ] 4. Add `type-checks.ts`; `npm run typecheck` green with the `@ts-expect-error` live (E32); `git diff --exit-code src/be/contracts/src/frozen.ts`.
- [ ] 5. `npm test` green; `<BUILD>` green.
- [ ] 6. Update branch state: Progress `T2/3 done`, Changes line, an Architecture block for `llm-gateway` / `ai-context` (the area's AI-context paragraph and the `src/be/ai-context` path, from planned to built).
- [ ] 7. Commit: `feat: add assembleWith with membership, per-row scope checks and snapshots, so every prompt gets only data the caller may see (W6)`.

### T3: Source scan
**Delivers:** the AD-25 rules in CI | **Satisfies:** N2 | **Depends on:** - | **Wave:** 1

**Files**
| Action | Path | What changes |
|---|---|---|
| Test | `src/be/ai-context/test/source-scan.test.ts` | a pure `scan(files: Map<string, string>)` returning `{ filesScanned, findings }` for rules 1-4 (conventions.md § Source-scan rule), using `ts.preProcessFile` for imports; E30 (inline fixtures) and E31 (the repository file set, read from disk) |

Intended shape:
```ts
// rule 1 (rule-1 file set): follow relative imports from each gateway-importing file; any workspace import other than
// @agile/contracts, @agile/ai-context or @agile/llm-gateway, and any @prisma/client import, anywhere in the chain, is a finding.
// rule 2 (rule-2 file set): /\$(queryRaw|executeRaw)Unsafe\b/ anywhere.
// rule 3: "@agile/ai-context/testing" outside src/be/api/src.
// rule 4 (rule-1 file set, gateway-importing files): /\b(import|require)\s*\(\s*[^'"\s)]/ on the source with comments
// and string contents blanked first; a template literal counts as non-literal (it can be computed).
```

**Checklist**
- [x] 1. Write `source-scan.test.ts` with the E30 fixtures (each a separate test case) against a stub `scan` that returns no findings; run `npm test`; expect the "reported" fixtures to FAIL.
- [x] 2. Implement the scanner (rules 1-4 with their file sets) in the test file; E30 green.
- [x] 3. Add E31 over the repository: `filesScanned > 0`, no findings.
- [x] 4. `npm test`, `npm run typecheck`, `npm run lint` green.
- [x] 5. Update branch state: Progress, Changes line.
- [x] 6. Commit: `test: add the AD-25 source scan, so features cannot build prompts from their own queries (W6)`.

**Notes for next task:** a multi-line import is reported on the module name's line (`ts.preProcessFile` positions). Rule 4 blanks comments and quoted strings before matching, so a template literal argument counts as computed.

### Close-out
- [ ] Every Traceability row verified; `<BUILD>` green; `npm test` green.
- [ ] Review the branch diff with the Attacker and Tester lenses (read-only reviewer agents); fix blocking findings or record them as Deviations.
- [ ] Spec index status and plan Task order reflect reality; amendments recorded in the branch state.
- [ ] Branch state: W6 `In review`, session rows cleared, Changes complete, Handovers for W5 (wiring, boot test, `requireMember` owner), W7-W9 (sources, `assembleWith`, file split), W8 (`FACT_KEYS`), the PR's AD-11 sign-off (SD4), and `slicing.md` W8 depends on W6; Deviation for the frozen `assemble` narrowing; `guide out of date: llm-gateway`.
- [ ] Ask the operator to review the branch (Gate 3); write `Approved` only on their yes.
- [ ] GATE: the operator pushes `w6-ai-context` and opens the PR into `development`, asking the PM and the Dev Lead to sign off SD4 under AD-11.
