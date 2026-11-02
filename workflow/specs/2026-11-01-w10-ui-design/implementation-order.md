# Implementation Order

Statuses in the last column are as of 2026-11-01.

| ID | Task | Delivers | Satisfies | Status |
|---|---|---|---|---|
| T1 | Reference documents | `ui.md`, `flows.md` and the screen files that the rest is built from | F1 | Done (4cd429a) |
| T2 | Spec close-out | index, edge cases, this order, lint, review lenses, owner approval (gate 1) | F1, F3 | In progress |
| T3 | Design tokens, shell and shared components | one set of tokens, `AppShell`, `ProjectHeader`, `ProjectTabs`, the shared components of `ui.md` §5 | N1, N2 | Drawn on the canvas, not verified |
| T4 | Tier 1 screens | S1 to S9, S11, S14, S17, S18, S19, S20 with their listed states | F2, N1 | Drawn on the canvas, not verified |
| T5 | Tier 2 screens | S10, S12, S13, S15, S16 and the Tier 2 controls on the Tier 1 screens | F2, N1 | Drawn on the canvas, not verified |
| T6 | Remaining states | S14 phase D, S20 degraded standup, the global states sheet, 1024 px width check | F2, N1 | Not started |
| T7 | Operator review of the canvas | confirmed mockups; corrections applied | F2 | Not started |
| T8 | Handovers | one message per owner: W5 (endpoint 6), the policy map and W8 owners (endpoint 42), W7 (endpoint 36), W9 (endpoints 51 and 52), W4 (sign-in and register are design only) | F3 | Not started |
| T9 | Standalone prototype | the confirmed canvas as a Next.js clickable prototype on typed fixtures behind one data layer (SD13) | F4, N2 | Not started |

## Dependencies

| Task | Depends on | Can run concurrently with | Wave |
|---|---|---|---|
| T1 Reference documents | - | - | 1 |
| T2 Spec close-out | T1 | T3, T8 | 2 |
| T3 Tokens, shell and components | T1 | T2, T8 | 2 |
| T8 Handovers | T1 | T2, T3 | 2 |
| T4 Tier 1 screens | T3 | T5 | 3 |
| T5 Tier 2 screens | T3 | T4 | 3 |
| T6 Remaining states | T4, T5 | - | 4 |
| T7 Operator review of the canvas | T6, T8 | - | 5 |
| T9 Standalone prototype | T2, T7 | - | 6 |

Shared-file hazards: T2 and T8 both write the branch state, so serialize those writes. T3 to T6 all draw on the one design canvas, so T4 and T5 take turns on a screen that appears in both (the Tier 2 controls of a Tier 1 screen). T7 waits for T8 so that no mockup is confirmed while a handover is unsent. T9 starts only after the owner approves the spec (T2).
