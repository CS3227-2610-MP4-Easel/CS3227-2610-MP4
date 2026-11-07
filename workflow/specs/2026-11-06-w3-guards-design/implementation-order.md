# Implementation Order

| ID | Task | Delivers | Satisfies |
|---|---|---|---|
| T1 | Input rules: `sanitise.ts` with the rule data (D, P, I, invisible characters, confusables), `sanitiseInput`, `injectionFlag` and their unit tests | the pure input guard W7 can call | F1, F2, F3, F4, N2, N3 |
| T2 | Output rules: `output-check.ts` with the rule data and `checkOutput` (iterative walk, joined check, no-throw wrapper) and its unit tests | the pure output guard | F6, N2, N3 |
| T3 | Pipeline and wrapping: `guards.ts` (`GuardPipeline` with `maxChars`, `OutputContext`, optional `reason`; `defaultGuards`; `GUARD_LIMITS`; `rulesFingerprint`; `GUARD_VERSION` with its doc comment and the `KNOWN` test); `budget.ts` (`fitSections` with boundary, wrapper and suffix; `assertStaticSectionsFit` counts the suffix); `gateway.ts` (STATIC trust check, input cap, trusted-section cleaning, joined flag, boundary seam with validation and collision check, `secrets` dep, context to `output`); `runtime.ts` (passes the key in `secrets`); `index.ts` exports | W3 live in `run`; exports for W6-W9 | F5, F7, N1, N4, N5 |

## W2 tests T3 changes (N4)
Only these, and only because untrusted sections are now wrapped and the suffix is always appended:
- `fit.test.ts:8` (the `render` helper must wrap untrusted sections), `:16`, `:18`, `:19` (the `kept` slice, the probe string and the `sectionTokens` check assume no wrapper), `:25` (`user` is now the suffix, not `""`), `:42`, `:44`, `:50` (expected `user` strings and the token total gain the wrapper and suffix); the helper at `:7` marks non-static sections untrusted, so these rows now exercise wrapping.
- `run.test.ts:49` and `:304` (expected user message is wrapped and ends with the suffix).
- W2 tests that pass `fitSections` three arguments gain the boundary argument.
`run.test.ts:323` and `run-integration.test.ts:145` (replacement guards without `reason`) stay unchanged (E38).

## Dependencies

| Task | Depends on | Can run concurrently with | Wave |
|---|---|---|---|
| T1 Input rules | - | T2 | 1 |
| T2 Output rules | - | T1 | 1 |
| T3 Pipeline and wrapping | T1, T2 | - | 2 |

Shared-file hazards: T1 and T2 each add one source and one test file and touch nothing shared; `src/index.ts` exports are added in T3 only, so wave 1 shares no file.
