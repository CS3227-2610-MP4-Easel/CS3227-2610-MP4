# Guardrails — Agile Platform

**Prohibitions and binding constraints only.** If a request collides with a line below, stop and ask before doing anything (`branch-state` skill). Detail: [decision-log.md](../../docs/architecture/decision-log.md).

> Legend: `AD-nn` = architecture decision (docs/architecture). `C<n>` = project decision. Gaps and out-of-scope entries carry no ID; cite by bold name.

## Known Gaps & Accepted Limitations

- **No scheduled jobs, queues or background workers** — AI work is request-driven (AD-06).
- **No restore, retention or deletion tooling** — restore is a manual DB task (AD-36, AD-42, AD-51).
- **Email verification and disabling users** — Firebase configuration, not our code (AD-57).
- **Typed SQL is disabled** — do not enable Prisma `typedSql` or add `.sql` files until `$queryRawTyped` is included in the filtered-client raw-query boundary.
- **Unvalidated relation filters are unsafe** — request-derived `where` clauses must not rely on the filtered client to hide soft-deleted related rows.
- **A few users can use up the global AI windows** — the per-user windows (6 a minute, 200 a day) limit each user, but four or five active users can exhaust `global:min` (25 a minute) and everyone else gets `AI_BUSY` until the window resets; there is no per-project share. A call refused by the breaker has already counted against the windows.
- **AI session caps and the spend cap are soft** — `Sessions.open` counts then inserts, so concurrent opens can pass both the open-per-feature and the daily cap (bounded by how many arrive at once); calls admitted together each see the spend sum before the others' reservations (bounded by `global:min`).
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
