# Contracts: API and module interfaces

Companion to [agile-platform-architecture.md](agile-platform-architecture.md) (§6). It holds the field-level contracts that the zod schemas in `packages/contracts` implement (D-01c). If code and this file disagree, fix the disagreement before merging; the OpenAPI file generated from the schemas is checked against the running API by a contract test (A-17).

Decisions cited as D-nn are in [decision-log.md](decision-log.md); tags A-nn are delegated assumptions awaiting the team's sign-off (architecture §16).

## 1. Conventions
- Base path `/api`. JSON bodies in UTF-8; `Content-Type: application/json` (the upload accepts the same JSON). Unknown body fields and server-managed fields are rejected with 422.
- Auth: `Authorization: Bearer <Firebase ID token>` on everything except `GET /api/health` and `POST /api/auth/check-code` (architecture §7).
- Ids are UUIDs. Instants are ISO-8601 UTC (`2026-10-29T01:30:00Z`). Dates are `YYYY-MM-DD` and are read in the application time zone (D-37).
- Every mutable entity returns `version`. A write sends the `version` it read; a stale one gives 409 `CONFLICT_VERSION` (D-35).
- Lists: `?page=0&size=20` (size at most 100); response `{ "items": [...], "page": 0, "size": 20, "total": 134 }`; a page past the end returns an empty `items`; each list names its sort key, with `id` as tie-breaker (D-37).
- Every response carries `X-Request-Id`. Errors use the envelope and codes of architecture §8.
- Policy notation (the policy map, A-01): roles `PM`, `LEAD` (Dev Lead), `DEV` (Developer). Predicates: `member` = caller is a member of the project; `self` = the resource belongs to the caller; `assignee` = the task is assigned to the caller; `adder` = the caller's role may add that member's role. A route missing from this map fails CI; the generated authorisation test (D-26) iterates the map.
- AI endpoints never accept a session id, model, prompt, flag or any experiment setting from the client; sessions and flags are decided on the server (A-07, A-09).

## 2. Shared schemas

| Schema | Fields |
|---|---|
| `User` | `id`, `email`, `displayName` (1 to 100), `role` (`PM` / `DEV_LEAD` / `DEVELOPER`) |
| `Project` | `id`, `name` (1 to 200), `brief` (null or at most 4000), `status` (`ACTIVE` / `ARCHIVED`), `createdBy`, `createdAt`, `updatedAt`, `version` |
| `ProjectDetail` | `Project` plus `progress`: `{ pointsTotal, pointsDone, percent, unestimatedTasks }` |
| `Member` | `userId`, `displayName`, `role`, `addedAt` |
| `Checkpoint` | `id`, `projectId`, `name` (1 to 200), `targetDate`, `createdAt`, `updatedAt`, `version` |
| `Epic` | `id`, `projectId`, `checkpointId` (null), `title` (1 to 200), `description` (null, at most 4000), `position`, `taskCount`, `pointsTotal`, `createdAt`, `updatedAt`, `version` |
| `Task` | `id`, `projectId`, `epicId`, `sprintId` (null), `assigneeId` (null), `title` (1 to 200), `description` (null, at most 4000), `acceptanceCriteria` (list of strings, at most 12, each at most 300), `status` (`TODO` / `IN_PROGRESS` / `IN_REVIEW` / `DONE`), `blocked`, `blockedReason` (null, at most 500), `storyPoints` (null or 1, 2, 3, 5, 8, 13), `doneAt` (null), `createdAt`, `updatedAt`, `version` |
| `Sprint` | `id`, `projectId`, `name`, `startDate`, `endDate`, `status` (`PLANNED` / `ACTIVE` / `CLOSED`), `completedPoints` (null until closed), `version` |
| `TaskEvent` | `id`, `taskId`, `actorId`, `type` (`CREATED` / `STATUS_CHANGED` / `ASSIGNEE_CHANGED` / `BLOCKED` / `UNBLOCKED` / `POINTS_CHANGED` / `SPRINT_CHANGED`), `from`, `to`, `at` |
| `PlanProposal` | `id`, `projectId`, `kind` = `PLAN`, `status` (`PENDING` / `APPROVED` / `REJECTED` / `SUPERSEDED`), `approach` (text), `checkpoints` (list of `{ name, targetDate }`), `epics` (list of `PlanEpic`), `retrieved` (list of `{ source, projectId, projectName, id, title }`, the provenance of similar items used), `flagged`, `createdBy`, `createdAt`, `updatedAt`, `version` |
| `PlanEpic` | `index`, `title`, `description`, `checkpointName` (null), `contentHash`, `expansion`: `{ status` (`PENDING` / `IN_PROGRESS` / `DONE` / `FAILED`), `tasks` (list of `{ title, description, acceptanceCriteria, storyPoints }` or null), `error` (null or a code) `}` |
| `ReplanProposal` | `id`, `projectId`, `kind` = `REPLAN`, `status`, `suggestions` (list of `Suggestion`), `explanation`, `flagged`, `createdAt`, `version` |
| `Suggestion` | `id`, `type` (`MOVE_CHECKPOINT_DATE` with `{ checkpointId, newTargetDate }`; `MOVE_EPIC_TO_CHECKPOINT` with `{ epicId, checkpointId or null }`; `REASSIGN_TASK` with `{ taskId, assigneeId }`), `rationale` (text, at most 300) |
| `Facts` | `asOf`, `pointsTotal`, `pointsDone`, `pointsRemaining`, `unestimatedTasks`, `velocity` (list of `{ sprintId, name, completedPoints }`), `avgVelocity` (null), `projectedCompletionDate` (null), `checkpoints` (list of `{ id, name, targetDate, remainingPoints, projectedDate` (null), `risk` (`ON_TRACK` / `AT_RISK` / `UNKNOWN`) `}`), `overload` (list of `{ userId, displayName, openPoints, avgCompletedPerSprint` (null), `projects` (list of `{ projectId, name, openPoints }`) `}`; only the caller's own projects) |
| `Digest` | `id`, `projectId`, `facts`, `explanation` (null), `degraded`, `flagged`, `proposalId` (null), `cached`, `createdAt` |
| `ActivityItemInput` | `type` (`COMMIT` / `PR`), `repo` (null or at most 200), `externalId` (1 to 200), `title` (1 to 300), `body` (null or at most 2000), `timestamp` (an instant, not later than now plus 24 hours), `url` (null; `https:` only; at most 500), `files` (at most 50 names, each at most 300) |
| `Standup` | `id`, `projectId`, `developerId`, `date`, `content` (`{ yesterday, today, blockers }`, each a list of at most 12 lines of at most 300 characters), `degraded`, `flagged`, `cached`, `outcome` (null / `ACCEPTED` / `EDITED`), `feedback` (null / `UP` / `DOWN`), `createdAt`, `updatedAt`, `version` |
| `UsageSession` | `id`, `feature`, `startedAt`, `endedAt` (null), `outcome` (`OPEN` / `ACCEPTED` / `EDITED` / `REJECTED` / `ABANDONED`), `regenerateCount`, `feedback`, `calls`, `promptTokens`, `completionTokens`, `costMicroUsd`, `elapsedSeconds` |

## 3. Endpoints

Columns: policy (roles; predicate), request, response, errors beyond the common ones (400, 401, 403 role, 422, 500 apply everywhere; 404 applies wherever a project or resource is addressed), side effects. All ids in paths must belong to a project the caller is a member of, else 404.

### 3.1 Account and system
| # | Endpoint | Policy | Request | Response | Errors | Side effects |
|---|---|---|---|---|---|---|
| 1 | `GET /api/health` | public | none | 200 `{ "status": "UP" }` | none | none |
| 2 | `POST /api/auth/check-code` | public; rate-limited per client IP | `{ role, code }` | 200 `{ "valid": true }` | 403 `REGISTRATION_CODE_INVALID`; 429 `RATE_LIMITED` | counts an attempt in `rate_counters` |
| 3 | `POST /api/auth/register` | any valid token with no `users` row | `{ role, code, displayName }` | 201 `User` | 403 `REGISTRATION_CODE_INVALID`; 409 `ALREADY_REGISTERED`; 429 `RATE_LIMITED` | inserts `users` (email from the verified token) |
| 4 | `GET /api/me` | any registered | none | 200 `User` | 403 `USER_NOT_REGISTERED` | none |

### 3.2 Projects and members
| # | Endpoint | Policy | Request | Response | Errors | Side effects |
|---|---|---|---|---|---|---|
| 5 | `POST /api/pm/projects` | PM | `{ name, brief? }` | 201 `Project` | | inserts project and the creator's membership |
| 6 | `GET /api/projects` | any role; member | query `page`, `size`, `status` | 200 page of `Project`, newest first | | none |
| 7 | `GET /api/projects/{projectId}` | any role; member | none | 200 `ProjectDetail` | | none |
| 8 | `PATCH /api/pm/projects/{projectId}` | PM; member | `{ name?, brief?, status?: "ARCHIVED", version }` | 200 `Project` | 409 `CONFLICT_VERSION` | archived projects become read-only |
| 9 | `GET /api/projects/{projectId}/members` | any role; member | none | 200 list of `Member` | | none |
| 10 | `POST /api/projects/{projectId}/members` | PM adds `DEV_LEAD`, LEAD adds `DEVELOPER`; member; adder | `{ email }` | 201 `Member` (200 with the same body if already a member) | 422 if the email is not a registered user of the role the caller may add | inserts membership |
| 11 | `DELETE /api/projects/{projectId}/members/{userId}` | same roles as 10; member; adder | none | 204 | 409 `CONFLICT_STATE` if the user has open assigned tasks | deletes membership |

### 3.3 Planning (checkpoints, epics, tasks, sprints)
Mutations on an archived project return 409 `CONFLICT_STATE` (one check in `core`, A-13).

| # | Endpoint | Policy | Request | Response | Errors | Side effects |
|---|---|---|---|---|---|---|
| 12 | `GET /api/projects/{id}/checkpoints` | any; member | none | 200 list of `Checkpoint`, by `targetDate` | | none |
| 13 | `POST /api/projects/{id}/checkpoints` | PM, LEAD; member | `{ name, targetDate }` | 201 `Checkpoint` | | insert |
| 14 | `PATCH /api/checkpoints/{id}` | PM, LEAD; member | `{ name?, targetDate?, version }` | 200 `Checkpoint` | 409 version | update |
| 15 | `DELETE /api/checkpoints/{id}?version=` | PM, LEAD; member | none | 204 | 409 version | soft delete; epics unlinked |
| 16 | `GET /api/projects/{id}/epics` | any; member | `page`, `size` | 200 page of `Epic`, by `position` | | none |
| 17 | `POST /api/projects/{id}/epics` | PM, LEAD; member | `{ title, description?, checkpointId? }` | 201 `Epic` | 422 if the checkpoint is in another project | insert |
| 18 | `PATCH /api/epics/{id}` | PM, LEAD; member | `{ title?, description?, checkpointId? (or null), position?, version }` | 200 `Epic` | 409 version | update |
| 19 | `DELETE /api/epics/{id}?version=` | PM, LEAD; member | none | 204 | 409 version; 409 `CONFLICT_STATE` if it holds a DONE task | soft delete epic and its tasks |
| 20 | `GET /api/projects/{id}/tasks` | any; member | `epicId?`, `sprintId?`, `assigneeId?`, `status?`, `blocked?`, `page`, `size` | 200 page of `Task`, by `createdAt` desc | | none |
| 21 | `POST /api/projects/{id}/tasks` | PM, LEAD; member | `{ epicId, title, description?, acceptanceCriteria?, storyPoints?, assigneeId? }` | 201 `Task` | 422 if the epic is in another project, or the assignee is not a member | insert; `CREATED` event |
| 22 | `GET /api/tasks/{id}` | any; member | none | 200 `Task` | | none |
| 23 | `PATCH /api/tasks/{id}` | PM, LEAD; member | `{ title?, description?, acceptanceCriteria?, storyPoints?, epicId?, assigneeId?, sprintId?, version }` | 200 `Task` | 409 version; 422 if `sprintId` is set and points are missing, or the assignee is not a member; 409 `CONFLICT_STATE` if the task is in a CLOSED sprint | update; events for points, assignee and sprint changes |
| 24 | `POST /api/tasks/{id}/status` | LEAD; member, or DEV; assignee | `{ status, blocked?, blockedReason?, version }` | 200 `Task` | 409 version; 422 if `blocked` is true without a reason; 409 `CONFLICT_STATE` if the task is in a CLOSED sprint | update; `STATUS_CHANGED`, `BLOCKED` or `UNBLOCKED` event; `doneAt` set or cleared |
| 25 | `DELETE /api/tasks/{id}?version=` | PM, LEAD; member | none | 204 | 409 version; 409 `CONFLICT_STATE` if DONE | soft delete |
| 26 | `GET /api/tasks/{id}/events` | any; member | `page`, `size` | 200 page of `TaskEvent`, newest first | | none |
| 27 | `GET /api/projects/{id}/sprints` | any; member | none | 200 list of `Sprint`, by `startDate` | | none |
| 28 | `POST /api/projects/{id}/sprints` | LEAD; member | `{ name, startDate, endDate }` | 201 `Sprint` (PLANNED) | 422 if the end is before the start or the dates overlap another sprint | insert |
| 29 | `PATCH /api/sprints/{id}` | LEAD; member | `{ name?, startDate?, endDate?, version }` | 200 `Sprint` | 409 version; 409 `CONFLICT_STATE` unless PLANNED | update |
| 30 | `POST /api/sprints/{id}/start` | LEAD; member | `{ version }` | 200 `Sprint` (ACTIVE) | 409 `CONFLICT_STATE` unless PLANNED, or another sprint is ACTIVE | update |
| 31 | `POST /api/sprints/{id}/close` | LEAD; member | `{ version, carryOver: [{ taskId, to: "BACKLOG" or a PLANNED sprint id }] }` (one entry for each task not DONE) | 200 `Sprint` (CLOSED, `completedPoints` set) | 409 `CONFLICT_STATE` unless ACTIVE; 422 if a not-DONE task has no carry-over entry | sets `completedPoints` from the DONE tasks; moves carried tasks; `SPRINT_CHANGED` events |
| 32 | `DELETE /api/sprints/{id}?version=` | LEAD; member | none | 204 | 409 `CONFLICT_STATE` unless PLANNED | soft delete; its tasks go to the backlog |
| 33 | `GET /api/projects/{id}/progress` | any; member | none | 200 `{ pointsTotal, pointsDone, percent, unestimatedTasks, velocity: [{ sprintId, name, completedPoints }] }` | | none (computed in code, D-12) |

### 3.4 PM: plans
| # | Endpoint | Policy | Request | Response | Errors | Side effects |
|---|---|---|---|---|---|---|
| 34 | `POST /api/pm/projects/{id}/plans` | PM; member | `{ idea }` (20 to 6000 characters) | 201 `PlanProposal`, status PENDING, every epic expansion PENDING | 422 `VALIDATION_FAILED` (empty after sanitising) or `REQUEST_REFUSED`; 429 `AI_BUSY`, `RATE_LIMITED`; 503 `AI_UNAVAILABLE`, `AI_DISABLED` | opens an `ai_sessions` row; one stage-1 gateway call; inserts `ai_proposals` and `proposal_epics` |
| 35 | `GET /api/pm/proposals/{proposalId}` | PM; member | none | 200 `PlanProposal` | | none |
| 36 | `GET /api/pm/projects/{id}/proposals` | PM; member | `status?`, `page`, `size` | 200 page of `PlanProposal`, newest first | | none |
| 37 | `POST /api/pm/proposals/{proposalId}/epics/{index}/expand` | PM; member | `{}` (the server uses the stored epic; it takes no text) | 200 `PlanEpic` with expansion DONE | 409 `CONFLICT_STATE` unless the proposal is PENDING; 429 `AI_BUSY`; 503 `AI_UNAVAILABLE` | claims the epic (`IN_PROGRESS`, leased); one gateway call; stores tasks or `FAILED` |
| 38 | `PATCH /api/pm/proposals/{proposalId}/epics/{index}` | PM; member | `{ title?, description?, checkpointName?, tasks?, version }` | 200 `PlanEpic` | 409 version; 409 `CONFLICT_STATE` unless PENDING | a change to title or description resets expansion to PENDING |
| 39 | `POST /api/pm/proposals/{proposalId}/epics/{index}/regenerate` | PM; member | `{}` | 200 `PlanEpic` | as 37; 429 `RATE_LIMITED` when the session's regeneration cap is reached | `regenerate_count` + 1; one gateway call |
| 40 | `POST /api/pm/proposals/{proposalId}/approve` | PM; member | `{ version }` | 200 `{ proposalId, status: "APPROVED", created: { checkpoints, epics, tasks } }` (the same body when repeated) | 409 `CONFLICT_STATE` if REJECTED or SUPERSEDED, or any epic is not DONE | one transaction takes a row lock on the proposal, re-checks it, creates checkpoints, epics, tasks and `CREATED` events, and marks it APPROVED; a second request waits on the lock and then returns the same result; session closed `ACCEPTED` or `EDITED` |
| 41 | `POST /api/pm/proposals/{proposalId}/reject` | PM; member | `{ version }` | 200 `PlanProposal` (REJECTED) | 409 `CONFLICT_STATE` unless PENDING | session closed `REJECTED` |

### 3.5 Dev Lead: facts, digest, re-plan
| # | Endpoint | Policy | Request | Response | Errors | Side effects |
|---|---|---|---|---|---|---|
| 42 | `GET /api/lead/projects/{id}/facts` | LEAD; member | none | 200 `Facts` (no LLM) | | none |
| 43 | `GET /api/lead/overview` | LEAD | none | 200 list of `{ project, facts summary, latestDigest status }` for the caller's member projects only | | none |
| 44 | `POST /api/lead/projects/{id}/digests` | LEAD; member | `{}` | 200 `Digest` (`cached: true` and no model call when the facts hash is unchanged); with suggestions it also returns `proposalId` | 429 `AI_BUSY`; the model failing is not an error: `explanation: null`, `degraded: true` (D-34) | session; one gateway call; inserts `project_digests`; a REPLAN proposal when suggestions exist |
| 45 | `GET /api/lead/projects/{id}/digests/latest` | LEAD; member | none | 200 `Digest` or 404 if none | | none |
| 46 | `GET /api/lead/projects/{id}/proposals` | LEAD; member | `status?`, `page`, `size` | 200 page of `ReplanProposal` | | none |
| 47 | `POST /api/lead/proposals/{proposalId}/approve` | LEAD; member | `{ version, suggestionIds }` (the subset to apply) | 200 `{ proposalId, status: "APPROVED", applied: [suggestionId] }` | 409 `CONFLICT_STATE` if not PENDING; 409 `CONFLICT_STATE` listing suggestions whose ids no longer fit the project | one transaction with a row lock on the proposal re-checks and applies each chosen suggestion; session `ACCEPTED` |
| 48 | `POST /api/lead/proposals/{proposalId}/reject` | LEAD; member | `{ version }` | 200 `ReplanProposal` | 409 `CONFLICT_STATE` unless PENDING | session `REJECTED` |

### 3.6 Developer: upload, summaries, standup
| # | Endpoint | Policy | Request | Response | Errors | Side effects |
|---|---|---|---|---|---|---|
| 49 | `POST /api/dev/projects/{id}/uploads` | DEV; member | `{ items: [ActivityItemInput] }` (at most 1 MB, at most 100 items) | 200 `{ received, created, updated, unchanged, rejected: [{ index, reason }], needsSummary: [itemId] }` | 413 `PAYLOAD_TOO_LARGE`; 422 `VALIDATION_FAILED` | upserts `activity_items` for the uploader; no model call |
| 50 | `POST /api/dev/projects/{id}/summaries` | DEV; member; items are the caller's own | `{ itemIds }` (at most 10) | 200 `{ summaries: [{ itemId, oneLiner, cached }], failed: [itemId] }` | 429 `AI_BUSY`; 503 `AI_UNAVAILABLE` | one gateway call for the uncached items; inserts `item_summaries` |
| 51 | `POST /api/dev/projects/{id}/standups` | DEV; member | `{ date? }` (default today) | 200 `Standup` (`cached: true` when the input hash is unchanged); on model failure a code-built standup with `degraded: true` | 429 `AI_BUSY` | session; at most one gateway call; upserts `standups` |
| 52 | `GET /api/dev/projects/{id}/standups/mine` | DEV; member; self | `date?` | 200 `Standup` or 404 | | none |
| 53 | `PATCH /api/dev/standups/{standupId}` | DEV; self | `{ content, version }` (plain text lines) | 200 `Standup` (`outcome: "EDITED"`) | 409 version | updates content; session closed `EDITED` |
| 54 | `POST /api/dev/standups/{standupId}/feedback` | DEV; self | `{ feedback?: "UP" or "DOWN" or null, accept?: true }` | 200 `Standup` | | `accept` closes the session `ACCEPTED` |
| 55 | `GET /api/lead/projects/{id}/standups` | LEAD; member | `date?`, `developerId?`, `page`, `size` | 200 page of `Standup` for developers who are members of the project | | none |

### 3.7 Usage
| # | Endpoint | Policy | Request | Response | Errors | Side effects |
|---|---|---|---|---|---|---|
| 56 | `GET /api/usage/sessions` | any; self | `from?`, `to?`, `feature?`, `page`, `size` | 200 page of `UsageSession` for the caller | | none |
| 57 | `GET /api/usage/summary` | any | `from?`, `to?` | 200 list of `{ feature, model, calls, promptTokens, completionTokens, costMicroUsd, cacheHits, avgLatencyMs, schemaFailures, estimateErrorPercent }`, aggregated over all users, with no per-user content or flags | | none |

## 4. Examples

Register (3):
```
POST /api/auth/register
{ "role": "DEVELOPER", "code": "<per-environment secret>", "displayName": "Lee Wei" }
201 { "id": "5b7e…", "email": "lee@example.com", "displayName": "Lee Wei", "role": "DEVELOPER" }
```

Validation error (23):
```
PATCH /api/tasks/9a1c…   { "storyPoints": 4, "version": 3 }
422 { "error": { "code": "VALIDATION_FAILED", "message": "The request body is not valid.",
     "details": [{ "field": "storyPoints", "message": "Must be one of 1, 2, 3, 5, 8, 13." }],
     "requestId": "7d1c…" } }
```

PM plan, stage 1 (34) and stage 2 (37):
```
POST /api/pm/projects/c3d4…/plans   { "idea": "A mobile app for booking campus study rooms…" }
201 { "id": "e8f1…", "projectId": "c3d4…", "kind": "PLAN", "status": "PENDING", "version": 1, "flagged": false,
      "approach": "Mobile client with a REST backend; sign-in with the university directory…",
      "checkpoints": [{ "name": "Booking works end to end", "targetDate": "2026-12-04" }],
      "epics": [{ "index": 0, "title": "Room search and booking", "description": "…", "checkpointName": "Booking works end to end",
                  "contentHash": "a41c…", "expansion": { "status": "PENDING", "tasks": null, "error": null } }],
      "retrieved": [{ "source": "epic", "projectId": "77aa…", "projectName": "Library Portal", "id": "3b9d…", "title": "Search and filters" }] }

POST /api/pm/proposals/e8f1…/epics/0/expand   {}
200 { "index": 0, "title": "Room search and booking", …,
      "expansion": { "status": "DONE", "error": null,
        "tasks": [{ "title": "Room availability endpoint", "description": "…", "acceptanceCriteria": ["Returns free slots for a date"], "storyPoints": 3 }] } }
```

Upload (49) and standup (51):
```
POST /api/dev/projects/c3d4…/uploads
{ "items": [{ "type": "PR", "repo": "team/api", "externalId": "212", "title": "Add booking endpoint",
              "body": "Adds POST /bookings with overlap check.", "timestamp": "2026-10-28T09:12:00Z",
              "url": "https://github.com/team/api/pull/212", "files": ["src/bookings.ts"] }] }
200 { "received": 1, "created": 1, "updated": 0, "unchanged": 0, "rejected": [], "needsSummary": ["0f3a…"] }

POST /api/dev/projects/c3d4…/standups   {}
200 { "id": "d21b…", "date": "2026-10-29", "degraded": false, "flagged": false, "cached": false,
      "content": { "yesterday": ["Opened a PR adding the booking endpoint with an overlap check."],
                   "today": ["Finish the booking tests."], "blockers": [] },
      "outcome": null, "feedback": null, "version": 1 }
```

## 5. Module interfaces (the frozen-first set, A-18)
These four are written first and changed only by agreement of all three owners (D-11).

### 5.1 `LlmGateway.run(call): LlmResult`
`LlmCall` (all fields set by server code, never by the client):
| Field | Type | Meaning |
|---|---|---|
| `feature` | `PM_PLAN_OUTLINE` / `PM_PLAN_EXPAND` / `LEAD_DIGEST` / `DEV_SUMMARY` / `DEV_STANDUP` | selects the model set, caps, `max_tokens` and output spec from configuration |
| `caller` | `{ userId, role }` | from the authorised principal; the gateway refuses a role not allowed for the feature (`ROLE_DENIED`) |
| `sessionId` | uuid | issued by `Sessions.open`; checked for owner, feature and OPEN state |
| `projectId` | uuid or null | recorded on the call |
| `sections` | list of `{ name, kind: STATIC / RETRIEVED / DYNAMIC, priority, budgetTokens, text, trusted }` | the context (D-17); `trusted: false` text goes through the full pipeline (D-25) |
| `output` | `{ kind: "json" with a zod schema, or "text" with maxChars }` | validated before it is returned; links, HTML and images rejected |
| `inputHash` | string | for the hash check and the experiment result cache |

`LlmResult`: success `{ ok: true, value, callId, flagged, truncated, cacheHit, promptTokens, completionTokens, costMicroUsd }`; failure `{ ok: false, code, retryAfterSeconds?, callId }` with `code` one of `AI_BUSY`, `AI_UNAVAILABLE`, `AI_DISABLED`, `REQUEST_REFUSED`, `BLOCKED_INPUT`, `ROLE_DENIED`. `run` refuses to run inside a database transaction (MP3 SD7). After the limiter admits the call (D-59), it writes the `llm_calls` row with `IN_FLIGHT` and finalises it.

### 5.2 `AiContext.assemble(caller, feature, targetProjectId): ContextSections`
Returns the sections a feature may use, from the allow-list below, built only from projects where the caller is a member, with deleted rows and archived projects excluded. It throws `NotMember` (mapped to 404). Features never query these tables themselves.

| Feature | Entity types allowed |
|---|---|
| `PM_PLAN_OUTLINE`, `PM_PLAN_EXPAND` | the target project's brief and checkpoints; titles (not descriptions) of epics and tasks of the caller's member projects found by full-text search (top 5) |
| `LEAD_DIGEST` | `Facts` for the target project; previous digest; the change list since it |
| `DEV_SUMMARY` | the caller's own `activity_items` in the target project |
| `DEV_STANDUP` | the caller's own item summaries, task events and blocked tasks in the target project |

Standup text and other users' activity items are never returned to any feature other than the one that owns them.

### 5.3 `Sessions`
`open({ feature, userId, projectId }) → sessionId`; `assertUsable(sessionId, userId, feature)`; `touch(sessionId)`; `close(sessionId, outcome, actorId)` (idempotent; only the owner or the approving user may close). Caps: at most 5 regenerations per session, at most 20 new sessions per user per day, at most 3 OPEN sessions per user per feature (A-07).

### 5.4 `Core` (used by `proposals`, `lead`, `dev`, `pm`)
`requireMember(userId, projectId)`; `assertWritable(projectId)`; `progress(projectId)`; `velocity(projectId, n)`; `applyPlan(tx, projectId, plan, actorId)`; `applyReplan(tx, projectId, suggestions, actorId)`. The apply functions run inside the caller's transaction, validate the payload with a strict schema, ignore any project id in it, re-check every id against the project, re-check assignee membership, the actor's role and that the project is writable, and write `task_events` in the same transaction (A-06).
