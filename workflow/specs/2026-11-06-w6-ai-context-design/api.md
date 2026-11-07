# API

All operations are in-process functions of the new package `@agile/ai-context` (`src/be/ai-context`). None is an HTTP endpoint; callers are server code only. The frozen types in `src/be/contracts/src/frozen.ts` (`AiContext`, `Core`, `ContextSections`, `NotMember`) are used unchanged. Tables write regex or type alternation `|` as `\|`.

## Types

- `EntityType` = `PROJECT` · `CHECKPOINT` · `EPIC` · `TASK` · `TASK_EVENT` · `FACTS` · `DIGEST` · `ACTIVITY_ITEM` · `ITEM_SUMMARY`. There is no `STANDUP` type (contracts §5.2).
- `SourceId` = the ten ids in § Allow-list.
- `ContextRow = { projectId: string; ref: { type: EntityType; id: string }; ownerId?: string; text: string }`
- `ownerId` meaning, per type, for the sections with scope **own**: `ITEM_SUMMARY` and `ACTIVITY_ITEM` the uploader; `TASK_EVENT` the actor; `TASK` the assignee.
- `ContextSource = (args: { caller: { userId: string; role: UserRole }; projectId: string; options: Readonly<AssembleOptions> }) => Promise<ContextRow[]>`
- `Provenance = { section: string; type: EntityType; id: string; projectId: string }[]`
- `ContextScopeViolation extends Error`: `name` `"ContextScopeViolation"`, `sourceId`, `check`; message `CONTEXT_SCOPE_VIOLATION:<sourceId>:<check>`; no `cause`.

## Allow-list

Data in `src/allow-list.ts`. Sections are returned in this order. "Owner" registers the source. `Scope`: **target** = every row's `projectId` equals `targetProjectId`; **member** = the caller must be a member of each row's project (F5); **own** = every row's `ownerId` equals `caller.userId`; **requested** = every row's `ref.id` is in `options.itemIds`, each at most once; **format** = trusted text format (§ Row checks).

| Feature (role) | Section name | Source id (owner) | Kind | Priority | Budget tokens | Trusted | Types | Scope | Max rows | Max chars per row |
|---|---|---|---|---|---|---|---|---|---|---|
| `PM_PLAN_OUTLINE` (PM) | `project-brief` | `core.projectBrief` (W5) | DYNAMIC | 1 | 1200 | no | PROJECT | target | 1 | 4300 |
| | `checkpoints` | `core.checkpoints` (W5) | DYNAMIC | 2 | 400 | no | CHECKPOINT | target | 50 | 300 |
| | `similar-items` | `pm.similarItems` (W7) | RETRIEVED | 3 | 600 | no | EPIC, TASK | member | 5 | 200 |
| `PM_PLAN_EXPAND` (PM) | `project-brief` | `core.projectBrief` | DYNAMIC | 1 | 800 | no | PROJECT | target | 1 | 4300 |
| | `checkpoints` | `core.checkpoints` | DYNAMIC | 2 | 300 | no | CHECKPOINT | target | 50 | 300 |
| | `similar-items` | `pm.similarItems` | RETRIEVED | 3 | 400 | no | EPIC, TASK | member | 5 | 200 |
| `LEAD_DIGEST` (DEV_LEAD) | `facts` | `lead.facts` (W8) | DYNAMIC | 1 | 1500 | **yes** | FACTS | target, format | 200 | 52 (the longest valid row, `overloaded_user=<uuid>`; recomputed when `FACT_KEYS` changes) |
| | `changes` | `lead.changes` (W8) | DYNAMIC | 2 | 1200 | no | TASK_EVENT | target | 200 | 400 |
| | `previous-digest` | `lead.previousDigest` (W8) | DYNAMIC | 3 | 800 | no | DIGEST | target | 1 | 4000 |
| `DEV_SUMMARY` (DEVELOPER) | `activity-items` | `dev.activityItems` (W9) | DYNAMIC | 1 | 2500 | no | ACTIVITY_ITEM | target, own, requested | 10 | 2600 |
| `DEV_STANDUP` (DEVELOPER) | `item-summaries` | `dev.itemSummaries` (W9) | DYNAMIC | 1 | 1200 | no | ITEM_SUMMARY | target, own | 100 | 300 |
| | `task-events` | `core.taskEvents` (W5) | DYNAMIC | 2 | 800 | no | TASK_EVENT | target, own | 200 | 400 |
| | `blocked-tasks` | `core.blockedTasks` (W5) | DYNAMIC | 3 | 500 | no | TASK | target, own | 50 | 800 |

- `lead.facts` is the only trusted section, because it skips the W3 pipeline; its rows are `key=value` lines enforced by the `format` check, never names or titles (T3).
- Max rows × max chars can exceed a section's token budget. The gateway then cuts the section's tail and sets `truncated` (AD-17), so sources return rows most important first. Provenance lists every row returned, not only the rows the gateway kept.

## Options

`AssembleOptions` is validated by a strict zod schema per feature (`zod` ^4.6.6; unknown keys rejected; `null` or a non-object is invalid):

| Feature | Options | Rules |
|---|---|---|
| `PM_PLAN_OUTLINE`, `PM_PLAN_EXPAND` | `{ query?: string }` | 1 to 6000 characters when present; every source receives the options, only `pm.similarItems` uses `query` |
| `LEAD_DIGEST` | `{}` | - |
| `DEV_SUMMARY` | `{ itemIds: string[] }` | required; 1 to 10 distinct uuids |
| `DEV_STANDUP` | `{ window: { from: Date; to: Date } }` | required; valid `Date` objects, `from` before `to` (the AD-44 window, computed by W9) |

Each source receives its own `structuredClone` of the validated options, deep-frozen, so no source can change what another sees or what the caller passed (`Date` objects are copies, so changing one has no effect elsewhere). The `caller` object passed to sources is a frozen copy too.

## `assembleWith(caller, feature, targetProjectId, options): Promise<{ sections: ContextSections; provenance: Provenance }>`

| Field | Definition |
|---|---|
| Caller | W7, W8, W9 feature code, before `LlmGateway.run`; the route has already passed the policy-map gate |
| Steps (in order) | 1 validate `caller` (uuid `userId`, `UserRole`), `feature` (`Feature`), `targetProjectId` (uuid) and `options` (§ Options); 2 `caller.role` must equal the feature's role; 3 a core must be registered (or injected); 4 `core.requireMember(caller.userId, targetProjectId)`; 5 every source of the feature must be registered, checked in allow-list order; 6 call all the feature's sources at once with `Promise.allSettled`, each raced against a deadline of `sourceTimeoutMs` (10,000 ms; a source that has not settled by then counts as rejected); 7 walk the sections in allow-list order: a rejected source fails here; otherwise **snapshot** its rows (read each field once into a frozen plain object of strings: `projectId`, `ref.type`, `ref.id`, `ownerId`, `text`; a row whose fields are not plain data fails `shape`) and run the row checks on the snapshots; the first failure stops the call; 8 call `core.requireMember(caller.userId, targetProjectId)` again (membership may have changed while sources ran); 9 build sections and provenance from the snapshots only (F6) |
| Outputs | sections in allow-list order, omitting any with no rows; `text` = row texts joined with `\n`; `name`, `kind`, `priority`, `budgetTokens`, `trusted` from the allow-list; provenance in row order |
| Errors | step 1: `RangeError("INVALID_ASSEMBLE_INPUT")`; step 2: `Error("ROLE_DENIED")`; step 3: `Error("CORE_NOT_REGISTERED")`; steps 4 and 8: an `instanceof NotMember` error is replaced by a fresh `new NotMember()`, any other core error becomes `Error("CORE_FAILED")`; step 5: `Error("CONTEXT_SOURCE_MISSING:<first missing id>")`; step 7: a source's `NotMember` is replaced by a fresh `new NotMember()`, any other rejection or a missed deadline becomes `Error("CONTEXT_SOURCE_FAILED:<id>")`, a failed check is `ContextScopeViolation`. No W6 error sets `cause` or carries a caught error's message |
| Idempotency | none needed; reads only |
| Transaction | none; W6 opens none |
| Logging | on `ContextScopeViolation` only, exactly once: `console.warn("context_scope_violation", { sourceId, check })` |

`assemble(caller, feature, targetProjectId)` (the frozen `AiContext`) returns `(await assembleWith(caller, feature, targetProjectId, {})).sections`. For `DEV_SUMMARY` and `DEV_STANDUP`, whose options are required, it throws `INVALID_ASSEMBLE_INPUT`: those features call `assembleWith` (spec SD4, signed off under AD-11 in the W6 PR).

### Row checks
For each section, each check runs over all of the section's rows before the next check (check-major), in this order; the first failure is the violation's `check`.

| Check | Rule |
|---|---|
| `shape` | the source returned an array; each row is an object with a uuid `projectId`, a known `ref.type`, a `ref.id` of 1 to 64 characters, a uuid `ownerId` when present, and a `text` that is a well-formed string (no lone surrogates) of at least one code point |
| `count` | rows ≤ the section's max rows |
| `type` | `ref.type` is in the section's types |
| `length` | the text's code points ≤ the section's max chars per row |
| `format` | (trusted sections) the text is `<key>=<value>` where `<key>` is in the closed `FACT_KEYS` table (§ Fact keys) and `<value>` is `null` or matches that key's kind: `number` `^-?[0-9]{1,15}(\.[0-9]{1,6})?$`; `uuid` (lower-case 8-4-4-4-12 hex); `date` `^[0-9]{4}-[0-9]{2}-[0-9]{2}$`; `risk` one of `AT_RISK`, `ON_TRACK`, `UNKNOWN` |
| `project` | (scope target) `projectId` equals `targetProjectId` |
| `owner` | (scope own) `ownerId` is present and equals `caller.userId`, compared in lower case |
| `requested` | (scope requested) `ref.id` is in `options.itemIds` and appears once; fewer rows than requested is allowed |
| `membership` | (scope member) for each distinct `projectId` other than the target, in order of first appearance, one at a time: `core.requireMember(caller.userId, projectId)`; a `NotMember` is this violation, any other error is `CORE_FAILED` |

### Fact keys
Data in `src/allow-list.ts`; the only keys and kinds the trusted section accepts. Keys may repeat (one checkpoint or person per group, in order). Starting set from architecture §11 (A-19); W8 adds keys by changing this table in a PR, which bumps nothing else.

| Key | Kind | Key | Kind |
|---|---|---|---|
| `points_total` | number | `projected_completion_date` | date |
| `points_done` | number | `checkpoint` | uuid |
| `progress_percent` | number | `checkpoint_remaining_points` | number |
| `unestimated_tasks` | number | `checkpoint_projected_date` | date |
| `avg_velocity` | number | `checkpoint_target_date` | date |
| `points_remaining` | number | `checkpoint_risk` | risk |
| `sprints_needed` | number | `overloaded_user` | uuid |
| `active_sprint` | uuid | `overloaded_user_open_points` | number |
| `blocked_tasks` | number | `overloaded_user_avg_points` | number |

## Registries and construction

| Function | Definition |
|---|---|
| `registerContextSource(id, source)` | `id` must be a `SourceId`, else `Error("UNKNOWN_CONTEXT_SOURCE")`; `source` must be a function, else `Error("INVALID_CONTEXT_SOURCE")`; a second registration of the same id throws `Error("SOURCE_ALREADY_REGISTERED")` and keeps the first |
| `registerCore(core: Pick<Core, "requireMember">)` | a second registration throws `Error("CORE_ALREADY_REGISTERED")` and keeps the first |
| `resetContextRegistries()` | empties both registries; exported only from the `@agile/ai-context/testing` subpath |
| `createAiContext({ core, sources, sourceTimeoutMs? })` | returns `{ assemble, assembleWith }` over the given core and a copy of the given `ReadonlyMap<SourceId, ContextSource>` taken at creation; `sourceTimeoutMs` defaults to 10,000; exported only from `@agile/ai-context/testing` |
| `getAiContext()` | returns `{ assemble, assembleWith }` reading both registries at call time, so a source registered later is used; main entry |
| exported data (main entry) | `ALLOW_LIST`, `SOURCE_IDS`, `FEATURE_ROLES`, `FACT_KEYS`, `ContextScopeViolation`, `registerContextSource`, `registerCore`, `getAiContext`, the types above |

The `testing` subpath is a second `exports` entry in `package.json` (`"./testing": "./src/testing.ts"`). Scan rule 3 (conventions.md) keeps it out of production code, so no module can reset the registries or build a context over a permissive core.

**Wiring.** The API composition root (`src/be/api`, when W5 lands) calls `registerCore` and registers W5's four `core.*` sources, so `core` never imports `@agile/ai-context` and §4's direction (`ai-context` uses `core`, roles use `ai-context`) holds. W7, W8 and W9 register their own sources at module load (roles may depend on `ai-context`).

## Security per operation

| Operation | Principal and scope | Never logged or returned | Input trust |
|---|---|---|---|
| `assembleWith` | an authorised principal; membership of the target project before and after the source reads; per-row scope | row text, row ids, option values, source or core error details | rows are untrusted until every check passes; `trusted: false` sections are sanitised later by the gateway (W3); the trusted section is format-checked here |
| `registerContextSource`, `registerCore` | server modules at load | - | ids checked against the allow-list; duplicates refused |
