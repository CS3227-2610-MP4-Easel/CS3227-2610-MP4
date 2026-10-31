# Architecture concerns (attacker review)

Part 1 covers D-25 to D-28 (C-01 to C-15). Part 2 covers the remaining components (C-16 to C-39).

# Part 1: attacker review of D-25 to D-28

Reviewed: 2026-10-28, against the first draft of `agile-platform-architecture.md` (D-25 untrusted text and scoped context, D-26 security test strategy, D-27 standup visibility, D-28 similar-item retrieval), read together with D-07, D-10, D-16, D-18 to D-22.

Status of every item below: **Open** (nothing here has been decided or recorded in the architecture). Items marked *fixed since* were addressed by the later restructure and are listed at the end.

## High

| # | Concern | Attack | Gap in the architecture | Suggested direction |
|---|---|---|---|---|
| C-01 | No object-level ownership check for standups (D-27) | A Developer who is a member of project P reads any colleague's standup by changing an id | D-07's two checks (role gate, membership) are not enough; D-26 layer 2 tests roles, not objects | State "own standup, or a Dev Lead member of the same project" as an explicit rule; test it per object |
| C-02 | Uploaded activity is self-attested (D-20, D-27) | Developer A uploads fake commits with `author` = B, planting injection text or false blockers in B's standup; backdated or future `timestamp` fills "Yesterday" with invented work | Not stated whether attribution follows the uploader or `author`; the time zone of "one day" is open (G-22) | Attribute items to the uploader only; `author` is display-only; define the day boundary |
| C-03 | Proposals validated when stored, not when applied (T3, D-10) | A REPLAN stays PENDING for days; entities move or are deleted, a member is removed, or the approver double-clicks | T3 checks ids "before it is stored" only | The apply step re-checks every id against the proposal row's `project_id`, ignores any `project_id` in the payload, uses a strict schema, re-checks assignee membership and the approver's role, and claims once (`PENDING → APPLYING`) |
| C-04 | Multi-request flows take client-controlled fields (D-21, D-19) | A stage-2 request that carries epic text skips stage-1 output validation; a client-supplied `session_id` attributes spend to another user's session; new sessions reset the per-session regeneration cap (T7) | Contracts do not say which fields the browser controls | Stage-2 requests carry only `(proposal_id, epic_index)`; every session id is checked for owner, feature and open state; add a per-user cap and an open-session cap |
| C-05 | Scoped context is membership-only (D-25, D-28) | A PM-feature context could include standup text the PM may not read; D-28 retrieves across all the PM's projects, so a Developer in project A plants a task that ranks for expected ideas and reaches the strong-model prompt for project B, and A's content leaks into B | The function scopes by caller and membership, not by role, feature or target project; the source-scan test is grep-brittle and conflicts with D-28's raw SQL | Signature `(caller, feature, targetProject)` with an allow-list of entity types per feature; scope retrieval to the target project; ban `$queryRawUnsafe`; require `project_id = ANY(...)` in every raw query |
| C-06 | Caches can leak and be poisoned across users (D-18) | A hit on my upload reveals that someone else uploaded the same text; a summary cached under a weaker guard version survives a security fix; the generic result cache serves one user's result to another | Summary cache key is content hash plus prompt version | Add `project_id` and a sanitiser/guard version to the key; include user and project in the result-cache key |
| C-07 | The tests do not measure the attack (D-26) | Layer 3 runs a corpus written by the guard authors against those guards, with no model in the loop; layer 4 scores schema validity, refusals and manual quality, never whether the injection worked | No success criterion per attack; D-11 gives one person A + C + J (auth, guards, security tests) so they test their own code | Give each attack a success criterion (canary leaks, forbidden id appears, link survives); require cross-review of the corpus and the authorisation tests |
| C-08 | One user can starve everyone through the limiter (D-16, D-18, T7) | Parallel requests hold all 4 global slots; one upload of N items triggers N summary calls and eats the per-minute budget; the shared SoCLaaS key can be exhausted by outsiders | Slots and per-minute limits are global; caps are described as counts of rows rather than cost or tokens; upload limits have no numbers; G-10 and G-27 are open | Per-user concurrency and per-minute shares; cap by cost or tokens (D-24); per-upload item cap; separate keys per tier |

## Medium

| # | Concern | Detail | Suggested direction |
|---|---|---|---|
| C-09 | Sanitiser under-specified (D-25) | Delimiter-tag removal done once leaves `<un<untrusted>trusted>`; a static tag name is guessable; D-17 truncation can cut off the closing delimiter; output validation ignores bidi and zero-width characters (NFKC runs on input only); model output is reused as input (a poisoned summary feeds the standup) | Remove tags until stable; use a per-call random boundary and check it is absent from the content; truncate before wrapping and never trim the security suffix; reject bidi and zero-width characters in output; wrap reused model output as untrusted |
| C-10 | Injection flag lives only on `llm_calls` | A cache hit creates no new flag, so the reader sees a clean summary | Store the flag with the item and the summary |
| C-11 | Stored XSS through the upload `url` field (T9) | React escapes text but not `href`; `javascript:` works | Restrict to `https:`, render with `rel="noopener"`, set a CSP |
| C-12 | Registration code oracle (T8, D-08) | `check-code` lets an unauthenticated caller brute-force codes; Firebase signup can be called directly; a valid token with no `users` row must not be auto-created; request-body logging could capture the code | Specify code entropy, per-IP limit and the trusted IP header; deny tokens with no row; keep codes out of logs |
| C-13 | D-28 full-text search | Raw idea text into `to_tsquery` gives syntax errors and 500s; Prisma does not manage `tsvector` columns or GIN indexes, so migrations can drop them and the query degrades to a scan; ranking is steerable by whoever writes tasks, and a PM approving a large plan cannot see which retrieved item shaped it | Use `websearch_to_tsquery` or `plainto_tsquery`; manage the index in a manual migration; show provenance of retrieved items in the plan |
| C-14 | Experiment flags weaken controls (D-22 raw-ticket mode, D-28, D-18) | Raw ticket mode removes the closed-fact defence for T3 | Flags are server-side only; controls do not depend on them; the flag state is recorded on every `llm_calls` row |
| C-15 | D-27 confidentiality rests on open items | Who may add members was G-22; the usage page (WP F) has no access rule yet shows per-user calls, flags and outcomes | Decide member management rules and usage-page access |

## Document hygiene (at review time)

- The T1 to T11 control list sat inside "Original brief (kept for the record)"; if that history were trimmed the controls would vanish. Move the list into the decision or §7.
- D-20's decision text listed no project reference although D-27 and the changelog said it was added.
- The header still read "Draft — round 1 | Last audit: not yet run".
- G-24 and G-18 said "Covered" but still showed "Blocks implementation: yes".

## Fixed since the review

- C-01: §7 now shows "own only" for standups.
- C-15: A-01 states who adds members. The usage-page rule is A-09 (own sessions and aggregates), still to confirm.
- The control list and the decision log are now separate documents (`decision-log.md`).

The other items were not re-checked against the restructured document.

---

# Part 2: attacker review of the remaining components

Reviewed: 2026-10-28, against the restructured `agile-platform-architecture.md` (§1 to §5, §7, §8, §12, §14, §15, §16) and `decision-log.md` (D-01 to D-24, D-29 to D-38). Scope: what the architecture should dictate; spec-level detail is out of scope. Numbering continues from Part 1. Status of every item: **Open**.

## High

| # | Concern | Detail | Suggested direction |
|---|---|---|---|
| C-16 | Authorization is described as three checks, but the rules need more | §4 says authorization lives in three places only, and the role gate is by URL namespace. The §7 matrix cuts across namespaces ("PM and Dev Lead yes, Developer no" for tasks; "Developer: own assigned tasks only" for status). A namespace gate cannot express shared endpoints, and ownership predicates ("own task", "own standup") are neither role gates nor membership checks | One declared policy map per operation (allowed roles plus an ownership predicate) in `packages/contracts`, enforced in one place; the D-26 generated test iterates that map; CI fails on any route missing from it |
| C-17 | Cross-table integrity is by convention (§5) | `tasks.project_id` "equals the epic's" with no composite foreign key; `sprint_id`, `checkpoint_id` and `assignee_id` can point into other projects; `assignee_id` need not be a project member, so a REPLAN `reassign` could move work to a non-member | Composite FKs `(project_id, x_id)` wherever a row references a project-scoped parent; an explicit membership rule for assignees |
| C-18 | `proposals` cannot be built as drawn | D-10's apply writes epics, tasks, checkpoints and `task_events`, which `core` owns. §4 forbids one module querying another's tables, and the diagram gives `proposals` only a `db` edge. The same conflict exists for `usage` reading `llm_calls` and for `proposals` setting `ai_sessions.outcome` (D-19) | The apply is a `core` operation that takes a validated payload and a transaction handle; cross-module reads and writes go through exported functions, e.g. `closeSession(id, outcome)` with an ownership check |
| C-19 | The limiter undercounts, so caps are bypassable (D-16) | Per-minute and daily caps are counts over `llm_calls`, but a row is written only after the call. Parallel requests all pass the count check, and a function killed at `maxDuration` writes no row, so its tokens are never counted | Write a reservation row at reserve time with an `IN_FLIGHT` status (missing from `llm_calls.status`) and finalize after the call; an expired lease finalizes the row as `TIMEOUT`; set the SoCLaaS client timeout below `maxDuration` |
| C-20 | Wrong-owner overwrite in the upload model (`activity_items`) | Unique key is `(project_id, item_type, external_id)`. Developer B uploads `PR 12` with different content and the re-upload rule updates the row and invalidates A's summary; PR numbers also collide across repositories. Nothing says whose standup an item feeds | Key items per uploader and attribute them to the uploader only; `author_text` is display-only |
| C-21 | Parallel expansions write one JSON row (`ai_proposals.payload`) | Parallel stage-2 requests each read-modify-write the same jsonb, so D-35's `version` check gives constant 409s or lost updates. The per-epic state `PENDING/DONE/FAILED` has no in-progress state: a killed function leaves `PENDING` forever and two requests can double-spend. D-35's idempotency key (proposal, epic, prompt version) omits the epic's content, so after the PM edits an epic, regeneration returns the stale stored expansion | Per-epic rows, or atomic path updates with a leased `IN_PROGRESS` state; include the epic's content hash in the key |
| C-22 | Unverified email can be used to take a membership (A-01, A-10) | Members are added by an account's identity and `users.email` is "taken from the verified token", but the document never requires Firebase's `email_verified`. An attacker registers with a teammate's unverified address and the PM adds them. `users` has no `disabled` state, so a leaked registration code has no revocation path and tokens stay valid until they expire. Nobody is said to be allowed to remove members, or whom | Closed by D-57 for verification and disabling: both are Firebase configuration, and the application models neither (`email_verified`, `users.disabled_at` and `USER_DISABLED` are not used). Still open: write explicit removal rules (who may remove whom) |
| C-23 | Dev and prod separation has leaks (D-29, D-32) | Every PR preview shares the dev database and carries Preview-scoped secrets, so an unreviewed (possibly agent-written) branch can read the dev DB URL, the dev SoCLaaS key and the dev codes. D-29 deploys `main` through Vercel's Git integration while D-32 says production deploys come "only from CI": the two contradict. R4's evidence tests a missing setting, not cross-wiring | Scope dev secrets to the `development` branch only; other previews use mock mode and no data credentials. Pick one deploy path, with the prod job in a GitHub Environment that needs approval and no secrets in PR-triggered CI. Add a startup assertion that the Firebase project id, DB host and `env` all match the tier |

## Medium

| # | Concern | Detail | Suggested direction |
|---|---|---|---|
| C-24 | A third-party 429 can switch off AI for everyone (§12) | SoCLaaS returns 429 for both rate limit and quota, and other users of the shared key can trigger it. The breaker and budget-block state in `llm_gateway_state` is global | The breaker counts only upstream failures, never user-attributable outcomes such as `SCHEMA_FAIL` or `BLOCKED_INPUT`; a 429 is transient with backoff; budget-block comes only from the app's own cost estimate or the budget endpoint, with a decay |
| C-25 | The §8 mapping has holes | `REFUSED` and `BLOCKED_INPUT` have no status; a duplicate registration (same uid or email) has no code; an upstream 429 and our own `AI_BUSY` 429 look identical to the client; it is unstated whether a flagged input still goes to the model | Add the missing rows; state whether a flag blocks or only marks |
| C-26 | The `check-code` rate limiter has no table | It is DB-backed under D-05 but absent from §5; the trusted IP header is unspecified (spoofable if wrong); stored IPs are personal data | Add the table and the IP rule to §5 and §7 |
| C-27 | Soft delete and archive rely on "a shared query helper" | Prisma has no default soft-delete filter, so a helper can be bypassed. The D-28 search and `ai-context` must also exclude deleted rows and archived projects. "Archived is read-only" has no single enforcement point, including for AI writes (uploads, standups, proposals) | A Prisma client extension that applies the filter by default with an explicit opt-out; one archive check in `core` that every write path uses |
| C-28 | The Dev Lead cross-project overload fact (D-22) can leak | Computing one person's load across projects reads projects the lead may not belong to | Aggregate over the caller's member projects only |
| C-29 | `ai-context` is on the critical path but scheduled last | Work package J owns it, yet G, H and I all depend on it; D-11 freezes only contracts and `LlmGateway.run`. The gateway interface, the policy map and `ai-context` are written down nowhere (§6 and §12 are pending) | Add all three to the frozen-first set and specify them before the role slices start |
| C-30 | Deployment obligations were dropped when G-15 was removed | Neon pooled versus direct connections for runtime and migrations, Prisma on serverless, advisory-lock behaviour and the Hono-in-Next check (decision-log lines 46, 106, 341) appear in no §16 row, though D-16's correctness depends on the advisory-lock check. G-26 lost its fallback: if SoCLaaS is unreachable from Vercel, every AI feature is dead in prod | Re-add them as gaps; record the fallback now (a relay, or AI disabled in hosted environments) |
| C-31 | Migrations and recovery | With a shared dev DB and Vercel's instant rollback, old code runs against a new schema. A-13 makes restore a manual DB operation, which presumes backups; backups are a Gap that depends on the Neon plan | Forward-only expand/contract migrations; state a recovery target and verify the plan provides it |
| C-32 | Browser-side controls are missing from §7 and §14 | UI and API share one origin, so any XSS yields full API access. CSP, `frame-ancestors`, token storage and the "no CSRF because Bearer header" stance are unwritten. The generated OpenAPI or a Swagger UI should not be served in prod | Add a browser-security decision and put it in §7 and §14 |
| C-33 | Sprint velocity can be rewritten after close | `completed_points` is frozen at close, but tasks in a CLOSED sprint can still change points or sprint | Freeze those fields once the sprint closes |

## Development process (D-30 to D-32)

| # | Concern | Suggested direction |
|---|---|---|
| C-34 | The repository holds attack text: the D-26 corpus and seed data contain injection payloads, and coding agents read the repository | A deny rule for agents on the corpus path, or store it encoded |
| C-35 | The agent-permission policy is a repo file that agents can edit | CODEOWNERS and human-only review for agent definitions, the policy file and CI workflows |
| C-36 | Supply chain: only a dependency audit and a lockfile are required | Frozen-lockfile installs, `--ignore-scripts` on agent machines, Actions pinned by SHA, least-privilege `GITHUB_TOKEN` |
| C-37 | Branch protection may be unavailable: on GitHub Free, private repos cannot enforce it (verify) | Add repository plan and visibility to G-29 |
| C-38 | Reviewer disagreements go to "the owner", who is also the implementer's orchestrator | Let the security reviewer block security-class findings |
| C-39 | R2's evidence ("hand-off files exist") proves process, not conformance | Add a contract test of the implementation against the generated OpenAPI |

## Notes

- Part 2 was written before the Part 1 items were cross-checked against the decision log, so some overlap is possible: C-19 and C-08 both concern the limiter, and C-20 and C-02 both concern upload attribution.
- No item here has been confirmed by the team. Treat each as a finding to accept, reject or fold into a decision.
