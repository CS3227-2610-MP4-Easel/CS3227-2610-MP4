# Architecture — Authentication and registration

> Legend: `C` = project decision. `AD-nn` = architecture decision, recorded in [decision-log.md](../../../docs/architecture/decision-log.md). This area's **Now** is replaced wholesale when a branch changes it; the decisions table only grows.

## Now

`auth` is the workspace package `src/be/auth` (`@agile/auth`). `loadAuthSettings` validates `APP_TIER`, the Firebase project id, the three registration codes (13 to 128 characters, distinct, no demo codes on prod) and `RATE_KEY_SECRET` at module load and throws on unsafe values; `FIREBASE_AUTH_EMULATOR_HOST` is refused on every tier; a preview with no data settings starts with them null, and routes needing them return 500. `createFirebaseTokenVerifier` checks ID tokens with `firebase-admin` (no revocation check, AD-57); `createResolvePrincipal` turns a `Bearer` header into `{ firebaseUid, tokenClaims.email }` with the email lowercased, and `createLookupRegisteredUser` reads the role from `users`, never from a claim. `createHit` is the AD-59 fixed-window limiter over `@agile/db`'s `incrementRateCounter`; `clientIpKey` keys it by an HMAC of the purpose and the first `x-vercel-forwarded-for` value (IPv6 grouped to /64, anything invalid to `unknown`). `checkRegistrationCode` compares SHA-256 digests with `timingSafeEqual`; `createUser` maps a unique violation (P2002) to `AlreadyRegistered`; `getUser` returns only the `User` contract fields. `getAuthRuntime()` builds all of this once from `process.env` around one `PrismaClient`. The routes for endpoints 2 (`check-code`), 3 (`register`) and 4 (`me`) live in `src/be/api/src/routes/auth.ts`; 2 and 3 run a `before` hook that counts the attempt per client IP (20 a minute) and caps the body at 4 KiB before authorization or parsing. `requireMember` is not here: W5's `core` owns it (C48, C49). The sign-in screen is a follow-up (C46).

## Paths

| Path | Role |
|---|---|
| `src/be/auth/src/settings.ts` | settings validation per tier |
| `src/be/auth/src/token-verifier.ts`, `principal.ts` | Firebase token check, principal resolution, registered-user lookup |
| `src/be/auth/src/rate-limit.ts` | `hit()` and client-IP keys |
| `src/be/auth/src/registration.ts` | code check, `createUser`, `getUser` |
| `src/be/auth/src/runtime.ts` | process-wide `AuthRuntime` |
| `src/be/api/src/routes/auth.ts` | endpoints 2 to 4, the rate-limit and body-size hook, fixed-message body schemas |

## Decisions

Architecture decisions that shaped this area (`AD-nn`, full reasoning in the decision log). Project decisions (`C<n>`) are added here when they land.

| ID | Date | One-line decision | File |
|---|---|---|---|
| AD-03 | 2026-10-29 | Firebase Auth; role read from our database | [decision-log](../../../docs/architecture/decision-log.md) |
| AD-08 | 2026-10-29 | Registration codes per role per environment | [decision-log](../../../docs/architecture/decision-log.md) |
| AD-59 | 2026-10-29 | Limiter is a fixed-window counter table | [decision-log](../../../docs/architecture/decision-log.md) |
| AD-63 | 2026-10-29 | Codes at least 13 characters; demo codes for local and dev | [decision-log](../../../docs/architecture/decision-log.md) |
| C50 | 2026-10-31 | Tokens verified with `firebase-admin` | [C50](../decisions/C50.md) |
| C48 | 2026-10-31 | `requireMember` moves to `core` (W5) | [C48](../decisions/C48.md) |
| C51 | 2026-11-04 | `auth` is the package `src/be/auth` | [C51](../decisions/C51.md) |
| C45 | 2026-11-04 | `hit()`'s upsert lives in `@agile/db` | [C45](../decisions/C45.md) |
| C46 | 2026-11-04 | T7 (sign-in screen) moves to a follow-up spec and PR | [C46](../decisions/C46.md) |
| C49 | 2026-11-04 | W5, not W4, implements the membership resolvers | [C49](../decisions/C49.md) |

## Target Link and Drift

Realises [architecture §7, §9.1](../../../docs/architecture/agile-platform-architecture.md); work package A in [delivery-plan.md](../../../docs/architecture/delivery-plan.md). Drift: architecture §7 says a valid token belongs to a verified, enabled account; it does not (guardrails, Known Gaps). See [D14](../deviations/D14.md).
