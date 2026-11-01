# Branch State — w4-auth

**What this branch has changed, and how to pick it up.** `workflow/project-state/STATE.md`
describes `INT`; read it for context and write here instead of editing it.
`sync-project-state` folds this file in after the branch merges.

- **Branch:** w4-auth (from `INT` at `0dbbdcb`)
- **Base:** 0dbbdcb
- **Owner:** ludannnn (Developer member)
- **Status:** Draft
- **Approved:** —
- **Last updated:** 2026-10-31 by Claude Opus 5.5 — branch state created, spec started

**Untouched:** Architecture, Conventions, Deviations

---

**Scope.** W4 Auth and registration: endpoints 2, 3 and 4, plus the Firebase token check, on top of the W1 foundation. This branch currently holds the spec only; code waits for W1.

---

## 1. How to Resume

**Sessions**

| Session | Started | Agent(s) | Workstream | Status | Doing | Next action | Last touched |
|---|---|---|---|---|---|---|---|
| S1 | 2026-10-31 22:13 | Claude Opus 5.5 | W4 | Paused | Spec approved; waiting for W1 | Once W1 merges, merge `INT` in, draft interface stubs (`drafting-interfaces`), then run `writing-plans-lite` against the real paths; done when gate 2 is asked | 2026-10-31 22:13 |

**Remaining**

- [ ] Plan, interface stubs and tests; all need the W1 monorepo, because plan paths must be real.
- [ ] Operator to decide whether T7 becomes a follow-up PR, so T1 to T6 can merge before the screen; proposed and held on 2026-10-31. The approved spec keeps T7 in W4, so this would be an amendment.
- [ ] Ask the PM whether W10 delivers a working sign-in page or a design only.
- [ ] Agree with the Dev Lead the W1 seams listed in the spec's `conventions.md`.
- [ ] **Handover:** correct architecture §7, which says a valid token always belongs to a verified, enabled account. Firebase does not guarantee that; see Known Gaps.
- [ ] **Handover:** tell the Dev Lead that W5 now owns `requireMember`, and that endpoint 10 must lowercase emails before lookup.
- [ ] **Handover:** W13 smoke checks on the deployed tiers: a forged `x-vercel-forwarded-for` must not change the limiter bucket, and a token from another Firebase project must get 401. `RATE_KEY_SECRET` must differ between dev and prod.
- [ ] **Handover:** add `REGISTRATION_CODE_*` and `RATE_KEY_SECRET` per tier in W13, and confirm `firebase-admin` verifies with only a project id on Vercel. Firebase's verify-token page says a service account is needed; if the smoke test fails, record a Deviation.

---

## 2. Workstreams

| ID | Workstream | Status | Spec | Plan | Progress | Guide |
|---|---|---|---|---|---|---|
| W4 | Auth and registration | Spec'd | [spec](../../specs/2026-10-31-w4-auth-design.md) | — | Spec approved; plan waits for W1 | — |

---

## 3. Changes

| Date | What changed | Workstream | Ref |
|---|---|---|---|
| 2026-10-31 | W4 auth spec written, reviewed and approved | W4 | this commit |

---

## 6. Known Gaps

Changes the guardrails entry **Email verification and disabling users**; AD-57 stays.

- **Unverified email at registration** — Firebase issues tokens to unverified emails unless blocking functions are set up, so someone holding a registration code could register an email they do not own (AD-57).
- **Disabled users keep access until token expiry** — a disabled user's ID token works for up to 1 hour, because revocation is not checked (AD-57).

New entry:

- **`rate_counters` rows are never cleaned up** — one row per key, with no scheduled jobs to remove them; IPv6 /64 grouping limits growth, and rows can be cleared by hand.

## 7. Decisions

> Legend: `C` = project decision. AD-nn entries are in docs/architecture.

### C~1 — The token check belongs to W4, not W1

- **Date:** 2026-10-31
- **Who asked:** operator (ludannnn, Developer member), who told the team they will take it
- **Supersedes:** the `packages/api` token-check entry in `architecture/foundation.md` Now, for who builds it
- **Why:** the docs named it in both W1 (API skeleton) and W4, so it could be built twice or missed.
- **Rejected:** leaving it in W1.

### C~2 — W4 scope includes user lookup, `hit()` and the sign-in screen wiring

- **Date:** 2026-10-31
- **Who asked:** operator (ludannnn), choosing the recommended options
- **Why:** the architecture puts these helpers in `auth`, and no workstream named who wires the screen.
- **Rejected:** leaving user lookup in W1; the PM wiring the screen in W10.

### C~5 — `requireMember` moves from `auth` to `core`, built in W5

- **Date:** 2026-10-31
- **Who asked:** operator (ludannnn), after the Maintainer review found the collision; reverses their earlier choice to keep it in W4
- **Supersedes:** the `requireMember` entry in architecture §4's `auth` row and `architecture/auth.md`
- **Why:** `core` owns `project_members`, `conventions/general.md` forbids querying another module's tables, and architecture §4 already says it runs inside `core`.
- **Rejected:** keeping it in `auth` as a recorded exception.

### C~3 — Tokens are verified with `firebase-admin`

- **Date:** 2026-10-31
- **Who asked:** operator (ludannnn), choosing the recommended option; architecture §7 left the library to this spec
- **Why:** vendor-maintained key rotation and claim checks suit a security boundary.
- **Rejected:** `jose`, because we would own every check.

### C~4 — AD-57 kept despite its Firebase assumption being wrong

- **Date:** 2026-10-31
- **Who asked:** operator (ludannnn), asked keep or reverse under AGENTS.md §4
- **Why:** registration still needs a code, and the deadline is tight. See Known Gaps.
- **Rejected:** reversing it for email only, or for email and revocation.
