# Conventions

Applies `conventions/general.md`; only additions and W4-specific applications are listed.

## Placement
| Path | Holds |
|---|---|
| `packages/api/auth/` | middleware, `TokenVerifier`, code check, `hit`, auth settings |
| `packages/api/auth/routes/` | one file per endpoint |
| `apps/web` | the wired screen and a token helper; the exact folder follows W1 and W10 |

## Settings
Settings are read by a pure function over an env map, run at module load in every serverless entry point. A failure stops startup, naming the setting and never its value. These add to the AD-53 assertions.

The tier comes from W1's tier setting: `local`, `dev`, `preview`, `prod` or `test`. A missing or other value fails startup. Tests pass an explicit map with fake values and tier `test`, and never read the real environment.

| Setting | Tiers | Rule |
|---|---|---|
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

## Seams W1 must provide
- A way to mount `authenticate` and `loadUser` ahead of the policy gate.
- Route-level middleware that runs before body validation.
- Policy-map entries for endpoints 2 to 4, including the access levels public and token-without-row.
- The error codes used in [api.md](api.md), including `PAYLOAD_TOO_LARGE`.
- The `users` and `rate_counters` tables, and the tier setting.

## Seams for later workstreams
- W5: endpoint 10 must lowercase an email before looking it up, and W5 owns `requireMember`.
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
| Unregistered account | Reach application routes | `loadUser` before the gate | E5 |
| Teammate or agent | Ship with the emulator variable set | Startup assertion on every tier | E24 |
| Log reader | Read tokens, codes or IPs | Bodies and headers not logged; IP stored only as HMAC | E25 |
| Third-party site | Call `check-code` from a visitor's browser | No CORS headers; same origin only | E38 |
| Registered user | Plant script or prompt text in `displayName` | Plain-text rendering (A-15); untrusted under AD-25 | E39 |
| Holder of a code, known gap | Register an unverified email they do not own | Accepted under AD-57 | none |
| Disabled user, known gap | Use a token until it expires, up to 1 hour | Accepted under AD-57 | none |
