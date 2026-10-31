# Guardrails — Agile Platform

**Prohibitions and binding constraints only.** If a request collides with a line below, stop and ask before doing anything (`branch-state` skill). Detail: [decision-log.md](../../docs/architecture/decision-log.md).

> Legend: `AD-nn` = architecture decision (docs/architecture). `C<n>` = project decision. Gaps and out-of-scope entries carry no ID; cite by bold name.

## Known Gaps & Accepted Limitations

- **No scheduled jobs, queues or background workers** — AI work is request-driven (AD-06).
- **No restore, retention or deletion tooling** — restore is a manual DB task (AD-36, AD-42, AD-51).
- **Email verification and disabling users** — Firebase configuration, not our code (AD-57).

## Explicitly Out of Scope

- **GitHub integration, diffs as AI input** (AD-20); **comments, attachments, subtasks, labels, priorities, custom workflows** (AD-09).
- **Per-project roles, email invitations** (AD-07, AD-08); **embeddings, per-PR databases, streaming** (AD-28, AD-29).
- **Any client-controlled AI setting** (A-07).

## Binding Decisions

| ID | Constraint | File |
|---|---|---|
| AD-01b | `apps/web` never imports Prisma or `packages/db` | [log](../../docs/architecture/decision-log.md) |
| AD-55 | Authorisation only through the policy map; handlers never check roles | [log](../../docs/architecture/decision-log.md) |
| AD-25 | All untrusted text passes the gateway pipeline; no prompt text is stored | [log](../../docs/architecture/decision-log.md) |
| AD-32 | No secrets in the repo; production deploys and migrations only from CI | [log](../../docs/architecture/decision-log.md) |
