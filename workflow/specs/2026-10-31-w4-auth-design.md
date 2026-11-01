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
