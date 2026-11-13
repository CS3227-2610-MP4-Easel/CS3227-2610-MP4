# Branch State — GitHub Pages product site

**Branch:** `codex/github-pages-site`
**Started:** 2026-11-13 from `development`
**Status:** In review

**Untouched:** Architecture, Conventions, Known Gaps, Decisions, Deviations

## 1. How to Resume

| Session | Started | Agent(s) | Workstream | Status | Doing | Next action | Last touched |
|---|---|---|---|---|---|---|---|
| Session | Started | Agent(s) | Workstream | Status | Doing | Next action | Last touched |
|---|---|---|---|---|---|---|---|

**Remaining**

- [ ] Configure GitHub Pages to publish `main` from `/docs` after merge.

## 2. Workstreams

| ID | Workstream | Status | Spec | Plan | Progress | Guide |
|---|---|---|---|---|---|---|
| — | GitHub Pages product site | Building | — | — | Site shell and guide rendering in progress | — |

## 3. Changes

| Date | What changed | Workstream | Ref |
|---|---|---|---|
| 2026-11-13 | Started a branch from `development` for the public GitHub Pages product site | GitHub Pages product site | this work |
| 2026-11-13 | Added a Cayman Jekyll site shell, public landing page, styled guide pages, and exclusions for internal docs | GitHub Pages product site | this work |

## 4. Verification

- `git diff --check` — passed.
- `jekyll build --source docs --destination <temporary directory>` — passed; generated `index.html`, `UserGuide.html`, and `DeveloperGuide.html`.
- Verified excluded internal `architecture`, `guide`, and `telemetry` directories are not emitted into the site output.
