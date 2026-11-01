# Data Model

W4 adds no tables or columns. W1 defines these from architecture §5; W4 owns the behaviour of `users` and `rate_counters`.

## Entities
| Entity | Attribute | Type | Null | Default | Range / rule |
|---|---|---|---|---|---|
| `users` | id | uuid | no | generated | primary key |
| `users` | firebase_uid | text | no | - | unique; the token's `sub` |
| `users` | email | text | no | - | unique; the token's `email`, lowercased by W4 |
| `users` | display_name | text | no | - | the trimmed value, 1 to 100 Unicode code points; no normalisation |
| `users` | role | enum | no | - | `PM`, `DEV_LEAD`, `DEVELOPER`; set once at registration |
| `users` | created_at | timestamptz | no | now | server-set |
| `rate_counters` | key | text | no | - | primary key; at most 200 characters |
| `rate_counters` | window_start | timestamptz | no | database clock | reset when the window has elapsed |
| `rate_counters` | count | int | no | 1 | incremented on each `hit` |

## Keys and relationships
No foreign keys are added. `users` is referenced by `core` tables, which W1 defines.

## Lifecycle
| From state | To state | Triggered by (role) | Guard |
|---|---|---|---|
| no row | registered | any valid token | correct code for the requested role; unique `firebase_uid` and `email` |

No other transition exists in W4: role, email and display name are not edited, and rows are not deleted. If a user's email changes in Firebase, the stored email stays as it was.

## Invariants
- A `users.role` was only ever written alongside a code check for that role.
- One Firebase account maps to at most one `users` row, and one email to at most one row.
- `rate_counters.window_start` is set only by the database clock, never by application time.
- `count` above `limit` never grants admission.

## Migration and rollback
- Version: none on this branch; W1's migration creates the tables | Existing rows: none | Regenerate committed data: no; W13's seed must lowercase emails and follow the same field rules | If it fails halfway: not applicable.
- The single `register` insert is atomic, so a failure leaves no row and the user can retry.

## Architecture areas changed
- `architecture/auth.md` - Now and Paths at fold; remove `requireMember`.
- `architecture/foundation.md` - the token check and user lookup are supplied by `auth`; `packages/api` wires them.
- `architecture/core.md` - gains `requireMember` through W5.
