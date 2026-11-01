# UI

W4 connects the W10 sign-in and register screen to Firebase and the API. Layout, tokens and copy not listed here come from the W10 mockup. It lives in `apps/web` and never imports `packages/db` (AD-01b). The sign-in route is `/sign-in` and the projects route is `/projects`.

## Flows
| Flow | Sequence | Success |
|---|---|---|
| New user | enter role, code, display name, email and password -> `check-code` -> Firebase `createUserWithEmailAndPassword` -> `register` | redirect to `/projects` |
| Returning user | enter email and password -> Firebase `signInWithEmailAndPassword` -> `GET /api/me` | redirect to `/projects` |
| Firebase account with no row | sign-in, then `GET /api/me` gives 403 `USER_NOT_REGISTERED` -> show role, code and display name -> `check-code` -> `register` | redirect to `/projects` |
| Sign out | Firebase `signOut` | redirect to `/sign-in` |

The code field is trimmed before it is sent.

## States
| State | Shown |
|---|---|
| Loading | submit disabled, with a progress indicator, until the current request ends |
| 403 `REGISTRATION_CODE_INVALID` | "Code not accepted." on the code field |
| 429 `RATE_LIMITED` | "Too many attempts. Try again in N seconds.", with N from `Retry-After`; submit stays disabled for N seconds |
| 409 `ALREADY_REGISTERED` | "This account is already registered. Sign in instead." |
| 422 `VALIDATION_FAILED` | each `details` message on its field |
| Firebase `auth/email-already-in-use` | Firebase's message, plus a "Sign in instead" action that opens the returning-user form |
| Other Firebase error | Firebase's own message as returned (architecture §13) |
| 401 on any page | redirect to `/sign-in` |
| Network or 500 | "Something went wrong." with a retry action, and the `requestId` when present |

## Token handling
Requests use `getIdToken()` from the Firebase SDK, which refreshes expired tokens itself, and default SDK storage (A-15). The token is sent only in the `Authorization` header. The role shown in navigation comes from `GET /api/me`, and hiding a control is never the security check.

The code stays in component state only until `register` finishes. It is not stored in the browser or put in a URL.

## Role visibility
The screen is the same for all roles and for signed-out visitors. Display names are rendered as plain text (A-15).
