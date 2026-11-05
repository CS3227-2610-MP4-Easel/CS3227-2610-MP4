# Follow-up: Sign-in Screen Wiring (T7)

Split from this spec on 2026-11-04 (SD18) so T0 to T6 can merge first and unblock W5. It becomes its own spec and PR once W10's real data layer replaces the cookie-based prototype (`src/fe/app/[[...slug]]/page.tsx`) and `src/fe` has a UI test runner. [ui.md](ui.md) still defines the flows and states.

## Requirement
| ID | Requirement | Acceptance criterion |
|---|---|---|
| F7 | The sign-in and register screen works end to end | Given each flow in [ui.md](ui.md), with the Firebase SDK mocked, the user reaches that flow's stated result and each listed state shows its exact text |

## Edge cases
| ID | Requirement | Scenario | Expected behaviour (exact) | Why it matters | Test layer |
|---|---|---|---|---|---|
| E39 | F7 | `displayName` containing `<script>` | Accepted, and shown as plain text | No script injection | UI |
| E32 | F7 | New user with a valid code | Reaches `/projects` | Main path | UI |
| E33 | F7 | Firebase signup succeeded, `register` failed, user returns and signs in | Register fields appear and registration completes | No stranded accounts | UI |
| E34 | F7 | 429 on the screen, using fake timers | Message shows N and submit stays disabled for N seconds | Avoids burning attempts | UI |
| E51 | F7 | Returning user signs in; then signs out | Reaches `/projects`; then `/sign-in` | Baseline | UI |
| E52 | F7 | 403 code, 409, 422 and network or 500 responses | Each shows its exact text from `ui.md`, with `requestId` on 500 | States are specified | UI |
| E53 | F7 | Firebase returns `auth/email-already-in-use` | Message and a "Sign in instead" action | Recovery path | UI |
| E54 | F7 | 401 on any page | Redirect to `/sign-in` | Expired sessions | UI |
| E55 | F7 | After registration | Code is absent from browser storage and the URL | Secret handling | UI |

## Task
T7, wire the sign-in and register screen: depends on endpoints 2 to 4 (T4 to T6) being merged and on the W10 mockup.
