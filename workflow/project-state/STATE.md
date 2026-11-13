# Project State — Agile Platform

**Hot file — read in full every session.** `guardrails.md` beside it is also always loaded. Everything else (`architecture/`, `conventions/`, `decisions/`, `deviations/`, `lessons/`, `ledger/`) is read by ID or area, only when the task touches it. On `INT` this file changes only through `sync-project-state` (or an owner hotfix); on a branch, read it and write the branch state instead (`branch-state` skill).

- **Phase:** Pre-implementation. The architecture passed its readiness gate for the first slice on 2026-10-29; the W10 clickable prototype, W1 foundation/API skeleton, W2 gateway, W3 guards, W4 auth, W6 AI context and W12 CI are merged, while the role features (W5, W7-W9) remain.
- **Stack:** TypeScript monorepo, Next.js App Router with a Hono API under `/api`, Prisma, Postgres (Neon), Firebase Auth, Vercel (Hobby), NUS SoCLaaS
- **Branch:** `INT` = `development`; `main` is the release branch. This file describes `INT` only.
- **Last updated:** 2026-11-13 by Claude Opus 5.5 — folded w9-screen-wiring, w9-self-membership
- **Last verified against repo:** 2026-11-13 (W4, W5, W8, W9, W11, and W13 guide checkpoint)
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
| W7 resource resolvers | Post-merge | implement proposal resolvers and register them (W9's activity/summary/standup resolvers are done) (session/usage resolvers are W15's) | handed over from w1, w2-gateway | 2026-11-03 |
| W16: standup edit and feedback must check membership | Todo | endpoint 52 is covered (its `DEV_STANDUP_MINE_READ` resolver calls `requireMember` before setting `ownerId`; route test in `src/be/api/test/dev-routes.test.ts`). When W16 builds 53 and 54 (`SELF` on a standup id), their resolvers must check the caller's current membership of the standup's project, not only that they own the row | handed over from w9-self-membership | 2026-11-13 |
| W5 ADDER target-role semantics | Post-merge | resolve target roles and preserve 422/NOT_FOUND behavior for endpoints 10 and 11 | handed over from w1 | 2026-11-03 |
| W13 Deploy hello-world calling SoCLaaS `GET /v1/models` | Todo | answers G-26, G-32, G-33 with something running | delivery-plan P0 | 2026-10-31 |
| W15 usage endpoints 56 and 57 | Todo | W15 owns endpoints 56 and 57 and their resolvers (spec SD3). It calls `usageSummary` with a date range (it reads every matching row to compute the means) and gates endpoint 57 by role; `usageSessions`, `usageSummary` and `failureReason` all take `settings.tier` | handed over from w2-gateway | 2026-11-07 |
| Session endpoints check membership | Todo | the endpoints that call `Sessions.open` check the caller's project membership, and those that call `close` check owner or approver (SD11); `Sessions` does neither | handed over from w2-gateway | 2026-11-07 |
| CI Postgres for integration tests (W12) | Todo | the W2 and W4 integration tests skip without `W1_INTEGRATION_DATABASE_URL`, and W12's CI does not set it; the CI owner (Dev Lead, W12) adds a Postgres 16 service to `.github/workflows/ci.yml`, sets the variable, and makes a missing integration database fail the job. A PR #14 reviewer asked for this; the operator chose to hand it to W12 (2026-11-06) | handed over from w2-gateway, w4-auth | 2026-11-07 |
| Mock responses and static sections (W7, W8, W9) | Todo | register mock responses with `registerMockResponse` at import of their module, put rules in `STATIC` sections (non-static sections can be dropped when the prompt is over budget), and call `assertStaticSectionsFit` in a test | handed over from w2-gateway | 2026-11-07 |
| Tell PM and Dev Lead about `regenerate` and `close` | Todo | in the W2 PR: `createSessions` adds `regenerate` beside the frozen `Sessions` type (spec SD10), and `Sessions.close` leaves the owner-or-approver check to their endpoints (SD11) | handed over from w2-gateway | 2026-11-07 |
| W13 environment variables | Todo | set `LLM_MODE`, `SOCLAAS_API_KEY` (dev and prod keys differ, AD-58) and, if SoCLaaS is unreachable from Vercel, `AI_ENABLED=false` per tier; add `REGISTRATION_CODE_*` and `RATE_KEY_SECRET` per tier and confirm `firebase-admin` verifies with only a project id on Vercel (Firebase's verify-token page says a service account is needed; if the smoke test fails, record a Deviation); `apiApp` validates auth settings at module load, so `next build`, `next dev` and every deployed tier need `APP_TIER`, `FIREBASE_PROJECT_ID`, the three `REGISTRATION_CODE_*` and `RATE_KEY_SECRET` (`src/fe/.env.local` locally; mock previews may omit all but `APP_TIER=preview`) | handed over from w2-gateway, w4-auth | 2026-11-07 |
| W13 smoke checks on deployed tiers | Todo | the limiter trusts `x-vercel-forwarded-for`, so dev and prod must run behind Vercel (on any other host a client can pick its own bucket): a forged `x-vercel-forwarded-for` must not change the limiter bucket, and a token from another Firebase project must get 401; `RATE_KEY_SECRET` must differ between dev and prod | handed over from w4-auth | 2026-11-07 |
| Export `DATABASE_URL` for `npm test` | Todo | since the Prisma 7 merge, `npm test` (its `pretest` runs `prisma generate`) fails without `DATABASE_URL` set; tell the team to export it locally | handed over from w2-gateway | 2026-11-07 |
| Correct architecture §7 | Todo | it says a valid token always belongs to a verified, enabled account; Firebase does not guarantee that; see Known Gaps | handed over from w4-auth | 2026-11-07 |
| Tell the Dev Lead about `requireMember` and emails | Todo | W5 now owns `requireMember`, and endpoint 10 must lowercase emails before lookup | handed over from w4-auth | 2026-11-07 |
| Section rules for W6-W9 | Todo | follow W3's rules for sections (spec conventions.md § Rules for features): `trusted: true` only for server-built text; anything users typed or uploaded, and any stored model output reused as input, is `trusted: false`; `STATIC` sections are always trusted (`run` throws `INVALID_LLM_CALL` otherwise) and section names are literals; each untrusted section's budget leaves room for the 49-character wrapper plus its name line, and the statics leave room for the ~280-character suffix | handed over from w3-guards | 2026-11-07 |
| W7 blocked-input handling | Todo | W7 checks "empty after sanitising" with `sanitiseInput(text).blocked`; every feature maps `BLOCKED_INPUT` to 422 `VALIDATION_FAILED`; PM endpoints map `REQUEST_REFUSED` to 422, Dev Lead and Developer endpoints to the degraded 200 (architecture §8) | handed over from w3-guards | 2026-11-07 |
| W7 output schemas | Todo | must not need URLs, angle brackets, HTML entities, `](`, `![`, `scheme:` values or dotted-quad numbers; such strings fail the output guard | handed over from w3-guards | 2026-11-07 |
| W11 corpus reads the guard rules | Todo | the corpus can read the rule tables (`DELIMITER_RULES`, `PII_RULES`, `INJECTION_RULES`, `OUTPUT_RULES`) and the `reason` codes from `checkOutput`; per AD-26 the corpus is reviewed by a different owner than the guards' author (Developer) | handed over from w3-guards | 2026-11-07 |
| Changing a guard rule | Todo | whoever changes a guard rule bumps `GUARD_VERSION` and adds its `KNOWN` entry in `src/be/llm-gateway/test/guards.test.ts` (spec conventions.md § bump checklist) | handed over from w3-guards | 2026-11-07 |
| W5 delivery estimate | Todo | the operator is asking W5's owner (Dev Lead) for a delivery estimate; W6's membership check and its core-owned sections depend on W5 | handed over from w6-ai-context | 2026-11-07 |
| Contracts §5.2 follow-up for `assembleWith` | Todo | SD4 is signed off (C59); the follow-up names `assembleWith` as the entry point for every feature, with `assemble` kept but throwing for `DEV_SUMMARY` and `DEV_STANDUP` (D18) | handed over from w6-ai-context | 2026-11-07 |
| W5 `requireMember` placement and boot test | Todo | confirm where `requireMember` lives (architecture §4 says `auth`, frozen contracts §5.4 says `Core`; W6 follows §5.4) and that it throws `NotMember` for archived projects; the API composition root calls `registerCore(core)` and registers `core.projectBrief`, `core.checkpoints`, `core.taskEvents`, `core.blockedTasks`; `core` must not import `@agile/ai-context`; add a boot test asserting the core and all ten source ids are registered | handed over from w6-ai-context | 2026-11-07 |
| W7/W8 context sources and `assembleWith` | Todo | register your sources at module load with `registerContextSource` (rules in [W6 spec conventions.md § Rules for source owners](../specs/2026-11-06-w6-ai-context-design/conventions.md): `ownerId` meanings, rows most important first, filtered client, no unsafe raw SQL); call `assembleWith`, not `assemble`; keep gateway-calling files free of database imports (the source scan enforces it); never catch `ContextScopeViolation`. W7: `pm.similarItems` filters by the caller's member projects before searching, titles only, at most 5. W8: `lead.facts` emits only `FACT_KEYS` rows (add keys to `allow-list.ts` by PR, and update `facts`' max chars, which a test pins); test that the overload fact covers only member projects (C-28) | handed over from w6-ai-context | 2026-11-07 |
| Slicing: W8 also depends on W6 | Todo | `workflow/specs/slicing.md` lists W8's dependencies as W2, W3, W5; it also depends on W6 | handed over from w6-ai-context | 2026-11-07 |
| W10 canvas screens are fixed-size | Todo | to the PM (W10): the canvas screens, including the live sign-in and register screens that reuse their markup, are fixed-size (`.app { min-height: 1000px }` in `src/fe/app/canvas.css`, fixed flex bases such as `1 1 420px`), so they do not adapt to short or very wide windows (seen by the operator on an ultrawide monitor) | handed over from w4-sign-in-screen | 2026-11-13 |
| W13 Firebase projects per tier | Todo | to the repo owner (W13): `agile-platform-dev` exists (owner ludannnn; add the repo owner as Owner); create `agile-platform-prod` with that exact ID (`src/be/db/src/tier-targets.ts`) and add the Vercel domains to Authorized domains on both projects; set the four `NEXT_PUBLIC_FIREBASE_*` values per tier | handed over from w4-sign-in-screen | 2026-11-13 |
| W12 pin the fe test script | Todo | to the Dev Lead (W12): `tests/process-security/ci-workflow.test.ts` now pins the chained root `test` script (C63) but not `src/fe/package.json` `scripts.test` (`vitest run`) or `src/fe/vitest.config.ts`; consider asserting the fe script too (T1 Attacker review nit) | handed over from w4-sign-in-screen | 2026-11-13 |
| Lazy-load the Firebase SDK | Todo | `AuthRoot` in the root layout statically imports `lib/auth/firebase` and `session`, so `@firebase/app` and `@firebase/auth` ship in every page bundle, including prototype previews; load them lazily (`next/dynamic` or `import()`) only in `firebase` mode. `force-dynamic` on the layout is deliberate (mode read per request) | handed over from w4-sign-in-screen | 2026-11-13 |
| W5 member removal and archive must lock the project | Todo | to the Dev Lead (W5): W9 adds an export of `lockProjectForMutation` to `src/be/core/src/index.ts` (C71); its no-op `version: { increment: 0 }` update bumps `projects.updated_at` (`@updatedAt`) on every task, checkpoint, membership and now W9 write. When member removal (endpoint 11) and project archive are built, they must update the project row (`lockProjectForMutation`) so they serialise with W9's writes; W9's seam reads membership through core's `requireMember`, which does not take the transaction | handed over from w9-dev-slice | 2026-11-13 |
| Contracts rows 49-51: list W9's errors | Todo | contracts.md rows 50 and 51 list fewer errors than W9 returns (`RATE_LIMITED`, `AI_DISABLED`, 422 for `BLOCKED_INPUT`, 404, 409); add them as a clarification (they follow architecture §8 and the W3 handover). Rows 49-51 also gain 429 `RATE_LIMITED` with `Retry-After: 1` when concurrent writes to one project exhaust the retries (C72) | handed over from w9-dev-slice | 2026-11-13 |
| W17: dev `CACHE_HIT` rows | Todo | tell W17 that `CACHE_HIT` rows now exist for DEV_SUMMARY and DEV_STANDUP (spec SD13); summary hits have a null `session_id` | handed over from w9-dev-slice | 2026-11-13 |
| S20/S18 wiring to the live W9 API | Workstream | Medium follow-up (C69), in progress on branch `w9-screen-wiring`; the browser must cut bodies over 2000 characters instead of rejecting them (spec SD4), send `{}` (not an empty body) to endpoint 51, and render summaries and standup lines as plain text only | handed over from w9-dev-slice | 2026-11-13 |
| W5: `core.blockedTasks` ignores the window | Todo | to the Dev Lead (W5): `core.blockedTasks` now ignores `options.window` and lists every task assigned to the caller that is blocked now (D23); `context-sources.test.ts` was updated to match (the W5 spec names no window for this source, so it is unchanged). DEV_STANDUP is its only consumer | handed over from w9-dev-slice | 2026-11-13 |
| Merge the two `bodyTooLarge` helpers | Todo | two identical `bodyTooLarge` helpers exist (`src/be/api/src/body-limit.ts` from W9, `src/be/api/src/routes/shared.ts` from W7/W8; `auth.ts` and `pm.ts` use the latter); fold them into one in a Small change. W4: `auth.ts` keeps 4,096 bytes. W1: `RouteDefinition.bodyLimitBytes` (plan P1) reads the body after authorisation; endpoints 49 (1 MiB), 50 and 51 (16 KiB) use it | handed over from w9-dev-slice | 2026-11-13 |
| S20/S18 day tabs keyboard support | Todo | the day tabs (`role="tab"`) have no `tabpanel` or arrow-key navigation (accessibility) | handed over from w9-screen-wiring | 2026-11-13 |
| One mock/live switch for the web app | Todo | three switches decide live vs fixtures: `useAuthMode()` (S20/S18, W9 SD1), `useProjectRoute().mode` (UUID in the URL, W5 #35) and `isLive()` (`LLM_MODE === 'live'`, W7 PM UI). `isLive()` keeps New project and Plan on fixtures whenever `LLM_MODE` is not `live`, even with real sign-in; the PM is fixing that. Pick one mechanism | handed over from w9-screen-wiring | 2026-11-13 |

---

## 3. Workstreams

| ID | Workstream | Status | Spec | Plan | Progress | Guide |
|---|---|---|---|---|---|---|
| W1 | Foundation and API skeleton | Done | [review-repairs spec](../../specs/2026-11-02-w1-review-repairs-design.md); [backend source-root spec](../../specs/2026-11-02-w1-backend-source-root-design.md) | [review-repairs plan](../../plans/2026-11-02-w1-review-repairs-plan.md); [source-root plan](../../plans/2026-11-02-w1-backend-source-root-plan.md) | Merged 2026-11-03; resolver/auth handovers remain; confirmed 2026-11-03 | Documented 2026-11-03 |
| W2 | Gateway runtime and mock | Done | [spec](../../specs/2026-11-05-w2-gateway-design.md) | [plan](../../plans/2026-11-05-w2-gateway.md) | T1–T7 done; approved at Gate 3; PR #14 merged 2026-11-06; guide confirmed 2026-11-07 | Documented 2026-11-07 |
| W3 | Guards (untrusted-text pipeline) | Done | [spec](../../specs/2026-11-06-w3-guards-design.md) | [plan](../../plans/2026-11-06-w3-guards.md) | PR #15 merged 2026-11-07; guide confirmed 2026-11-07 | Documented 2026-11-07 |
| W4 | Auth and registration | Done | [spec](../../specs/2026-10-31-w4-auth-design.md), [T7 spec](../../specs/2026-11-08-w4-sign-in-screen-design.md) (approved 2026-11-08) | [plan](../../plans/2026-11-08-w4-sign-in-screen/plan.md) (approved 2026-11-08) | T0–T6 PR #10 merged 2026-11-05; T7 sign-in screen PR #25 merged 2026-11-09; guide confirmed 2026-11-13 | Documented 2026-11-13 |
| W5 | Core planning (projects to tasks) | Done | [spec](../../specs/2026-11-07-w5-core-planning-design.md) | [plan](../../plans/2026-11-08-w5-core-planning/plan.md) | T1–T6 complete; merged and folded 2026-11-13 | Documented 2026-11-13 |
| W6 | AI context assembly | Done | [spec](../../specs/2026-11-06-w6-ai-context-design.md) | [plan](../../plans/2026-11-06-w6-ai-context.md) | PR #16 merged 2026-11-07; SD4 signed off (C59); depends on W5 for `requireMember`; guide confirmed 2026-11-07 | Documented 2026-11-07 |
| W7 | PM plan flow (proposals, pm) | Not started | — | — | Tier 1 · Big · owner PM · after W2, W3, W5, W6 | — |
| W8 | Dev Lead facts and digest | Done | [spec](../../specs/2026-11-09-w8-dev-lead-facts-digest-design.md) (approved/amended 2026-11-09) | [plan](../../plans/2026-11-09-w8-dev-lead-facts-digest/plan.md) (approved/amended 2026-11-09) | `factsAsOf` migration, bounded ordering, `previousDigest`, session-cap mapping, compatibility trigger, and final verification complete; merged and folded 2026-11-13 | Documented 2026-11-13 |
| W9 | Developer upload, summaries, standup | Done | [spec](../../specs/2026-11-08-w9-dev-slice-design.md) (approved 2026-11-08, amended 2026-11-09) | [plan](../../plans/2026-11-09-w9-dev-slice/plan.md) (approved 2026-11-09) | PR #29 merged 2026-11-13; S20/S18 wiring in W19; SELF membership for 52 verified (PR #38); guide confirmed 2026-11-13 | Documented 2026-11-13 |
| W10 | UI mockups and shell | Done | [spec folder](../../specs/2026-11-01-w10-ui-design/ui.md) ([index](../../specs/2026-11-01-w10-ui-design.md), approved 2026-11-02) | [plan](../../plans/2026-11-02-w10-prototype.md) (approved 2026-11-02) | Tier 1 · Big · owner PM · merged 2026-11-02 (PR #6), confirmed 2026-11-02 | Documented 2026-11-02 |
| W11 | Security corpus and authorisation tests | Done | [spec](../../specs/2026-11-09-w11-security-corpus-authorisation-tests-design.md) | [plan](../../plans/2026-11-09-w11-security-corpus-authorisation-tests/plan.md) | T1-T3 done; focused and full verification green; merged and folded 2026-11-13 | Documented 2026-11-13 |
| W12 | CI and process security | Done | [spec](../../specs/2026-11-02-w12-ci-process-security-design.md) | [plan](../../plans/2026-11-02-w12-ci-process-security-plan.md) | T1–T7 merged (PR #9); agent policy narrowed (PR #13, C55); guide confirmed 2026-11-07 | Documented 2026-11-07 |
| W13 | Environments, seed data and deployment | Done | [follow-up spec](../../specs/2026-11-07-w13-pr18-safety-fixes-design.md); [safety repairs](../../specs/2026-11-12-w13-safety-repairs-design.md) (amended and approved 2026-11-12) | [safety repairs plan](../../plans/2026-11-12-w13-safety-repairs/plan.md) (approved 2026-11-12) | T1-T4 complete; merged and folded 2026-11-13 | Documented 2026-11-13 |
| W14 | Sprints, velocity and re-plan | Not started | — | — | Tier 2.1 · Big · owner Dev Lead · after W5, W8 | — |
| W15 | Usage views | Not started | — | — | Tier 2.2 · Medium · owner PM · after W2 | — |
| W16 | Tier 2 remainder | Not started | — | — | Tier 2 · Medium · per owner · after W5, W7, W9 | — |
| W17 | Experiments and telemetry evidence | Not started | — | — | P2 · Medium · all · after W7, W8, W9 | — |
| W18 | Reflection document (R7) | Not started | — | — | Small · all · after W17 | — |
| W19 | W9 screen wiring (S20, S18) | Done | [spec](../../specs/2026-11-12-w9-screen-wiring-design.md) (approved 2026-11-12) | in the spec (Medium) | PR #36 merged 2026-11-13 | — |

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
| C28 | Under the W12 agent policy, the operator runs git and places workflow files (superseded by C55) | [C28](decisions/C28.md) |
| C29 | Fix W1's Prisma 7 test on this branch (reverses the D5 choice) | [C29](decisions/C29.md) |
| C30 | One CODEOWNER approval per PR | [C30](decisions/C30.md) |
| C31 | Use Xiao-Congchen as the independent approver for Dev Lead PRs | [C31](decisions/C31.md) |
| C32 | Use GitHub reviews as the sensitive-path approval source | [C32](decisions/C32.md) |
| C33 | Use GitHub approvals without a committed artifact | [C33](decisions/C33.md) |
| C34 | Permit an alternate security reviewer when `@ludannnn` authors a sensitive PR | [C34](decisions/C34.md) |
| C35 | W12 uses the thin enforceable baseline | [C35](decisions/C35.md) |
| C36 | GitHub ownership and independent review handles | [C36](decisions/C36.md) |
| C37 | W12 follows the merged W1 source-root layout | [C37](decisions/C37.md) |
| C38 | Remediate audited dependencies before T3 completion | [C38](decisions/C38.md) |
| C39 | Use a fixed bootstrap list for the first manifest rollout | [C39](decisions/C39.md) |
| C40 | Bound the bootstrap to the current development rollout | [C40](decisions/C40.md) |
| C41 | Approve the bounded bootstrap amendment | [C41](decisions/C41.md) |
| C42 | Re-evaluate review approvals in a separate trusted workflow | [C42](decisions/C42.md) |
| C43 | Make the trusted workflow the authoritative security status | [C43](decisions/C43.md) |
| C44 | W4 adds two optional seams to W1's route registration | [C44](decisions/C44.md) |
| C45 | `hit()`'s atomic statement lives in `@agile/db` | [C45](decisions/C45.md) |
| C46 | T7 (sign-in screen) moves to a follow-up spec and PR | [C46](decisions/C46.md) |
| C47 | AD-57 kept despite its Firebase assumption being wrong | [C47](decisions/C47.md) |
| C48 | `requireMember` moves from `auth` to `core`, built in W5 | [C48](decisions/C48.md) |
| C49 | W5, not W4, implements the membership resolvers | [C49](decisions/C49.md) |
| C50 | Tokens are verified with `firebase-admin` | [C50](decisions/C50.md) |
| C51 | Feature modules are workspace packages; `auth` is `src/be/auth` | [C51](decisions/C51.md) |
| C52 | The token check belongs to W4, not W1 | [C52](decisions/C52.md) |
| C53 | W4 scope includes user lookup, `hit()` and the sign-in screen wiring | [C53](decisions/C53.md) |
| C54 | W4 defines the tier setting for now | [C54](decisions/C54.md) |
| C55 | Narrow the agent pre-tool policy to process-control files | [C55](decisions/C55.md) |
| C56 | W3's scope choices | [C56](decisions/C56.md) |
| C57 | W3 starts stacked on `w2-gateway` | [C57](decisions/C57.md) |
| C58 | Source-scan rules tightened after the close-out review (spec amendment) | [C58](decisions/C58.md) |
| C59 | SD4 / D18 signed off under AD-11 | [C59](decisions/C59.md) |
| C60 | Keep the frozen `assemble`; sign off `assembleWith` at the PR (AD-11) | [C60](decisions/C60.md) |
| C61 | W6's scope choices | [C61](decisions/C61.md) |
| C62 | Settle W4 before continuing W9 | [C62](decisions/C62.md) |
| C63 | Update W12's pinned root `test` script assertion | [C63](decisions/C63.md) |
| C64 | Use `@firebase/app` and `@firebase/auth`, not the `firebase` package | [C64](decisions/C64.md) |
| C65 | Use the Firebase 12.19 versions of app and auth | [C65](decisions/C65.md) |
| C66 | T7 replaces the role cookie with a real auth gate | [C66](decisions/C66.md) |
| C67 | Mock previews keep the prototype role buttons | [C67](decisions/C67.md) |
| C68 | `src/fe` UI tests use Vitest, Testing Library and jsdom | [C68](decisions/C68.md) |
| C69 | W9 is backend only; screen wiring is a follow-up | [C69](decisions/C69.md) |
| C70 | Amend the W9 spec to W5's merged code before planning | [C70](decisions/C70.md) |
| C71 | W9 writes lock with W5's exported `lockProjectForMutation` | [C71](decisions/C71.md) |
| C72 | An exhausted write retry returns 429, not 500 | [C72](decisions/C72.md) |
| C73 | Fix the three PR #29 review findings before merge | [C73](decisions/C73.md) |
| C74 | An empty standup window still includes current blockers | [C74](decisions/C74.md) |
| C75 | The standup activity window is anchored to the standup date | [C75](decisions/C75.md) |
| C76 | W9 is High risk | [C76](decisions/C76.md) |
| C77 | W9 spec now, build after W5 merges | [C77](decisions/C77.md) |
| C78 | An unchanged input hash returns the stored standup, even when degraded | [C78](decisions/C78.md) |
| C79 | W9 adds `recordCacheHit` and `openOrReuse` to the gateway | [C79](decisions/C79.md) |
| C80 | W5 uses one `core` package for project, membership, planning-domain, and resolver behavior; `src/be/api` only composes routes and dependencies | decisions/C80.md |
| C82 | Use a declarative corpus with deterministic runners and a policy-derived authorization suite | decisions/C82.md |
| C83 | Keep W11 as verification over frozen guard and policy contracts; do not change production guard rules or policy entries | decisions/C83.md |
| C84 | Keep C83 and amend T1-E2 to assert the frozen guard's actual contract: PII redaction and injection flagging, without requiring arbitrary non-PII canary/tag removal | decisions/C84.md |
| C95 | Preserve AD-53's protected development exception | decisions/C95.md |
| C96 | Permit the approved isolated development recovery target | decisions/C96.md |
| C92 | Allow the approved W13 branch through dev seed validation | decisions/C92.md |
| C97 | Supersede C96 with baseline/past recovery branches | decisions/C97.md |
| C85 | Replace automated dev-check with manual owner evidence | decisions/C85.md |
| C98 | Remove the W9 standup/AI probe from the T4 gate | decisions/C98.md |
| C99 | Keep C85 for T6 | decisions/C99.md |
| C100 | Wire the W9 endpoints only; the project screens stay mock (S20/S18) | [C100](decisions/C100.md) |
| C101 | Hide standup Edit, Use as is and thumbs in live mode until W16 | [C101](decisions/C101.md) |

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

- **Latest entry:** 2026-11-13
- **Entries (live file):** 431
