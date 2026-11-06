# Branch State — codex/vercel-webpack-build

**What this branch has changed, and how to pick it up.** `workflow/project-state/STATE.md`
describes `INT`; read it for context and write here instead of editing it.

- **Branch:** codex/vercel-webpack-build (from `INT` at `94ebc77134ffd4ab00e0bda3c3fe9c2ff933ef01`)
- **Base:** 94ebc77134ffd4ab00e0bda3c3fe9c2ff933ef01
- **Owner:** operator / repository owner
- **Status:** In review
- **Approved:** —
- **Last updated:** 2026-11-06 by Codex — credential-free Prisma generation fix

**Untouched:** Architecture, Conventions, Known Gaps, Decisions, Deviations

---

**Scope.** One-line Vercel build compatibility fix for the Next.js frontend.

## 1. How to Resume

**Sessions**

| Session | Started | Agent(s) | Workstream | Status | Doing | Next action | Last touched |
|---|---|---|---|---|---|---|---|

**Remaining**

- [ ] Open a PR into `development` after the local commit is pushed.

## 2. Workstreams

| ID | Workstream | Status | Spec | Plan | Progress | Guide |
|---|---|---|---|---|---|---|
| build-hotfix | Vercel frontend build compatibility | In review | — | — | Prisma generation and `next build --webpack` pass without `DATABASE_URL` | — |

## 3. Changes

| Date | What changed | Workstream | Ref |
|---|---|---|---|
| 2026-11-06 | Explicitly select Webpack for the Next.js production build because Next.js 16 rejects the existing custom Webpack config under default Turbopack | build-hotfix | 95139e7 |
| 2026-11-06 | Allow Prisma client generation to use a localhost placeholder when `DATABASE_URL` is absent, without changing runtime database requirements | build-hotfix | this commit |
