# Delivery plan to 13 November 2026

Status: the cut line (section 1) is **Decided** (D-68, team, 2026-10-29) and so is the feature freeze at the end of 10 Nov (D-69), and the production deploy on 11 Nov (D-70); the UI scope: one person designs the whole UI and the others link their flows to it (D-71). The assignment in section 3 is **Decided** (D-72); the rest of sections 2 and 4 is **Proposed** by the AI and are not decided until the team says so. Source of the date: the team (G-01). Endpoint numbers are those of [contracts.md](contracts.md); work packages (WP) A to J are those of the module table in [agile-platform-architecture.md](agile-platform-architecture.md) §4.

Basis: 16 calendar days (29 Oct to 13 Nov), 57 endpoints, five AI workflows, two deployed tiers, a security test suite, evidence for R5 and a reflection document (R7). Sizes below are relative (S, M, L), the AI's estimate, with low confidence: the real rate depends on how much the coding agents produce per day and how much review each hand-off needs.

## 1. Cut line

**Tier 1, must have (32 endpoints).** Everything the course requires R1 to R4 and R6 to be demonstrable, one complete path per role.

| Area | Endpoints | Why it is Tier 1 |
|---|---|---|
| Account, system | 1, 2, 3, 4 | sign-in and roles |
| Projects and members | 5, 6, 7, 9, 10 | a project exists and has a team |
| Planning basics | 12, 13, 16, 17, 20, 21, 22, 23, 24 | checkpoints, epics, tasks and status are the product |
| Progress | 33 | the Dev Lead's facts need it |
| PM plan | 34, 35, 37, 40, 41 | R1 for the PM: outline, expand, approve (D-46 needs every epic expanded), reject |
| Dev Lead | 42, 44, 45 | R1 for the Dev Lead: facts in code, digest from the model |
| Developer | 49, 50, 51, 52, 55 | R1 for the Developer: upload, summaries, standup; the Dev Lead reads standups |
| Platform, not endpoints | gateway (guards, limiter, `llm_calls`, sessions, mock), `AiContext`, policy map, CI, two deployed tiers, the security tests of D-26, the UI mockups and shell | R2, R3, R4, R5 |

**Tier 2, should have, in this order** (25 endpoints; each starts only when its owner's Tier 1 slice is merged).
1. Re-plan by the Dev Lead (46, 47, 48) and sprints with velocity (27 to 32): this is the Dev Lead's "adjust from progress" story. Without closed sprints the forecast shows `UNKNOWN` (§11), so seed data carries a history.
2. Usage views (56, 57): the numbers exist in `llm_calls` either way, so for R5 a SQL query is enough; the page is a convenience.
3. Standup edit and feedback (53, 54), PM epic edit and regenerate (38, 39), Lead overview (43), proposal lists (36).
4. Editing and deleting entities (8, 11, 14, 15, 18, 19, 25, 26).

**Cut first if time runs out:** Tier 2 item 4, then 3, then 2. Do not cut Tier 2 item 1 without telling the team, because it is the Dev Lead's main value.

**Never cut:** the guards, the policy map and the authorisation tests, the dev and prod separation, `llm_calls` logging, the mock gateway in CI.

## 2. Schedule

| Dates | Phase | Exit condition |
|---|---|---|
| 29 to 31 Oct | **P0 Foundation.** Specs for WP E and the frozen-first set (contracts, policy map, `LlmGateway.run`, `AiContext.assemble`, `Sessions`, `Core`); monorepo, database schema, API skeleton, mock gateway; a hello-world deployed to Vercel that calls SoCLaaS `GET /v1/models`; UI mockups of the Tier 1 screens, due 2 Nov | the interfaces are frozen; G-26, G-32 and G-33 are answered by something running |
| 1 to 7 Nov | **P1 Role slices** in parallel (section 3), each end to end (API, UI, tests) against the mock gateway, then against the live gateway | every Tier 1 endpoint of that owner works on the dev tier |
| 8 to 10 Nov | **P2 Integration.** All roles together on dev, live-model smoke runs, the security suite, seed data, the model and cache experiments for R5 (D-23b, G-23) | Tier 1 complete; **feature freeze at the end of 10 Nov** |
| 11 Nov | **Production.** Migrate, deploy `main`, rehearse the demo on the prod tier | prod works with prod keys and codes |
| 12 to 13 Nov | Tier 2 leftovers that are already half done, reflection document (R7), buffer | submission |

Why the foundation comes first: three people cannot start in parallel until the contracts and the gateway signature are frozen (A-18). If P0 slips by a day, P1 shrinks by a day, not P2.

## 3. Who builds what (Decided, D-72)

The team asked the AI to split the work across the three roles by suitability. The split was an AI choice, confirmed by the team on 2026-10-29 (D-72). Two things the first version missed are now in it: the owner of the GitHub and Vercel accounts does the deploy operations (G-33), and one person makes all the front-end mockups.

**Pieces and weights** (the AI's rough scale: S = 1, M = 2, L = 3; low confidence).

| Piece | Weight | What it is |
|---|---|---|
| PM slice | 5 | `pm` (L): plan outline, expand, approve; `proposals` (M): the claim-and-apply protocol |
| Dev Lead slice | 5 | `lead` (M): facts, forecast, digest, re-plan; `core` (L): projects, checkpoints, epics, tasks, sprints, progress, `assertWritable` |
| Developer slice | 3 | `dev` (L): upload, summaries, standup |
| UI mockups and shell | 4 | one person designs the entire UI (D-71): the 11 screens of §13 with their main layouts and most of their states (loading, empty, error, forbidden, and the screen-specific ones of §13: plan expansion progress and partial failure, Approve disabled, AI unavailable, busy with a retry time, degraded or flagged standup, stale version), plus the design tokens, the app shell, role navigation and shared components (R6: simple, single responsibility, no duplication). Each screen names its endpoint numbers and fields, so the other members link their own flows to the backend using the mockups |
| WP E-core | 2 | monorepo, contracts and policy map, database schema, API skeleton |
| WP D | 3 | gateway runtime: limiter, SoCLaaS client, `llm_calls`, sessions, mock |
| WP C | 2 | guards: sanitising, injection flag, output validation |
| Security corpus and authorisation tests | 2 | the attack corpus (D-26) and the tests generated from the policy map |
| WP A | 1 | `auth`: registration, codes, `rate_counters` |
| WP J | 1 | `ai-context` |
| WP F | 1 | usage routes and page |
| CI | 1 | tests, lint, contract test |
| Deploy operations | 2 | owner only: Vercel projects, branch protection, tier variables and secrets, the day-1 checks (G-26, G-32), dev deploys, the production migration and deploy on 11 Nov, reading logs for the others. Busy on 29 to 31 Oct and 8 to 11 Nov |

The total is 32, so about 10 to 11 each. The mockup deliverable: Tier 1 screens by 2 Nov, Tier 2 screens by 5 Nov.

**The split by role.**

| Member | Gets | Weight | Why this combination |
|---|---|---|---|
| **PM** | PM slice, UI mockups and shell, WP F | 10 | The PM thinks in screens and flows, and owns the screen with the most UI (the plan flow with per-epic progress), so the same person sets the look and builds the hardest screen. The mockups are needed first (due 2 Nov), while the PM's backend work waits for `core` |
| **Dev Lead** | Dev Lead slice, WP E-core, security corpus and authorisation tests, CI | 10 | `core` is the data backbone, and the schema, contracts and policy map describe the same rules, so one person holds the domain. The forecast functions are pure and testable. The policy map and the tests generated from it belong to the person who knows the membership rules; CI runs those tests |
| **Developer** | Developer slice, WP D, WP C, WP A, WP J | 10 | The AI safety stack in one head: guards, gateway runtime, context assembly and registration. The upload and standup flow is the heaviest user of that stack, and the slice is the last unblocked, so the foundation work comes first |

**Deploy operations follow the owner.** Whoever owns the accounts takes the 2 points, and hands pieces on so that no one is over 11. The owner never holds WP E-core, because the owner is on the hello-world deploy in the same days.

| Owner is the | Hand-over | Result (PM / Dev Lead / Developer) |
|---|---|---|
| PM | PM hands WP F to the Dev Lead | 11 / 11 / 10 |
| Dev Lead | Dev Lead hands WP E-core to the PM; the PM hands WP F to the Developer | 11 / 10 / 11 |
| Developer | Developer hands WP A to the Dev Lead and WP J to the PM | 11 / 11 / 10 |

If the Developer member is the owner, 29 to 31 Oct is the tightest: the mock gateway and the deploy setup are both needed then. In that case the mock gateway goes to the Dev Lead member first, and the Developer member does the live client afterwards.

**Cross-review.** The author does not review their own security work. The Developer member (guards, gateway) is reviewed by the Dev Lead member; the Dev Lead member (policy map, corpus, authorisation tests) by the Developer member; the PM member's UI and proposals by the Dev Lead member. Dependencies inside a slice are unchanged: `core` before `proposals` apply; the gateway mock before any role prompt; the policy map before any route; the guards before the live gateway is enabled.

## 4. Risks for the date

| Risk | Effect | Mitigation |
|---|---|---|
| Vercel Hobby: only the repository owner deploys (G-33) | nobody else can see logs or variables; teammates' merges may not deploy | decide the owner and the deploy path in P0; use the CI deploy path (D-32) with the owner's token if the Git integration blocks teammates' commits |
| SoCLaaS not reachable from Vercel (G-26) | no live AI on the deployed tiers | the day-1 hello-world test; fallback `AI_ENABLED=false` (D-66) and demo with the mock or a relay |
| One shared key limit (90 requests a minute, USD 80 a day) used by three people and several coding agents | 429s and a blocked budget during experiments | schedule experiments in P2; the per-user and global counters of D-59 stay below the key limit |
| Model experiments (D-23b) need many calls | they eat the budget and the time | a fixed small experiment matrix agreed before P2, run on the dev key |
| Agents produce code faster than it can be reviewed | merge queue in P1 | small hand-offs, one review per slice, CODEOWNERS at the frozen interfaces (A-17 is deferred, so agree the minimum by hand) |

## 5. What the team still decides
Decided: the Tier 1 and Tier 2 lists, with the usage page in Tier 2 (D-68); the feature freeze at the end of 10 Nov (D-69); the production deploy on 11 Nov (D-70).

1. Nothing about the split: it is confirmed (D-72).
2. Which member takes which role, and who owns the GitHub repository and the Vercel account (G-33); both can wait.
