# Implementation Order

| ID | Task | Delivers | Satisfies |
|---|---|---|---|
| T1 | Package and allow-list: the `src/be/ai-context` workspace (`package.json`, `tsconfig.json`, root `tsconfig.json` reference, `package-lock.json` via `npm install`), `allow-list.ts` (allow-list, source ids, feature roles, option schemas, trusted format), `errors.ts`, `registry.ts` (with `resetContextRegistries`), `index.ts`; `allow-list.test.ts` | the ids and types W5, W7-W9 register against; a buildable package | F1, F7, N5 |
| T2 | Assembly: `assemble.ts` (`createAiContext`, `getAiContext`, the nine steps, check-major row checks, option cloning, `allSettled` ordering), `type-checks.ts`; `assemble.test.ts` | `assemble` and `assembleWith` for W7-W9 | F2, F3, F4, F5, F6, F7, N1, N3, N4 |
| T3 | Source scan: `source-scan.test.ts` with a pure scanner function and inline fixtures | the AD-25 rules in CI | N2 |

## Dependencies

| Task | Depends on | Can run concurrently with | Wave |
|---|---|---|---|
| T1 Package and allow-list | - | T3 | 1 |
| T2 Assembly | T1 | - | 2 |
| T3 Source scan | - | T1 | 1 |

Shared-file hazards: T3 adds one test file inside `src/be/ai-context/test/`, a directory T1 creates, and touches no file T1 writes. `npm install` in T1 changes `package-lock.json`; if the agent policy refuses it, that step is a `GATE:` for the operator.
