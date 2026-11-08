# W4 Sign-in Screen Implementation Plan

- **Status:** Approved (ludannnn, 2026-11-08)
- **Format:** v2
- **Spec:** [W4 sign-in screen design](../../specs/2026-11-08-w4-sign-in-screen-design.md) | **Spec hash:** 3cdecab29621
- **Workstream:** W4

> **For the orchestrator:** this file is your router. Do not open task files yourself except to
> dispatch them; implementers read their own task file and the Shared context below, nothing else.
> You alone write this file's Status column, the branch state and `STATE`-level records.

## Scope
**Goal:** sign-in, register and sign-out in `src/fe` use Firebase and endpoints 2-4, pages need a Firebase session, the role comes from `GET /api/me`, and mock previews keep the role buttons.
**In scope:** F1-F7, N1-N3.
**Non-goals:** wiring other screens to the API; email verification, revocation, password reset, social sign-in (AD-57, C47); server-side sessions; Playwright; screen redesign; editing `.github/workflows/ci.yml` or CI's Node version.
**Risk tier:** High - every task sits on the authentication surface or touches security-sensitive paths (`package.json`, `package-lock.json`), so every task gets full review with the Attacker lens.

## Shared context
**Commands** (run from the repo root)
- Install: `npm install` (after editing a `package.json`); CI uses `npm ci --ignore-scripts` on Node 20.19.5.
- Test one file: `npm --workspace easel-fe run test -- test/<file>`; all fe tests: `npm --workspace easel-fe run test`.
- Typecheck: `npm --prefix src/fe run typecheck`; whole repo: `npm run typecheck`.
- Build: `env -u DATABASE_URL npm --prefix src/fe run build` (a shell `DATABASE_URL` overrides `src/fe/.env.local`; the build needs that file).

**Rules for every task** (ID - rule)
- AD-01b/C8 - `src/fe` never imports Prisma or `@agile/db`; all source stays under `src/`.
- AD-55 - authorization is the API's job; the gate and hidden controls are usability only.
- AD-32 - no secrets in the repo; `.env.local` is never committed; `.env.example` has empty values.
- A-15 - Firebase keeps its session in default SDK storage; app code stores nothing about auth in the browser.
- N3 - in `firebase` mode nothing reads the `role` cookie, a token claim or browser storage for the role.
- Logging - no `console` call anywhere in new code receives a token, code, password or response body.
- Rendering - user text is React text only; never `dangerouslySetInnerHTML`.
- Data layer - screens call `lib/api` functions; never import `lib/api/fixtures` or `lib/api/store` outside `lib/api/`.
- Tests - Vitest files live in `src/fe/test/`, named `*.test.ts` or `*.test.tsx`; import `describe/it/expect/vi` from `vitest` (no globals); each test name or comment cites its E ID.
- Mocks - UI tests mock `lib/auth/firebase` with explicit factories (`firebaseConfigured: () => true`, `onUserChanged` storing the callback and returning an unsubscribe `vi.fn()`, `idToken: async () => 't'`, the rest `vi.fn()`), `lib/auth/navigate`, and `next/navigation` (`useRouter` returns one stable `{ replace }` object shared across calls; `usePathname`, `useSearchParams`); stub `fetch` with `vi.stubGlobal`. "Reaches X" means `replace('X')` called once.
- Commits - in a wave with two tasks, stage only your own files by path (never `git add -A`).
- Style - match the surrounding code: single quotes, 2-space indent, `'use client'` first line in client files, no new comments beyond one line explaining a non-obvious rule.
- Commits - one per task, `type: what and why (W4)` with trailers `Workstream: W4` and `Task: Tn`.

**Boundaries.** You do not read `STATE.md`, `guardrails.md`, the branch state or the spec. You commit
only your own task's files. Contract tests marked read-only are not edited.

## Task order
| Task | File | Depends on | Concurrent with | Wave | Weight | Review | Status |
|---|---|---|---|---|---|---|---|
| T1 Test runner and dependencies | `tasks/T1.md` | - | - | 1 | standard | full | Done |
| T2 Auth mode and the prototype route | `tasks/T2.md` | T1 | T3 | 2 | standard | full | Done |
| T3 Firebase wrapper and API client | `tasks/T3.md` | T1 | T2 | 2 | complex | full | Done |
| T4 Session, gate, layout and top bar | `tasks/T4.md` | T2, T3 | - | 3 | complex | full | In progress |
| T5 Sign-in screen | `tasks/T5.md` | T3, T4 | T6 | 4 | standard | full | Not started |
| T6 Register screen | `tasks/T6.md` | T3, T4 | T5 | 4 | complex | full | Not started |
| T7 Source rules and prototype scripts | `tasks/T7.md` | T5, T6 | - | 5 | standard | full | Not started |

Full review on every task means Implementer + Tester + Attacker lenses (authentication, tokens, registration codes, security-sensitive paths).

Bundles: none.

## Traceability
| Requirement | Task(s) | Verified by |
|---|---|---|
| F1 | T2, T4 | `test/mode.test.ts`, `test/as-route.test.ts`, `test/gate.test.tsx` |
| F2 | T3 | `test/http.test.ts` |
| F3 | T4 | `test/gate.test.tsx`, `test/session.test.tsx` |
| F4 | T5 | `test/sign-in.test.tsx` |
| F5 | T6 | `test/register.test.tsx` |
| F6 | T4 | `test/top-bar.test.tsx` |
| F7 | T1 | `test/runner.test.ts` and root `npm test` |
| N1 | T1 | root `npm test` with `APP_TIER=test`; timing checked at close-out |
| N2 | T1, T7 | `test/source-rules.test.ts`; `npm run scan:secrets` |
| N3 | T4 | `test/gate.test.tsx` (E66) |
| E56 | T2 | `test/mode.test.ts` |
| E57 | T2 | `test/mode.test.ts` |
| E58 | T2 | `test/mode.test.ts` |
| E84 | T2 | `test/mode.test.ts` |
| E85 | T2 | `test/mode.test.ts` |
| E59 | T2 | `test/as-route.test.ts` |
| E86 | T2 | `test/as-route.test.ts` |
| E87 | T2 | `test/as-route.test.ts` |
| E60 | T3 | `test/http.test.ts` |
| E61 | T3 | `test/http.test.ts` |
| E62 | T3 | `test/http.test.ts` |
| E63 | T3 | `test/http.test.ts` |
| E64 | T3 | `test/http.test.ts` |
| E65 | T3 | `test/http.test.ts` |
| E88 | T3 | `test/http.test.ts` |
| E89 | T3 | `test/http.test.ts` |
| E90 | T3 | `test/http.test.ts` |
| E91 | T3 | `test/http.test.ts` |
| E92 | T3 | `test/http.test.ts` |
| E93 | T3 | `test/http.test.ts` |
| E54 | T4 | `test/session.test.tsx` |
| E70 | T4 | `test/session.test.tsx` |
| E99 | T4 | `test/session.test.tsx` |
| E66 | T4 | `test/gate.test.tsx` |
| E67 | T4 | `test/gate.test.tsx` |
| E68 | T4 | `test/gate.test.tsx` |
| E69 | T4 | `test/gate.test.tsx` |
| E78 | T4 | `test/gate.test.tsx` |
| E79 | T4 | `test/gate.test.tsx` |
| E94 | T4 | `test/gate.test.tsx` |
| E95 | T4 | `test/gate.test.tsx` |
| E96 | T4 | `test/gate.test.tsx` |
| E97 | T4 | `test/gate.test.tsx` |
| E98 | T4 | `test/gate.test.tsx` |
| E77 | T4 | `test/top-bar.test.tsx` |
| E105 | T4 | `test/top-bar.test.tsx` |
| E39 | T4, T6 | `test/top-bar.test.tsx`, `test/register.test.tsx` |
| E51 | T4, T5 | `test/top-bar.test.tsx`, `test/sign-in.test.tsx` |
| E81 | T4, T6 | `test/session.test.tsx`, `test/register.test.tsx` |
| E100 | T4, T6 | `test/session.test.tsx`, `test/register.test.tsx` |
| E71 | T5 | `test/sign-in.test.tsx` |
| E72 | T5 | `test/sign-in.test.tsx` |
| E32 | T6 | `test/register.test.tsx` |
| E33 | T6 | `test/register.test.tsx` |
| E34 | T6 | `test/register.test.tsx` |
| E52a | T6 | `test/register.test.tsx` |
| E52b | T6 | `test/register.test.tsx` |
| E52c | T6 | `test/register.test.tsx` |
| E52d | T6 | `test/register.test.tsx` |
| E52e | T6 | `test/register.test.tsx` |
| E52f | T6 | `test/register.test.tsx` |
| E52g | T6 | `test/register.test.tsx` |
| E52h | T6 | `test/register.test.tsx` |
| E53 | T6 | `test/register.test.tsx` |
| E55 | T6 | `test/register.test.tsx` |
| E73 | T6 | `test/register.test.tsx` |
| E74 | T6 | `test/register.test.tsx` |
| E75 | T6 | `test/register.test.tsx` |
| E76 | T6 | `test/register.test.tsx` |
| E80 | T6 | `test/register.test.tsx` |
| E101 | T6 | `test/register.test.tsx` |
| E102 | T6 | `test/register.test.tsx` |
| E103 | T6 | `test/register.test.tsx` |
| E104 | T6 | `test/register.test.tsx` |
| E82 | T1 | root `npm test` passes; a deliberately failing fe test makes it exit non-zero (close-out) |
| E83 | T7 | `test/source-rules.test.ts` |

## Close-out
Run by the orchestrator (no task file):
- [ ] `lint.mjs plan <plan.md> --closeout` has no errors; every Done task has a valid handover.
- [ ] `npm run typecheck`, root `npm test` (with `APP_TIER=test`), `env -u DATABASE_URL npm --prefix src/fe run build` and `npm run audit:dependencies` green; `time npm --workspace easel-fe run test` under 60 s (N1).
- [ ] E82: temporarily make one fe test fail, confirm root `npm test` exits non-zero, revert (not committed).
- [ ] Manual check with the operator's `.env.local`: register a new PM with `PROJ_MANAGER_DEMO`, sign out, sign in, reach `/projects`.
- [ ] Code review of the branch diff (`code-review` skill); confirmed findings fixed or recorded as Deviations.
- [ ] Branch state: workstream `In review`, session rows removed, Changes lines, Known Gap (sign-up reveals registered emails) kept, handovers (W13 Firebase prod project and `NEXT_PUBLIC_FIREBASE_*` per tier; close the "Ask the PM" Upcoming row), `guide out of date: setup (Firebase, .env.local), testing (fe Vitest)`.
- [ ] Ask the operator to review the branch (`AGENTS.md` § 8, gate 3); `Approved` only on their yes;
      never push, open a PR or merge before it.
