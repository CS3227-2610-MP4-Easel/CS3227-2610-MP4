# Project State — Agile Platform

**Hot file — read in full every session.** `guardrails.md` beside it is also always loaded. Everything else (`architecture/`, `conventions/`, `decisions/`, `deviations/`, `lessons/`, `ledger/`) is read by ID or area, only when the task touches it. On `INT` this file changes only through `sync-project-state` (or an owner hotfix); on a branch, read it and write the branch state instead (`branch-state` skill).

- **Phase:** Pre-implementation. The architecture passed its readiness gate for the first slice on 2026-10-29; the W10 clickable prototype and W1 backend foundation/API skeleton are merged, while feature work remains.
- **Stack:** TypeScript monorepo, Next.js App Router with a Hono API under `/api`, Prisma, Postgres (Neon), Firebase Auth, Vercel (Hobby), NUS SoCLaaS
- **Branch:** `INT` = `development`; `main` is the release branch. This file describes `INT` only.
- **Last updated:** 2026-11-07 by ws fold — folded w3-guards
- **Last verified against repo:** 2026-11-03
- **Developer guide:** seeded 2026-11-02 from W10, [guide](../../docs/guide/index.md)
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

Verification commands are configured in `workflow/config.json`: `npm test`, `npm run typecheck`, `npm run lint`, and `npm --workspace @agile/db run prisma:validate`.

**Upcoming** — in priority order. **The first row is the next action.**

| Item | Kind | Context / done when | Source | Added |
|---|---|---|---|---|
| W5 `requireMember` and project/core resolver seams | Post-merge | implement filtered compound membership lookup and register W5 resource resolvers | handed over from w1 | 2026-11-03 |
| W4 principal, user lookup and route registration | Post-merge | supply `resolvePrincipal`, `lookupRegisteredUser`, dependencies, and append W4 routes to `ROUTES` | handed over from w1 | 2026-11-03 |
| W2/W7/W9 resource resolvers | Post-merge | implement session/usage, proposal, activity/summary/standup resolvers and register them | handed over from w1 | 2026-11-03 |
| W9 SELF membership check | Post-merge | ensure removed developers cannot access endpoints 52–54 through owner-only resolution | handed over from w1 | 2026-11-03 |
| W5 ADDER target-role semantics | Post-merge | resolve target roles and preserve 422/NOT_FOUND behavior for endpoints 10 and 11 | handed over from w1 | 2026-11-03 |
| W13 Deploy hello-world calling SoCLaaS `GET /v1/models` | Todo | answers G-26, G-32, G-33 with something running | delivery-plan P0 | 2026-10-31 |
| W15 calls `usageSummary` with a date range (it reads every matching row to compute the means) and gates endpoint 57 by role; `usageSessions`, `usageSummary` and `failureReason` all take `settings.tier`. | Workstream | W2 handover | handed over from `w2-gateway` | 2026-11-07 |
| the endpoints that call `Sessions.open` check the caller's project membership, and those that call `close` check owner or approver (SD11); `Sessions` does neither. | Todo | W2 handover | handed over from `w2-gateway` | 2026-11-07 |
| the W2 integration tests skip without `W1_INTEGRATION_DATABASE_URL`, and W12's CI does not set it; the CI owner (Dev Lead, W12) adds a Postgres 16 service to `.github/workflows/ci.yml`, sets the variable, and makes a missing integration database fail the job. A PR #14 reviewer asked for this ("should fix"); the operator chose to hand it to W12 rather than edit CI on this branch (2026-11-06). | Todo | W2 handover | handed over from `w2-gateway` | 2026-11-07 |
| W15 owns endpoints 56 and 57 and their resolvers; W1's handover listed "session and usage" resolvers under W2 (spec SD3). | Workstream | W2 handover | handed over from `w2-gateway` | 2026-11-07 |
| W7, W8 and W9 register their mock responses with `registerMockResponse` at import of their module, put their rules in `STATIC` sections (non-static sections can be dropped when the prompt is over budget), and call `assertStaticSectionsFit` in a test. | Todo | W2 handover | handed over from `w2-gateway` | 2026-11-07 |
| tell the PM and Dev Lead in the W2 PR that `createSessions` adds `regenerate` beside the frozen `Sessions` type (spec SD10), and that `Sessions.close` leaves the owner-or-approver check to their endpoints (SD11). | Todo | W2 handover | handed over from `w2-gateway` | 2026-11-07 |
| W13 sets `LLM_MODE`, `SOCLAAS_API_KEY` (dev and prod keys differ, AD-58) and, if SoCLaaS is unreachable from Vercel, `AI_ENABLED=false` per tier. | Todo | W2 handover | handed over from `w2-gateway` | 2026-11-07 |
| since the Prisma 7 merge, `npm test` (its `pretest` runs `prisma generate`) fails without `DATABASE_URL` set; tell the team to export it locally. | Todo | W2 handover | handed over from `w2-gateway` | 2026-11-07 |
| ask the PM whether W10 delivers a working sign-in page or a design only. | Workstream | see item | handed over from `w4-auth` | 2026-11-07 |
| correct architecture §7, which says a valid token always belongs to a verified, enabled account. Firebase does not guarantee that; see Known Gaps. | Workstream | see item | handed over from `w4-auth` | 2026-11-07 |
| tell the Dev Lead that W5 now owns `requireMember`, and that endpoint 10 must lowercase emails before lookup. | Workstream | see item | handed over from `w4-auth` | 2026-11-07 |
| `apiApp` validates auth settings when its module loads (from T3), so `next build`, `next dev` and every deployed tier need `APP_TIER` and the auth settings (`FIREBASE_PROJECT_ID`, the three `REGISTRATION_CODE_*`, `RATE_KEY_SECRET`) set; W13 for deployed tiers, `src/fe/.env.local` locally. Mock previews may omit all but `APP_TIER=preview`. | Workstream | see item | handed over from `w4-auth` | 2026-11-07 |
| W13 smoke checks on the deployed tiers (the limiter trusts `x-vercel-forwarded-for`, so dev and prod must run behind Vercel; on any other host a client can pick its own bucket): a forged `x-vercel-forwarded-for` must not change the limiter bucket, and a token from another Firebase project must get 401. `RATE_KEY_SECRET` must differ between dev and prod. | Workstream | see item | handed over from `w4-auth` | 2026-11-07 |
| the integration tests (E8, E10, E22, E23, E26, E35, E41) skip when `W1_INTEGRATION_DATABASE_URL` is unset, and the repo has no CI workflow; whoever adds CI should give it a Postgres 16 and fail when the URL is missing. | Workstream | see item | handed over from `w4-auth` | 2026-11-07 |
| add `REGISTRATION_CODE_*` and `RATE_KEY_SECRET` per tier in W13, and confirm `firebase-admin` verifies with only a project id on Vercel. Firebase's verify-token page says a service account is needed; if the smoke test fails, record a Deviation. | Workstream | see item | handed over from `w4-auth` | 2026-11-07 |
| W6, W7, W8, W9 follow W3's rules for sections (spec conventions.md § Rules for features): `trusted: true` only for server-built text; anything users typed or uploaded, and any stored model output reused as input, is `trusted: false`; `STATIC` sections are always trusted (`run` throws `INVALID_LLM_CALL` otherwise) and section names are literals; each untrusted section's budget leaves room for the 49-character wrapper plus its name line, and the statics leave room for the ~280-character suffix. | Workstream | see item | handed over from `w3-guards` | 2026-11-07 |
| W7 checks "empty after sanitising" with `sanitiseInput(text).blocked`; every feature maps `BLOCKED_INPUT` to 422 `VALIDATION_FAILED`; PM endpoints map `REQUEST_REFUSED` to 422, Dev Lead and Developer endpoints to the degraded 200 (architecture §8). | Workstream | see item | handed over from `w3-guards` | 2026-11-07 |
| W9 calls `sanitiseInput` per item to store each item's and summary's own `flagged`, and imports `GUARD_VERSION` (never copies it) into the `item_summaries` unique key (AD-67). | Workstream | see item | handed over from `w3-guards` | 2026-11-07 |
| W9 and W7 output schemas must not need URLs, angle brackets, HTML entities, `](`, `![`, `scheme:` values or dotted-quad numbers; such strings fail the output guard. | Workstream | see item | handed over from `w3-guards` | 2026-11-07 |
| W11's corpus can read the rule tables (`DELIMITER_RULES`, `PII_RULES`, `INJECTION_RULES`, `OUTPUT_RULES`) and the `reason` codes from `checkOutput`; per AD-26 the corpus is reviewed by a different owner than the guards' author (Developer). | Workstream | see item | handed over from `w3-guards` | 2026-11-07 |
| whoever changes a guard rule bumps `GUARD_VERSION` and adds its `KNOWN` entry in `src/be/llm-gateway/test/guards.test.ts` (spec conventions.md § bump checklist). | Workstream | see item | handed over from `w3-guards` | 2026-11-07 |

---

## 3. Workstreams

| ID | Workstream | Status | Spec | Plan | Progress | Guide |
|---|---|---|---|---|---|---|
| W1 | Foundation and API skeleton | Done | [review-repairs spec](../../specs/2026-11-02-w1-review-repairs-design.md); [backend source-root spec](../../specs/2026-11-02-w1-backend-source-root-design.md) | [review-repairs plan](../../plans/2026-11-02-w1-review-repairs-plan.md); [source-root plan](../../plans/2026-11-02-w1-backend-source-root-plan.md) | Merged 2026-11-03; resolver/auth handovers remain; confirmed 2026-11-03 | Documented 2026-11-03 |
| W2 | Gateway runtime and mock | Done | [spec](../../specs/2026-11-05-w2-gateway-design.md) | [plan](../../plans/2026-11-05-w2-gateway.md) | T1–T7 done; approved at Gate 3; PR #14 merged 2026-11-06; guide confirmed 2026-11-07 | Pending |
| W3 | Guards (untrusted-text pipeline) | In review | [spec](../../specs/2026-11-06-w3-guards-design.md) | [plan](../../plans/2026-11-06-w3-guards.md) | PR #15 fixes reviewed; owner review needed | — |
| W4 | Auth and registration | In review | [spec](../../specs/2026-10-31-w4-auth-design.md) | [plan](../../plans/2026-11-04-w4-auth.md) | T0–T6 done; PR #10 open | guide out of date: auth |
| W5 | Core planning (projects to tasks) | Not started | — | — | Tier 1 · Big · owner Dev Lead · after W1, W4 | — |
| W6 | AI context assembly | Not started | — | — | Tier 1 · Big · owner Developer · signature frozen first | — |
| W7 | PM plan flow (proposals, pm) | Not started | — | — | Tier 1 · Big · owner PM · after W2, W3, W5, W6 | — |
| W8 | Dev Lead facts and digest | Not started | — | — | Tier 1 · Big · owner Dev Lead · after W2, W3, W5 | — |
| W9 | Developer upload, summaries, standup | Not started | — | — | Tier 1 · Big · owner Developer · after W2, W3, W5, W6 | — |
| W10 | UI mockups and shell | Done | [spec folder](../../specs/2026-11-01-w10-ui-design/ui.md) ([index](../../specs/2026-11-01-w10-ui-design.md), approved 2026-11-02) | [plan](../../plans/2026-11-02-w10-prototype.md) (approved 2026-11-02) | Tier 1 · Big · owner PM · merged 2026-11-02 (PR #6), confirmed 2026-11-02 | Documented 2026-11-02 |
| W11 | Security corpus and authorisation tests | Not started | — | — | Tier 1 · Big · owner Dev Lead · after W1, W3 | — |
| W12 | CI and process security | Done | [spec](../../specs/2026-11-02-w12-ci-process-security-design.md) | [plan](../../plans/2026-11-02-w12-ci-process-security-plan.md) | T1–T7 merged (PR #9); agent policy narrowed (PR #13, C55); guide confirmed 2026-11-07 | Pending |
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
| C20 | Existing architecture contracts remain normative | [C20](decisions/C20.md) |
| C21 | Shared facts endpoint contract | [C21](decisions/C21.md) |
| C22 | Source-root monorepo | [C22](decisions/C22.md) |
| C23 | Backend-only source-root migration | [C23](decisions/C23.md) |
| C24 | Remove the obsolete frontend scaffold | [C24](decisions/C24.md) |
| C25 | Separate frontend typechecking | [C25](decisions/C25.md) |
| C26 | Permit the minimal health-route adapter | [C26](decisions/C26.md) |
| C27 | W2's scope boundaries and starting values | [C27](decisions/C27.md) |
| C28 | Under the W12 agent policy, the operator runs git and places workflow files | [C28](decisions/C28.md) |
| C29 | Fix W1's Prisma 7 test on this branch (reverses the D5 choice) | [C29](decisions/C29.md) |
| C30 | One CODEOWNER approval per PR | decisions/C30.md |
| C35 | W12 uses the thin enforceable baseline | decisions/C35.md |
| C36 | GitHub ownership and independent review handles | decisions/C36.md |
| C37 | W12 follows the merged W1 source-root layout | decisions/C37.md |
| C38 | Remediate audited dependencies before T3 completion | decisions/C38.md |
| C31 | Use Xiao-Congchen as the independent approver for Dev Lead PRs | decisions/C31.md |
| C34 | Permit an alternate security reviewer when `@ludannnn` authors a sensitive PR | decisions/C34.md |
| C32 | Use GitHub reviews as the sensitive-path approval source | decisions/C32.md |
| C39 | Use a fixed bootstrap list for the first manifest rollout | decisions/C39.md |
| C40 | Bound the bootstrap to the current development rollout | decisions/C40.md |
| C41 | Approve the bounded bootstrap amendment | decisions/C41.md |
| C33 | Use GitHub approvals without a committed artifact | decisions/C33.md |
| C42 | Re-evaluate review approvals in a separate trusted workflow | decisions/C42.md |
| C43 | Make the trusted workflow the authoritative security status | decisions/C43.md |
| C52 | The token check belongs to W4, not W1 | decisions/C52.md |
| C53 | W4 scope includes user lookup, `hit()` and the sign-in screen wiring | decisions/C53.md |
| C48 | `requireMember` moves from `auth` to `core`, built in W5 | decisions/C48.md |
| C44 | W4 adds two optional seams to W1's route registration | decisions/C44.md |
| C54 | W4 defines the tier setting for now | decisions/C54.md |
| C49 | W5, not W4, implements the membership resolvers | decisions/C49.md |
| C51 | Feature modules are workspace packages; `auth` is `src/be/auth` | decisions/C51.md |
| C45 | `hit()`'s atomic statement lives in `@agile/db` | decisions/C45.md |
| C46 | T7 (sign-in screen) moves to a follow-up spec and PR | decisions/C46.md |
| C50 | Tokens are verified with `firebase-admin` | decisions/C50.md |
| C47 | AD-57 kept despite its Firebase assumption being wrong | decisions/C47.md |
| C55 | Narrow the agent pre-tool policy to process-control files | decisions/C55.md |
| C57 | W3 starts stacked on `w2-gateway` | decisions/C57.md |
| C56 | W3's scope choices | decisions/C56.md |

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

- **Latest entry:** 2026-11-06
- **Entries (live file):** 112
