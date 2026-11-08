# W8 Dev Lead Facts and Digest Design

- **Status:** Approved (project operator, 2026-11-09)
- **Format:** v2
- **Risk tier:** High - role authorization, cross-project tenancy, untrusted model input, and persisted AI output
- **Workstream:** W8 | **Plan:** —
- **Constraints consulted:** `guardrails.md`; AD-07, AD-10, AD-22, AD-25, AD-34, AD-55; C20, C21, C48, C51, C60; W2 and W3 conventions; W6 AI-context API and conventions

## 1. Problem

The contracts and Prisma schema already define `Facts`, `Digest`, `ProjectDigest`, `LEAD_DIGEST`,
and endpoints 42, 44 and 45, but no `src/be/lead` package, lead routes, facts computation, digest
orchestration, or lead context sources exist. W5 provides core membership and derived progress/
velocity seams; W6 provides `assembleWith` and the source registry. Without W8, PM and Dev Lead
clients cannot read computed project health or generate/read a guarded Dev Lead digest.

W8 adds a dedicated `@agile/lead` package following W7's `@agile/pm` runtime pattern. It computes
facts in code, exposes the three lead context sources, calls the gateway only from the runtime's
feature flow, stores `ProjectDigest` rows, and leaves proposal approval to W14 endpoints 46-48.

## 2. Goals

**Functional**

- **F1 Facts:** Compute the frozen `Facts` shape for a target project from visible tasks, closed sprints, checkpoints, epics, project members and users. Endpoint 42's overload is computed across the caller's active member projects; a stored digest's overload is computed within the target project only. Accept: endpoint 42 returns schema-valid facts with no model call.
- **F2 Facts authorization:** Endpoint 42 permits PM and Dev Lead callers who are active members of the target project; hidden, missing, archived, or non-member projects return the existing 404 `NOT_FOUND` response. Accept: an active member gets 200 and every other target state gets 404 without facts data.
- **F3 Lead context:** Register `lead.facts`, `lead.changes`, and `lead.previousDigest` at runtime initialization. Accept: `LEAD_DIGEST` assembly invokes only these sources and each source returns rows within W6's scope and format rules.
- **F4 Digest generation:** Endpoint 44 computes facts, hashes the canonical facts value, returns the latest digest without a model call when the hash is unchanged, otherwise opens one `LEAD_DIGEST` session and performs one gateway call outside the persistence transaction. Accept: unchanged hashes make zero gateway calls and changed hashes make exactly one admitted call.
- **F5 Digest persistence:** Store a successful or degraded digest and its optional REPLAN proposal atomically. Accept: a failed transaction stores neither row; a successful changed-hash request returns a schema-valid `Digest`.
- **F6 Digest failure behavior:** Upstream failure, AI disabled, schema failure, refusal, or blocked input returns HTTP 200 with the computed facts, `explanation: null`, `degraded: true`, `proposalId: null`, and `flagged` reflecting the call result where applicable. Accept: each listed failure produces that exact degraded shape and never a partial proposal.
- **F7 Latest digest:** Endpoint 45 returns the newest visible digest for an active member project, or 404 when none exists; it never exposes another project's row. Accept: the newest target-project row is returned and an empty or foreign result is 404.
- **F8 Closed suggestions:** Accepted model output may contain only `MOVE_CHECKPOINT_DATE`, `MOVE_EPIC_TO_CHECKPOINT`, and `REASSIGN_TASK` suggestions matching the existing `SuggestionSchema`; W8 stores them in an `REPLAN` proposal but does not apply them.

**Non-functional**

- **N1 Tenancy:** Every project-scoped read and write is constrained to the target project and active membership; overload facts cover only projects where the caller is an active member. Accept: cross-project and removed-member fixtures return no foreign rows.
- **N2 Gateway boundary:** Files that call the gateway do not import the database package; database reads are performed by source/runtime collaborators and passed as bounded values. Accept: the source-scan test reports no gateway/database import violation.
- **N3 Determinism:** Identical visible data produces byte-stable canonical facts and the same `factsHash`; facts are pure-code output and never depend on model text. Accept: two runs over the same fixture deep-equal and hash-equal.
- **N4 Observability:** Errors and logs contain request id, fixed error code, source id or call id only; no prompt, response, task title, digest explanation, secret, or user-provided text is logged. Accept: captured logs contain no prohibited value.

## 3. Non-goals

- Endpoint 43 lead overview - it is a separate contract surface and is not in the W8 slice.
- Endpoints 46-48 proposal listing, approval, and rejection - W14 owns their transport and transactional application.
- UI changes - the existing UI contract will consume these endpoints later.
- New Prisma tables or migrations - `ProjectDigest`, `AiProposal`, `AiSession`, tasks, sprints, checkpoints and memberships already exist.
- Automatic refresh, scheduled jobs, queues, streaming, or background workers - prohibited by AD-06.
- Applying re-plan suggestions during digest generation - AD-22 requires explicit later approval.

## 4. Design

### 4.1 Approach

Create `src/be/lead` as a workspace package with pure facts/forecast functions, lead context
sources, prompt sections and mocks, a gateway binding, and a memoized runtime. The runtime follows
W7: it creates or receives the filtered database client, binds the gateway and sessions, builds a
flow service, and registers context sources exactly once after successful registration. API route
handlers translate validated transport input only; API composition wires lead services and resource
resolution while the policy map remains the sole role gate.

Rejected alternatives: route-owned queries and gateway calls violate W6 ownership/source-scan rules;
separate facts and digest packages add an unnecessary boundary before any independent consumer exists.

### 4.2 Data model

No schema migration. `ProjectDigest` remains append-only with `facts`, `factsHash`, nullable
`explanation`, `degraded`, `flagged`, nullable `proposalId` and `sessionId`, and `createdAt`.
`AiProposal.kind` is `REPLAN`; its payload contains the validated explanation and closed suggestions.

Facts invariants follow architecture §11/A-19 exactly: `pointsTotal` is the story points of live tasks
with points; `pointsDone` is the points of those tasks in `DONE`; `pointsRemaining` is the points of
live non-DONE tasks; unestimated tasks are counted separately. Velocity is `completedPoints` from the
newest three closed sprints or fewer, ordered by `endDate DESC, id ASC`; `avgVelocity` is their
arithmetic mean as an IEEE-754 JavaScript number with no intermediate rounding, or null with no
history. `projectedCompletionDate` is null when average velocity is null or zero, otherwise today plus
`ceil(pointsRemaining / avgVelocity)` further average-length sprints, using Asia/Singapore calendar
dates. Average inclusive sprint length is rounded to the nearest whole day, with exact half-days
rounded upward. A checkpoint's remaining points are live non-DONE task points in its live epics;
its projected date uses the same formula, `AT_RISK` means projected date after target date,
`ON_TRACK` means on or before target date, a missing target date is impossible under the existing
checkpoint schema, and no velocity means `UNKNOWN`. Endpoint 42 overload
groups open assigned points over the caller's active member projects; a stored digest overload groups
open assigned points over the target project only. A person appears only when they have open points in
at least two projects for endpoint 42, or any open points for a target-only digest; average completed
points uses the same last-three-sprint rule and is null without history. All task, sprint, checkpoint,
epic, member and user joins must retain the target-project and active-project predicates.

The transport shape is the existing `FactsSchema`: fields are emitted in this order: `asOf`,
`pointsTotal`, `pointsDone`, `pointsRemaining`, `unestimatedTasks`, `velocity`, `avgVelocity`,
`projectedCompletionDate`, `checkpoints`, `overload`. Velocity is ordered by `sprint.endDate DESC,
sprint.id ASC`; checkpoints by `targetDate ASC, checkpoint.id ASC`; overload people by
`userId ASC`, with nested projects by `projectId ASC`. `asOf` is the captured current UTC instant and
is excluded from the hash input. Canonical hash input is the Facts object without `asOf`, encoded as
UTF-8 JSON with object keys sorted lexicographically recursively, arrays in the stated order, dates as
schema strings, numbers in ECMAScript JSON number form, and explicit nulls; `factsHash` is the lowercase
SHA-256 hex digest of those bytes.

Nested fields are the existing schema contracts: each velocity item is `{ sprintId, name,
completedPoints }`; each checkpoint is `{ id, name, targetDate, remainingPoints, projectedDate,
risk }`; each overload item is `{ userId, displayName, openPoints, avgCompletedPerSprint, projects }`,
where each nested project is `{ projectId, name, openPoints }`. `avgCompletedPerSprint` and
`projectedDate` are nullable exactly when the formulas above have no usable history.

Digest writes use one short transaction after the model call. The transaction inserts the digest and,
when suggestions exist, one REPLAN proposal linked by `proposalId`; a failed transaction rolls back
both. Existing rows are unchanged, so rollback is the transaction rollback and no migration rollback
is required. `DigestSchema` is the normative response shape for endpoints 44 and 45, including its
`cached` boolean: endpoint 44 sets it true only for a non-degraded existing row with an unchanged
hash, and false for fresh or degraded rows; endpoint 45 always sets it false. A degraded latest row is
never a cache hit: the next endpoint-44 request retries generation even when its facts hash is
unchanged. A changed-hash request always persists a digest, including model-attributable failures.
An admitted session is closed `ACCEPTED` only after its digest transaction commits, and `REJECTED`
after an admitted model, guard, or output-validation failure; an AI-disabled or pre-admission failure
has `sessionId` null. A degraded row has `explanation` and `proposalId` null and `flagged` false
unless the gateway returned a flagged result. Concurrent changed-hash requests may each call and
persist one digest, bounded by the existing per-user/global gateway limits; latest selection is
`facts.asOf DESC, createdAt DESC, id DESC`, and each row's facts, hash, session and proposal are
internally consistent.

### 4.3 Interfaces

| Operation | Caller / role | Inputs (validation, limits) | Outputs | Errors (condition -> type/message) | Notes (idempotency, transaction, events) |
|---|---|---|---|---|---|
| `GET /api/projects/{id}/facts` | PM or DEV_LEAD, active member | UUID path; no body | `Facts` | hidden/missing/non-member/archived -> 404 `NOT_FOUND`; database failure -> 500 | read-only; no model call |
| `POST /api/lead/projects/{id}/digests` | DEV_LEAD, active member | UUID path; parsed JSON object exactly `{}`; malformed JSON, non-object, extra keys, or absent body -> 422 `VALIDATION_FAILED` | `Digest` | hidden/missing/non-member/archived -> 404; session cap -> 429 `AI_BUSY` with gateway `Retry-After` seconds; persistence failure -> 500 with request id only | unchanged facts hash returns latest digest with `cached: true`; changed hash performs one model call outside the write transaction |
| `GET /api/lead/projects/{id}/digests/latest` | DEV_LEAD, active member | UUID path; no body | `Digest` | hidden/missing/non-member/archived -> 404; no digest -> 404 `NOT_FOUND` | newest by `facts.asOf DESC, createdAt DESC, id DESC`; `cached` is always false |
| `lead.facts` | `LEAD_DIGEST` context assembly | caller, target project, no free-text options | up to 200 trusted `key=value` rows, max 52 chars each, keys from `FACT_KEYS` | source failure -> `LEAD_FACTS_SOURCE_FAILED`; malformed rows -> `ContextScopeViolation` during assembly | target project only; emit scalar rows in `FACT_KEYS` table order, then checkpoint groups by target date/id, then overload groups by user UUID; nullable values render `null`; over-limit valid rows are omitted |
| `lead.changes` | `LEAD_DIGEST` context assembly | caller, target project, optional `window { from, to }` of UTC instants; default last 30 UTC days ending now; max span 31 days | up to 200 untrusted rows, max 400 chars each, rendered as `<ISO instant> <event type> <task UUID> <from or empty> -> <to or empty>` | source failure -> `LEAD_CHANGES_SOURCE_FAILED`; wrong scope/type/size -> `ContextScopeViolation` | target project only; `at DESC, id DESC`; null from/to render empty; CR/LF and other control characters become spaces; over-limit rows are omitted, never truncated |
| `lead.previousDigest` | `LEAD_DIGEST` context assembly | caller, target project | zero or one untrusted `DIGEST` row, max 4000 chars, rendered as stored explanation | source failure -> `LEAD_PREVIOUS_DIGEST_SOURCE_FAILED`; wrong scope/type/size -> `ContextScopeViolation` | newest digest by `facts.asOf DESC, createdAt DESC, id DESC`; null or over-limit explanation produces no row |

The gateway prompt uses literal `STATIC` sections for rules and the closed output schema, then
`facts`, `changes`, and `previous-digest` in W6's declared order and budgets. Output is validated by
W3 guards and the existing re-plan schema before persistence. `REQUEST_REFUSED` and `BLOCKED_INPUT`
follow the W3 feature rule and produce the degraded 200 response. Injection flags do not by themselves
block the call: untrusted rows remain wrapped, static rules remain authoritative, and a flagged gateway
result produces a flagged digest. Any invalid suggestion shape, duplicate id, missing/deleted entity,
wrong-project entity, non-member assignee, or conflicting suggestion invalidates the whole model result:
the response is degraded, the session closes with the gateway's schema-failure outcome, a degraded
digest is stored, and no REPLAN proposal is stored.

| Failure class | Stored digest | `sessionId` / session outcome | `flagged` |
|---|---|---|---|
| upstream failure, timeout, breaker or local limit after admission | yes, degraded, same facts hash | admitted session / `REJECTED` | false |
| AI disabled or failure before admission | yes, degraded, same facts hash | null / none | false |
| `REQUEST_REFUSED` or `BLOCKED_INPUT` | yes, degraded, same facts hash | admitted session / `REJECTED` | gateway result flag |
| schema/output/suggestion validation failure | yes, degraded, same facts hash | admitted session / `REJECTED` | gateway result flag, otherwise false |
| valid explanation and suggestions | yes, non-degraded | admitted session / `ACCEPTED` after transaction commit | gateway result flag |

### 4.4 UI

None: W8 exposes backend contracts only. Existing screens handle loading, empty, 404, 429, degraded,
and flagged states according to architecture §13.

### 4.5 Conventions

Apply W2's package, gateway, UTC and no-prompt-logging rules; W3's trusted/static section, blocked
input, refusal, output-schema and flag rules; W6's source registration, `assembleWith`, source-scope,
row-budget and no-database-import-in-gateway-calling-file rules. New facts keys are added to
`src/be/ai-context/src/allow-list.ts` by the same change and the pinned facts max-row size is updated
with its test.

### 4.6 Sequencing constraints

W5's `requireMember`, filtered client and core composition must be available before W8 runtime
wiring. Contract schemas and policy entries already exist and must remain compatible. Context-source
registration must occur after the W6 registry is available and must be duplicate-safe in tests. The
facts hash must be computed before checking the latest digest; model calls must occur outside the
digest persistence transaction; W14 must consume the stored REPLAN proposal shape without changing
W8's write contract.

## 5. Edge cases

| ID | Req | Scenario | Expected behaviour (exact) | Test layer |
|---|---|---|---|---|
| E1 | F1,N3 | No tasks or closed sprints | zero totals, empty velocity, null average and projected date, empty checkpoints/overload | unit |
| E2 | F1 | Unestimated open and done tasks | unestimated count increases; unestimated tasks add no points | unit |
| E3 | F1 | Fewer than three closed sprints | all available sprints are returned newest first and average uses only them | unit |
| E4 | F1 | Zero average velocity | projected completion and projected checkpoint dates are null; risk is `UNKNOWN` | unit |
| E5 | F1 | Checkpoint with no linked remaining points | remaining points is zero and risk is `ON_TRACK` | unit |
| E6 | N1 | Caller belongs to projects A and B; target is A | endpoint 42 overload includes only A and B; a stored digest for A includes only A's workload and never B's | integration |
| E7 | F2,N1 | PM reads a member project | 200 facts; no gateway/session call | route |
| E8 | F2,N1 | Developer or removed/non-member reads facts | 404 `NOT_FOUND`; no facts or row content leaks | authorization |
| E9 | F3 | Source registration is attempted twice | second registration fails closed or is skipped by the memoized runtime; no replacement source is possible | unit |
| E10 | F3 | `lead.facts` returns a title or free text | assembly rejects it with `ContextScopeViolation`; no model call occurs | unit |
| E11 | F3 | Source returns another project, forbidden type, too many rows, or oversized text | assembly rejects the whole context with `ContextScopeViolation` | unit |
| E12 | F4 | Latest non-degraded digest has unchanged facts hash | return latest digest with `cached: true`; no session, gateway call, or new row | integration |
| E12a | F4,F6 | Latest degraded digest has unchanged facts hash | retry generation; do not return it as a cache hit | integration |
| E13 | F4,F5 | Facts hash changed and model returns explanation with suggestions | one session/call; one digest and one REPLAN proposal committed atomically | integration |
| E14 | F5 | Proposal insert fails after digest preparation | transaction rolls back digest and proposal; no partial row remains | integration |
| E15 | F6 | Gateway upstream failure, disabled AI, schema failure, refusal, or blocked input | 200 degraded digest with facts, null explanation, null proposal id; no 5xx | service |
| E16 | F6 | Gateway returns flagged output | digest `flagged` is true and explanation remains plain text if schema/guard checks pass | service |
| E17 | F7 | No previous digest | 404 `NOT_FOUND` | route |
| E18 | F7,N1 | Latest digest belongs to another project or archived project | 404 `NOT_FOUND` | authorization |
| E19 | F8 | Model emits an unknown suggestion type or cross-project id | output validation fails; no proposal or digest explanation is stored; response is degraded | service |
| E20 | F4 | Two changed-hash requests race | both may call the model, but each committed digest is internally consistent; no transaction writes partial data | integration |
| E21 | N4 | Error or logging path handles model text | logs contain only fixed code and ids, never prompt, response, task text or secret | security |
| E25 | F1 | Mixed-project relation fixture joins a task, checkpoint, assignee, or sprint from another project | the foreign row is excluded and facts remain target-scoped | integration |
| E26 | F2,F4,F7 | PM calls endpoint 44 or 45; DEV_LEAD calls a non-member target | policy rejects the wrong role with 403 and membership rejects the target with 404 | authorization |
| E27 | F6,N4 | Task event or previous digest contains instruction-like text and triggers the injection flag | static rules remain in the prompt, text stays untrusted, the call is not blocked solely by the flag, and the returned digest is flagged | guard/service |

### What could corrupt data

| ID | Req | Scenario | Expected behaviour (exact) | Test layer |
|---|---|---|---|---|
| E22 | F5 | Digest insert succeeds but REPLAN proposal insert fails | the transaction rolls back both records; no digest points at a missing proposal | integration |
| E23 | F8 | A suggestion references a task, epic, checkpoint, or assignee outside the target project | no REPLAN proposal is committed; a degraded digest with the computed facts and `cached: false` is committed | integration |
| E24 | F5 | Concurrent changed-hash requests persist at the same time | each committed digest has matching target-only facts/factsHash/session/proposal links; no half-written record is visible, and gateway limits bound admitted calls | integration |
| E28 | F4 | Malformed JSON, absent/whitespace body, non-object, duplicate key, extra key, wrong content type, or malformed UUID | 422 `VALIDATION_FAILED` (415 `UNSUPPORTED_MEDIA_TYPE` for non-JSON content type), fixed error body with request id only, and no service, session, database write, or model call; valid case-insensitive UUIDs are normalized to lowercase | route |
| E29 | F4,F7 | Two successful digests race with different `asOf` values | both rows may exist; endpoint 45 returns greatest `facts.asOf`, then `createdAt`, then id; a later commit of older facts cannot become latest | integration |
| E30 | F3 | A valid facts value exceeds 52 characters or a previous explanation exceeds 4000 characters | the source omits that row and assembly continues; no truncation or malformed trusted row is emitted | unit |

## 6. Security

All three HTTP operations require a registered Firebase principal. Endpoint 42 is authorized by the
policy map for PM/DEV_LEAD plus `MEMBER`; endpoints 44 and 45 require DEV_LEAD plus `MEMBER`.
Handlers do not perform role checks. Resource resolution and `requireMember` enforce active-project
tenancy, and the filtered client removes hidden/archived rows. UUID and exact-empty-body validation
occur before service calls. The model receives only W6-assembled, budgeted sections; facts trusted
rows contain allow-listed scalar values, while events and stored digest text are untrusted and pass
W3 guards. Suggestions are closed-schema values and their referenced ids are rechecked against the
target project before persistence. No prompt or response text is logged or stored outside the
specified digest/proposal fields.

| Actor | Abuse | Mitigation | Test |
|---|---|---|---|
| Non-member | Reads another project's facts or digest | policy membership plus filtered reads and source target checks | E8,E18 |
| Member of A | Uses target B to make A data enter a prompt | target scope, post-assembly checks, caller-member overload filter | E6,E11 |
| Member | Injects task-event or prior-digest text | untrusted sections, W3 sanitisation/output rules, static rules never dropped | E10,E15,E21 |
| Model | Emits a destructive or cross-project suggestion | closed schema and target-project id validation; approval remains W14 | E19 |
| Concurrent caller | Creates inconsistent digest/proposal state | one transaction for persistence; no writes during model call | E14,E20 |

## 7. Open questions

| ID | Question | Blocks | Owner |
|---|---|---|---|

## 8. Decisions made in this spec

| ID | Decision | Why / rejected alternative | Asked by |
|---|---|---|---|
| SD1 | Use a single `@agile/lead` package with a memoized runtime, isolated gateway binding, and owned context sources | Reuses W7's proven role-package pattern; rejected route-owned queries and premature package split | operator |
| SD2 | W8 implements endpoints 42, 44 and 45 only; endpoint 43 and proposal approval endpoints remain outside scope | Matches the W8 slice and preserves W14 ownership | operator |
| SD3 | Return degraded 200 for every model-attributable digest failure while retaining computed facts | AD-34 makes facts deterministic and available during AI failure; rejected propagating model failures as endpoint errors | operator |
| SD4 | Store REPLAN proposals during digest generation but never apply them | AD-22 requires explicit approval and W14 owns endpoints 46-48 | operator |
| SD5 | Endpoint 42 retains caller-project overload, but a persisted digest computes overload within its target project only | The shared `ProjectDigest` row is readable by other target-project members; storing caller-specific cross-project workload would leak another project. Rejected: adding caller identity to the digest key/schema during the feature freeze | operator, 2026-11-09 |

## 9. Review record

Lenses: Implementer, Tester, Attacker, Maintainer | Rounds: 2 | Round 1 findings and the SD5 tenancy issue were folded into the spec; round 2 re-reviews confirmed the remaining contract fixes, which were folded into hashing, ordering, persistence, validation and edge cases.
