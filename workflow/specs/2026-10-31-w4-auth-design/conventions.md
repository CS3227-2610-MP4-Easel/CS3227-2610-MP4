# Conventions

Applies `conventions/general.md`; only additions and W4-specific applications are listed.

## Placement
| Path | Holds |
|---|---|
| `src/be/auth` (`@agile/auth`, new workspace package) | `resolvePrincipal`, `lookupRegisteredUser`, `TokenVerifier`, code check, `hit`, user creation and lookup, auth settings (C~9) |
| `src/be/db` | the one raw `rate_counters` statement that `hit` calls (C~10) |
| `src/be/api/src/routes/auth.ts` | the three thin `RouteDefinition`s and their `before` hooks, appended to `ROUTES` |
| `src/be/api/src/app.ts` | wires `@agile/auth` into `createApiApp(deps)` |
| `src/fe` | the wired screen and a token helper; the exact folder follows W10 |

`src/be/api` may not import `@agile/db` or run raw SQL (`src/be/api/test/import-rules.test.ts`), so every table access goes through `@agile/auth`.

## Settings
Settings are read by a pure function over an env map, run at module load in every serverless entry point. A failure stops startup, naming the setting and never its value. These add to the AD-53 assertions.

The tier comes from `APP_TIER`, which W4 defines until a shared settings module exists (C~7): `local`, `dev`, `preview`, `prod` or `test`. A missing or other value fails startup. Tests pass an explicit map with fake values and tier `test`, and never read the real environment.

| Setting | Tiers | Rule |
|---|---|---|
| `APP_TIER` | all | one of the five tiers |
| `FIREBASE_PROJECT_ID` | local, dev, prod, test | present |
| `REGISTRATION_CODE_PM`, `REGISTRATION_CODE_DEV_LEAD`, `REGISTRATION_CODE_DEVELOPER` | local, dev, prod, test | each 13 to 128 characters; all three different |
| Same three | prod | none equals `PROJ_MANAGER_DEMO`, `DEV_LEAD_DEMO` or `DEVELOPER_DEMO` |
| `RATE_KEY_SECRET` | local, dev, prod, test | at least 32 characters |
| `FIREBASE_AUTH_EMULATOR_HOST` | all | must be unset, because the Admin SDK then accepts unsigned tokens |

Previews other than dev run in mock mode with no data credentials (AD-53), so these settings are not required there; when they are absent, every route that needs them returns 500 `INTERNAL`.

`RATE_KEY_SECRET` must differ between dev and prod. One process cannot see this, so it is a W13 deploy-checklist item.

## Rate-limit keys
Key format: `ip:<hex HMAC-SHA256>`, keyed by `RATE_KEY_SECRET`, over `<purpose>:<ip>`, where purpose is `check-code` or `register`. Window 60 seconds, limit 20.

Client IP: the first comma-separated value of `x-vercel-forwarded-for`, trimmed. An IPv4-mapped address is unwrapped. An IPv6 address is reduced to its /64 prefix in canonical lowercase form. If the header is absent, empty, or not a valid IP, the literal `unknown` is used, so those requests share one bucket; on dev and prod this also logs the fixed label `client_ip_missing`.

## Seams from W1
Provided by W1 and used as they are:
- `AuthDependencies.resolvePrincipal` and `lookupRegisteredUser`, which `authorizeRequest` calls before the policy gate; W1 maps the errors `UNAUTHENTICATED` to 401 and `USER_NOT_REGISTERED` to 403.
- Policy-map entries for endpoints 2 to 4, with auth states `PUBLIC`, `TOKEN` and `REGISTERED`.
- The error codes used in [api.md](api.md), including `PAYLOAD_TOO_LARGE`.
- The `users` and `rate_counters` tables.

Added by W4 in task T0, both optional so existing routes are unchanged (C~6; the Dev Lead reviews it):
- `RouteDefinition.before?: (c: { requestId: string; request: Request }) => Promise<Response | void>` (the raw request, so the hook can read headers and a clone of the body), run by `registerRoute` before `authorizeRequest`; a returned `Response` ends the request with that response plus `X-Request-Id`.
- `ApiContext.identity?: { firebaseUid: string; email: string }`, set for `TOKEN` routes from `resolvePrincipal`'s result; `principal` stays registered-only.

Not provided by W1, so W4 adds them: the tier setting (C~7) and a home for module code (C~9).

## Seams for later workstreams
- W5: endpoint 10 must lowercase an email before looking it up, and W5 owns `requireMember` and the membership and member-project-set resolvers that W1's handover listed under W4 (C~8).
- W2: treats `displayName` as untrusted text if it ever enters a prompt (AD-25).

## Tests
Use a fake `TokenVerifier` for middleware and route tests (N6), and the real `firebase-admin` offline for N7. The authorisation suite generated from the policy map is W11's; W4 tests the auth behaviour in [edge-cases.md](edge-cases.md). Every test cites its `E` ID. Tests clear `rate_counters` between cases, because they share a bucket. Tests of concurrency use a real Postgres with a pool of at least 21 connections. Window tests backdate `window_start` in SQL.

## Threat list
| Actor | Abuse | Mitigation | Test |
|---|---|---|---|
| Anonymous | Guess a code | Limit per IP, long random production codes | E9, E35 |
| Anonymous | Forge a token | `firebase-admin` signature, issuer and audience checks; a cross-project token is checked on dev by W13 | E36, E2 |
| Anonymous | Spoof the IP to escape the limiter | Vercel-set header (SD5); W13 sends a forged header to the deployed tiers and confirms the bucket does not change | E11 |
| Anonymous | Rotate IPv6 addresses to escape the limiter | /64 grouping | E37 |
| Anonymous | Lock out everyone behind a shared address | Accepted: costs availability for up to 60 seconds, not integrity (SD12) | E9 |
| Anonymous | Fill `rate_counters` with new keys | Accepted Known Gap (SD10); /64 grouping raises the cost | E37 |
| Holder of a low-role code | Register with a higher role | Code is checked against the requested role | E13 |
| Signed-in user | Set their role through a claim or body field | Claims dropped by the adapter; unknown fields rejected | E14, E15 |
| Unregistered account | Reach application routes | `lookupRegisteredUser` before the gate | E5 |
| Teammate or agent | Ship with the emulator variable set | Startup assertion on every tier | E24 |
| Log reader | Read tokens, codes or IPs | Bodies and headers not logged; IP stored only as HMAC | E25 |
| Third-party site | Call `check-code` from a visitor's browser | No CORS headers; same origin only | E38 |
| Registered user | Plant script or prompt text in `displayName` | Plain-text rendering (A-15); untrusted under AD-25 | E39 |
| Holder of a code, known gap | Register an unverified email they do not own | Accepted under AD-57 | none |
| Disabled user, known gap | Use a token until it expires, up to 1 hour | Accepted under AD-57 | none |
