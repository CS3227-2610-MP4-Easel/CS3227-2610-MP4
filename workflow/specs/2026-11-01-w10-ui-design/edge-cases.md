# Edge Cases and Non-Happy Paths

IDs are permanent: never reuse or renumber. Every F requirement appears in at least one row. W10 has no API of its own, so each row is a state or behaviour that a mockup must draw, taken from the screen files (S-numbers) and `ui.md`. All rows are checked by walking the mockup (test layer UI). The risk tier is Medium, so the "what could corrupt data" section is not needed: the mockups store nothing.

## Input
| ID | Requirement | Scenario | Expected behaviour (exact) | Why it matters | Test layer |
|---|---|---|---|---|---|
| E1 | F2 | S14: the idea is under 20 or over 6000 characters, or empty after cleaning | The live counter shows the length. The server's 422 message appears under the field and the typed idea stays in the box | A PM must not lose a long idea to a validation message | UI |
| E2 | F2 | S20: the file is not JSON, is over 1 MB, or has over 100 items | Nothing is sent. The panel names the limit that was exceeded | The 413 round trip is avoided and the Developer knows which limit applies | UI |
| E3 | F2 | S20: some items in the file are invalid | Problems are listed per item ("Item 14: title is required"). **Upload the valid items** is offered | One bad line must not block the whole file | UI |
| E4 | F2 | S10: end date before start date, or dates overlapping another sprint | Inline messages "End date must be on or after the start date" and "Dates overlap sprint {name}" | Overlapping sprints break velocity and the active-sprint rule | UI |
| E5 | F2 | S7: a sprint is set on a task with no story points | The form blocks it with "Estimate this task before it joins a sprint." | Unestimated tasks cannot be planned | UI |
| E6 | F2, N1 | Any text field holds markup, a markdown link or a script tag, from a user, the AI or an upload | It is drawn literally as plain text with line breaks kept. Only `https:` item URLs are links, opened in a new tab with `rel="noopener noreferrer"` | Stored text is untrusted (A-15) | UI |

## State
| ID | Requirement | Scenario | Expected behaviour (exact) | Why it matters | Test layer |
|---|---|---|---|---|---|
| E7 | F2 | The project is archived | The banner "This project is archived and read-only." shows on every project screen. Every write control is disabled with the tooltip "Archived projects are read-only" | No role can change an archived project | UI |
| E8 | F2 | S3 has no projects | PM sees "No projects yet." with **New project**. Dev Lead and Developer see the † "ask your PM to add you" copy | Each role gets the next step it can take | UI |
| E9 | F2 | S14: not every epic is DONE | **Approve plan** is disabled with the tooltip "Expand every epic first (N left)" (AD-46) | An unexpanded epic would create an epic without tasks | UI |
| E10 | F2 | S14: a plan with some epics DONE, one FAILED and one PENDING | The FAILED card shows its reason and **Retry**. The PENDING card shows **Expand**. The other epics are unaffected. Approve stays disabled | Partial failure is the normal case for a long run | UI |
| E11 | F2 | A task is in a closed sprint | The row and card show a lock and "Sprint closed". The drawer says "This task is frozen because its sprint is closed." | Closed sprints are frozen (A-14) | UI |
| E12 | F2 | The project has no closed sprint | The forecast cells read "No forecast yet", risk reads `UNKNOWN`, and the line "Close a sprint to get a forecast." shows | A zero forecast would read as a real prediction | UI |
| E13 | F2 | Registration was interrupted: Firebase signed up but endpoint 3 failed | The next sign-in goes to S2 at **Finish setup**, not to a second sign-up | The Firebase account must not be created twice | UI |
| E14 | F2 | S5 of a new project | The role's three-step checklist is the main content and ticks itself from the data | The first visit shows what to do next | UI |

## Concurrency
| ID | Requirement | Scenario | Expected behaviour (exact) | Why it matters | Test layer |
|---|---|---|---|---|---|
| E15 | F2 | 409 `CONFLICT_VERSION` on an edit | Banner "Someone else changed this. Reload to see their version." with **Reload**. The user's unsaved edit stays visible until they choose | Two editors must not overwrite each other silently | UI |
| E16 | F2 | S17: applying suggestions where one is out of date (409 `CONFLICT_STATE`) | Nothing is applied. Listed rows show "Out of date: {reason}", are unchecked and disabled. The rest stay selectable and **Generate a new digest** is offered | The Dev Lead sees that the whole apply was refused, not half | UI |
| E17 | F2 | S14: another request approved, rejected or replaced the plan | The 409 banner shows the server reason and the screen reloads the proposal so the status chip is correct | A stale approve button must not mislead | UI |
| E18 | F2 | The user double clicks a submit button | The second click is ignored while the request is in flight | Duplicate creates and duplicate AI calls | UI |
| E19 | F2 | Another request is expanding an epic that this browser did not start | The card reads "Another request is expanding this epic" and the screen re-reads the proposal every 5 seconds | Two tabs must not both start the same epic | UI |

## Failure (AI and network)
| ID | Requirement | Scenario | Expected behaviour (exact) | Why it matters | Test layer |
|---|---|---|---|---|---|
| E20 | F2 | The model is unreachable when a PM generates a plan (503 `AI_UNAVAILABLE`) | † "LLM unreachable. Please try again later" with **Try again** and **Create manually** | The PM is never stuck (AD-34) | UI |
| E21 | F2 | The model fails when a Dev Lead asks for a digest | The facts stay, the digest panel shows the `DegradedNote` and **Try again** | The numbers do not depend on the model (AD-34) | UI |
| E22 | F2 | The model fails when a Developer generates a standup | A standup built from the Developer's own task events is shown, marked "Built from your task activity only". The panel never ends empty | A degraded standup still helps the daily meeting | UI |
| E23 | F2 | 503 `AI_DISABLED` | "AI features are switched off in this environment." Every non-AI feature keeps working | The product must run without AI | UI |
| E24 | F2 | 429 `AI_BUSY` during **Expand all epics** or summaries | The run pauses with a countdown from `Retry-After` and resumes by itself | One busy response must not abandon a long run | UI |
| E25 | F2 | 200 with `flagged: true` | A "flagged for review" marker shows on the item. The text is still shown, as plain text | The reviewer decides, the UI does not hide content | UI |
| E26 | F2 | The browser is offline | An offline banner shows and write actions are disabled until the next successful request | Silent lost writes | UI |
| E27 | F2 | S19: one project's request fails while loading | The other groups show. The failed group shows an error panel with **Try again** | One bad project must not blank the page | UI |

## Permission
| ID | Requirement | Scenario | Expected behaviour (exact) | Why it matters | Test layer |
|---|---|---|---|---|---|
| E28 | F2 | A Developer types a PM-only URL such as `/projects/:id/plan` | Full-page "Your role cannot open this page" with a link home. Navigation never links there | The UI hides actions as a convenience; the server stays the control | UI |
| E29 | F2 | A user opens a project they are not a member of, or one that does not exist | "Not found", with no hint that it exists elsewhere (AD-33) | Existence must not leak | UI |
| E30 | F2 | A PM opens S6 | Status is read-only: no drag, no **Change status** and no **Mark blocked** menu. **Add task** stays | Status is not a PM operation | UI |
| E31 | F2, F3 | A PM opens the **Health** tab | Only the facts panel shows, with the line "Read only. The Dev Lead generates the digest and applies re-plan changes." No digest button and no suggestions list exist | The PM gets facts but cannot start an AI call or change the plan | UI |
| E32 | F2 | The session expires on a deep link | The user is sent to S1 and returned to the same path after sign-in | A pasted link must still work | UI |

## Time
| ID | Requirement | Scenario | Expected behaviour (exact) | Why it matters | Test layer |
|---|---|---|---|---|---|
| E33 | F2, F3 | S20 selector **For the next standup** on a Friday, Saturday or Sunday | The option shows the date of the following Monday in `Asia/Singapore` (AD-37, AD-44), for example "Mon 9 Nov" | The next standup is the next working day | UI |
| E34 | F2 | Switching between **For the next standup** and **For today** | Each choice loads its own stored standup. A day without one reads "No standup for {selected date} yet." | One standup per developer, project and day (AD-27) | UI |

## Volume
| ID | Requirement | Scenario | Expected behaviour (exact) | Why it matters | Test layer |
|---|---|---|---|---|---|
| E35 | F2 | S6 has more than 100 tasks | **Show more** loads the next page of endpoint 20 | The board must not load unbounded data | UI |

## Handover fallbacks
Each row applies only if the owner refuses the change; the mockup is drawn for the requested change and the fallback is the behaviour in the row.

| ID | Requirement | Scenario | Expected behaviour (exact) | Why it matters | Test layer |
|---|---|---|---|---|---|
| E36 | F3 | Endpoint 6 does not return progress (SD5) | S3 calls endpoint 7 per visible row. The screen looks the same | The bar per project is kept | UI |
| E37 | F3 | Endpoint 36 stays Tier 2 (SD4) | S14 phase A has no plan-in-progress banner and no **Continue plan**. A PM returns by the URL with the proposal id, or through S15 once it exists | Resume is lost but nothing breaks | UI |
| E38 | F3 | Endpoint 42 stays Dev Lead only (SD3) | The **Health** tab is hidden for the PM. S5 shows no **View project health**. S9 shows no `RiskBadge` to the PM | The PM must not see a control that returns 403 | UI |
| E39 | F3 | Endpoints 51 and 52 reject a future date (SD6) | S20 and S18 offer **For today** only | The selector must not offer a day the server refuses | UI |

## Prototype
| ID | Requirement | Scenario | Expected behaviour (exact) | Why it matters | Test layer |
|---|---|---|---|---|---|
| E40 | F4 | The prototype differs from the confirmed canvas | Each difference is listed in the branch state before the prototype is reviewed | The canvas is the source of truth for the design | UI |
| E41 | F4 | The prototype is opened without a network | Every screen still opens, from fixture data. No Firebase call, key or token exists in it (AD-32) | The prototype must be safe to share and to run in class | UI |

## Accessibility and consistency
| ID | Requirement | Scenario | Expected behaviour (exact) | Why it matters | Test layer |
|---|---|---|---|---|---|
| E42 | N1 | A screen is viewed in greyscale | Every `StatusChip`, `RiskBadge` and `BlockedBadge` still shows its text label and its icon | Colour alone fails colour-blind users | UI |
| E43 | N1 | A Developer moves a task without a pointer | The card's **Change status** menu is reachable with the keyboard and sends the same change as a drag | Drag and drop alone excludes keyboard users | UI |
| E44 | N2 | A colour or spacing value appears on a screen that is not in the tokens | It is replaced by a token. Tokens are defined in one place | Three roles must look like one product | UI |
| E45 | N2 | A role needs a different navigation | The one `AppShell` shows different items. No second shell is drawn | Per-role layout copies drift apart (R6) | UI |

## Reference
| ID | Requirement | Scenario | Expected behaviour (exact) | Why it matters | Test layer |
|---|---|---|---|---|---|
| E46 | F1 | An endpoint of `contracts.md` has no screen | It is listed in `endpoint-coverage.md` with the reason. Only endpoint 1 (health) is listed this way | A silent gap would become a missing screen late in the build | UI |
| E47 | F1 | A screen has copy that the architecture does not fix | It is proposed copy and may change in the mockups. Only copy marked † is fixed by the architecture | Reviewers must know which wording is negotiable | UI |
