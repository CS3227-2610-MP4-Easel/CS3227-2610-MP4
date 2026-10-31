# Edge Cases and Non-Happy Paths

IDs are permanent: never reuse or renumber. E7 and E18 were retired when `requireMember` moved to W5. Every F requirement and every API error appears in at least one row.

## Input
| ID | Requirement | Scenario | Expected behaviour (exact) | Why it matters | Test layer |
|---|---|---|---|---|---|
| E1 | F1 | On `register` and a protected route: no header, wrong scheme, empty token, two `Authorization` headers, or a token of 4097 bytes | 401 `UNAUTHENTICATED`; verifier not called. `bearer` in lower case and a 4096-byte token do reach it | Rejects junk cheaply | service |
| E2 | F1 | Verifier rejects the token | 401 `UNAUTHENTICATED`, same message for every reason | Hides why it failed | service |
| E3 | F1 | Valid token whose `email` is absent, empty or not a string | 401 `UNAUTHENTICATED` | `users.email` is required | service |
| E4 | F5 | `displayName` is spaces only, 101 code points after trimming, or has a Cc or Cf character | 422 `VALIDATION_FAILED` with `details`; no row. 100 code points after trimming is accepted, and the trimmed value is stored | Keeps stored names clean | service |
| E16 | F4, F5 | Malformed JSON or wrong content type on 2 or 3 | 400 `BAD_REQUEST`; the attempt was counted | Bad requests cannot skip the limiter | service |
| E17 | F4, F5 | Unknown field, invalid `role`, `code` empty or 129 characters, or a value of the wrong JSON type | 422 `VALIDATION_FAILED`; the attempt was counted; `details` does not echo the value | Contract rule | service |
| E40 | F4, F5 | Body over 4 KiB on 2 or 3 | 413 `PAYLOAD_TOO_LARGE` | Limits the public surface | service |
| E41 | F5 | Token email `Foo@X.com` | Stored and returned as `foo@x.com` | One form for uniqueness | integration |
| E42 | F4 | Correct code with a leading space sent to the API | 403 `REGISTRATION_CODE_INVALID` | Exact comparison (SD11) | service |

## Permission
| ID | Requirement | Scenario | Expected behaviour (exact) | Why it matters | Test layer |
|---|---|---|---|---|---|
| E5 | F2 | Valid token, no row, on `GET /api/me` or any protected route | 403 `USER_NOT_REGISTERED`; handler not run | Firebase accounts alone get nothing | service |
| E6 | F2, N5 | Registered caller | Context role equals the row's role | Role has one source | service |
| E13 | F5 | Valid `DEVELOPER` code sent with role `PM` | 403 `REGISTRATION_CODE_INVALID`; no row | Blocks role escalation | service |
| E14 | N5 | Stubbed decoded token has a `role` claim | Adapter output has only `uid` and `email`; `verifyIdToken` was called with `checkRevoked` false | Role is ours (AD-03) | unit |
| E15 | F5 | Body has `email`, `firebaseUid` or `id` | 422 `VALIDATION_FAILED` | Identity comes from the token | service |
| E19 | F6 | Registered caller on `GET /api/me` | 200 `User` from the row, including when the token's email differs | Baseline | service |
| E20 | F4 | Correct pair on `check-code` | 200 `{ "valid": true }`; no `users` row written; the count still rises | Baseline | service |
| E21 | F4 | Wrong code on `check-code` | 403 `REGISTRATION_CODE_INVALID` | Baseline | service |
| E43 | F5 | Valid token, no row, correct code on `register` | 201 `User`; `USER_NOT_REGISTERED` is not returned | The token-without-row rule | service |
| E38 | F4 | Cross-origin request to `check-code` | No `Access-Control-Allow-Origin` in the response | Same origin only | service |
| E39 | F7 | `displayName` containing `<script>` | Accepted, and shown as plain text | No script injection | UI |

## Concurrency and limits
| ID | Requirement | Scenario | Expected behaviour (exact) | Why it matters | Test layer |
|---|---|---|---|---|---|
| E8 | F3 | 21 concurrent `hit` calls with limit 20 on real Postgres | Exactly 20 allowed; the other has `retryAfterSeconds` from 1 to the window | Atomic admission (AD-59) | integration |
| E9 | F4, F5 | 21st attempt in a minute from one IP, mixing successes and failures, including one with a bad token on `register` | 429 `RATE_LIMITED`, not 401, with integer `Retry-After` equal to `retryAfterSeconds` | Brute-force control | service |
| E10 | F3 | `window_start` backdated to exactly `windowSeconds` ago, in SQL | `count` resets to 1 and the call is allowed | Windows must reopen | integration |
| E11 | F4 | Local run: header absent, empty, or an invalid value, and a client-sent `x-forwarded-for` | Bucket `unknown`; `x-forwarded-for` has no effect | Limiter cannot be escaped by header | service |
| E12 | F4, F5 | Different purpose same IP; same purpose different IP; different `hit` keys | Separate buckets in all three | One flow cannot exhaust another | service |
| E22 | F5 | Two concurrent `register` calls for one uid, and for two uids sharing one email | One 201, one 409 `ALREADY_REGISTERED`, one row | Unique indexes decide | integration |
| E23 | F5 | Second uid with an already registered email in a different case | 409 `ALREADY_REGISTERED`; no second row | One account per email | integration |
| E26 | F5 | Same uid registers again with a correct code | 409 `ALREADY_REGISTERED`; the row is unchanged | Role is set once | integration |
| E27 | F5 | Registered uid sends a wrong code | 403 `REGISTRATION_CODE_INVALID` | Code is checked first | service |
| E35 | F3 | Calls past the limit | `count` keeps rising and `allowed` stays false | Over-limit never admits | integration |
| E37 | F4 | Two addresses in one IPv6 /64, `::ffff:1.2.3.4` and `1.2.3.4`, and upper and lower case forms | Each pair shares one bucket | Stops address rotation | unit |
| E44 | F3 | `hit` with an empty or 201-character key, or a `windowSeconds` or `limit` of 0, negative or non-integer | `RangeError`; no database call | Programmer errors fail early | unit |

## Failure
| ID | Requirement | Scenario | Expected behaviour (exact) | Why it matters | Test layer |
|---|---|---|---|---|---|
| E24 | N4 | One test per settings rule: 12 and 129 character codes, duplicate codes, a demo code on prod, a 31-character secret, the emulator variable on each tier, a missing or unknown tier | Startup fails naming the setting, without its value. 13 and 128 character codes and a 32-character secret pass, and demo codes pass on dev | Unsafe deploy cannot run | unit |
| E25 | N1, N3 | Marker values through every path listed in N1 | Marker token, code and IP absent from logs, bodies, headers and `rate_counters` keys | Secrets stay out | integration |
| E28 | F3, F4 | Database failure in `hit` | 500 `INTERNAL`; the request is not admitted | Limiter fails closed | service |
| E29 | F1 | `VerifierUnavailable` | 500 `INTERNAL`, not 401 | Outage must not look like signing out | service |
| E30 | N2 | Comparison with short, long and empty values | Spy shows both hashed and `timingSafeEqual` called once; result 403 | No length shortcut | unit |
| E31 | N6 | Suite offline with the fake settings map | Suite passes | CI has no Firebase dependency | integration |
| E36 | N7 | `alg: none`, wrong audience, wrong issuer and mangled tokens on the real adapter | `InvalidToken` for each | Proves the real check | unit |
| E45 | F1 | Adapter receives `auth/id-token-expired`, `auth/argument-error`, `auth/internal-error`, an unknown `auth/` code, and a plain `Error` | `InvalidToken`, `InvalidToken`, `VerifierUnavailable`, `InvalidToken`, `VerifierUnavailable` | Mapping must be exact | unit |
| E46 | F2, F6 | Database failure in `loadUser`, including on `GET /api/me` | 500 `INTERNAL` | Fails closed | service |
| E47 | F5 | Insert fails for a reason other than a unique violation | 500 `INTERNAL`; no row | Only duplicates are 409 | service |
| E48 | F4, F5, F6 | Any response, including errors | `X-Request-Id` present | Contract rule | service |
| E49 | F4 | Deployed tier with the IP header missing | Bucket `unknown`, and `client_ip_missing` logged | A misconfiguration stays visible | service |
| E50 | F2 | Preview tier with auth settings absent | Routes needing them return 500 `INTERNAL`; startup succeeds | Mock previews still build | service |

## UI
| ID | Requirement | Scenario | Expected behaviour (exact) | Why it matters | Test layer |
|---|---|---|---|---|---|
| E32 | F7 | New user with a valid code | Reaches `/projects` | Main path | UI |
| E33 | F7 | Firebase signup succeeded, `register` failed, user returns and signs in | Register fields appear and registration completes | No stranded accounts | UI |
| E34 | F7 | 429 on the screen, using fake timers | Message shows N and submit stays disabled for N seconds | Avoids burning attempts | UI |
| E51 | F7 | Returning user signs in; then signs out | Reaches `/projects`; then `/sign-in` | Baseline | UI |
| E52 | F7 | 403 code, 409, 422 and network or 500 responses | Each shows its exact text from `ui.md`, with `requestId` on 500 | States are specified | UI |
| E53 | F7 | Firebase returns `auth/email-already-in-use` | Message and a "Sign in instead" action | Recovery path | UI |
| E54 | F7 | 401 on any page | Redirect to `/sign-in` | Expired sessions | UI |
| E55 | F7 | After registration | Code is absent from browser storage and the URL | Secret handling | UI |

## What could corrupt data (High tier)
- A wrong role stored permanently, since no edit path exists: guarded by the code check against the requested role (E13).
- Two rows for one person: guarded by unique `firebase_uid` and lowercased unique `email` (E22, E23).
- A failed `register` leaving part of a user: it is one insert, so nothing partial exists (E47).
- Limiter counters drifting across clocks: only the database clock is used (E10).
