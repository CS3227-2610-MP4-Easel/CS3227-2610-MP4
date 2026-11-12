# Architecture — Developer role module

> Legend: `C` = project decision. `AD-nn` = architecture decision, recorded in [decision-log.md](../../../docs/architecture/decision-log.md). This area's **Now** is replaced wholesale when a branch changes it; the decisions table only grows.

## Now

`dev` is the workspace package `src/be/dev` (`@agile/dev`). Endpoints 49-52 and 55 are served by `src/be/api/src/routes/dev.ts` and composed in `dev-composition.ts`. Upload (49) checks each item against `ActivityItemInputSchema`, cuts bodies over 2,000 UTF-16 units (marked `body_truncated` and flagged), and upserts `activity_items` by (project, uploader, type, repo, externalId) with a `content_hash`; it returns `needsSummary` for items in the current standup window that have no current summary. Summaries (50) answers cached items from `item_summaries` (keyed by `GUARD_VERSION` and the prompt version) and makes one DEV_SUMMARY gateway call for the rest on an `openOrReuse` session; it inserts after the call and re-reads, so concurrent callers get the stored one-liner. Standup (51) assembles DEV_STANDUP context: item summaries and task events in the window anchored to the standup date, plus every task blocked now (an empty window still assembles). An unchanged input hash returns the stored row with `cached: true`; otherwise it regenerates the session, makes at most one gateway call (falling back to a code-built `degraded` standup), and upserts `standups`. 52 reads the caller's own standup; 55 lists a project's developer standups for the Dev Lead. All writes run in `inDevWrite`, which takes W5's `lockProjectForMutation`, returns 409 for an archived project and checks membership; exhausted serialization retries become 429 `RATE_LIMITED`. The `dev.activityItems` and `dev.itemSummaries` sources register at boot and return only the caller's rows; the DEV_SUMMARY and DEV_STANDUP mocks register in mock mode.

## Paths

| Path | Role |
|---|---|
| `src/be/dev` | upload, summaries and standup flows, stores, context sources, prompts and mocks |
| `src/be/api/src/routes/dev.ts`, `src/be/api/src/dev-composition.ts` | endpoints 49-52 and 55, composition |

## Decisions

Architecture decisions that shaped this area (`AD-nn`, full reasoning in the decision log). Project decisions (`C<n>`) are added here when they land.

| ID | Date | One-line decision | File |
|---|---|---|---|
| AD-20 | 2026-10-29 | Developer input is an uploaded structured JSON file, no diffs | [decision-log](../../../docs/architecture/decision-log.md) |
| AD-27 | 2026-10-29 | A standup is one developer, one project, one day | [decision-log](../../../docs/architecture/decision-log.md) |
| AD-38 | 2026-10-29 | Uploads at most 1 MB and 100 items; batches of 10; cached per item | [decision-log](../../../docs/architecture/decision-log.md) |
| AD-60 | 2026-10-29 | Uploaded item has no author field; belongs to the uploader | [decision-log](../../../docs/architecture/decision-log.md) |
| C69 | 2026-11-08 | W9 is backend only; screen wiring is a follow-up | [C69](../decisions/C69.md) |
| C75 | 2026-11-08 | The standup activity window is anchored to the standup date | [C75](../decisions/C75.md) |
| C78 | 2026-11-08 | An unchanged input hash returns the stored standup, even when degraded | [C78](../decisions/C78.md) |
| C79 | 2026-11-08 | W9 adds `recordCacheHit` and `openOrReuse` to the gateway | [C79](../decisions/C79.md) |
| C71 | 2026-11-09 | W9 writes lock with W5's exported `lockProjectForMutation` | [C71](../decisions/C71.md) |
| C72 | 2026-11-09 | An exhausted write retry returns 429, not 500 | [C72](../decisions/C72.md) |
| C74 | 2026-11-12 | An empty standup window still includes current blockers | [C74](../decisions/C74.md) |

## Target Link and Drift

Realises [architecture §9.4](../../../docs/architecture/agile-platform-architecture.md); work package I in [delivery-plan.md](../../../docs/architecture/delivery-plan.md). Drift: none known; S20/S18 screen wiring follows (C69).
