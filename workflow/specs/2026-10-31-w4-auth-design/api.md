# API

Common rules: errors use the AD-33 envelope; every response has `X-Request-Id`; unknown body fields and wrong JSON types give 422 `VALIDATION_FAILED`, and `details` never echoes a submitted value; malformed JSON or a wrong content type gives 400 `BAD_REQUEST`; a body over 4 KiB on endpoints 2 or 3 gives 413 `PAYLOAD_TOO_LARGE`; an unexpected failure, including a database failure, gives 500 `INTERNAL` with only the `requestId`. No CORS headers are sent: the API is same-origin only.

Pipeline order per route (each step can stop the request):

| Route | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|
| `check-code` | request id | IP limiter | policy gate (public) | body validation | code check | - |
| `register` | request id | IP limiter | token check | policy gate (token-without-row) | body validation | code check, then insert |
| `me` and all other protected routes | request id | token check | user lookup | policy gate | handler | - |

`Retry-After` is an integer number of seconds equal to `retryAfterSeconds`.

## POST /api/auth/check-code (endpoint 2)
| Field | Definition |
|---|---|
| Caller and principal | public, no token |
| Authorization rule | none; limited per client IP in route-level middleware |
| Tenancy scope | none; reads no user data |
| Inputs | `role`: `PM`, `DEV_LEAD` or `DEVELOPER`. `code`: string, 1 to 128 characters, compared exactly. Failure: 422 |
| Outputs | 200 `{ "valid": true }` |
| Errors | wrong code -> 403 `REGISTRATION_CODE_INVALID`; over limit -> 429 `RATE_LIMITED` with `Retry-After` |
| Idempotency | no state except the attempt count; a success does not reset it |
| Transaction boundary | the single `hit` statement |
| Events / audit | none |
| Logging | request id, status, error code. Never the body or client IP |
| Compatibility | new |

## POST /api/auth/register (endpoint 3)
| Field | Definition |
|---|---|
| Caller and principal | any valid token; a `users` row is not required, and a caller with a row is not stopped before the insert |
| Authorization rule | correct code for the requested role, checked here as the final authority |
| Tenancy scope | writes only the caller's own row; `firebase_uid` and `email` come from the token |
| Inputs | `role` and `code` as above. `displayName`: trimmed, then 1 to 100 Unicode code points, with no Unicode control or format characters (categories Cc and Cf); the trimmed value is stored. Failure: 422 |
| Outputs | 201 `User`: `id`, `email`, `displayName`, `role` |
| Errors | no or invalid token -> 401 `UNAUTHENTICATED`; wrong code -> 403 `REGISTRATION_CODE_INVALID`; uid or email already present -> 409 `ALREADY_REGISTERED`; over limit -> 429 `RATE_LIMITED` with `Retry-After` |
| Idempotency | a repeat gives 409; the code check runs first, so 409 is only visible to someone holding a valid code |
| Transaction boundary | one insert; a unique violation on either `firebase_uid` or `email` is the 409, with no prior select; any other insert failure is 500 |
| Events / audit | none |
| Logging | as endpoint 2 |
| Compatibility | new |

## GET /api/me (endpoint 4)
| Field | Definition |
|---|---|
| Caller and principal | any registered user |
| Authorization rule | policy map entry, roles all |
| Tenancy scope | the caller's own row, found by token `sub` |
| Inputs | none |
| Outputs | 200 `User`, from the stored row, even if the token's email differs |
| Errors | 401 `UNAUTHENTICATED`; no row -> 403 `USER_NOT_REGISTERED` |
| Idempotency | read only |
| Transaction boundary | none |
| Events / audit | none |
| Logging | request id, status, error code |
| Compatibility | new |

## authenticate (middleware)
| Field | Definition |
|---|---|
| Caller and principal | every route except health and `check-code` |
| Authorization rule | none; establishes identity |
| Tenancy scope | none |
| Inputs | One `Authorization` header: `Bearer`, case-insensitive, one or more spaces, then a token of at most 4096 bytes. Anything else -> 401 without calling the verifier |
| Outputs | request context `principal: { uid, email }`, with `email` lowercased |
| Errors | missing, malformed, invalid or expired token, or an `email` claim that is absent, empty or not a string -> 401 `UNAUTHENTICATED`; `VerifierUnavailable` -> 500 `INTERNAL` |
| Idempotency | yes |
| Transaction boundary | none |
| Events / audit | none |
| Logging | never the token or header; the failure reason only as a fixed label |
| Compatibility | W1 mounts it before the policy gate |

## loadUser (middleware)
| Field | Definition |
|---|---|
| Caller and principal | every route using `authenticate`, except `register` |
| Authorization rule | no row -> 403 `USER_NOT_REGISTERED` |
| Tenancy scope | looks up by `principal.uid` only |
| Inputs | `principal` |
| Outputs | request context `user: { id, email, displayName, role }` |
| Errors | as the rule; database failure -> 500 `INTERNAL` |
| Idempotency | read only |
| Transaction boundary | none |
| Events / audit | none |
| Logging | request id, status, error code |
| Compatibility | the policy gate reads `user.role`; gateway calls build `caller` from `user` |

## TokenVerifier.verify(token): Promise<{ uid, email | null }>
| Field | Definition |
|---|---|
| Caller and principal | `authenticate`, and tests through a fake |
| Authorization rule | production adapter calls `firebase-admin` `verifyIdToken(token, false)`, with the app initialised from `FIREBASE_PROJECT_ID` and no service account key |
| Tenancy scope | tier-specific: the project id fixes the accepted issuer and audience |
| Inputs | token string |
| Outputs | `sub` as `uid`, and the `email` claim when it is a non-empty string, else null. No other claim leaves the adapter |
| Errors | `auth/internal-error` and any error without an `auth/` code -> `VerifierUnavailable`; every other `auth/` code -> `InvalidToken` |
| Idempotency | yes |
| Transaction boundary | none |
| Events / audit | none |
| Logging | none |
| Compatibility | tests pass the fake directly; no setting selects it |

## hit(key, windowSeconds, limit): Promise<{ allowed, retryAfterSeconds }>
| Field | Definition |
|---|---|
| Caller and principal | server code: W4 routes and the W2 gateway |
| Authorization rule | none; not reachable from a request directly |
| Tenancy scope | by key |
| Inputs | `key`: 1 to 200 characters. `windowSeconds` and `limit`: positive integers. Otherwise throws a `RangeError` before touching the database |
| Outputs | `allowed` is true when the post-increment count is at most `limit`. `retryAfterSeconds` is 0 when allowed; otherwise the window's remaining seconds by the database clock, rounded up, between 1 and `windowSeconds` |
| Errors | database failure propagates, so callers fail closed with 500 |
| Idempotency | no; each call counts, including rejected calls |
| Transaction boundary | one atomic statement, using the database clock, that also returns the count and remaining time (AD-59). A window has elapsed when now is at or after `window_start + windowSeconds` |
| Events / audit | none |
| Logging | none; callers must not log keys |
| Compatibility | fixed signature for W2; W2 maps a rejection to `AI_BUSY` |
