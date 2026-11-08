# W4 Sign-in Screen Design

- **Status:** Approved (ludannnn, 2026-11-08)
- Amended 2026-11-08: see branch state C~5 (`@firebase/app` and `@firebase/auth` instead of `firebase`)
- **Format:** v2
- **Risk tier:** High - it replaces the prototype's sign-in with real authentication in the browser, handles registration codes and decides which tiers may skip sign-in.
- **Workstream:** W4 (T7 follow-up, C46) | **Plan:** pending (`writing-plans-lite-v2` after Gate 1)
- **Constraints consulted:** AD-01b, AD-03, AD-32, AD-55, AD-57, A-15, C8, C46, C47, C50; W4 spec SD6, SD8, SD11, SD18, [ui.md](2026-10-31-w4-auth-design/ui.md), [follow-up-t7.md](2026-10-31-w4-auth-design/follow-up-t7.md); guardrails Known Gaps (unverified email, disabled users); `architecture/auth.md`; contracts.md rows 2-4; [branch state](../project-state/branch-states/w4-sign-in-screen.md) C~1 to C~4

## 1. Problem
Current: `src/fe` signs people in with a stand-in. `app/api/as/route.ts` writes a `role` cookie chosen from three buttons, `app/[[...slug]]/page.tsx` treats any `role` cookie as signed in and picks screens by it, and the sign-in and register screens (`components/canvas/Main.tsx`, `Register.tsx`, `RegisterAccount.tsx`, `RegisterFinish.tsx`) are static canvases whose buttons link to `/api/as`. `/api/as` also redirects to `to=/\evil.com` (its check passes `/\`). Endpoints 2-4 are merged (PR #10) but nothing in the browser calls them, and `src/fe` has no Firebase SDK and no test runner.

Desired: on any tier with Firebase configured, people sign in, register and sign out with Firebase and endpoints 2-4; pages need a Firebase session; the role and identity shown come from `GET /api/me`; a shared fetch helper attaches the ID token for later workstreams. Mock previews without Firebase keep the role buttons (C~3). All three roles and every later feature that calls the API depend on this.

## 2. Goals
**Functional**
- F1 Auth mode - the server picks one of three modes and hands it to the client - Accept: E56-E59, E84-E87.
- F2 Shared API client - `apiFetch` sends the ID token only to same-origin `/api/` paths and turns error bodies into `ApiError` - Accept: E60-E65, E88-E93.
- F3 Session gate - in `firebase` mode every non-public route waits for Firebase, then `GET /api/me`, and renders the screen for the returned role - Accept: E54, E66-E70, E94-E99.
- F4 Sign-in - the returning-user flow of ui.md works - Accept: E51, E71, E72.
- F5 Register - the new-user and finish-setup flows of ui.md work, with the code held in component state only - Accept: E32-E34, E39, E52a-E52h, E53, E55, E73-E76, E80, E81, E100-E104.
- F6 Sign-out and identity - the top bar shows the `/api/me` user and its Sign out button ends the Firebase session - Accept: E51, E77, E105.
- F7 UI test runner - `src/fe` tests run with Vitest under root `npm test` - Accept: E82.

**Non-functional**
- N1 The `src/fe` suite runs inside root `npm test` on Node 20.19.5 (the CI version) with no network access - Accept: the CI `workspace` job runs it, it finishes in under 60 s, and it passes with `APP_TIER=test` and any `NEXT_PUBLIC_*` in the ambient environment (E82).
- N2 No secret enters the repo or the client bundle - Accept: browser modules read only the four `NEXT_PUBLIC_FIREBASE_*` names, literally; `src/fe/.env.example` has empty values; `npm run scan:secrets` passes (E83).
- N3 In `firebase` mode no code path reads the `role` cookie, a token claim or browser storage to decide the role - Accept: E66.

## 3. Non-goals
- Wiring other screens to the API - each feature's own follow-up (W9 C~1 for S20/S18, others per owner); they keep fixtures here.
- Email verification, revocation, password reset, social sign-in - AD-57, C47, W4 SD8.
- Server-side sessions, auth cookies or server rendering of user data - the API is the security boundary (AD-55); pages show fixtures only.
- Playwright or browser end-to-end tests - C~4.
- Redesigning the screens - layout comes from the W10 canvases; copy listed here or in ui.md wins over canvas text (SD7).
- Changing `.github/workflows/ci.yml` or the CI Node version - W12's files (SD5, SD6).

## 4. Design
### 4.1 Approach
The server decides the mode (`authMode`, server-only) and `layout.tsx` passes it to a client `AuthRoot`, which provides `AuthModeCtx` and, in `firebase` mode, mounts `SessionProvider`. `page.tsx` keeps the `/` redirect, keeps today's cookie logic in `prototype` mode, and otherwise renders the client `AuthGate` with `pathname` and `view` as props. `AuthGate` resolves the screen with the existing client-safe `resolve()` and `Screen`. `/sign-in` and `/register` render new live components (`components/live/sign-in.tsx`, `components/live/register.tsx`) reusing the canvas markup and classes. All Firebase calls go through `lib/auth/firebase.ts`; all hard navigations through `lib/auth/navigate.ts`; soft navigations use `useRouter().replace` from `next/navigation` inside `useEffect`, never during render.

### 4.2 Data model
None: no tables or persisted client data. The Firebase SDK keeps its own session in default browser storage (A-15); the app stores nothing.

### 4.3 Interfaces
**Mode table.** `authMode(env)` in `lib/auth/mode.ts` is called only from server files; no `'use client'` file imports it (source scan, rule six). Each value is trimmed; an empty result counts as absent. `APP_TIER` is compared exactly (lower case). `firebaseSet` = all four of `NEXT_PUBLIC_FIREBASE_API_KEY`, `_AUTH_DOMAIN`, `_PROJECT_ID`, `_APP_ID` present.

| Condition (first match wins) | Mode |
|---|---|
| `firebaseSet` | `firebase` |
| `APP_TIER === 'preview'`, none of the four present, `VERCEL_ENV !== 'production'` | `prototype` |
| anything else | `unconfigured` |

| Operation | Caller / role | Inputs (validation, limits) | Outputs | Errors (condition -> type/message) | Notes |
|---|---|---|---|---|---|
| `authMode(env: Record<string, string \| undefined>): AuthMode` (`'firebase' \| 'prototype' \| 'unconfigured'`) | `layout.tsx`, `page.tsx`, `app/api/as/route.ts` | env object; callers pass `process.env` | mode per table | none | pure |
| `GET /api/as?role=&to=` (existing) | anyone | `role` as today; `to` is used only if `new URL(to, request.url).origin` equals the request origin and `to` starts with `/`, else `/projects` | `prototype`: as today (cookie set or deleted, 307 redirect) | mode not `prototype` -> 404, empty body, no `Set-Cookie` | only route that writes `role` |
| `AuthRoot({ mode, children })`, `useAuthMode(): AuthMode` (`lib/auth/mode-context.tsx`, client) | `layout.tsx`; any client component | mode from the server | context value; `useAuthMode()` outside `AuthRoot` returns `'prototype'` | if mode is `firebase` and `firebaseConfigured()` is false, renders the `unconfigured` text instead of children | mounts `SessionProvider` only in `firebase` mode |
| `lib/auth/firebase.ts`: `firebaseConfigured(): boolean`, `currentUser(): FbUser \| null`, `onUserChanged(cb): () => void`, `signIn(email, password)`, `signUp(email, password)`, `signOutUser()`, `idToken(): Promise<string \| null>` | browser code | reads the four values as literal `process.env.NEXT_PUBLIC_FIREBASE_*` expressions; strings passed to the SDK unchanged | `FbUser = { uid: string; email: string \| null }`; `idToken` = `getIdToken()` of the current user or null | SDK errors rethrown unchanged (`code`, `message`) | `initializeApp` once, lazily on first call; `getAuth` default persistence; the only file importing `@firebase/app` or `@firebase/auth` |
| `lib/auth/navigate.ts`: `hardNavigate(path: string): void` | `SessionProvider.signOut` | same-origin path | `window.location.assign(path)` | none | the only `location.assign` call; tests mock this module |
| `apiFetch<T>(path, init?: { method?: 'GET'\|'POST'\|'PATCH'\|'DELETE'; body?: unknown; auth?: boolean })` in `lib/api/http.ts` | `lib/api` functions only | `path` must match `^/api/[A-Za-z0-9._~\-/?=&%]*$` and contain no `/../`, `/./` or `//` after `/api/`; else throws `Error('apiFetch: path must be a same-origin /api/ path')` before `idToken` or `fetch`; `auth` defaults to true; `body` JSON-encoded with `Content-Type: application/json` | 2xx JSON body parsed; 204 or empty body -> `undefined`; 2xx with unparseable body -> `ApiError('INTERNAL', status, 'Something went wrong.')` | `auth` and `idToken()` null -> `ApiError('UNAUTHENTICATED', 401, 'Authentication is required.')`, no request, no sign-out; non-2xx with `{error:{code,message,details?,requestId?}}` -> `ApiError` with those fields, `status`, `retryAfterSeconds`; non-2xx without that body -> `ApiError('INTERNAL', status, 'Something went wrong.')`; `fetch` rejects -> `ApiError('NETWORK', 0, 'Something went wrong.')`; 401 on an `auth` call -> starts `signOutUser()` (not awaited) and still throws the `ApiError`; 401 on an `auth:false` call -> throws only | `fetch(path, { redirect: 'error', credentials: 'same-origin' })`; token only in `Authorization: Bearer`; no `console` call |
| `retryAfterSeconds` | `apiFetch` | `Retry-After` header | integer when the header matches `^\d+$` and is 1-3600, else null | - | |
| `ApiError` (existing, `lib/api/index.ts`) | all callers | `constructor(code, message, opts?: { status?; details?: {field: string; message: string}[]; requestId?: string \| null; retryAfterSeconds?: number \| null })` | fields `code`, `message`, `status` (default 0), `details` (default `[]`), `requestId` (default null), `retryAfterSeconds` (default null) | - | existing two-argument calls keep working; change is additive |
| `checkCode_2(role: ApiRole, code: string): Promise<void>` | register screen | `ApiRole = 'PM' \| 'DEV_LEAD' \| 'DEVELOPER'`; code trimmed | resolves on 200 | as `apiFetch`, `auth: false` | counts against the per-IP limit (W4 SD6) |
| `register_3(role, code, displayName): Promise<User>` | register screen | code and displayName trimmed | the 201 `User` | as `apiFetch` | |
| `me_4(): Promise<User>` | `SessionProvider` | none | `User = { id, email, displayName, role: ApiRole }` (contracts §2) | as `apiFetch` | |
| `useSession(): Session \| null` (`lib/auth/session.tsx`) | gate, top bar, live auth screens | - | null outside `SessionProvider`; else `{ status, user, firebaseEmail, error, retry(), setUser(u), holdForRegistration(): () => void, signOut() }` | - | see state machine |

**Session state machine** (`SessionProvider`). `status` is `'loading' | 'signed-out' | 'unregistered' | 'ready' | 'error'`; it starts `loading`. Each Firebase user change increments a generation number and restarts: user null -> `signed-out`; user present -> `loading`, then `me_4()`: 200 -> `ready` with the user; 403 `USER_NOT_REGISTERED` -> `unregistered`; 401 -> no change (the sign-out started by `apiFetch` produces `signed-out`); any other error -> `error` with that `ApiError`. A reply whose generation is not current is discarded. `retry()` repeats `me_4()` under the current generation. `setUser(u)` increments the generation (discarding any in-flight `me_4`) and sets `ready` with `u`. `holdForRegistration()` starts a hold and returns its release function; while held, a user change from null to a user does not call `me_4()` and leaves `status` at its current value; release does not call `me_4()` (the caller ends with `setUser` or `signOut`). `signOut()` calls `signOutUser()`, then `hardNavigate('/sign-in')`.

**Role mapping:** `PM -> 'pm'`, `DEV_LEAD -> 'lead'`, `DEVELOPER -> 'dev'` (the `Role` of `lib/screens.ts`); labels Project Manager, Dev Lead, Developer.

### 4.4 UI
**Routing in `firebase` mode** (`AuthGate`). Public routes: `/sign-in`, `/register`, `/styleguide`, `/states`; every other route (including `/screens`) is protected. `/` is redirected to `/sign-in` by `page.tsx` before the gate. Redirects run in `useEffect`; while a redirect is pending the gate renders the loading view ("Loading…" centred, nothing else). That is also what the server renders for every protected route.

| Session status | Protected route | `/sign-in` | `/register` | `/styleguide`, `/states` |
|---|---|---|---|---|
| `loading` | loading view | form, submit disabled | form, submit disabled | page |
| `signed-out` | replace `/sign-in` | sign-in form | new-user steps 1-2 | page |
| `unregistered` | replace `/register` | replace `/register` | finish-setup step | page |
| `ready` | `resolve(pathname, view, role)` through `Screen` with `RoleCtx` = mapped role | replace `/projects` | replace `/projects` | page |
| `error` | error view | error view | error view | page |

Error view: "Something went wrong." with a Retry button calling `retry()`, plus "Request ID: <id>" when `requestId` is set. The gate is the only owner of the move to `/projects` after sign-in or registration.

**Sign-in (`components/live/sign-in.tsx`)**, markup of `Main.tsx` without the "Prototype: sign in as" card: Email and Password inputs (empty, `autoComplete` `email` and `current-password`), a Show/Hide toggle that flips the password input type, a Sign in submit, "New here? Create an account" linking to `/register`. Submit calls `signIn`. Firebase errors show `error.message` unchanged in a `banner b-bad`.

**Register (`components/live/register.tsx`)**, one component, steps held in state, URL stays `/register`:
- Step 1 "Role and code" (`Register.tsx` markup): role radio group (none preselected; Next disabled until one is chosen), Registration code (`type="password"`, `autoComplete="off"`). Next -> `checkCode_2`; success -> step 2.
- Step 2 "Account" (`RegisterAccount.tsx` markup): chip "Role: <label>, code accepted", Display name, Email, Password (`autoComplete="new-password"`), Back (to step 1, role and code kept), Create account. Create account takes a hold (`holdForRegistration`), calls `signUp`, then `register_3`, then `setUser`, then releases. If `signUp` has already succeeded in this component, a later submit or Retry skips `signUp` and repeats only `register_3`.
- Finish setup (`RegisterFinish.tsx` markup), shown whenever status is `unregistered` and no hold is active: "You are signed in as <firebaseEmail>, but your profile is not set up yet. You do not need to create the account again.", role group, Registration code (`autoComplete="off"`), Display name, Finish -> `checkCode_2`, then `register_3`, then `setUser`. A "Sign out" link calls `signOut()`.
- The code lives only in this component's state. It is cleared (state and input value) on `register_3` success, on 409, and on unmount; on any other error it is kept so Retry can resend it. It is never written to storage, a URL, a log or an error message.

**States** (exact text; one request at a time; the submit is guarded by a ref so a second click before re-render does nothing):

| Condition | Shown |
|---|---|
| request in flight | submit disabled with `aria-busy="true"` and its label replaced by "Please wait…" until the request settles |
| 403 `REGISTRATION_CODE_INVALID` (endpoint 2 or 3) | "Code not accepted." under the code field; the step does not advance |
| 429 `RATE_LIMITED` (endpoint 2 or 3) | `banner b-warn` "Too many attempts. Try again in N seconds." (N = 1: "Try again in 1 second."), N = `retryAfterSeconds` or 60 when null; N counts down once a second; submit disabled until 0, then the banner clears; the countdown continues across step changes and stops on unmount |
| 409 `ALREADY_REGISTERED` | `banner b-bad` "This account is already registered. Sign in instead." with a "Sign in instead" link to `/sign-in` |
| 422 `VALIDATION_FAILED` | each `details` message under its field: `role` -> role group, `code` -> code field, `displayName` -> display name; any other `field` -> form banner |
| Firebase `auth/email-already-in-use` | Firebase's `message`, plus a "Sign in instead" button navigating to `/sign-in` |
| other Firebase error | Firebase's `message` unchanged |
| `NETWORK`, `INTERNAL` or any 5xx | "Something went wrong." with a Retry button that repeats the failed request, plus "Request ID: <id>" when present |

**Top bar** (`components/canvas/Top.tsx`): when `useSession()` is non-null, name, email, initials and role label come from `session.user`, and Sign out is a button calling `session.signOut()`; when null (`prototype`), unchanged. Initials: trim `displayName`, split on whitespace, take the first code point of each of the first two words, upper-case them; `"?"` when no word. **Role bar** (`components/role-bar.tsx`) renders only when `useAuthMode() === 'prototype'`. **`unconfigured`**: every route shows only "Sign-in is not configured for this deployment." centred, with no top bar or role bar.

All user text (display names, emails, Firebase messages) is rendered as React text, never as HTML.

### 4.5 Conventions
- `lib/auth/firebase.ts` is the only importer of any `firebase` or `@firebase/*` module; `lib/api/http.ts` is the only `fetch` caller outside `app/api/`; `lib/auth/navigate.ts` is the only `location.assign` caller; no file uses `dangerouslySetInnerHTML`; browser modules (`'use client'` files and `lib/auth/firebase.ts`) read `process.env` only as the four literal `NEXT_PUBLIC_FIREBASE_*` names. Rule six: no `'use client'` file imports `lib/auth/mode.ts`. A Vitest source-scan test (`src/fe/test/source-rules.test.ts`, `// @vitest-environment node`, reads files with `node:fs`) enforces all six rules.
- Screens keep calling `lib/api` functions (`check-data-layer.mjs`); the live auth screens may also call `lib/auth`.
- Dependencies pinned exactly (versions checked on npm 2026-11-08): `@firebase/app` 0.16.5 and `@firebase/auth` 1.13.9 (the versions inside `firebase` 13.2.0; the umbrella package is not installed, SD15); dev: `vitest` 4.1.12, `jsdom` 27.4.0, `@testing-library/react` 16.3.3, `@testing-library/dom` 10.4.2, `@testing-library/user-event` 14.6.8.
- Tests live in `src/fe/test/**/*.test.ts(x)` (the root runner walks only `tests/` and `src/be/`), with `environment: 'jsdom'` from `src/fe/vitest.config.ts`. UI tests mock `lib/auth/firebase`, `lib/auth/navigate` and `next/navigation` (`useRouter` -> `{ replace: vi.fn() }`) and stub `globalThis.fetch`; "reaches X" means `replace('X')` called once. Unit tests pass explicit env objects; route tests use `vi.stubEnv`. Fake timers use `userEvent.setup({ advanceTimers: vi.advanceTimersByTime })`. Firebase error mocks reject with `{ code, message }` set by the test.
- `src/fe/package.json` gains `"test": "vitest run"`; root `test` becomes `node --import tsx scripts/discover-tests.mjs && npm --workspace easel-fe run test`.
- `src/fe/scripts/smoke.mjs` and `linkcheck.mjs` send a `role` cookie and so run only with `APP_TIER=preview` and no Firebase values (`prototype`); a comment at the top of each says so.

### 4.6 Sequencing constraints
- Install the dependencies first, commit `package-lock.json` with them, and run `npm ci --ignore-scripts` and `npm run audit:dependencies` on Node 20.19.5 before pushing; a high audit finding stops the work for the operator. Root `package.json` and the lockfile are shared with every workstream: rebase on `development` immediately before this change.
- `vitest.config.ts` before any test; `lib/auth/mode.ts`, `lib/auth/firebase.ts`, `lib/auth/navigate.ts` and `lib/api/http.ts` before `session.tsx`, which precedes `mode-context.tsx`, the gate, the live screens and `Top.tsx`.
- `app/[[...slug]]/page.tsx` and `app/layout.tsx` change together. `lib/api/index.ts` (`ApiError` fields and endpoints 2-4) is also edited by other owners: rebase before editing and keep the change additive.
- A preview tier with Firebase values but without the API's data settings gets 500 from endpoints 2-4 (`architecture/auth.md`), so it shows the error view with its Request ID; that is expected, not a defect.

## 5. Edge cases
**Mode and prototype route**
| ID | Req | Scenario | Expected behaviour (exact) | Test layer |
|---|---|---|---|---|
| E56 | F1 | `APP_TIER=prod`, all four set; `APP_TIER=other`, all four set | `firebase` both | unit |
| E57 | F1 | `APP_TIER=preview`, none set, `VERCEL_ENV` absent or `preview` | `prototype` | unit |
| E58 | F1 | `dev` none set; `prod` with 1, 2 and 3 set; `preview` with each single value missing in turn; `APP_TIER` absent | `unconfigured` each | unit |
| E84 | F1 | values are `"  "` (whitespace) | treated as absent | unit |
| E85 | F1 | `APP_TIER=PREVIEW`, none set; `APP_TIER=preview`, `VERCEL_ENV=production`, none set | `unconfigured` both | unit |
| E59 | F1 | `firebase` or `unconfigured`, `GET /api/as?role=pm&to=/projects` | 404, no `Set-Cookie` | unit |
| E86 | F1 | `prototype`, `GET /api/as?role=lead&to=/lead/overview` | 307 to `/lead/overview`, `role=lead` cookie set | unit |
| E87 | F1 | `prototype`, `to` = `/\evil.com`, `/%5Cevil.com`, `//evil.com`, `https://evil.com` | each redirects to same-origin `/projects` | unit |
| E78 | F1 | `prototype`, `AuthGate` not used: `/sign-in`; `/projects` with `role=pm` | canvas `Main` with role buttons; `/projects` shows the role bar | UI |
| E79 | F1 | `unconfigured` on `/projects` and `/sign-in`; and `firebase` from the server with `firebaseConfigured()` false | only "Sign-in is not configured for this deployment."; no top bar, no role bar | UI |

**API client**
| ID | Req | Scenario | Expected behaviour (exact) | Test layer |
|---|---|---|---|---|
| E60 | F2 | paths `https://evil.example/api/me`, `//evil/api`, `/other`, `/api`, `/apix`, `/\evil`, `/api/../x`, `/api/a b`, `/api/a\nb` | each throws before `idToken` and `fetch` | unit |
| E61 | F2 | signed in, `apiFetch('/api/me')` | one `fetch` with `Authorization: Bearer <token>`, `redirect: 'error'`; token not in the URL | unit |
| E88 | F2 | `auth: false` POST with body `{a:1}` | no `Authorization` header, `idToken` not called, body `{"a":1}`, `Content-Type: application/json` | unit |
| E62 | F2 | 422 with two details and requestId `r1` | `ApiError` `VALIDATION_FAILED`, status 422, both details, requestId `r1` | unit |
| E63 | F2 | `Retry-After` `42`; `0`, `3601`, `3.5`, `abc`, empty, missing | 42; null for each of the rest | unit |
| E64 | F2 | 502 with HTML body; `fetch` rejects | `ApiError('INTERNAL', 502)`; `ApiError('NETWORK', 0)` | unit |
| E89 | F2 | 204; 200 with empty body; 200 with `not json` | `undefined`; `undefined`; `ApiError('INTERNAL', 200)` | unit |
| E65 | F2 | `auth` call, `idToken()` null | `ApiError('UNAUTHENTICATED', 401)`; `fetch` and `signOutUser` not called | unit |
| E90 | F2 | `auth` call returns 401 | `signOutUser` called once; the call still rejects with `ApiError` 401 | unit |
| E91 | F2 | `auth: false` call returns 401 | rejects with `ApiError` 401; `signOutUser` not called | unit |
| E92 | F2 | any call, spy on every `console` method | no call receives the token, code or password | unit |
| E93 | F2 | existing two-argument `new ApiError('X', 'm')` | status 0, details `[]`, requestId null, retryAfterSeconds null | unit |

**Session gate**
| ID | Req | Scenario | Expected behaviour (exact) | Test layer |
|---|---|---|---|---|
| E54 | F3 | `me_4` returns 401 on `/projects` | `signOutUser` called, status `signed-out`, `replace('/sign-in')`; no error view | UI |
| E66 | F3 | `ready` as `DEV_LEAD` on `/lead/overview`, `role=pm` cookie present | Lead overview rendered with role `lead` | UI |
| E67 | F3 | `/projects` while `loading`; then `signed-out` | "Loading…" only, no screen; then `replace('/sign-in')` with "Loading…" still shown | UI |
| E68 | F3 | `me_4` 500 with requestId `r9`, then Retry succeeds | "Something went wrong." and "Request ID: r9"; after Retry the screen renders | UI |
| E69 | F3 | user signs out in another tab while on `/projects`; and while on `/sign-in` | `replace('/sign-in')`; on `/sign-in` the form stays, no replace | UI |
| E70 | F3 | uid A's `me_4` resolves after the user changed to uid B | A's reply discarded; B's role used | UI |
| E94 | F3 | `unregistered` on `/projects` | `replace('/register')`, finish setup shown there | UI |
| E95 | F3 | `ready` on `/sign-in` and on `/register` | `replace('/projects')` once each | UI |
| E96 | F3 | `error` on `/sign-in` and `/register` | error view with Retry | UI |
| E97 | F3 | `/styleguide` while `signed-out` and while `unregistered` | page renders, no replace | UI |
| E98 | F3 | server render of `/projects` in `firebase` mode | HTML contains "Loading…" and no screen markup | UI |
| E99 | F3 | `useSession()` outside a provider | returns null; `Top` renders prototype content | UI |

**Sign-in, register, sign-out**
| ID | Req | Scenario | Expected behaviour (exact) | Test layer |
|---|---|---|---|---|
| E51 | F4, F6 | returning user signs in; then clicks Sign out | `signIn` called; after `ready`, `replace('/projects')`; Sign out calls `signOutUser` once and `hardNavigate('/sign-in')` | UI |
| E71 | F4 | `signIn` rejects with mock message `Firebase: Error (auth/invalid-credential).` | that text shown unchanged; no replace | UI |
| E72 | F4 | `userEvent.dblClick` on Sign in | `signIn` called once | UI |
| E32 | F5 | new user, valid code | `checkCode_2`, `signUp`, `register_3`, `setUser` in order; `replace('/projects')` once | UI |
| E100 | F5 | `onUserChanged(user)` fires between `signUp` and `register_3`, a late `me_4` 403 is pending | no `me_4` call during the hold; step 2 stays mounted; final status `ready`; finish setup never shown | UI |
| E33 | F5 | `signUp` ok, `register_3` 500; user reloads and signs in | status `unregistered`, finish setup shows their email; Finish reaches `/projects` | UI |
| E101 | F5 | `signUp` ok, `register_3` 500, Retry | `signUp` called 1 time, `register_3` 2 times; code still in state between | UI |
| E34 | F5 | `checkCode_2` 429 with `Retry-After: 3`, fake timers | "Try again in 3 seconds.", then "2 seconds.", then "1 second."; submit disabled 3 s, then enabled, banner gone | UI |
| E102 | F5 | `register_3` 429 with no `Retry-After` in finish setup | "Try again in 60 seconds."; timer cleared on unmount (no state update after unmount) | UI |
| E52a | F5 | 403 code at Next, at Create account, at Finish | "Code not accepted." under the code field each time | UI |
| E52b | F5 | 409 at Create account and at Finish | "This account is already registered. Sign in instead." with a `/sign-in` link | UI |
| E52c | F5 | 422 with details for `role`, `code`, `displayName` | each message under its field | UI |
| E52d | F5 | 422 with a detail for field `other` | message in the form banner | UI |
| E52e | F5 | `NETWORK` at Next | "Something went wrong." and Retry; no Request ID line | UI |
| E52f | F5 | 500 with requestId `r2` at Create account | "Something went wrong.", "Request ID: r2", Retry | UI |
| E52g | F5 | `signUp` rejects with `auth/weak-password` and mock message `m1` | `m1` shown unchanged, no "Sign in instead" | UI |
| E52h | F5 | 500 at Finish, then Retry succeeds | reaches `/projects` | UI |
| E53 | F5 | `signUp` rejects with `auth/email-already-in-use` | Firebase message plus "Sign in instead", which navigates to `/sign-in` | UI |
| E39 | F5, F6 | display name `<script>alert(1)</script>` | sent as typed (trimmed); top bar shows it as literal text; no `script` element added | UI |
| E55 | F5 | after `register_3` success, and separately after 409 | code absent from `localStorage`, `sessionStorage`, `document.cookie`, `location.href`, DOM text and every input's `.value` | UI |
| E103 | F5 | register unmounts mid-flow (navigate away) | code input and state gone; remount starts at step 1 with an empty code | UI |
| E104 | F5 | code inputs | `autoComplete="off"` on both; password `autoComplete="new-password"` | UI |
| E73 | F5 | step 1 code `  abc  ` | `checkCode_2` receives `abc` | UI |
| E74 | F5 | no role chosen | Next disabled; `checkCode_2` not called | UI |
| E75 | F5 | step 2 Back, then Next | role and code kept; `checkCode_2` called again | UI |
| E76 | F5 | finish setup "Sign out" link | `signOutUser` once, `hardNavigate('/sign-in')` | UI |
| E77 | F6 | `ready` as `DEVELOPER` "Ana Lee"; `DEV_LEAD` "bo"; `PM` "  Cy  de  Ro " | "AL" Developer; "B" Dev Lead; "CD" Project Manager; names and emails shown; no role bar | UI |
| E105 | F6 | display name starting with an emoji `😀 Zed` | initials "😀Z" (whole code point) | UI |

**Build and source rules**
| ID | Req | Scenario | Expected behaviour (exact) | Test layer |
|---|---|---|---|---|
| E82 | F7, N1 | root `npm test` with `APP_TIER=test`; then with one `src/fe` test made to fail | passes; then exits non-zero | CI, plus one local check in the plan |
| E83 | N2 | source-scan test | the six § 4.5 rules hold; `.env.example` values empty | unit |

**What could corrupt data**
| ID | Req | Scenario | Expected behaviour (exact) | Test layer |
|---|---|---|---|---|
| E80 | F5 | `userEvent.dblClick` on Create account | `signUp` and `register_3` each called once | UI |
| E81 | F5 | `register_3` succeeds while a `me_4` 403 is in flight | `me_4` reply discarded; status `ready`; no redirect to `/register` | UI |

## 6. Security
**Per operation.** Principal: anonymous for `/sign-in`, `/register` steps 1-2 and endpoint 2; a Firebase user for endpoints 3-4. Authorization stays in the API (AD-55): the gate and hidden controls are usability only and pages render fixtures, not user data. Tenancy: none here. Validation: the server owns it (W4 schemas); the client only trims the code and display name. Logging: the client logs nothing (E92).

| Threat (actor, abuse) | Mitigation | Test |
|---|---|---|
| User on a real tier sets a `role=lead` cookie | cookie unread in `firebase` mode (N3); `/api/as` 404 outside `prototype` | E59, E66 |
| Misconfigured tier falls back to role buttons | `prototype` needs `preview`, no Firebase values and `VERCEL_ENV` not `production`; everything else `unconfigured`; client fails closed when its bundle lacks the config | E58, E79, E84, E85 |
| Crafted `to` on a preview's `/api/as` redirects off-site | same-origin check after URL parsing | E87 |
| Path passed to `apiFetch` sends the token elsewhere, or a redirect forwards it | path allow-list before `idToken`; `redirect: 'error'` | E60, E61 |
| Code leaks via storage, URL, DOM, autofill or logs | component state only; cleared on success, 409 and unmount; `autoComplete="off"`; no `console` | E55, E92, E103, E104 |
| Display name or Firebase message carries markup | React text only; no `dangerouslySetInnerHTML` (source scan) | E39, E71, E83 |
| Session ends in another tab but the page keeps showing | `onUserChanged` drives the gate | E69 |
| Stale role after a user switch, or a late 403 after registering | generation number discards old replies | E70, E81, E100 |
| Anonymous code guessing through `checkCode_2` | server limit 20 a minute per IP (W4 SD6); accepted | W4 tests |
| Account enumeration through `auth/email-already-in-use` | inherent to Firebase sign-up; accepted (Known Gap below) | E53 |
| Script on the page reads the Firebase session from IndexedDB | accepted (A-15); the source scan bans `dangerouslySetInnerHTML` | E83 |

**Known Gap (new):** **Sign-up reveals registered emails** - Firebase answers `auth/email-already-in-use` for an existing account and the screen shows it (ui.md), so anyone can test whether an email has a Firebase account; this sits beside the unverified-email gap (AD-57).

## 7. Open questions
| ID | Question | Blocks | Owner |
|---|---|---|---|

## 8. Decisions made in this spec
| ID | Decision | Why / rejected alternative | Asked by |
|---|---|---|---|
| SD1 | The gate is client-side; the server only decides the mode and passes routing props | `Screen` and `resolve` are client-safe and no user data is server-rendered. Rejected: Firebase session cookies verified on the server (new endpoint, out of T7) | AI, from C~2 |
| SD2 | Three modes; `prototype` needs `preview`, no Firebase values and a non-production `VERCEL_ENV`; the client fails closed | A dev or prod tier with missing values must not fall back to role buttons. Rejected: falling back whenever values are absent | AI, Attacker lens on C~3 |
| SD3 | Every successful sign-in or registration goes to `/projects`, and only the gate navigates there | ui.md states it and `/projects` exists for all roles; one owner avoids double navigation. Rejected: per-role homes (`HOME`) | AI, from ui.md |
| SD4 | Register is one component with steps in state; URL stays `/register` | Keeps the code out of URLs. Rejected: `?view=step2` routes | AI, from E55 |
| SD5 | Vitest 4.1.12 and jsdom 27.4.0, not the latest majors | CI is Node 20.19.5; Vitest 5 and jsdom 31 require Node 22. Rejected: raising CI's Node (W12) | AI |
| SD6 | Root `npm test` runs the `src/fe` suite after the backend suite | CI already runs `npm test`; `ci.yml` unchanged. Rejected: a new CI job | AI |
| SD7 | Copy listed here or in ui.md wins over canvas text | ui.md is approved W4 copy. Rejected: canvas wording ("This email is already registered") | AI |
| SD8 | Add `src/fe/.env.example` with names and empty values | The operator needs the list; the root `.gitignore` allows only this env file. Rejected: names only in docs | AI, operator asked about env vars |
| SD9 | `apiFetch` starts sign-out on an authed 401 and still throws; the gate navigates | One navigation owner, no double redirect. Rejected: `apiFetch` navigating itself | AI, Implementer lens |
| SD10 | `holdForRegistration` plus a generation number keep step 2 mounted through `signUp` | `signUp` fires `onUserChanged`, whose 403 would swap in finish setup and drop the code. Rejected: letting the 403 through and recovering in finish setup | AI, Implementer and Attacker lenses |
| SD11 | Retry after `signUp` succeeded repeats only `register_3`; the code is kept on non-409 errors | A second `signUp` fails with `email-already-in-use`. Rejected: clearing the code on any settle | AI, Tester lens |
| SD12 | `/api/as` keeps working in `prototype` but gets a same-origin `to` check | It is an open redirect on every preview today. Rejected: leaving W10's check | AI, Attacker lens |
| SD13 | The six source rules are a Vitest source-scan test | `check-data-layer.mjs` is not run in CI and `ci.yml` is not edited. Rejected: extending that script | AI, Maintainer lens |
| SD15 | Depend on `@firebase/app` 0.16.5 and `@firebase/auth` 1.13.9, not the `firebase` umbrella | `firebase` 13.2.0 pulls `@firebase/firestore` with `@grpc/grpc-js` 1.9.16 (high: GHSA-m9gg-hp2v-232j, GHSA-f596-whhp-79r4), which fails CI's audit; auth needs neither. Rejected: an npm `overrides` pin of `@grpc/grpc-js` (forces Firestore onto an untested gRPC); accepting the risk (CI fails on high) | operator (ludannnn), C~5 |
| SD14 | No bounce guard for a 401 right after sign-in | Each bounce needs the user to submit again, so it cannot loop on its own. Rejected: a counter in browser storage | AI, Attacker nit |

## 9. Review record
Lenses: Implementer, Tester, Maintainer, Attacker (authentication, registration codes, tokens, tier fallback) | Rounds: 1 | Rejected findings: Attacker "bounce guard after a 401" - each bounce needs a new user submit (SD14); Maintainer "link the plan" - the plan follows Gate 1 by the workflow; Tester "time the suite in a test" - verified once in the plan instead (E82).
