# Project State — Agile Platform

**Hot file — read in full every session.** `guardrails.md` beside it is also always loaded. Everything else (`architecture/`, `conventions/`, `decisions/`, `deviations/`, `lessons/`, `ledger/`) is read by ID or area, only when the task touches it. On `INT` this file changes only through `sync-project-state` (or an owner hotfix); on a branch, read it and write the branch state instead (`branch-state` skill).

- **Phase:** Pre-implementation. The architecture passed its readiness gate for the first slice on 2026-10-29; the W10 clickable prototype (`src/fe`) is merged, no backend code yet.
- **Stack:** TypeScript monorepo, Next.js App Router with a Hono API under `/api`, Prisma, Postgres (Neon), Firebase Auth, Vercel (Hobby), NUS SoCLaaS
- **Branch:** `INT` = `development`; `main` is the release branch. This file describes `INT` only.
- **Last updated:** 2026-11-02 by ws fold — folded w10-ui-mockups
- **Last verified against repo:** 2026-11-02
- **Developer guide:** not created; first write when the first approved spec lands on `INT`
- **Deadline:** 13 Nov 2026. Feature freeze end of 10 Nov (AD-69), production deploy 11 Nov (AD-70).

---

## 1. Orientation

A web app for Agile scrum teams: projects, epics, tasks, checkpoints and sprints, with one LLM feature per role (PM plans, Dev Lead digests and re-plans, Developer standups) behind a metering gateway. Target design: [architecture](../../docs/architecture/agile-platform-architecture.md), [contracts](../../docs/architecture/contracts.md), [delivery plan](../../docs/architecture/delivery-plan.md).

| Path | What lives there |
|---|---|
| `docs/architecture/` | Target architecture (AD-nn), contracts, decision log, delivery plan |
| `workflow/specs/`, `workflow/plans/` | Specs and plans (C2) |
| `workflow/agents/`, `workflow/models.json` | Provider-neutral role files and model tiers; adapters in `.claude/`, `.codex/` |
| `workflow/skills/` | Vendored skills (`ws skills sync`, locked) |
| `workflow/project-state/` | This tree: `architecture/`, `conventions/`, `decisions/`, `ledger/`, `branch-states/` |
| `tools/probe-soclaas/` | SoCLaaS probe script |

---

## 2. How to Resume

```bash
node workflow/tools/ws.mjs doctor   # node, git, state tree, hooks
node workflow/tools/ws.mjs pack implementer --area <area>   # what to read
```

No build or test commands yet; add them to `workflow/config.json` `test_commands` when the monorepo exists.

**Upcoming** — in priority order. **The first row is the next action.**

| Item | Kind | Context / done when | Source | Added |
|---|---|---|---|---|
| W1 Spec for the foundation and the frozen-first set | Workstream | contracts + policy map, `LlmGateway.run` + mock, `AiContext.assemble`, `Sessions`, `Core` signatures frozen (A-18) | delivery-plan P0 | 2026-10-31 |
| W13 Deploy hello-world calling SoCLaaS `GET /v1/models` | Todo | answers G-26, G-32, G-33 with something running | delivery-plan P0 | 2026-10-31 |

---

## 3. Workstreams

| ID | Workstream | Status | Spec | Plan | Progress | Guide |
|---|---|---|---|---|---|---|
| W1 | Foundation and API skeleton | Not started | — | — | Tier 1 · Big · owner Dev Lead · first | — |
| W2 | Gateway runtime and mock | Not started | — | — | Tier 1 · Big · owner Developer · after W1 signature | — |
| W3 | Guards (untrusted-text pipeline) | Not started | — | — | Tier 1 · Big · owner Developer · after W2 | — |
| W4 | Auth and registration | Not started | — | — | Tier 1 · Big · owner Developer · after W1 | — |
| W5 | Core planning (projects to tasks) | Not started | — | — | Tier 1 · Big · owner Dev Lead · after W1, W4 | — |
| W6 | AI context assembly | Not started | — | — | Tier 1 · Big · owner Developer · signature frozen first | — |
| W7 | PM plan flow (proposals, pm) | Not started | — | — | Tier 1 · Big · owner PM · after W2, W3, W5, W6 | — |
| W8 | Dev Lead facts and digest | Not started | — | — | Tier 1 · Big · owner Dev Lead · after W2, W3, W5 | — |
| W9 | Developer upload, summaries, standup | Not started | — | — | Tier 1 · Big · owner Developer · after W2, W3, W5, W6 | — |
| W10 | UI mockups and shell | Done | [spec folder](../../specs/2026-11-01-w10-ui-design/ui.md) ([index](../../specs/2026-11-01-w10-ui-design.md), approved 2026-11-02) | [plan](../../plans/2026-11-02-w10-prototype.md) (approved 2026-11-02) | Tier 1 · Big · owner PM · merged 2026-11-02 (PR #6), confirmed 2026-11-02 | Pending |
| W11 | Security corpus and authorisation tests | Not started | — | — | Tier 1 · Big · owner Dev Lead · after W1, W3 | — |
| W12 | CI and process security | Not started | — | — | Tier 1 · Medium · owner Dev Lead · after W1 | — |
| W13 | Environments, seed data and deployment | Not started | — | — | Tier 1 · Big · owner repo owner · after W1 | — |
| W14 | Sprints, velocity and re-plan | Not started | — | — | Tier 2.1 · Big · owner Dev Lead · after W5, W8 | — |
| W15 | Usage views | Not started | — | — | Tier 2.2 · Medium · owner PM · after W2 | — |
| W16 | Tier 2 remainder | Not started | — | — | Tier 2 · Medium · per owner · after W5, W7, W9 | — |
| W17 | Experiments and telemetry evidence | Not started | — | — | P2 · Medium · all · after W7, W8, W9 | — |
| W18 | Reflection document (R7) | Not started | — | — | Small · all · after W17 | — |

Sliced and confirmed 2026-10-31; realises, dependencies and areas per workstream in [slicing.md](../specs/slicing.md).

Status: `Not started` · `Spec'd` · `Planned` · `Building` · `Blocked — needs human` · `In review` · `Done` · `Abandoned`.

---

## 4. Decision Index

> Legend: `C` = project decision. Architecture decisions (`AD-nn`) live in the [decision log](../../docs/architecture/decision-log.md) and in each area file.

| ID | One-line decision | File |
|---|---|---|
| C1 | Architecture decisions are `AD-nn`; state IDs have no hyphen | [C1](decisions/C1.md) |
| C2 | Specs and plans in `workflow/specs` and `workflow/plans` | [C2](decisions/C2.md) |
| C3 | Each slice owner approves their own specs, plans and branch reviews | [C3](decisions/C3.md) |
| C4 | Agents from role files; Claude Code and Codex adapters generated | [C4](decisions/C4.md) |
| C5 | Developer guide per phase in `docs/guide/` | [C5](decisions/C5.md) |
| C6 | Only the Implementer lens reviews the W10 spec | [C6](decisions/C6.md) |
| C7 | Mock up on the design canvas first, prototype later; all 20 screens in one pass | [C7](decisions/C7.md) |
| C8 | All source code lives under `src/`; the web app is `src/fe`, not `apps/web` | [C8](decisions/C8.md) |
| C9 | Light is the default theme; the dark palette on the canvas is for testing only | [C9](decisions/C9.md) |
| C10 | Canvas organisation: shared components at the side, role variants, states and dialogs drawn | [C10](decisions/C10.md) |
| C11 | The PM may read project facts | [C11](decisions/C11.md) |
| C12 | Team roles and ownership | [C12](decisions/C12.md) |
| C13 | Plan tab moves before Checkpoints; PM gets its own Backlog and Checkpoints boards | [C13](decisions/C13.md) |
| C14 | No left navigation: the top-bar project switcher gains "All projects", and pages use the full width | [C14](decisions/C14.md) |
| C15 | Board gets a status filter; the multi-column card layout is dynamic | [C15](decisions/C15.md) |
| C16 | The screen reference lives in the W10 spec folder, split by role | [C16](decisions/C16.md) |
| C17 | Inventory and open points of the UI reference approved; standup day is a two-option selector | [C17](decisions/C17.md) |
| C18 | No "Sprint closed" label on cards and rows | [C18](decisions/C18.md) |
| C19 | Closing a sprint moves unfinished tasks to the next sprint, after confirmation | [C19](decisions/C19.md) |

---

## 5. Needs a Human

| ID | What is needed | What it blocks | Raised |
|---|---|---|---|
| Q2 | Decide A-17 process-security files (CODEOWNERS, agent permission policy, CI placeholders); deferred in the architecture | nothing now; needed before P1 merges | 2026-10-31 |
| Q3 | Run the day-1 checks: SoCLaaS reachable from Vercel (G-26), Neon pooling and Prisma on serverless (G-32); migrations and recovery in the spec (G-28) | deployment | 2026-10-31 |
| Q4 | Choose the process model per tier and run the model experiment (AD-23b, experiments.md) | model routing only; tool defaults apply | 2026-10-31 |

---

## 6. Record

The Done ledger is **[`ledger/done-ledger.md`](ledger/done-ledger.md)**, newest first.

- **Latest entry:** 2026-11-02
- **Entries (live file):** 18
