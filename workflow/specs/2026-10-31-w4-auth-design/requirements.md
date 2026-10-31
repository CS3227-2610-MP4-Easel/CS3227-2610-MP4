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
