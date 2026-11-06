<!-- Calibration artifact "mediocre": the same excerpt with acceptance criteria removed and vague wording added. -->

# W4 Auth and Registration Design

- **Status:** Approved (ludannnn, 2026-10-31)
- **Risk tier:** High - it is the authentication boundary for every route, assigns roles and handles registration secrets.
- **Workstream:** W4 | **Plan:** not written yet
- **Constraints consulted:** AD-03, AD-07, AD-08, AD-25, AD-33, AD-50, AD-53, AD-55, AD-57, AD-59, AD-63, AD-01b, A-03, A-10, A-15; guardrails Known Gaps; `conventions/general.md`, `conventions/process.md`; `architecture/auth.md`, `architecture/foundation.md`; contracts.md §1, §2, §3.1; architecture §4, §5, §7, §8, §9.1, §13, §14
## 1. Problem
Nothing is built. No request can be tied to a person, no account can get a role, and W5 and the AI features cannot enforce who may do what.

Desired: a Firebase account becomes a platform user only with the registration code for its role; every protected request is tied to a verified identity and a role read from our database; other modules get a shared rate limiter. The role owners and all three demo roles depend on this.

## 2. Goals
Some functional and non-functional requirements are in [requirements.md](2026-10-31-w4-auth-design/requirements.md).

## 3. Non-goals
- Enforcing email verification or disabling users in our code - AD-57, kept by the operator; the guardrails line is reworded to name both consequences, not duplicated (SD3).
- Per-project roles and email invitations - AD-07, AD-08.
- Password reset, social sign-in and account deletion - not in the Tier 1 screen list.
- Editing a role or removing a user - there is no admin route; a wrong registration is fixed by hand in the database, as a manual DB task (guardrails, no restore or deletion tooling).
- `requireMember` - moves to W5 in `core` (SD9).
- Defining the Prisma schema - W1 owns the schema for `users` and `rate_counters`.
- The policy map's content and the gate itself - W1 (AD-55).
- The design of the sign-in screen - W10 (AD-71); W4 only wires it.

## 4. Components
- [Requirements](2026-10-31-w4-auth-design/requirements.md) - F and N lists with acceptance criteria
- [Data model](2026-10-31-w4-auth-design/data-model.md) - how W4 uses the W1 tables; no schema changes
- [API](2026-10-31-w4-auth-design/api.md) - endpoints 2-4, middleware and exported functions
- [UI](2026-10-31-w4-auth-design/ui.md) - wiring of the sign-in and register screen
- [Conventions](2026-10-31-w4-auth-design/conventions.md) - placement, settings, seams and threat list
- [Edge cases](2026-10-31-w4-auth-design/edge-cases.md) - failure and abuse behaviour
- [Implementation order](2026-10-31-w4-auth-design/implementation-order.md) - tasks and waves

## 5. Open questions
To be decided later, as needed.


---

# Requirements

## Functional
| ID | Requirement |
|---|---|
| F1 | Handle tokens quickly and securely where appropriate |
| F2 | Load the caller's `users` row and refuse unregistered callers |
| F3 | `hit(key, windowSeconds, limit)` limits requests in a reasonable way |
| F4 | `POST /api/auth/check-code` validates a role's code |
| F5 | `POST /api/auth/register` creates one user |
| F6 | `GET /api/me` returns the caller |
| F7 | The sign-in and register screen works end to end |

## Non-functional
| ID | Requirement |
|---|---|
| N1 | Secrets are handled safely, etc. |
| N2 | Code comparison is constant-path |
| N3 | The raw client IP is never stored |
| N4 | The process refuses unsafe settings at startup |
| N5 | The role comes only from the validated `register` request and the `users` row |
| N6 | Tests need no live Firebase or network |
| N7 | The real verifier adapter rejects forged tokens |
