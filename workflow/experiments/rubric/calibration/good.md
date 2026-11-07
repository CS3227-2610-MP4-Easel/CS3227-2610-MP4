<!-- Calibration artifact "good": the approved W4 auth spec index and its requirements component, unchanged. -->

# W4 Auth and Registration Design

- **Status:** Approved (ludannnn, 2026-10-31)
- **Risk tier:** High - it is the authentication boundary for every route, assigns roles and handles registration secrets.
- **Workstream:** W4 | **Plan:** not written yet
- **Constraints consulted:** AD-03, AD-07, AD-08, AD-25, AD-33, AD-50, AD-53, AD-55, AD-57, AD-59, AD-63, AD-01b, A-03, A-10, A-15; guardrails Known Gaps; `conventions/general.md`, `conventions/process.md`; `architecture/auth.md`, `architecture/foundation.md`; contracts.md §1, §2, §3.1; architecture §4, §5, §7, §8, §9.1, §13, §14
- **Reviewed by lenses:** Implementer, Tester, Maintainer, Attacker (authentication, secrets and a public endpoint); one round, findings fixed in these files

## 1. Problem
Nothing is built. No request can be tied to a person, no account can get a role, and W5 and the AI features cannot enforce who may do what.

Desired: a Firebase account becomes a platform user only with the registration code for its role; every protected request is tied to a verified identity and a role read from our database; other modules get a shared rate limiter. The role owners and all three demo roles depend on this.

## 2. Goals
Seven functional and seven non-functional requirements, with acceptance criteria, in [requirements.md](2026-10-31-w4-auth-design/requirements.md).

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
| ID | Question | Blocks | Owner |
|---|---|---|---|

External dependencies are not open questions but must be met before building: the W1 seams in [conventions.md](2026-10-31-w4-auth-design/conventions.md) (owner Dev Lead) and the W10 mockup for T7 (owner PM).

## 6. Decisions made in this spec
| ID | Decision | Why / rejected alternative | Asked by |
|---|---|---|---|
| SD1 | W4 includes the token check, user lookup and `hit()` | The architecture places them in `auth`, and endpoints 2 and 3 need `hit()`. Rejected: leaving lookup in W1 | operator |
| SD2 | Verify tokens with `firebase-admin` | Vendor-maintained key rotation and claim checks suit a security boundary. Rejected: `jose`, because we would own every check | operator |
| SD3 | Keep AD-57; `verifyIdToken` runs with `checkRevoked` false as a consequence | Registration still needs a code and the deadline is tight. Rejected: reversing it for email only, or for email and revocation | operator |
| SD4 | W4 wires the sign-in and register screen | Matches end-to-end slices; no other owner was named. Rejected: the PM wiring it in W10 | operator |
| SD5 | Client IP comes from `x-vercel-forwarded-for` | Vercel's request-headers docs say it equals `x-forwarded-for` but is not overwritten by a proxy on top of Vercel. No proxy fronts this deployment (assumption). The docs do not state that a client value cannot reach it, so W13 checks this on the deployed tiers. Rejected: `x-forwarded-for` | AI, architecture §7 requires a named header |
| SD6 | 20 attempts per minute per client IP, separately for `check-code` and `register` | Long random codes make guessing impractical, and a class may share one campus address. Rejected: 5 per minute, which could block real users during grading | AI |
| SD7 | IPv6 addresses are limited per /64, and `::ffff:` mapped addresses as IPv4 | A client usually controls a whole /64, which would otherwise bypass the limit | AI, Attacker lens |
| SD8 | Sign-in is email and password only, and local runs use the dev Firebase project with no emulator | Fewest settings per tier, and `FIREBASE_AUTH_EMULATOR_HOST` can then be banned everywhere. Rejected: social providers; an emulator tier | AI |
| SD9 | `requireMember` moves to `core` and W5 | `core` owns `project_members` and no module may query another's tables (A-03). Rejected: keeping it in `auth` as an exception. Overrides the operator's earlier choice, at the operator's request | operator |
| SD10 | `rate_counters` rows are not cleaned up | AD-59 allows one atomic statement and guardrails forbid scheduled jobs; /64 grouping limits growth. Recorded as a Known Gap. Rejected: opportunistic deletes inside `hit` | AI, Attacker lens |
| SD11 | Registration codes are compared exactly, with no trimming | A code has one correct value. The UI trims the field before sending, to handle pasted spaces | AI, Tester lens |
| SD12 | Every request reaching the limiter counts, whatever its outcome | Simple and matches "counts an attempt". A shared-address lockout is accepted in the threat list | AI, Attacker lens |


---

# Requirements

## Functional
| ID | Requirement | Acceptance criterion |
|---|---|---|
| F1 | Verify the Firebase ID token on every protected route and `register` | Given a missing, malformed, expired or wrongly signed token, when such a route is called, then it returns 401 `UNAUTHENTICATED` and runs no handler |
| F2 | Load the caller's `users` row and refuse unregistered callers | Given a valid token with no row, when any protected route except `register` is called, then it returns 403 `USER_NOT_REGISTERED`; with a row, the role in context equals the stored role |
| F3 | `hit(key, windowSeconds, limit)` is an atomic fixed-window limiter | Given `limit` N, when N+1 calls run concurrently in one window, then exactly N are allowed and the rejected call has `retryAfterSeconds` between 1 and `windowSeconds` |
| F4 | `POST /api/auth/check-code` validates a role's code | Given the correct pair it returns 200 `{ "valid": true }`; given a wrong pair, 403 `REGISTRATION_CODE_INVALID`; over the limit, 429 `RATE_LIMITED` with `Retry-After` |
| F5 | `POST /api/auth/register` creates one user | Given a valid token, correct code and no row, it returns 201 `User`, with the email taken from the token and the role from the validated request |
| F6 | `GET /api/me` returns the caller | Given a registered caller it returns 200 `User`, matching the stored row |
| F7 | The sign-in and register screen works end to end | Given each flow in [ui.md](ui.md), with the Firebase SDK mocked, the user reaches that flow's stated result and each listed state shows its exact text |

## Non-functional
| ID | Requirement | Acceptance criterion |
|---|---|---|
| N1 | Secrets never appear in logs, errors or responses | Marker token, code and IP values sent through 200, 201, 400, 401, 403, 409, 413, 422, 429 and 500 paths appear in no captured log, response body or response header |
| N2 | Code comparison is constant-path | For short, long and empty inputs, both values are SHA-256 hashed and `timingSafeEqual` is called exactly once, shown with a spy. Timing itself is not measured |
| N3 | The raw client IP is never stored | Every `rate_counters` key for these endpoints is `ip:<64 hex characters>` and contains no IP text |
| N4 | The process refuses unsafe settings at startup | Each rule in the settings table of [conventions.md](conventions.md) has a test showing that startup fails with the setting's name and without its value |
| N5 | The role comes only from the validated `register` request and the `users` row | Given a decoded token containing a `role` claim, the adapter output has only `uid` and `email`; `GET /api/me` returns the stored role |
| N6 | Tests need no live Firebase or network | The suite passes offline, using an explicit fake settings map and a fake `TokenVerifier`; UI tests mock the Firebase SDK |
| N7 | The real verifier adapter rejects forged tokens | Running the real `firebase-admin` offline, tokens with `alg: none`, a wrong audience, a wrong issuer and a mangled body each give `InvalidToken` |
