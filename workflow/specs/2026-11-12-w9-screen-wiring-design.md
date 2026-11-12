# W9 screen wiring: S20 and S18 (Medium spec: this file is also the plan)

- **Status:** Approved (ludannnn, 2026-11-12)
- **Format:** v2
- **Tier:** Medium - frontend only, calls existing endpoints 9, 49-52 and 55; no contract, schema or permission change
- **Risk:** Medium - renders untrusted uploaded text and model output; a wrong project id or role must fail closed
- **Workstream:** W~1 (follow-up of W9, C~1 in the `w9-dev-slice` branch state)
- **Constraints consulted:** W9 spec SD1, SD4, C~9; W10 spec `screens-dev.md` S20, `screens-lead.md` S18, ui.md §8 and Q6; contracts rows 9, 49-55; `StandupSchema`, `ActivityItemInputSchema`, `MemberSchema`

## Problem
S20 (`/projects/:id/standup`) and S18 (`/projects/:id/standups`) read the in-browser mock (`useDb`). The canvas files `canvas/Standup.tsx` and `canvas/Standups.tsx` hard-code `project={"1"}` and static upload and summary markup. `generateStandup_51` and `listTeamStandups_55` take no project id, and endpoints 49 and 52 have no frontend function. The example file uses `kind/text/at`, which the server rejects. Desired: in `firebase` auth mode, both screens call the live endpoints for the project in the URL. In `prototype` mode they render exactly as today.

## Goals / Non-goals
- F1 Live data functions for 9, 49, 50, 51, 52 and 55, plus `useProjectId()` and the date helpers.
- F2 S20 upload: choosing a file uploads it (49) and shows the result strip and rejected items.
- F3 S20 summaries: summarises `needsSummary` ids (50) in sequential batches of 10, with progress, retry and the AI_BUSY countdown.
- F4 S20 standup: loads (52), generates and regenerates (51) the standup for the selected date.
- F5 S18: one card per developer member (9 + 55) for the selected day.
- F6 `prototype` mode is unchanged; `exampleActivityFile_49` returns a valid `ActivityItemInput` file in both modes.
- N1 Untrusted text (one-liners, standup lines, rejection reasons) is rendered only as React text nodes. No `dangerouslySetInnerHTML`, no `href` built from it, and list `key`s are indexes, never the text.
- Non-goal: wiring the project list or other W5 screens. Live S20/S18 are reached by URL (C~1).
- Non-goal: Edit, Use as is and thumbs (53, 54). These are hidden in live mode until W16 (C~2).
- Non-goal: per-field validation in the browser (SD2), and listing earlier uploads (W10 Q6).

## Contract delta
None on the server. New module `src/fe/lib/api/dev.ts`, exported from `index.ts` as `export * as live from './dev'`. Each call goes through `apiFetch`. A failure is an `ApiError`, read by `e.code`, `e.status` and `e.retryAfterSeconds` (null means 10).

| Function | Request | Returns |
|---|---|---|
| `members_9(projectId)` | `GET /api/projects/{id}/members` | `{ userId, displayName, role }[]` |
| `upload_49(projectId, items: unknown[])` | `POST /api/dev/projects/{id}/uploads` `{ items }` | `{ received, created, updated, unchanged, rejected: {index, reason}[], needsSummary: string[] }` |
| `summaries_50(projectId, itemIds)` | `POST /api/dev/projects/{id}/summaries` `{ itemIds }` (1-10) | `{ summaries: {itemId, oneLiner, cached}[], failed: string[] }` |
| `standup_51(projectId, date)` | `POST /api/dev/projects/{id}/standups` `{ date }` (always sent) | `LiveStandup` |
| `myStandup_52(projectId, date)` | `GET /api/dev/projects/{id}/standups/mine?date=` | `LiveStandup`, or `null` on 404 |
| `teamStandups_55(projectId, date)` | `GET /api/lead/projects/{id}/standups?date=&page=0&size=100` | `LiveStandup[]` (the response's `items`) |

- `LiveStandup` = `{ id, developerId, date, content: { yesterday, today, blockers }, degraded, flagged, cached, outcome: 'EDITED' | 'ACCEPTED' | null, version }`. Other `StandupSchema` fields are ignored.
- `useProjectId(): string | null` reads `usePathname()`. It returns the segment after `/projects/`, lowercased, when that segment is a UUID, and `null` otherwise.
- `todaySgt(now: Date): string` and `nextStandupDate(now: Date): string` return `YYYY-MM-DD` in Asia/Singapore. For the next date, Monday to Thursday give the next day, and Friday to Sunday give the coming Monday.
- `exampleActivityFile_49()` returns `{ items: [...] }` holding two COMMITs and one PR. Every item has `type`, a unique `externalId`, `title`, `timestamp` with a `+08:00` offset, and `files` (one has `[]`). The PR has `repo`, `body` and an `https:` `url`.

## Behaviour (live mode)
- **Screens:** `canvas/Standup.tsx` and `canvas/Standups.tsx` check `useAuthMode()`. When it is `firebase`, they render `LiveStandupScreen` (`live/standup-live.tsx`) and `LiveTeamStandups` (`live/team-standups-live.tsx`) inside the existing app frame, and ignore `?view`. `StandupDegraded` and `StandupsEarlier` stay mock-only. When `useProjectId()` is `null`, or a call returns 404, the main area shows only "This project was not found or you are not a member."
- **Loading and in flight:** each panel shows "Loading…" until its first call settles. A button is disabled while its request is in flight. A response that arrives after unmount, or after the date was switched, is dropped.
- **Upload (F2):** the drop zone takes one `.json` file. A file that is not JSON, is over 1,048,576 bytes, or lacks an `items` array of at most 100 is not sent. The messages are "That file is not valid JSON.", "That file is larger than 1 MB." and "A file can hold at most 100 items." Otherwise all items are sent in one call, as they are; the server cuts long bodies (W9 SD4). There is no "Upload the valid items" button. Result strip: "{created} new, {updated} changed, {unchanged} unchanged, {rejected.length} rejected", then "Item {index + 1}: {reason}" per rejection, with the reason cut to 200 characters.
- **Summaries (F3):** the panel appears when `needsSummary` is non-empty and shows "Summarised {done} of {total}" with the bar. Rows list each returned `oneLiner` in response order. Titles are not shown, because `needsSummary` does not map back to file items. Ids in `failed`, and a whole batch hit by 503 `AI_UNAVAILABLE`, 503 `AI_DISABLED` or a network error, count as failed. **Retry failed ({n})** resends only those ids. 429 `AI_BUSY` shows "AI is busy. Resuming in {s} s." and resends the same batch when the countdown ends. 429 `RATE_LIMITED` stops the run with "Too many AI requests. Try again in {s} s." and marks the remaining ids as failed. Below the panel: "The standup can still be generated without the missing summaries."
- **Standup (F4):** the selector offers **For the next standup · {nextStandupDate}** (default) and **For today · {todaySgt}**, computed once on mount. Selecting one calls 52 for that date. `null` shows "No standup for {date} yet." with **Generate standup**. A standup shows the three lists ("Nothing to report." when empty) and badges: `Edited` (outcome EDITED), "Built from your task activity only" (degraded) and `Flagged for review`. ACCEPTED shows the existing accepted banner. The controls are **Regenerate**, which calls 51 with the selected date, and **Copy**. A `cached: true` answer adds "Nothing has changed since this was generated. Upload new activity to refresh it." 429 `AI_BUSY` and `RATE_LIMITED` show "AI is busy. Try again in {s} s." with Generate disabled for {s} s. 422 shows "That date cannot be used for a standup."
- **S18 (F5):** the day options are **For today** (default), **For the next standup**, and **Earlier**, which lists the 7 calendar days before `todaySgt`, newest first, dates only (SD3). The developer filter is "All developers" or one name, and is applied in the browser. Members with role `DEVELOPER` get one card each, sorted by `displayName`. A card holds the standup whose `developerId` equals the member's `userId`; a standup with no matching member is not shown. A developer with no standup shows "not generated". With no developers, the screen shows "No developers have been added. Add them in Members." Badges: `Edited` (EDITED), none for ACCEPTED or null, "Built from task activity only" (degraded), `Flagged for review`.
- **Other errors:** 409 `CONFLICT_STATE` shows the banner "This project is archived. Upload and generate are off." It disables the file input, Generate, Regenerate and Retry failed; Copy stays enabled. 413 shows "That file is larger than 1 MB." 422 on upload shows the `ApiError` message. 503 `AI_DISABLED` on 51 shows "AI features are off for this deployment." Any other code shows its `ApiError` message in a `bad` toast. 401 is handled by `apiFetch`.

## Edge cases
| ID | Req | Scenario | Expected behaviour (exact) |
|---|---|---|---|
| E1 | F1 | path `/projects/1/standup` | `useProjectId()` is `null`; not-found text; no `fetch` |
| E2 | F1 | 52 returns 404 | `myStandup_52` resolves `null` |
| E3 | F2 | 2 MB file, non-JSON file, 101 items | each gets its message; no `fetch` |
| E4 | F2 | response rejects index 2 | the strip counts and "Item 3: {reason}" |
| E5 | F3 | 23 `needsSummary` ids | 3 calls of 10, 10, 3, each sent after the previous settles |
| E6 | F3 | second batch 429 AI_BUSY, retry 2 | countdown text, then the same 10 ids are resent |
| E7 | F3 | `failed` holds 2 ids | "Retry failed (2)" resends exactly those 2 |
| E8 | F4 | Fri, Sat, Sun 2026-11-13/14/15 18:00 SGT; Thu 2026-11-12 23:59 SGT | next 2026-11-16 for all three, 2026-11-13 for Thursday; today is that calendar day |
| E9 | F4 | 51 `cached: true` | the "Nothing has changed" note |
| E10 | F4 | degraded standup with one blocker | the degraded badge and the blocker line |
| E11 | F4 | live mode | no Edit, Use as is or thumbs buttons |
| E12 | F5 | 3 developers, 1 standup | 3 cards by name, 2 "not generated" |
| E13 | F5 | members include a PM and a DEV_LEAD | no card for them |
| E14 | N1 | a line `<img src=x onerror=alert(1)>` twice | shown twice as literal text; no `img` element |
| E15 | F6 | prototype mode | existing S20/S18 tests pass unchanged; the `fetch` spy is not called |
| E16 | F6 | the example file | each item passes `ActivityItemInputSchema` |
| E17 | F2-F4 | 409 on upload or generate | the archived banner; the four controls disabled; Copy enabled |
| E18 | F4 | date switched while 52 is in flight | the first response is dropped |

## Tasks (this list is the plan)
Tests render with a `LiveTestProvider` (`src/fe/test/live-provider.tsx`) that sets the mode to `firebase`. This needs `AuthModeCtx` exported from `mode-context.tsx`; that one-line export is part of T1. The tests mock `../lib/auth/firebase` (`idToken` resolves `'t'`), stub `next/navigation`'s `usePathname`, and spy on `global.fetch`. T1 may be built and tested before W9 merges, because `fetch` is mocked; T2-T4 run after T0.
- [x] T0 Merge `development` once PR #29 has merged.
- [x] T1 `dev.ts` functions, `useProjectId`, date helpers, the example file, the `AuthModeCtx` export and `LiveTestProvider`. Tests: `src/fe/test/dev-api.test.ts` (E1, E2, E8, E16, each path and body). Satisfies F1, F6.
- [x] T2 `LiveStandupScreen` upload and summaries panels, and the switch in `canvas/Standup.tsx`. Tests: `src/fe/test/standup-live.test.tsx` (E3-E7, E14, E17). Satisfies F2, F3, N1.
- [x] T3 `LiveStandupScreen` standup panel. Tests: the same file (E9-E11, E18) and E15 against the existing tests. Satisfies F4, F6.
- [x] T4 `LiveTeamStandups` and the switch in `canvas/Standups.tsx`. Tests: `src/fe/test/team-standups-live.test.tsx` (E12-E14). Satisfies F5.
- [ ] T5 Close-out: fe typecheck and `vitest` green, Implementer review, branch state updated.

**Decisions made here:**
- SD1 The mode switch is `useAuthMode()`: `firebase` is live, anything else is the mock. Rejected: a new env flag (two switches could disagree).
- SD2 No per-field check in the browser; the server's `rejected` list is shown, and the "Upload the valid items" button is dropped. This reverses W10 S20's "check before sending". Rejected: copying the schema into `src/fe` (two rule sets, and SD4's body cut would differ).
- SD3 Earlier lists dates without counts. Rejected: 7 extra requests per view.
- SD4 Summary rows show one-liners without titles. Rejected: matching titles by timestamp (ties are ambiguous).

## Review record
Round 1, Implementer lens: 3 blocking (project id source, live/canvas wiring, example shape), 10 should-fix, 4 nits; all applied. `RATE_LIMITED` and 409 `CONFLICT_STATE` were confirmed in the W9 code (C~9; `errors.ts`). The 55 `developerId` query is not used; filtering in the browser needs no extra request.
