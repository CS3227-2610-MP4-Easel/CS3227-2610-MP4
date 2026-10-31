# Architecture document template

Suggested location: `docs/architecture/<system-or-service>-architecture.md`. Ask the team if the project already has a convention.

Keep every section. If a section doesn't apply, give it one line saying why (Out of scope, with the reason). That's better than deleting it, because a deleted section looks like something nobody checked.

Profiles say how to specialise sections 6–8 and 13 (HTTP API, CLI commands, events, module APIs).

---

```markdown
# <System / Service> Architecture

Status: Draft — round <n> | Last audit: <date> | Profiles: <core, web-service, ...>

## 1. Purpose and scope
- Owns: <data, behavior>
- Does not own: <and who does>
- Users and roles: <role: what they do>
- Non-goals: <deliberate exclusions>

## 2. Requirements and traceability
| ID | Requirement | Component(s) | Contract / data affected | Verification evidence | Status |
|----|-------------|--------------|--------------------------|-----------------------|--------|
Evidence means how you'll show it works, e.g. a test, demo script, diagram or API transcript.

## 3. Context and dependencies
<context diagram: users, this system, every dependency, ownership boundaries>
| Dependency | Purpose | Interface owner | Contract status (existing / agreed / mocked / unknown) | Impact if it fails |
|------------|---------|-----------------|--------------------------------------------------------|--------------------|

## 4. Components and responsibility boundaries
<component or layer diagram, showing dependency direction>
| Component / layer | Owns | Must not own |
|-------------------|------|--------------|
Answer explicitly:
- where transactions start
- where authorization is enforced
- where derived values are computed
- which component may touch which store.

## 5. Data model
<ERD>
For each entity: purpose, fields and types, required or nullable, primary and foreign keys, cardinality, uniqueness, indexes, server-managed fields, stored vs derived fields, lifecycle states, seed or reference data, and delete behavior (hard or soft; restore; what happens to dependents and stored files).
<concrete schema: DDL, migration-ready model, or file layout>

## 6. Interfaces and contracts
<inventory table: consumer | caller roles | operation | input | output | side effects>
<per operation: field-level input and output, an example, errors, pagination / filtering / sorting where relevant>

## 7. Identity, permissions and trust boundaries
- Authentication (who is calling): token issuer, format, verification, claims
- Authorization (what they may do): a role × operation matrix
- Behavior on missing or invalid identity vs authenticated-but-forbidden
- Trust boundaries: what input is untrusted and where it is validated

## 8. Errors
- Shape: <envelope / exit codes / error event>, with an example
- Mapping: | Condition | Operation(s) | Code | Message / details | Decision ref |

## 9. Workflows: normal and failure
For each important workflow: a sequence diagram, plus a failure matrix:
| Step | Sync/async | In a transaction? | Idempotent? | If it fails | State the user sees | Retry or compensation |

## 10. Asynchronous processing (or "none", with the reason)
| Job / event | Producer | Consumer | Payload | ID / idempotency key | Retry, backoff, max attempts | Dead-letter | Ordering |
Answer explicitly:
- What if the store commits but the enqueue fails?
- What if a job is delivered twice?
- What if a step succeeds but its success is never recorded?

## 11. State, time and derived values
- State tables: | Event | From | To | Side effects |
- Time: time zone, clock source, day numbering, whether interval ends are inclusive, overnight / 24h / missing / holiday cases
- Derived values: how each is computed and where

## 12. External providers behind interfaces
<interface operations; what the system stores; what it returns to consumers; who authenticates; what happens when the provider is down; cleanup>
Provider-specific bucket, SDK, region and credential details go in the deployment notes.

## 13. Consumer / UI integration
<which operation feeds each screen or consumer; loading, empty, error and unauthorized states; live or mocked data>
Component structure and layout belong in the UI plan, not here.

## 14. Operations and deployment
| Concern | Status (Decided / Deferred / Out of scope / Required before deployment) | Notes |
Concerns: environments, configuration and secrets, database, queue, storage, network boundaries, health checks, logging, metrics, tracing, backups, migrations, scaling, retention, security monitoring.

## 15. Decision log
> Legend: AD = Architecture Decision (intended design). G = architecture gap. Not to be confused with D<n>, a Deviation in project state.

<an AD-nn record per decision; superseded ones are kept and marked "Superseded by AD-mm">

## 16. Open items and readiness
| Gap | Status | Blocks implementation? | Blocks integration? | Blocks deployment? | Owner |

## Changelog
<one line per round: date, decisions recorded, sections touched>
```
