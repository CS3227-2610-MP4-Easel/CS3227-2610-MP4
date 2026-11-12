# Guardrails — Agile Platform

**Prohibitions and binding constraints only.** If a request collides with a line below, stop and ask before doing anything (`branch-state` skill). Detail: [decision-log.md](../../docs/architecture/decision-log.md).

> Legend: `AD-nn` = architecture decision (docs/architecture). `C<n>` = project decision. Gaps and out-of-scope entries carry no ID; cite by bold name.

## Known Gaps & Accepted Limitations

- **No scheduled jobs, queues or background workers** — AI work is request-driven (AD-06).
- **No restore, retention or deletion tooling** — restore is a manual DB task (AD-36, AD-42, AD-51).
- **Unverified email at registration** — Firebase issues tokens to unverified emails unless blocking functions are set up, so someone holding a registration code could register an email they do not own (AD-57). Because endpoint 10 adds members by email, that impersonated account would receive the access meant for the real owner. Deliberate (C47, reconfirmed on PR #10); to close it, require `email_verified` in the verifier and turn on verification in Firebase.
- **Sign-up reveals registered emails** — Firebase answers `auth/email-already-in-use` for an existing account and the register screen shows it (W4 ui.md), so anyone can test whether an email has a Firebase account; sits beside **Unverified email at registration** (AD-57).
- **The web app's auth source scan is regex-based** — `src/fe/test/source-rules.test.ts` catches the usual import, `fetch(`, `location.assign(`, `process.env` and `dangerouslySetInnerHTML` forms but not deliberate evasion such as `window['location'].assign`, `fetch (` with a space, `process["env"]` or computed specifiers; review covers those.
- **Disabled users keep access until token expiry** — a disabled user's ID token works for up to 1 hour, because revocation is not checked (AD-57).
- **`rate_counters` rows are never cleaned up** — one row per key, with no scheduled jobs to remove them; IPv6 /64 grouping limits growth, and rows can be cleared by hand. An attacker holding many /64 prefixes (a /48 has 65,536) gets 20 attempts per prefix and adds one row per prefix; there is no global ceiling.
- **Slow request bodies** — endpoints 2 and 3 read up to 4 KiB before authorization; a client sending it slowly holds the function until the platform timeout.
- **Typed SQL is disabled** — do not enable Prisma `typedSql` or add `.sql` files until `$queryRawTyped` is included in the filtered-client raw-query boundary.
- **Unvalidated relation filters are unsafe** — request-derived `where` clauses must not rely on the filtered client to hide soft-deleted related rows.
- **A few users can use up the global AI windows** — the per-user windows (6 a minute, 200 a day) limit each user, but four or five active users can exhaust `global:min` (25 a minute) and everyone else gets `AI_BUSY` until the window resets; there is no per-project share. A call refused by the breaker has already counted against the windows.
- **AI session caps and the spend cap are soft** — `Sessions.open` counts then inserts, so concurrent opens can pass both the open-per-feature and the daily cap (bounded by how many arrive at once); calls admitted together each see the spend sum before the others' reservations (bounded by `global:min`).
- **The injection flag is a floor, not a proof** — NFKC and a small lookalike map do not fold every confusable (Greek nu, Cyrillic k and others evade the patterns), and obfuscated personal data ("a at b dot com") is not redacted. The wrapper, the closed output formats and human approval are the real safeguards (AD-25, architecture §7).
- **Zero-width characters are lost on input** — removing every format character deletes ZWJ and ZWNJ, damaging emoji sequences and some Persian and Indic text sent to the model; output keeps only emoji ZWJ sequences and U+FE0F.
- **Guard false positives** — an 8-digit number split by a space (`8901 2345`) and some UUID segments are redacted as phones; "system prompt" in prose is flagged; four-part version numbers (`10.0.0.1`) and `<a ` in prose fail the output guard.
- **`llm_calls.prompt_version` does not cover the security suffix** — `prompt_version` and `prefix_hash` hash the system message only (spec SD3, so the prefix stays stable), so a change to the suffix template leaves them unchanged; `GUARD_VERSION` changes but is not stored on `llm_calls`. W17 should record `GUARD_VERSION` in `experiment` (or add it to the version) before comparing prompt or guard variants.
- **A poisoned item can make the model refuse** — text that steers the model to `{"refusal":true}` fails that call with `REQUEST_REFUSED`; refusals do not trip the breaker and the item's flag is shown to the reader.
- **AI context checks rows, not sources** — `assembleWith` catches inconsistent rows (wrong project, owner, type, size, unrequested items, free text in facts), not a source that lies about a row's `projectId` or `ownerId`; each source owner's tests must prove their rows (W5, W7-W9).
- **The source scan cannot see data passed between unrelated files** — a route can query in one module and pass plain values into a gateway-calling file it does not import; review and the runtime checks cover it.
- **The gap between `assembleWith` and the model call** — membership is checked before and after the reads, not at `run` time.
- **Upload storage is unbounded** — endpoint 49 has no per-user rate limit or row cap and activity items are never deleted; spend is bounded by the session caps and AI windows, storage is not.
- **A regeneration or summary retry can spend a session without storing anything** — `regenerate` counts before `run`, so a busy or refused standup call uses one of the five regenerations and stores nothing.
- **Concurrent W9 writes to one project can exhaust the transaction retries** — writes queue on the project-row lock and each waiter is retried after a serialization error; `inMutationTransaction` allows 3 attempts, so four or more simultaneous uploads, summary inserts or standup writes on one project can fail (plan P6). Measured on Postgres: 5 concurrent uploads → 2 fail on every run, no partial writes; since C72 they get 429 `RATE_LIMITED` with `Retry-After: 1` instead of 500.
- **An oversize `Content-Length` gets 413 before authentication** — endpoints 49-51 check the header (only the header; no body is read) before the token, so an unauthenticated client sees 413 instead of 401.
- **A summary session is opened before context assembly** — if assembly fails (membership removed, a source error), the opened DEV_SUMMARY session stays OPEN and counts toward the caller's own caps.
- **A Developer on four or more projects can hit the 3-open DEV_STANDUP cap** — W9 leaves standup sessions open for W16's edit and accept (53, 54), so a fourth standup within 30 minutes gets 429 `RATE_LIMITED`.
- **Nested writes require explicit authorization** — callers must validate every connected resource inside the mutation transaction.

## Explicitly Out of Scope

- **GitHub integration, diffs as AI input** (AD-20); **comments, attachments, subtasks, labels, priorities, custom workflows** (AD-09).
- **Per-project roles, email invitations** (AD-07, AD-08); **embeddings, per-PR databases, streaming** (AD-28, AD-29).
- **Any client-controlled AI setting** (A-07).

## Binding Decisions

| ID | Constraint | File |
|---|---|---|
| AD-01b | `src/fe` never imports Prisma or `@agile/db` | [log](../../docs/architecture/decision-log.md) |
| AD-55 | Authorisation only through the policy map; handlers never check roles | [log](../../docs/architecture/decision-log.md) |
| AD-25 | All untrusted text passes the gateway pipeline; no prompt text is stored | [log](../../docs/architecture/decision-log.md) |
| AD-32 | No secrets in the repo; production deploys and migrations only from CI | [log](../../docs/architecture/decision-log.md) |
| C8 | All source lives under `src/`; the web app is `src/fe`, not `apps/web` (supersedes the path in AD-01b) | [C8](decisions/C8.md) |
