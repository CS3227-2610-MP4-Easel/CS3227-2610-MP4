# Guardrails — Agile Platform

**Prohibitions and binding constraints only.** If a request collides with a line below, stop and ask before doing anything (`branch-state` skill). Detail: [decision-log.md](../../docs/architecture/decision-log.md).

> Legend: `AD-nn` = architecture decision (docs/architecture). `C<n>` = project decision. Gaps and out-of-scope entries carry no ID; cite by bold name.

## Known Gaps & Accepted Limitations

- **No scheduled jobs, queues or background workers** — AI work is request-driven (AD-06).
- **No restore, retention or deletion tooling** — restore is a manual DB task (AD-36, AD-42, AD-51).
- **Unverified email at registration** — Firebase issues tokens to unverified emails unless blocking functions are set up, so someone holding a registration code could register an email they do not own (AD-57). Because endpoint 10 adds members by email, that impersonated account would receive the access meant for the real owner. Deliberate (C47, reconfirmed on PR #10); to close it, require `email_verified` in the verifier and turn on verification in Firebase.
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
