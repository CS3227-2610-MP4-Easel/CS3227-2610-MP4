# Done Ledger — Agile Platform

The full chronological record of every change, newest first. One line each: what changed and why, with a commit, plan or artifact as the reference. Not a copy of `git log`.

| Date | What changed | Workstream | Ref |
|---|---|---|---|
| 2026-11-02 | Developer guide first write: W10 front end (overview, setup, architecture, components, flow rules, testing) | W10 | `docs/guide/` |
| 2026-11-02 | Folded branch state `w10-ui-mockups` | — | archive |
| 2026-11-02 | Spec approved by the operator (gate 1); Q9 closed as SD13, Q10 as SD12 | W10 | this commit |
| 2026-11-02 | Web app location reversed to `src/fe` (C8); ui.md updated | W10 | this commit |
| 2026-11-02 | Prototype plan written and approved (gate 2); link check added at the operator's request | W10 | this commit |
| 2026-11-02 | T9 verified: `npm run lint` (no fixtures/store import outside `lib/api`), `npm run typecheck`, `npm run build`, `npm run smoke` (pm 37, lead 35, dev 27 routes return 200) and `linkcheck` (no dead link, every screen reached for all three roles) all pass. Hex colours appear only in `app/canvas.css` (tokens) and the Styleguide swatch page. Canvas comparison: the CSS is reused verbatim and the Standups page was checked at 1024 px; the side-by-side of every screen at 1280 and 1024 px was done manually by the operator and passed (2026-11-02) | W10 | this commit |
| 2026-11-02 | `src/fe` prototype: 73 canvas pages converted to React, routed by the spec URLs with a role cookie, every control wired to its screen; `linkcheck` passes for all three roles (no dead link, every screen reached). Not yet behind a data layer (T9b) | W10 | this commit |
| 2026-11-02 | Data layer `src/fe/lib/api` (typed fixtures, one function per endpoint number, in-memory store kept in sessionStorage). Board, sprints (start, close with carry-over, delete), members (add, remove with open-task refusal), checkpoints (add), standup (edit, accept, regenerate, copy, retry, example download), health (refresh, apply, dismiss), task status and blocked, archive project now work through it; toasts report each result | W10 | this commit |
| 2026-11-02 | Epics and task creation added to the data layer; backlog (all roles), add task and epic forms, new sprint form (overlap check), My work and the Projects list (New project for the PM only) now read and write through it | W10 | this commit |
| 2026-11-02 | Task drawer (edit, delete, status, block) and the three project overviews (progress, velocity, checkpoints, team) read through the data layer; task links carry the task id | W10 | this commit |
| 2026-11-01 | Spec index, edge cases and implementation order written; the screen files split so each stays under 200 lines (`screens-project.md`, `endpoint-coverage.md` added). `lint.mjs spec` passes. Implementer lens run, Tester skipped (C6) | W10 | 3aab4d6 |
| 2026-11-01 | All 20 screens, a global-states sheet, the close-sprint and plan-approve dialogs and shared shell components drawn on a design canvas (outside the repo); not visually verified | W10 | canvas link in Remaining |
| 2026-11-01 | Role variants, dialogs, states and shared components added to the canvas; spec updated for C9 to C15 (ui.md, edge-cases.md E11 and E48, screens-shared, screens-project, screens-dev, flows) | W10 | this commit |
| 2026-11-01 | Left nav removed; top-bar project switcher with All projects; full-width pages (C14; ui.md, edge-cases E45) | W10 | this commit |
| 2026-11-01 | PM Backlog and Checkpoints boards added; Plan tab moved before Checkpoints (C13; ui.md §3) | W10 | this commit |
| 2026-11-01 | Draft UI reference: shell and navigation, 20 screens with contents, interactions and states, and end-to-end flows per role | W10 | 4cd429a |
| 2026-10-31 | Workspace configured: state tree, AGENTS.md, vendored skills, role files and adapters; architecture decisions renamed AD-nn | — | `workflow-setup` |
| 2026-10-29 | Delivery plan, scope cut (AD-68), freeze (AD-69), deploy day (AD-70), UI scope (AD-71) and work split (AD-72) decided | — | `docs/architecture/delivery-plan.md` |
| 2026-10-29 | Architecture readiness gate passed for the first implementation slice | — | `docs/architecture/agile-platform-architecture.md` |

**Rotated:** none yet.
