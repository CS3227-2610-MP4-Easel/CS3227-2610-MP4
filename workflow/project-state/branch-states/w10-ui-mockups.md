# Branch State — w10-ui-mockups

**What this branch has changed, and how to pick it up.** `workflow/project-state/STATE.md`
describes `INT`; read it for context and write here instead of editing it.
`sync-project-state` folds this file in after the branch merges.

- **Branch:** w10-ui-mockups (from `INT` at `4f5f5de`)
- **Base:** 4f5f5de
- **Owner:** Xiao-Congchen (W10 is owned by the PM role, AD-72; member-to-role mapping is open, STATE Q1)
- **Status:** Draft
- **Approved:** —
- **Last updated:** 2026-11-01 by Claude Sonnet 5.5 — spec index, edge cases and implementation order written

**Untouched:** Architecture, Conventions, Known Gaps, Deviations

---

**Scope.** W10 UI mockups and shell. First deliverable: one reference document that lists, for every screen of every role, its contents, interactions and states, so the mockups can be built from it. Tier 1 mockups are due 2 Nov, Tier 2 by 5 Nov (AD-71). No code and no mockup yet.

---

## 1. How to Resume

**Sessions**

| Session | Started | Agent(s) | Workstream | Status | Doing | Next action | Last touched |
|---|---|---|---|---|---|---|---|
| S1 | 2026-11-01 | Claude Sonnet 5.5 | W10 | Paused | Spec index, edge cases and implementation order written; lint passes | Ask the owner for gate 1 (spec approval); close Q9 (prototype stack) and Q10 (Remove on own row) | 2026-11-01 |

**Remaining**

- [x] Operator review of the flows draft: inventory and Q1 to Q8 decided 2026-11-01 (`ui.md` §8).
- [x] Spec index (`2026-11-01-w10-ui-design.md`), `edge-cases.md`, `implementation-order.md` written; `lint.mjs spec` passes (2026-11-01).
- [x] Review: one Implementer lens run, findings fixed; Tester lens skipped at the operator's request (C~5).
- [ ] Gate 1 (`writing-specs-lite`). Open: Q9 (prototype stack, blocks T9) and Q10 (Remove on the caller's own row, S11). Gate 1 needs them answered or accepted as open.
- [ ] Re-check that the canvas matches the review fixes: Continue plan banner on S14 phase A, PM keeps Add task on S6, sprint controls hidden in Tier 1, project tabs now carry a Tier.
- [x] Design tokens, shell and shared components, then all 20 screens drawn on the design canvas (https://claude.ai/artifact/1J79XZiCmPvriGrBtAP2B6), 2026-11-01.
- [ ] Operator review of the canvas; fix details until "most details are confirmed" (C~4).
- [ ] Then translate the confirmed canvas to a standalone prototype (stack to be chosen; `apps/web` is W1's). Tokens to mirror as CSS variables: `project/ui.css` `:root` on the canvas.
- [ ] Not yet drawn: S14 phase D (approved/discarded/superseded views), S20 degraded standup state, tablet width (1024 px) checks. The canvas was not opened or rendered by me; nothing is visually verified.
- [ ] **Handover:** tell the Dev Lead (W5) that endpoint 6 should return `ProjectDetail` items (progress per project, approved as Q1 in the W10 spec's `ui.md` §8); without it S3 calls endpoint 7 per row.
- [ ] **Handover (permission change and endpoint move):** the PM may read the full facts (approved as Q5 and C~3). Endpoint 42 moves from `/api/lead/projects/{id}/facts` to the shared path `GET /api/projects/{id}/facts` (AD-07 reserves `/api/lead` for the Dev Lead) and its policy changes from `LEAD; member` to `PM, LEAD; member`. The number and the endpoint count (57) stay. Owners: the Dev Lead (policy map, W1) and the W8 owner (`lead` module). Amend AD-47, architecture §7 operation table, `contracts.md` §3.5, `delivery-plan.md` and `slicing.md` if they cite the path, and the generated authorisation tests (AD-26). Digest (44, 45) and re-plan (46 to 48) stay Dev Lead only.
- [ ] **Handover:** tell the W7 owner that endpoint 36 (plan list) moves from Tier 2 to Tier 1, so the PM can continue a plan in progress (approved as Q2). Update the Tier lists in `delivery-plan.md` and `slicing.md`.
- [ ] **Handover:** tell the W9 owner that the standup `date` may be tomorrow (the next working day, Asia/Singapore) as well as today, because a standup prepares the next daily standup. Confirm endpoint 51 and 52 accept a future date and how the AD-44 activity window is anchored to it; amend `contracts.md` if needed.
- [ ] **Handover:** tell the W4 owner the sign-in and register screens are specified in `screens-shared.md` S1 and S2; W4's branch still asks whether W10 delivers a working page or a design only; answer it in the spec index.

---

## 2. Workstreams

| ID | Workstream | Status | Spec | Plan | Progress | Guide |
|---|---|---|---|---|---|---|
| W10 | UI mockups and shell | Not started | [spec folder](../../specs/2026-11-01-w10-ui-design/ui.md) ([index](../../specs/2026-11-01-w10-ui-design.md), draft) | — | Spec drafted, lint clean; T2 spec close-out: lenses and gate 1 next | — |

---

## 3. Changes

| Date | What changed | Workstream | Ref |
|---|---|---|---|
| 2026-11-01 | Draft UI reference: shell and navigation, 20 screens with contents, interactions and states, and end-to-end flows per role | W10 | 4cd429a |
| 2026-11-01 | All 20 screens, a global-states sheet, the close-sprint and plan-approve dialogs and shared shell components drawn on a design canvas (outside the repo); not visually verified | W10 | canvas link in Remaining |
| 2026-11-01 | Spec index, edge cases and implementation order written; the screen files split so each stays under 200 lines (`screens-project.md`, `endpoint-coverage.md` added). `lint.mjs spec` passes. No lenses run yet | W10 | this commit |

---

## 7. Decisions

> Legend: `C` = project decision. AD-nn entries are in docs/architecture.

### C~1 — The screen reference lives in the W10 spec folder, split by role

- **Date:** 2026-11-01
- **Who asked:** operator (Xiao-Congchen), who wanted a document of each page's contents and interactions to build the mockups from, going beyond architecture §13
- **Why:** it is the `ui.md` component of W10's Big spec, so it is reviewed and approved with the spec. Split into shared rules, flows and one file per role so each stays readable.
- **Rejected:** a standalone file under `docs/`, which would sit outside the approval gate; a single file, which would be too long to review.

### C~2 — Inventory and open points of the UI reference approved; standup day is a two-option selector

- **Date:** 2026-11-01
- **Who asked:** operator (Xiao-Congchen)
- **Why:** the 20-screen inventory and Q1, Q2, Q3, Q4, Q6, Q8 were accepted as proposed; Q1 and Q2 change other owners' contracts and scope, so they are handovers above. Q5 was answered: the PM sees project progress, only forecast and risk stay Dev Lead only. Q7 was changed: a standup prepares the next daily standup, so S20 offers **For the next standup** (default, the next working day) and **For today**, instead of a date picker.
- **Rejected:** a free date picker limited to the last 7 days (the first proposal).

### C~4 — Mock up on the design canvas first, prototype later; all 20 screens in one pass

- **Date:** 2026-11-01
- **Who asked:** operator (Xiao-Congchen), answering the build-target question
- **Why:** details should be confirmed on the canvas before any code; the standalone prototype is translated from it afterwards. Scope is all 20 screens, not Tier 1 only.
- **Rejected:** scaffolding `apps/web` now (W1 has not landed); static HTML only.

### C~3 — The PM may read project facts

- **Date:** 2026-11-01
- **Who asked:** operator (Xiao-Congchen), reversing the earlier clarification of Q5 (PM sees progress but no risk)
- **Supersedes:** AD-47 and architecture §7's operation table, which list facts as Dev Lead only
- **Why:** the PM should see current progress, forecast and checkpoint risk without asking the Dev Lead. It is a read of data the PM can already see in pieces.
- **Scope confirmed:** the PM gets the whole `Facts` response (progress, forecast, per-checkpoint risk, overload), because the PM manages the whole project or several. Uploaded items, summaries and standups stay invisible to the PM.
- **Contract:** endpoint 42 moves to `GET /api/projects/{id}/facts` with policy `PM, LEAD; member`.
- **Rejected:** computing checkpoint progress in the browser; a trimmed PM response.

### C~5 — Only the Implementer lens reviews the W10 spec

- **Date:** 2026-11-01
- **Who asked:** operator (Xiao-Congchen)
- **Why:** W10 is UI design only (no data, no code), so the Tester lens adds little.
- **Rejected:** the Medium-tier default of Implementer plus Tester.
