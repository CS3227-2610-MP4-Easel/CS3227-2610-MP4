# Decision Log: Agile Platform

Companion to [agile-platform-architecture.md](agile-platform-architecture.md). This file records **how** each decision was reached: the options considered, the AI recommendation, and the team's answer. The architecture document keeps only the final decisions (its §15) and the design that follows from them.

## How to read an entry

- Each entry starts with the **decision record**: Decision, Reason, Consequences, Decided by. A decision is only Decided when the team chose it, including by accepting the AI recommendation.
- Below it, **Original brief (kept for the record)** keeps the options table, the AI recommendation, its confidence and evidence, exactly as it was put to the team.
- An entry still marked Proposed, Assumed or Deferred is not final. **Deferred**: D-23b.
- Where a later decision changed an earlier one, both are kept and the later one says what it supersedes (D-24 amends D-15; G-17 is superseded by D-05).
- Entries are in the order they were decided, not numeric order.

## Gaps that decisions closed

| Gap | Closed by |
|---|---|
| G-05 role model | D-07, D-08 |
| G-06 domain model | D-09, D-10, D-13, D-14 (field-level detail: architecture §5) |
| G-07 `llm_calls` schema | D-15, D-24 |
| G-08 model routing | D-23a, D-23b (deferred) |
| G-09 caching layers | D-18 |
| G-12 developer activity input | D-20, D-27, D-38 |
| G-14 work split | D-11 |
| G-15 hosting and dev/prod separation | D-01a, D-29 |
| G-16 SoCLaaS usage fields | resolved by the team's probe run (architecture §12) |
| G-17 single instance assumption | superseded by D-05 |
| G-18 AI threat model | D-25, D-26 |
| G-19 dev-process architecture | D-30, D-31, D-32 |
| G-20 DB-backed limiter | D-16 |
| G-21 estimation unit | D-12 |
| G-24 standup visibility | D-27 |
| G-25 similar-item retrieval | D-28 |

## Decisions

### D-01a Deployable shape — Decided
**Decision:** npm/pnpm-workspaces monorepo with shared packages (`contracts`, `llm-gateway`, `db`), deployed as one Vercel project with a single Hono app serving the API (option B′).
**Reason:** team's own choice (2026-10-28); the AI had recommended a separate long-lived API (option B). One URL, no CORS, and a single deploy.
**Consequences:** the API runs as serverless functions, so the gateway's runtime state moves to the database (D-05); batch jobs run through Vercel Cron within `maxDuration` (G-10); one build and one set of environment variables serve both UI and API, so a broken API build blocks a UI deploy; hosting is therefore decided in practice (Vercel), leaving only G-15's dev/prod separation open.
**Dependencies:** D-01b, D-05, G-10, G-15.
**Decided by:** team, 2026-10-28 (team's own choice).

### D-01b UI framework inside the single deploy — Decided
**Decision:** Next.js (App Router) with the Hono app mounted under `/api`. `apps/web` never imports `@prisma/client` or `packages/db`; all data access goes through the contracts client. A source-scan test enforces this.
**Reason:** accepted AI recommendation (2026-10-28).
**Consequences:** the Hono-in-Next layout must be verified before the first deploy; one Vercel project root is `apps/web`.
**Decided by:** team, 2026-10-28 (accepted AI recommendation).

Original brief (kept for the record):
Why now: §13 UI integration, the Vercel project layout (D-01a), and where the authorization boundary sits (§7).

| Option | Pros | Cons | Choose when |
|---|---|---|---|
| A. Next.js (App Router) with the Hono app mounted under `/api` through a catch-all route handler | Team knows Next 15, Tailwind and shadcn from MP3; zero-config on Vercel; routing and build in one framework | Server components can call Prisma directly and bypass the API, contracts and role checks, so the seam has to be enforced by an import rule and a test; heavier than needed for an authenticated app that needs no SSR | The team wants the familiar, well-trodden path |
| B. Static SPA (e.g. Vite + React) served alongside the Hono app in one Vercel project | All data must go through the API, which makes the seam structural; lighter; Firebase tokens are handled client-side | Needs hand-written Vercel config (static output plus SPA rewrite plus the function); fewer documented examples; no SSR (not needed) | The team wants the seam enforced by structure rather than by a rule |

Recommendation: A, because it is the lowest-risk deployment and the team already knows it, with two enforced rules: `apps/web` never imports `@prisma/client` or `packages/db`, and all data access goes through the contracts client. Confidence: medium. What would change it: no Next.js experience on the team, or a wish for a structural seam (then B).
Evidence: the Hono-in-Next catch-all pattern and the one-project SPA-plus-Hono layout were not checked against Vercel's docs; only standalone Hono, cron and `maxDuration` were. Verify before the first deploy.

### D-01c Contract style — Decided
**Decision:** REST. Zod schemas in `packages/contracts` are the single source; OpenAPI is generated from them (e.g. `@hono/zod-openapi`, package and version for the spec to pin).
**Reason:** accepted AI recommendation (2026-10-28); the OpenAPI file is the machine-readable spec handed to agents.
**Consequences:** every endpoint is documented at field level (§6); the error envelope lives in `packages/contracts`; file upload is multipart (G-12).
**Decided by:** team, 2026-10-28 (accepted AI recommendation).

### D-06 No scheduled jobs in the MVP — Decided
**Decision:** no cron. Standups, digests and summaries run on a user click or on upload. An input-hash check skips the LLM call when nothing changed. Cron is Deferred.
**Reason:** accepted AI recommendation (2026-10-28); removes a protected cron endpoint and the unverified Vercel plan limits.
**Consequences:** the first click pays LLM latency within `maxDuration`; a "refresh all" action stays available for the batch-versus-on-demand experiment; G-10 narrows to retries and idempotency for on-demand and upload-triggered work.
**Decided by:** team, 2026-10-28 (accepted AI recommendation).

Original D-01c brief (kept for the record):
Why now: §6 contracts, the work split (G-14), how agents get their specs, and file-upload handling (G-12).

| Option | Pros | Cons | Choose when |
|---|---|---|---|
| A. REST with zod schemas in `packages/contracts`, OpenAPI generated from them (e.g. `@hono/zod-openapi`) | The contract is a reviewable document that spec-driven agents and tests can read; validation happens at the boundary from one source; multipart upload and the error envelope are explicit; independent of the UI language | Some boilerplate per route; a typed client is generated or hand-written | Spec-driven work and several owners matter most |
| B. Hono RPC (`hono/client` with `@hono/zod-validator`) | End-to-end types with little code, using the framework already chosen | The contract is inferred TypeScript, so there is no OpenAPI document unless added; large route trees can slow type-checking; weaker as a written spec | Speed of development matters most |
| C. tRPC mounted in Hono | End-to-end types and a mature ecosystem | Another framework on top of Hono; the contract is in code, not a reviewable document; file upload is awkward | The team already knows tRPC |

Recommendation: A, because the brief asks for Spec-Driven Development and multi-agent coordination, and an OpenAPI file generated from the zod schemas is a machine-readable spec each agent can be handed. Confidence: medium-high. What would change it: the boilerplate proving too heavy (then B).
Evidence: the packages named above and any ability to combine A with the Hono RPC client were not checked here; versions are for the spec to pin.

### D-05 Gateway runtime state lives in the database — Decided (principle); the limiter design is D-16
**Decision:** per-user limits, daily caps, circuit-breaker and budget-block state, and in-flight tracking are stored in the database, not in process memory.
**Reason:** team's own choice (2026-10-28), a consequence of D-01a. This replaces the "single API instance" assumption (G-17), which is closed.
**Consequences:** each call adds database round trips (small against an LLM call); reservations must be atomic; the MP3 blocking queue and in-memory scheduler cannot be ported as is (G-20).
**Decided by:** team, 2026-10-28.

Original D-01 brief (kept for the record; the AI recommended option B):
Why now: every other section depends on it (§4 components, §6 contracts, §14 hosting, the three-way work split G-14). The gateway keeps in-process rate-limit state and the nightly/morning batch jobs need a long-lived process (§10).

| Option | Pros | Cons | Choose when |
|---|---|---|---|
| A. One Next.js app (route handlers / server actions), one deploy | Fewest moving parts; one language and one deploy | Request handlers on serverless hosting are short-lived and stateless, so a process-local limiter, scheduler and batch jobs need workarounds; the UI and API are tangled, which makes three people editing in parallel collide more | The team values deploy simplicity over parallel work, and AI calls are rare |
| B. Monorepo (npm/pnpm workspaces): `apps/web` (Next.js UI), `apps/api` (long-lived Node REST server), `packages/contracts` (zod schemas, OpenAPI generated), `packages/llm-gateway`, `packages/db` | Each person works against agreed schemas; the contracts package is the field-level contract that spec-driven agents read; a long-lived API suits limiter, jobs and metering; module-import rules can be tested | Two deployables; more initial scaffolding | Three people building in parallel and the AI platform needs a persistent process |
| C. Same monorepo as B, with tRPC instead of REST | End-to-end types with little code | The contract lives in code, not in a reviewable OpenAPI document; harder for non-TS clients and for contract-first specs | The whole team is TS-only and wants minimal ceremony |
| B′. Monorepo with the same packages as B, but one deployable: a single Hono app (UI served by Next.js with Hono mounted under `/api`, or a static SPA plus Hono) on one Vercel project | One project, one URL, no CORS; keeps the contracts package and module boundaries for parallel work; Hono's `hono/vercel` adapter is a common pattern | Runs as serverless functions, so the gateway's limiter, breaker and caps cannot rely on process memory and must move to the DB (G-17 would be rejected); batch jobs run through Vercel Cron within `maxDuration`; the Next.js-plus-Hono combination was not checked in Vercel's docs, only standalone Hono | Hosting on Vercel alone is a hard preference and the team accepts DB-backed limiter state |

Recommendation: B, because the brief rewards spec-driven work (a contracts package is the spec) and the gateway needs a persistent process. Confidence: medium-high. What would change it: a hosting constraint that rules out a long-lived server, or a team preference for the least scaffolding (then A).
Evidence: the claim that serverless handlers are stateless between invocations is general knowledge, not checked against the host's current docs. Verify when G-15 is decided.

### D-02 Data store and ORM — Decided
**Decision:** PostgreSQL with Prisma.
**Reason:** team's own choice (2026-10-28), based on tooling maturity and familiarity. The AI had recommended Drizzle.
**Consequences:** a `prisma generate` step in build and CI; the host's serverless/pooling behaviour for Prisma and Neon must be checked at G-15; usage and cache-hit queries use Prisma aggregates or raw SQL; query-result caching (Prisma Accelerate) is not used, since LLM and summary caching is application-level (G-09).
**Decided by:** team, 2026-10-28 (team's own choice).

Original brief (kept for the record):
Why now: §5 data model, the `llm_calls` metering table (G-07), cached summaries (G-09), job queue choice (G-10).

| Option | Pros | Cons | Choose when |
|---|---|---|---|
| A. PostgreSQL + Drizzle | SQL-close, so usage queries (cache hit rate per feature per day) are written directly; JSONB for cached summaries; a Postgres-backed job queue is possible; the team knows Postgres from MP3 | Drizzle is newer and has a smaller ecosystem than Prisma | The team is comfortable with SQL |
| B. PostgreSQL + Prisma | Mature, generated client, good tooling | Heavier codegen step; raw aggregate queries are less natural | The team prefers a higher-level ORM |
| C. SQLite/libSQL | No server; simple local and test setup | Weaker fit for multi-environment hosting and concurrent job workers; migration path to Postgres is a later cost | Single-process, solo, throwaway |

Recommendation: A. Confidence: medium. What would change it: team familiarity with Prisma (then B; both fit the design).
Evidence: no version or pricing claims made here; hosting limits are deferred to G-15.

### D-03 Authentication — Decided
**Decision:** Firebase Auth; the ID token is verified on the server; the role is read from our own database and never from the client.
**Reason:** team's own choice (2026-10-28); reuses MP3 experience and avoids storing passwords.
**Consequences:** one Firebase project per environment (dev and prod, R4); CI needs the Firebase emulator or a test project; role literals live in our DB (G-05 still open).
**Dependencies:** §7, G-05, G-15.
**Decided by:** team, 2026-10-28 (team's own choice, not the AI recommendation).

Original brief (kept for the record; the AI had recommended option A):

| Option | Pros | Cons | Choose when |
|---|---|---|---|
| A. Own accounts via an auth library, server sessions in the DB (HttpOnly cookie), roles stored in our DB | No external dependency in CI or tests; role literals are ours; CSRF and session handling are a visible, testable security feature | We carry password storage and session security | You want security work to be visible evidence and test independence |
| B. Firebase Auth (as MP3), ID token verified server-side, role in our DB | Passwords handled by a vendor; MP3 experience to reuse | One Firebase project per environment; CI needs an emulator or test project; ties the TS app to a Google service | You want the least account-security code |
| C. Hosted identity product (e.g. Clerk, Auth0) | Fast, polished | Vendor lock-in, quotas, more config per environment | Auth is not a marking focus |

Recommendation: A, with role always read from our database and never from the client. Confidence: medium. What would change it: a wish to avoid password storage (then B).
Evidence: specific library choice (Better Auth, Auth.js) is left for the spec; versions unverified.

### D-04 LLM gateway approach — Decided
**Decision:** port the MP3 gateway design to a TypeScript package, keeping the pure guards, scheduler, caps, breaker and fallback, and replacing the audit string with a queryable `llm_calls` table.
**Reason:** accepted AI recommendation (2026-10-28); inherits a security design already reviewed with an Attacker lens and gives direct reuse evidence for the reflection.
**Consequences:** Spring-specific parts (conditional beans, the transaction guard) are re-thought for TS; result cache, section budgets and routing are added in round 3 (G-07 to G-09, G-11); the SoCLaaS `usage` fields stay unverified until G-16; process-local limiter state depends on G-17 and on D-01.
**Dependencies:** D-01, G-07, G-16, G-17.
**Decided by:** team, 2026-10-28 (accepted AI recommendation).

Original brief (kept for the record):
Why now: R1, R3 and R5 all run through it; the three role features register against it (G-14 split depends on it).

| Option | Pros | Cons | Choose when |
|---|---|---|---|
| A. Port the MP3 gateway design to a TS package (`packages/llm-gateway`): keep the pure guards (sanitize, PII, injection flag, output validation), scheduler with caps, breaker and fallback; replace the MP3 audit-string with a queryable `llm_calls` table | Reviewed design with an Attacker lens already done; pure logic ports cleanly; gives direct reuse evidence for the reflection | Translation work; Java-specific parts (Spring conditions, transaction guard) must be re-thought | You want a security-reviewed baseline |
| B. Thin client (OpenAI-compatible SDK) plus new guard code | Quickest start | Re-derives security decisions MP3 already made; weaker R3 story | Time is very short |
| C. Run an existing proxy (e.g. LiteLLM) in front | Budgets, routing and logging out of the box | Another service to deploy and secure; Python, not TS; custom guards still needed; SoCLaaS key semantics need checking | Many providers, many teams |

Recommendation: A, with the metering and caching extensions in round 3. Confidence: medium-high. What would change it: a very short deadline (then B).
Evidence: the SoCLaaS `usage` payload fields are unverified. MP3's records show `llama3.1:8b`, `qwen3.5:9b` and `gemma4:26b` but no cached-token or reasoning-token evidence, so any cache-hit or reasoning-share measurement depends on a probe (G-16).

### D-07 Role model — Decided
**Decision:** one account has one global role (PM, Dev Lead or Developer). A `project_members` table (project, user) scopes which projects a user can see. Authorization is two checks in one layer: the role gate, then the membership check. Role-named URL namespaces: `/api/pm`, `/api/lead`, `/api/dev`.
**Reason:** accepted AI recommendation (2026-10-28), after a worked example of options A and B; same model as MP3 (C79). The role is read from our database, never from the client or the Firebase token (D-03).
**Consequences:** a person cannot be PM on one project and Developer on another; who may add members is G-22 (suggested: the PM adds Dev Leads, Dev Leads add developers); a demo account per role covers grading.
**Decided by:** team, 2026-10-28 (accepted AI recommendation).

Original brief (kept for the record):
Why now: §7 permissions, §4 (where authorization is enforced), the URL namespaces that let three people work in parallel, and the project visibility rule for Dev Leads who hold several projects.

| Option | Pros | Cons | Choose when |
|---|---|---|---|
| A. One account, one global role; visibility implied by ownership/assignment columns (PM sees projects they created, Dev Lead those assigned to them, Dev those they have tasks in) | Smallest model | Visibility logic scattered across tables; no clean way to say "this Dev Lead manages this project" | Single-project demo |
| B. One account, one global role, plus a `project_members` table (user, project) that scopes visibility; the global role decides which operations are allowed | One authorization check = role gate then membership check, in one layer; proven in MP3 (C79); role-named URL namespaces (`/api/pm`, `/api/lead`, `/api/dev`) let each owner work in their own area | A person cannot be PM on one project and Dev on another | Each person has one job, as in this brief |
| C. Per-project roles: `project_members(user, project, role)` | Jira-like flexibility | Every feature must resolve the role per project; role-switching UI; more tests; roles and AI features no longer map one-to-one to people | Real teams with fluid roles |

Recommendation: B, because the brief maps one AI feature to each role, the team maps one person to each role, and MP3 already proved the model. Confidence: high. What would change it: a requirement that one person act in two roles (then C). A demo user per role works under B.
Evidence: MP3 PROJECT_STATE C79 (role stored in own `users` table, one account one role, URL namespaces per role).

### D-08 Role assignment at registration — Decided (policy)
**Decision:** server-side registration codes, one per role (PM, Dev Lead, Developer) and per environment. The website checks the code before attempting the Firebase signup; the backend checks it again as the final authority. Codes are never logged.
**Reason:** accepted AI recommendation (2026-10-28), reusing MP3's pattern (C87, C94); every role's AI feature spends the shared SoCLaaS cap, so none is open.
**Consequences:** three code settings per environment (dev and prod differ, R4); rate limiting on the code check (details in §7); a leaked code is a residual risk to record in the threat model (G-18).
**Decided by:** team, 2026-10-28 (accepted AI recommendation).

Original brief (kept for the record):
Why now: §7 trust boundary; R3 security evidence; the shared SoCLaaS key is a limited resource, so open signup lets anyone consume the AI cap (the MP3 residual risk).

| Option | Pros | Cons | Choose when |
|---|---|---|---|
| A. User picks any role at signup | Simplest | Anyone can make themself PM; privilege self-assignment | Throwaway prototype |
| B. Server-side registration codes, one per role, set per environment; checked before the Firebase signup is attempted and again by the backend | Reuses MP3's tested pattern (C87, C94); no email delivery; dev and prod use different codes (R4); easy to hand graders the codes | A leaked code lets anyone register for that role; codes must be rotated and never logged | Small team and a demo with graders |
| C. PM invites each user by email into a project with a role | Real-world flow | Needs email delivery and invite lifecycle; much more to build | Production product |

Recommendation: B, with a code for all three roles (in MP3 the lowest role was open, but here every role has an AI feature that spends the shared cap). Confidence: medium. Policy choice, the team's. What would change it: wanting developers to sign up freely (then no developer code, with a lower per-user cap).
Evidence: MP3 PROJECT_STATE C87, C94.

### D-09 Entity set for the MVP — Decided
**Decision:** Project, Epic, Task, Sprint, Checkpoint, ProjectMember and TaskEvent (a log of status and assignee changes). Comments, attachments, subtasks, labels, priorities and custom workflows are not in the MVP. `ai_proposals` (D-10) and `llm_calls` (G-07) are platform tables beyond this set.
**Reason:** accepted AI recommendation (2026-10-28); the set covers all three AI features.
**Consequences:** field-level schema, relations and state tables are G-22; whether `ProjectMember` is used is tied to D-07.
**Decided by:** team, 2026-10-28 (accepted AI recommendation).

Original brief (kept for the record):
Why now: §5 data model, the AI inputs (velocity needs sprints; standups need activity), and the work split.

| Option | Pros | Cons | Choose when |
|---|---|---|---|
| A. Project, Epic, Task, Sprint, Checkpoint, ProjectMember, TaskEvent (a log of status and assignee changes) | Covers all three AI features: the PM plan (epics, tasks, checkpoints), Dev Lead forecasting (sprints, story points, events), and standup input (events); no feature without data | Comments and attachments are not modelled | An MVP that exercises each role's AI feature |
| B. A plus Jira-style extras: subtasks, labels, priorities, comments, attachments, custom workflows | Looks like Jira | Large surface for three people; none of it is needed by an AI feature | A longer timeline |
| C. A without Sprint (checkpoints and throughput only) | One fewer entity | Loses velocity from past sprints and the scrum framing | If scrum ceremonies are out of scope |

Recommendation: A. Confidence: medium-high. What would change it: a short deadline (trim further) or a requirement for comments as standup input (add Comment to A).
Evidence: the resource-aware notes list ticket status changes, comments and PR text as standup input; comments are the only listed input A leaves out (G-12 covers uploaded PR/commit text).

### D-10 Where AI-generated plans wait for approval — Decided
**Decision:** a single `ai_proposals` table shared by the PM plan and the Dev Lead re-plan: kind (PLAN, REPLAN), project, payload JSON validated against a `packages/contracts` schema, status (PENDING, APPROVED, REJECTED, SUPERSEDED), and a link to the LLM call. Approval applies the payload in one transaction.
**Reason:** accepted AI recommendation (2026-10-28).
**Consequences:** payload schemas are contracts (§6); the apply step is idempotent per proposal (§9, §10); a partial edit regenerates only that part.
**Decided by:** team, 2026-10-28 (accepted AI recommendation).

Original brief (kept for the record):
Why now: §5, §9 workflows, and both the PM plan and the Dev Lead re-plan need an approval step ("nothing is created until the PM approves").

| Option | Pros | Cons | Choose when |
|---|---|---|---|
| A. One `ai_proposals` table: kind (PLAN, REPLAN), project, payload JSON validated against a contracts schema, status (PENDING, APPROVED, REJECTED, SUPERSEDED), link to the LLM call; approval applies the payload in one transaction | One shared mechanism for PM and Dev Lead (DRY); the approval gate is enforced on the server; links an AI result to its call for the usage log; a partial edit regenerates only that part | JSON payload; needs a validation and apply step | Several features need approval |
| B. DRAFT status on real epic, task and checkpoint rows | Edit in place; no JSON | Every query and metric must exclude drafts; partial approval and showing a re-plan as a diff are awkward | A single feature |
| C. Return JSON to the browser; the PM edits it there and submits it to create items | No storage | Lost on refresh; no server-side gate; no record of which call produced it | Throwaway demo |

Recommendation: A. Confidence: high-medium. What would change it: dropping the Dev Lead re-plan approval (then B is workable).
Evidence: none external; design reasoning only.

### D-11 Work split for a team of 3 — Decided
**Decision:** role-owner vertical slices. Each person owns their role's AI feature end to end plus one platform area. The contracts (WP E) and the `LlmGateway.run` interface with its mock mode are frozen in the first days so all three start at once. The illustration below (PM owner = G + B + F; Dev Lead owner = H + D + E; Developer owner = I + A + C + J; K shared) is the starting point; the exact assignment and sizes are refined by the team in the spec.
**Reason:** accepted AI recommendation (2026-10-28).
**Consequences:** the PM owner delivers a seed dataset and stub domain API early so the others are not blocked on WP B; the gateway is split across two owners (C, D), so its interface is a contract (§6); each owner writes their role's section of the reflection.
**Decided by:** team, 2026-10-28 (accepted AI recommendation).

Original brief (kept for the record):
Why now: Given constraints: three people, one role each, comparable workload, parallel work wherever possible, everyone able to contribute. It decides module ownership, which interfaces freeze first, and what each person's reflection section is based on.

Work packages (sizes are AI estimates: M = 2, L = 3; to be refined with the team):

| WP | Content | Size | Needs |
|---|---|---|---|
| E | Monorepo scaffold, `packages/contracts`, CI, dev/prod environments, deploy | M | none |
| A | Firebase auth, registration codes, RBAC and membership checks | M | E |
| B | Domain core: API and UI for project, epic, task, sprint, checkpoint, member, event, and the `ai_proposals` apply step | L | E, A (can use stubs) |
| C | Gateway guards: sanitize, PII, injection flag, prompt builder, output validator | M | E |
| D | Gateway runtime: DB-backed limiter and leases, breaker, SoCLaaS client, `llm_calls`, mock mode | L | E, C interface |
| F | AI usage page and experiment harness | M | D |
| G | PM feature: idea to plan, two-stage generation, approval UI | L | B, D interface |
| H | Dev Lead feature: forecast code, digest, re-plan suggestions, multi-project dashboard | L | B, D interface |
| I | Developer feature: upload ingest, per-item summaries, standup | L | B, D interface |
| J | Security tests, threat model, eval sets | M | C, D |
| K | Process: specs, agent definitions, handoff notes, reflection document | M | all |

| Option | Pros | Cons | Choose when |
|---|---|---|---|
| A. Role-owner vertical slices: each person owns their role's feature end to end plus one platform area, with interfaces frozen first (the `LlmGateway.run` interface with its mock mode, and the contracts) so all three start on day one. Illustration: PM owner = G + B + F (8); Dev Lead owner = H + D + E (8); Developer owner = I + A + C + J (9); K shared by role section | Each person has a demoable AI feature and a clear module; matches "one AI feature per role" and the reflection per role; work stays parallel behind frozen interfaces | The PM owner holds the domain core that the others need, so a stub or seed data is needed until it lands; the gateway is split across two people (C, D) and needs an agreed interface | Each person should own an outcome |
| B. Two phases: all three build the shared platform first (E, A, B, C, D split among them), then each builds their role feature | No one waits on the platform; integration risk is lower | Role features start late; weaker parallel work; a bigger risk if the deadline is short | The deadline is distant and the platform is the main risk |
| C. Horizontal layers (frontend, backend, AI/gateway) | Specialisation | Contradicts the Given that each person is in charge of a role; nobody owns a role's AI feature | Not suitable |

Recommendation: A, because it is the only option that satisfies both "each in charge of a role" and parallel development, provided E and the gateway interface (with mock mode) are frozen in the first days. Confidence: medium. What would change it: a long deadline (then B), or a person who cannot take the work package assigned in the illustration.
Evidence: sizes are estimates, not measured.

### D-12 Estimation unit and progress — Decided (policy)
**Decision:** story points, integers from 1, 2, 3, 5, 8, 13. Points are required before a task joins a sprint and optional before that. Velocity = points done per sprint. Progress = points done / total points. Forecast = remaining points / average velocity of the last N sprints (N is a spec value). All computed in code, not by the LLM.
**Reason:** accepted AI recommendation (2026-10-28).
**Consequences:** the PM plan must propose points; the forecast needs history (behaviour with fewer than N sprints is G-22); the Dev Lead digest receives computed numbers only.
**Decided by:** team, 2026-10-28 (accepted AI recommendation).

Original brief (kept for the record):
Why now: Dev Lead forecasts and the PM plan depend on it; computed in code before any LLM call (the resource-aware notes).

| Option | Pros | Cons | Choose when |
|---|---|---|---|
| A. Story points (integers from 1, 2, 3, 5, 8, 13); velocity = points done per sprint; progress = points done / total points; forecast = remaining points / average of the last N sprints | The standard Scrum measure; a number the AI proposes and a human approves | Early sprints have little history; points must be present | Scrum framing matters |
| B. Task counts only | No estimation step | A one-day task counts the same as a two-week one; forecasts are poor | Tiny projects |
| C. Hours | Direct deadlines | False precision; conflicts with scrum | Waterfall |

Recommendation: A, with points required before a task joins a sprint and optional before that. Policy choice, the team's. Confidence: medium-high. What would change it: a wish to skip estimation (then B).
Evidence: the resource-aware notes list remaining story points and velocity from past sprints as code-computed inputs.

### D-13 Task states and blockers — Decided
**Decision:** task status is TODO, IN_PROGRESS, IN_REVIEW or DONE, plus a separate `blocked` flag and a `blocked_reason` text.
**Reason:** accepted AI recommendation (2026-10-28).
**Consequences:** allowed transitions, who may change status, and which changes write a `TaskEvent` go in the §11 state table (G-22); the standup reads blocked tasks directly.
**Decided by:** team, 2026-10-28 (accepted AI recommendation).

Original brief (kept for the record):
Why now: progress, the standup's Yesterday / Today / Blockers sections, and §11 state tables.

| Option | Pros | Cons | Choose when |
|---|---|---|---|
| A. Status: TODO, IN_PROGRESS, IN_REVIEW, DONE, plus a separate `blocked` flag and a `blocked_reason` text | A task can be blocked at any stage; the standup reads blockers directly | One more field to keep consistent | The standup needs blockers |
| B. Status: TODO, IN_PROGRESS, DONE | Simplest | No review stage; blockers unmodelled | Smallest MVP |
| C. A plus BLOCKED as a status | One field | A blocked task loses its stage, so progress and "in review" counts are wrong | Not recommended |

Recommendation: A. Confidence: medium-high. What would change it: dropping the review stage (then B plus the flag).
Evidence: none external.

### D-14 How checkpoints relate to the plan — Decided
**Decision:** a checkpoint has a target date. An epic belongs to at most one checkpoint, and tasks inherit it through their epic. A checkpoint is at risk when the remaining points of its epics exceed what the current velocity can complete by the target date (computed in code).
**Reason:** accepted AI recommendation (2026-10-28).
**Consequences:** `epics.checkpoint_id` is nullable; the PM plan assigns epics to checkpoints; the Dev Lead re-plan moves epics or dates, not tasks; behaviour when an epic is deleted or moved is G-22.
**Decided by:** team, 2026-10-28 (accepted AI recommendation).

Original brief (kept for the record):
Why now: the Dev Lead's "checkpoints at risk" is computed in code and needs a link from a checkpoint to work; the PM plan creates checkpoints.

| Option | Pros | Cons | Choose when |
|---|---|---|---|
| A. Checkpoint has a target date; an epic belongs to at most one checkpoint; tasks inherit it through their epic | At-risk test: remaining points of its epics against velocity by the date; matches how the PM plan is structured (epics to tasks) | A task cannot sit in a checkpoint apart from its epic | The epic is the unit of delivery |
| B. Tasks link to checkpoints directly | Fine-grained | Many links to maintain; the PM plan must assign each task | Tasks cross epics often |
| C. Checkpoint is a bare date with no links | Simplest | At risk cannot be computed | Not suitable |

Recommendation: A. Confidence: medium-high. What would change it: tasks that must cross epics (then B).
Evidence: none external.

### D-15 `llm_calls` row granularity and fields — Decided
**Decision:** option A, one row per gateway call (final outcome, `attempts` count, tokens summed over attempts that returned usage), with the field list below, **plus a `session_id`** that groups the calls of one user task so that total token spend, calls and elapsed time per task can be computed. No cache or reasoning columns, no cost column, no prompt or response text.
**Reason:** accepted AI recommendation (2026-10-28) with the team's amendment: a short, cheap answer of poor quality causes more rounds, so per-answer cost is misleading and the cost of the whole task must be visible when tuning settings.
**Consequences:** spend is measured in tokens (no price is known); what a session is, and how its outcome is captured, is D-19; the gateway interface takes a `sessionId` supplied by the calling feature.
**Decided by:** team, 2026-10-28 (accepted AI recommendation, amended by the team).

Original brief (kept for the record):
Why now: every metric in the resource-aware notes is a query over this table; §5 data model; the gateway writes it (WP D) and the usage page reads it (WP F). SoCLaaS reports only prompt, completion and total tokens (§12).

| Option | Pros | Cons | Choose when |
|---|---|---|---|
| A. One row per gateway call: final outcome, `attempts` count, tokens summed over attempts that returned usage | Simple; matches MP3 (one audit row per call); one row answers "what did this feature call cost" | Per-attempt latency is not kept | Retries are rare and carry no tokens when they fail |
| B. Two tables: a call row and one row per upstream attempt | Full retry accounting | More writes and joins; most attempts carry no usage | Detailed retry analysis is a goal |
| C. One row per attempt, grouped by a call id | Single table, full detail | Every metric needs a group-by; harder to read | Same as B, with fewer tables |

Fields proposed for A (the spec fixes types): id, created_at, feature, role, user_id, project_id (nullable), env, model, prompt_version, status (OK, SCHEMA_FAIL, UPSTREAM_ERROR, TIMEOUT, REFUSED, BLOCKED_INPUT, RATE_LIMITED, BUDGET_BLOCKED, CACHE_HIT), prompt_tokens, completion_tokens, total_tokens (nullable when no response), attempts, latency_ms, estimated_prompt_tokens, section_tokens (JSON: section to estimated tokens), prefix_hash (hash of the static part of the prompt, for spotting prompt drift), input_hash, flagged, truncated. No prompt text, response text or key is stored (MP3 SD2). No cache or reasoning columns, since the provider reports neither (add by migration if a provider does). No cost column, since no price is known.

Recommendation: A, because failed attempts return no usage and the gateway does not do repair retries, so per-attempt rows would add little. Confidence: medium-high. What would change it: a wish to analyse retry cost in the reflection (then B).
Evidence: probe results (§12); MP3 gateway spec SD2, SD5.

### D-16 DB-backed limiter behaviour — Decided
**Decision:** reject fast. The per-minute window and daily caps are counts over `llm_calls`; in-flight slots are `llm_slots` rows with a lease expiry; a reservation is one atomic transaction (a transaction-scoped advisory lock); over a limit the API returns 429 with a retry-after. The numeric limits (MP3 started at 25 per minute, 4 in flight, per-user and global daily caps) are set in the spec.
**Reason:** accepted AI recommendation (2026-10-28).
**Consequences:** a killed function frees its slot at lease expiry; the UI needs a "busy, try again" state (§13); the 429 mapping goes in §8; the advisory-lock behaviour with the chosen Neon connection mode must be verified at G-15.
**Decided by:** team, 2026-10-28 (accepted AI recommendation).

Original brief (kept for the record):
Why now: D-01a and D-05 moved gateway state into the database (G-20). The shared SoCLaaS key has a request limit and the MP3 defaults were 25 per minute, 4 in flight, and per-user and global daily caps (values to confirm in the spec).

| Option | Pros | Cons | Choose when |
|---|---|---|---|
| A. Reject fast. The per-minute window and daily caps are counts over `llm_calls`, in-flight slots are `llm_slots` rows with a lease expiry, and a reservation is one atomic transaction (a transaction-scoped advisory lock). Over a limit the API returns 429 with a retry-after and the UI says "busy, try again" | No function time wasted waiting; a killed function frees its slot when the lease expires; uses only the database | The user must retry by hand; needs one reservation transaction to be correct | Serverless, where waiting costs function time |
| B. Wait for a slot by polling the database up to a few seconds, then reject | Smoother for the user at moderate load | Burns function time; more code and tests | Heavy sustained use |
| C. A Redis counter service (e.g. Upstash) for the per-minute window and slots | Built for rate limiting; atomic increments with expiry | Another service per environment and another secret; departs from "use the DB" | The database becomes a bottleneck |

Recommendation: A. Confidence: medium. What would change it: heavy concurrent use in the demo (then B or C).
Evidence: advisory-lock behaviour with the chosen Neon connection mode is unverified until hosting is set (G-15).

### D-17 Context sections and token budgets — Decided
**Decision:** each feature declares named sections (name, kind static/retrieved/dynamic, priority, token budget). The gateway estimates tokens as characters divided by a per-model ratio calibrated from the provider's `prompt_tokens`, logs the estimate beside the real value, trims the lowest-priority section first when over budget, and sets `truncated`. Static sections must fit their budget; a test fails the build if they do not.
**Reason:** accepted AI recommendation (2026-10-28).
**Consequences:** each feature's sections and budgets are defined in round 4; the calibration ratio per model is stored or recomputed (spec); the estimate error is a reported metric.
**Decided by:** team, 2026-10-28 (accepted AI recommendation).

Original brief (kept for the record):
Why now: R5 asks for evidence of context engineering; the notes ask each feature to declare named sections with budgets and log `section_tokens`. The provider only returns a total, so per-section counts must be estimated locally.

| Option | Pros | Cons | Choose when |
|---|---|---|---|
| A. Each feature declares sections (name, kind static/retrieved/dynamic, priority, token budget). The gateway estimates tokens as characters divided by a per-model ratio calibrated from the provider's `prompt_tokens`, logs `estimated_prompt_tokens` next to the real value, and when over budget trims the lowest-priority section first, never silently (`truncated` is set) | No heavy dependency; the estimate error is itself a logged, reportable metric; audit of "12k tokens down to 900" per section | An estimate, not exact | A provider that reports only totals |
| B. A real tokenizer library per model family | Exact counts | Three model families, tokenizer availability in a serverless TS build unverified; adds weight | A single known model |
| C. Total only from the provider; no section split | Nothing to build | Loses the per-section evidence the notes ask for | Not suitable |

Recommendation: A. Static sections (rules, schema) must fit their budget; a test fails the build if they do not. Confidence: medium-high. What would change it: a tokenizer library that is verified to work for all three families in the build.
Evidence: the probe counted the same text as 4,725 tokens on `llama3.1:8b` and about 5,115 on `qwen3.5:9b` and `gemma4:26b`, an 8% spread that a per-model ratio can absorb.

### D-18 Which caches are baseline and which are experiments — Decided
**Decision:** baseline: the per-feature input-hash check from D-06, and cached per-item summaries keyed by content hash and prompt version. Experiment, behind a configuration flag: a generic gateway-level result cache for identical requests.
**Reason:** accepted AI recommendation (2026-10-28); SoCLaaS exposes no provider cache, so app-owned caches are the measurable ones.
**Consequences:** `llm_calls.status` CACHE_HIT is logged for cache hits; the summary cache needs invalidation when an item changes (§9, G-22); the flag is part of the experiment setup (G-23).
**Decided by:** team, 2026-10-28 (accepted AI recommendation).

Original brief (kept for the record):
Why now: G-09 and G-23. SoCLaaS exposes no provider cache (§12), so the only measurable savings come from caches the app owns. D-06 already decided that each on-demand action skips the LLM call when its inputs are unchanged.

| Option | Pros | Cons | Choose when |
|---|---|---|---|
| A. Baseline: (1) the per-feature input-hash check from D-06; (2) cached per-item summaries (a PR, a ticket, an upload) keyed by content hash and prompt version, which the Developer standup is built from. Experiment, behind a config flag: a generic gateway-level result cache for identical requests | The hierarchy needed by the standup is in the baseline; the flag gives a clean on/off comparison on identical inputs for the reflection; stale-data risk is limited to the experiment | A little more code than the baseline alone | The reflection needs measured on/off numbers |
| B. Baseline includes the generic result cache for every feature | Largest saving | Stale results; an experiment you cannot switch off cleanly; invalidation across features | Cost is the main concern |
| C. No app caches; prefix ordering only | Nothing to build | The effect is invisible through this provider; no measured saving | Not suitable |

Recommendation: A. Confidence: medium-high. What would change it: a requirement that every feature cache by default (then B).
Evidence: probe results (§12); resource-aware notes ("hierarchical summarisation", "result caching keyed on input hash and prompt version").

### D-19 What an AI session is, and how its outcome is recorded — Decided
**Decision:** an `ai_sessions` table. A session is one user task flow, created by the server when the flow starts (never from a client-supplied id) and closed when it ends: PM, from idea submission until the proposal is approved, rejected or abandoned; Dev Lead, from a re-plan request until it is resolved; Developer, one standup generation with its edits and regenerations. Fields: id, feature, user_id, project_id, started_at, ended_at, outcome (ACCEPTED, EDITED, REJECTED, ABANDONED, OPEN), regenerate_count, optional thumbs up/down. Calls, tokens, latency and elapsed time per session are queries over `llm_calls`. A session with no activity for a set time becomes ABANDONED when next read.
**Reason:** accepted AI recommendation (2026-10-28). "Session" means one task flow, not a login session.
**Consequences:** `llm_calls.session_id` references `ai_sessions`; PM and Dev Lead outcomes come from the `ai_proposals` status; the Developer UI needs a "used as is / edited" signal and a thumbs control (§13); the inactivity period and the exact outcome rules go in the §11 state table (G-22).
**Decided by:** team, 2026-10-28 (accepted AI recommendation).

Original brief (kept for the record):
Why now: D-15 adds a `session_id`. Without a definition of session boundaries and a quality signal, total spend per task cannot be compared with whether the answer was good. I read "session" as one user task flow (for example creating one plan), not a login session; please correct me if you meant otherwise.

| Option | Pros | Cons | Choose when |
|---|---|---|---|
| A. An `ai_sessions` table. A session is created by the server when a task flow starts and closes when it ends: PM, from idea submission until the proposal is approved, rejected or abandoned; Dev Lead, from a re-plan request until it is resolved; Developer, one standup generation with its edits and regenerations. Fields: id, feature, user_id, project_id, started_at, ended_at, outcome (ACCEPTED, EDITED, REJECTED, ABANDONED, OPEN), regenerate_count, optional thumbs up/down. Totals (calls, tokens, latency, elapsed time) are queries over `llm_calls` | Directly answers "how much did this task cost end to end, and was the result used"; outcome comes from the `ai_proposals` status for PM and Dev Lead; one place for the reflection's quality-versus-cost analysis | One more table; the standup needs a small "used as is / edited" signal in the UI | Quality and cost should be compared per task |
| B. A client-supplied `session_id` on `llm_calls` only, no sessions table | Lightest | No outcome or boundaries stored; the standup has no entity to carry an outcome; the client can send a wrong id | Quick experiments |
| C. Treat the login session as the unit | Needs no new concept | Mixes unrelated tasks; useless for cost-versus-quality | Not suitable |

Recommendation: A, with the id issued by the server (never accepted from the client) and the abandon rule (a session with no activity for a set time becomes ABANDONED when next read, so no timer is needed). Confidence: medium. What would change it: no wish to collect a quality signal (then B).
Evidence: none external; design reasoning, and the cost of a bad answer is the team's own observation.

### D-20 Developer activity input for the MVP — Decided
**Decision:** the Developer uploads a structured JSON file of activity items (`type` commit or pr, `id`, `title`, `body`, `author`, `timestamp`, `url`, `files` as names only). No diffs. The schema lives in `packages/contracts`. A documented helper script builds the file from `git log` and `gh pr list --json`. A later GitHub import produces the same shape.
**Reason:** accepted AI recommendation (2026-10-28).
**Consequences:** the upload is a multipart or JSON contract with size and item-count limits (§6); each item is hashed for the summary cache (D-18); how `author` maps to a user, and the limits, go in G-22; titles and bodies are untrusted text (G-18).
**Decided by:** team, 2026-10-28 (accepted AI recommendation).

Original brief (kept for the record):
Why now: G-12. It fixes what the Developer feature can see, the largest token cost (diffs), the upload contract (§6) and the main untrusted-input surface (G-18).

| Option | Pros | Cons | Choose when |
|---|---|---|---|
| A. Upload a structured JSON file of activity items. Each item: `type` (commit or pr), `id` (sha or PR number), `title`, `body`, `author`, `timestamp`, `url`, `files` (names only). No diffs. The zod schema lives in `packages/contracts`; a helper script that builds the file from `git log` and `gh pr list --json` is documented | Validated at the boundary; small and predictable token cost; each item has a content hash for the summary cache (D-18); GitHub import later reads the same shape | The user must produce the file; commit messages and PR bodies are untrusted text | MVP, with GitHub later |
| B. Upload raw `git log` or PR export text and let the LLM parse it | Easiest for the user | Parsing costs tokens; errors; a bigger injection surface | Not suitable |
| C. Option A plus patch or diff files | Richer summaries | Diffs are the largest token sink; the budget is hard to hold | A reason to analyse code, not work items |

Recommendation: A. Confidence: high. What would change it: a free GitHub import being feasible within the deadline (then it feeds the same shape).
Evidence: resource-aware notes ("send commit messages and PR descriptions, not full diffs").

### D-21 PM plan generation — Decided
**Decision:** two stages. Stage 1: one call on the strong tier produces the approach summary, epics and checkpoints. Stage 2: one call per epic on a cheaper tier expands it into tasks with story points and acceptance criteria, each started by the browser as its own request. Output is saved as an `ai_proposals` PLAN row (D-10). Editing an epic regenerates only that epic. The draft sections and budgets below are starting values for the spec.
**Reason:** accepted AI recommendation (2026-10-28).
**Consequences:** per-epic "busy, retry" state when the limiter returns 429 (D-16, §13); a proposal can be partly generated, so its states and the approve rule when some epics are missing go in G-22; retrieval of similar items is G-25.
**Decided by:** team, 2026-10-28 (accepted AI recommendation).

Original brief (kept for the record):
Why now: the PM feature (WP G). It sets the call structure, how it interacts with the limiter (D-16) and what context each call gets.

| Option | Pros | Cons | Choose when |
|---|---|---|---|
| A. Two stages. Stage 1: one call on the strong model produces the approach summary, epics and checkpoints. Stage 2: one call per epic on a cheaper model expands it into tasks with points and acceptance criteria. The browser starts each stage-2 call as its own request, so each stays short and the UI shows progress. All output is saved as an `ai_proposals` PLAN row (D-10); editing an epic regenerates only that epic | Small prompts; failures are per epic, not all-or-nothing; parallel expansions are limited by the browser, not by one long function; regeneration is cheap | More requests and a little client logic; stage-2 calls can hit the limiter (D-16) and must show "busy, retry" per epic | Output is large and structured |
| B. One large call that produces the whole plan | Simplest | Large output and long wait on a small model; one validation failure loses everything | A very small plan |
| C. A multi-turn chat that refines the plan | Flexible | More tokens, more injection surface, hard to bound a session's cost | Not an MVP |

Recommendation: A. Draft sections (budgets are proposals for the spec): stage 1 = rules (static) | ticket schema (static) | project brief (semi-static, up to 500 tokens) | similar existing items (retrieved, up to 800, see G-25) | the idea text (dynamic, up to 1,500). Stage 2 = rules | ticket schema | the epic from stage 1 | the approach summary (up to 300). Confidence: medium-high. What would change it: tiny plans (then B).
Evidence: resource-aware notes; the probe's latency (§12), where the strong model took 9 to 15 s per call.

### D-22 Dev Lead analysis — Decided
**Decision:** code computes the facts (remaining points, velocity, projected completion, checkpoints at risk, cross-project overload of the same person). The model receives the facts as JSON plus the previous digest and what changed since, and returns an explanation and re-plan suggestions from a closed set (move a checkpoint date, move an epic to another checkpoint, reassign a task). Suggestions are saved as an `ai_proposals` REPLAN row and applied only on approval. A digest is skipped when the facts hash is unchanged. A configuration flag switches to raw ticket lists for the experiment.
**Reason:** accepted AI recommendation (2026-10-28).
**Consequences:** the forecast functions are pure and unit-tested (§11); the closed set of suggestion types and their apply rules are contracts (§6); behaviour with fewer than N sprints of history is G-22.
**Decided by:** team, 2026-10-28 (accepted AI recommendation).

Original brief (kept for the record):
Why now: the Dev Lead feature (WP H). It decides the line between code and LLM, and the context given to the model.

| Option | Pros | Cons | Choose when |
|---|---|---|---|
| A. Code computes facts: remaining points, velocity, projected completion, checkpoints at risk, and the same person on several projects' critical paths (D-12, D-14). The model receives those facts as JSON, plus the previous digest and what changed since, and returns an explanation and up to a few re-plan suggestions from a closed set (move a checkpoint date, move an epic to another checkpoint, reassign a task). Suggestions are saved as an `ai_proposals` REPLAN row (D-10) and applied only on the Dev Lead's approval. A digest is skipped when the facts hash is unchanged (D-18). A configuration flag switches to raw ticket lists, for the "raw tickets vs computed digest" experiment | Dates are never invented by the model; small context; applying a suggestion is deterministic; the experiment is a one-line switch | Closed set of suggestion types limits the model's freedom | The forecast must be right |
| B. Give the model raw ticket lists and let it reason about dates | Least code | Errors in dates; large context; wasteful | Not suitable as the default |
| C. No LLM; code only | Cheapest | Fails the requirement for an AI feature | Not suitable |

Recommendation: A. Draft sections: rules (static) | output schema and suggestion types (static) | facts JSON (dynamic, up to 600) | previous digest (up to 500) | changes since (up to 300). Confidence: high. What would change it: nothing foreseeable.
Evidence: resource-aware notes (Dev lead section).

### D-24 Record an estimated cost per call — Decided
**Decision:** add `cost_microusd` to `llm_calls`, computed at write time from a price table (read from `/v1/models` when available, otherwise from configuration) and the call's token counts. It is an estimate and is labelled so. This amends D-15, which had no cost column.
**Reason:** accepted AI recommendation (2026-10-28); SoCLaaS publishes prices, and the team wants total spend per task (D-19).
**Consequences:** the price table needs a refresh path and a fallback for models without a price (the guide's example treats an unknown model pessimistically; the spec decides); session and feature spend are plain sums; the usage page can show it against the daily budget.
**Decided by:** team, 2026-10-28 (accepted AI recommendation).

Original brief (kept for the record):
Why now: D-15 recorded "no cost column, since no price is known", and the team wants total spend per task (D-19). The integration guide (§12) shows SoCLaaS does publish prices (µ$ per million tokens, from `GET /v1/models`), so that premise no longer holds.

| Option | Pros | Cons | Choose when |
|---|---|---|---|
| A. Add `cost_microusd` to `llm_calls`, computed at write time from a price table (read from `/v1/models` when available, else configuration) and the call's token counts | Historical rows keep the price in force at the time; spend per session and per feature is a plain sum; comparable with the $80/day budget | A price table to keep current; an estimate, since the real budget endpoint is unverified | Cost per task is a key metric |
| B. No column; compute cost at query time from tokens and the current price table | No new column | A price change silently rewrites history | Prices never change |

Recommendation: A, labelled as an estimate in the UI and the reflection. Confidence: medium-high. This amends D-15 (a Decided item), so it needs the team's confirmation.
Evidence: the SoCLaaS integration guide (§12), a secondary source to verify against `/v1/models`.

### D-23a Model routing mechanism — Decided
**Decision:** each feature uses a fixed model set chosen in configuration (static per feature, with an environment override), plus per-call settings (`max_tokens`, temperature, `reasoning_effort`). The gateway also keeps a small per-model capability record (which `reasoning_effort` values and other optional fields a model accepts, and its token-estimate ratio from D-17), because MP3 found models differ (`llama3.1:8b` rejected `low`).
**Reason:** team's own choice (2026-10-28): a static set per feature, settled by experiment.
**Consequences:** the model names below are not fixed (D-23b); the routing experiment (one model everywhere vs per feature) is a configuration switch; each experiment run is distinguishable in `llm_calls` by model and prompt version.
**Decided by:** team, 2026-10-28 (team's own choice).

### D-23b Which models each feature uses — Deferred
The team will test other models available on SoCLaaS (the probe listed 19; some may handle code better) and settle on a fixed set per role. Candidates named in the integration guide (§12, to be confirmed against `/v1/models`): `qwen3-coder-next`, `ornith:35b`, `qwen3.6:35b`, `qwen3.8:27b`, which are positioned for coding or agentic work and cost more per output token than the MP3 trio. Until then the MP3 trio is an Assumed starting point (Assumed, owner: team, to be replaced after the model experiment): `gemma4:26b` for the PM stage 1 and the Dev Lead re-plan, `qwen3.5:9b` for PM stage 2 and the Dev Lead explanation, `llama3.1:8b` for per-item summaries and the standup. Blocks: final configuration values only. Needs: the model ids from `GET /models`, a fixed set of about 20 test inputs per feature (G-23, G-18 evals) and a quality check.

Original D-23 brief (kept for the record; the AI had recommended static tiers with a single-model switch):
Why now: G-08. Models are configured, not hard-coded, and the call settings affect cost and quality.

| Option | Pros | Cons | Choose when |
|---|---|---|---|
| A. A static tier per feature, set in configuration with an environment override: strong (`gemma4:26b`) for the PM stage 1 and the Dev Lead re-plan; standard (`qwen3.5:9b`) for PM stage 2 and the Dev Lead explanation; fast (`llama3.1:8b`) for per-item summaries and the standup. `reasoning_effort` `none`, a low temperature for structured output, and a `max_tokens` per call | Matches stakes and latency; one place to change; the model name is logged | Quality is unverified until evaluated (G-18 evals) | Known models with different cost and speed |
| B. One model for every feature | Simple; also the baseline for the "routing vs one model" experiment | Strong model on every call is slow; weak model on stage 1 is poor | As an experiment flag, not the default |
| C. Dynamic routing: try the fast model and escalate on a schema failure | Saves calls on easy inputs | Failures cost extra calls, and the gateway does not do repair retries (MP3) | Later |

Recommendation: A, with B kept as a configuration switch for the experiment. Confidence: medium. What would change it: an evaluation showing a fast model is enough for stage 1 (move it down a tier).
Evidence: probe latencies (§12); `reasoning_effort` `none` was accepted by all three models in MP3 testing. The other 16 listed models were not examined, and quality per model is not yet measured.

### D-25 Handling untrusted text and scoping AI context — Decided
**Decision:** port the MP3 sanitising and output-validation pipeline for every untrusted field (NFKC, control characters, delimiter-tag removal, PII redaction, injection flag, untrusted-data wrapper; output length, key pattern, no links, HTML or Markdown images, schema), and add one membership-scoped context-assembly function that every feature must use. AI text is rendered as plain text. The T1 to T11 control list below is the baseline for the spec and the tests.
**Reason:** accepted AI recommendation (2026-10-28).
**Consequences:** the context function takes the caller and returns only data from projects where the caller is a member; a source-scan test forbids features from building their own context queries (like D-01b's rule); the injection flag is stored on `llm_calls` and shown to the human reader; a per-session cap on regenerations is a spec value (T7).
**Decided by:** team, 2026-10-28 (accepted AI recommendation).

Original brief (kept for the record):
Why now: R3 (security of the AI features) and G-18. Free text reaches the model from several people: the PM's idea, task titles and descriptions written by project members, and commit and PR text from uploads. Different roles then read what the model produces.

Threats for the three features (the AI platform threats; dev-process threats are G-19):

| # | Threat | Where | Control (all to be tested, see D-26) |
|---|---|---|---|
| T1 | Direct prompt injection in the PM idea | PM stage 1 | Delimited as data; fixed security suffix; output validated against the plan schema; nothing is created until the PM approves (D-10) |
| T2 | Indirect injection in uploaded commit or PR text | Developer summaries, standup | Each item wrapped as untrusted data; injection flag shown to the reader; summaries length-capped; plain-text rendering |
| T3 | Indirect injection in task titles written by another member | Dev Lead facts, PM context | The Dev Lead model receives computed numbers and ids, with free text kept to a minimum and wrapped as data; suggestions are a closed set and every id is checked against the caller's project before it is stored |
| T4 | Data from another project reaching a prompt | Retrieval (D-28), Dev Lead across projects, standup | One context-assembly function takes the caller and returns only data from projects where the caller is a member; no feature builds its own query |
| T5 | Exfiltration through links, images or HTML in output | All text output | Output rejected if it contains links, HTML or Markdown images; rendered as plain text |
| T6 | Leaking the system prompt or the key | All | The key never enters a prompt; output scanned for the key pattern; a refusal answer for out-of-scope requests |
| T7 | Spending the shared budget (a single account flooding, or a long regenerate loop) | All | Per-user and global caps (D-16); a cap on regenerations per session; upload size and item-count limits |
| T8 | Privilege escalation through a leaked registration code | Signup | Codes checked before Firebase signup and again by the backend, rate-limited, rotated per environment, never logged (D-08) |
| T9 | Stored XSS from AI or uploaded text | UI | React escaping, plain-text rendering of AI output, a content security policy |
| T10 | Role or membership bypass on AI endpoints | API | Role gate then membership check in one layer (D-07); a generated role × endpoint test |
| T11 | Personal data sent to an external LLM | All | Emails, phone numbers and ID-like strings redacted before sending; synthetic data in demos |

| Option | Pros | Cons | Choose when |
|---|---|---|---|
| A. Port the MP3 pipeline for every untrusted field (NFKC, control characters, delimiter-tag removal, PII redaction, injection flag, untrusted-data wrapper) plus output validation (length, key pattern, no links or HTML, schema), and one membership-scoped context-assembly function used by every feature | Covers T1 to T11 with reviewed rules; the flag gives the human reader a warning; scoped assembly removes the cross-project leak by construction | More code and tests; the flag can false-positive | The model reads text written by other people |
| B. Delimiters and output schema only | Light | Leaves T4, T5, T11 and the flag unaddressed | A single-user tool |
| C. Treat stored data as trusted and sanitise only live input | Least code | T2 and T3 (indirect injection) are the likely attack here | Not suitable |

Recommendation: A. Confidence: high. What would change it: nothing foreseeable; the pattern list is a floor and does not make personal data safe to send, so features still pass only the fields they need.
Evidence: MP3 gateway conventions (sanitising order, output validation order); the SoCLaaS guide, which says to avoid sending real personal data.

### D-26 Security test and evaluation strategy — Decided
**Decision:** four layers: (1) unit tests for each guard, ported from MP3; (2) a generated role × endpoint authorisation test; (3) a fixed corpus of about 20 inputs per feature, including injection and exfiltration attempts, run in mock mode against the guards and validators; (4) the same corpus run live on demand by a script with a token cap, to compare models (D-23b) and prompt versions. CI never calls the live service.
**Reason:** accepted AI recommendation (2026-10-28).
**Consequences:** each feature owner supplies its corpus (WP J, D-11); scoring for the live run (schema validity, refusals, a small manual quality check) is defined in the spec; live runs are logged in `llm_calls` with a distinguishing environment tag so they are not mixed with user traffic.
**Decided by:** team, 2026-10-28 (accepted AI recommendation).

Original brief (kept for the record):
Why now: R3 asks for explicit testing of the AI security features; D-23b needs an input set to compare models; the reflection needs before and after numbers.

| Option | Pros | Cons | Choose when |
|---|---|---|---|
| A. Layered. (1) Unit tests for each guard, ported from MP3. (2) A generated role × endpoint authorisation test. (3) A fixed corpus of about 20 inputs per feature, including injection and exfiltration attempts, run in mock mode against the guards and validators (deterministic, no tokens). (4) The same corpus run live on demand by a script with a token cap, to compare models (D-23b) and prompt versions, scored by schema validity, refusals and a small manual quality check. CI never calls the live service | Each layer has its own evidence; the corpus is reused for model comparison and prompt changes; CI spends no quota | Security and model choice both matter | 
| B. Unit tests of the guards only | Cheapest | No end-to-end evidence; no model comparison data | Prototype |
| C. Live red-teaming only | Realistic | Not repeatable; spends the shared budget; cannot run in CI | Not suitable |

Recommendation: A. Confidence: high. What would change it: a very short deadline (cut the live runs first, keep layers 1 to 3).
Evidence: MP3 gateway N5 (no live calls in CI); resource-aware notes (about 20 fixed inputs per experiment).

### D-27 Standup scope and visibility — Decided (policy)
**Decision:** a standup is one developer, one project, one day. An upload is made to a project and its items belong to that project. The developer and that project's Dev Lead(s) can read the standup; the PM cannot.
**Reason:** accepted AI recommendation (2026-10-28).
**Consequences:** the upload contract (D-20) gains a required project reference chosen by the uploader and checked against membership; a developer on two projects has two standups; the Dev Lead standup view is a per-project list (§13); the project-level digest (D-22) does not include standup text.
**Decided by:** team, 2026-10-28 (accepted AI recommendation).

Original brief (kept for the record):
Why now: G-24, and the upload (D-20) has no project field, so each upload must belong to a project; that choice also decides who can see what.

| Option | Pros | Cons | Choose when |
|---|---|---|---|
| A. A standup is one developer, one project, one day. An upload is made to a project. The developer and that project's Dev Lead(s) can read it; the PM cannot | No cross-project leak (T4); matches how a Dev Lead reviews a team; blockers reach the lead | A developer on two projects has two standups | Developers work on one or two projects |
| B. A standup is private to the developer; the Dev Lead sees only the project digest | Strongest privacy | The lead cannot see blockers directly; weakens the Dev Lead feature | Privacy is the priority |
| C. One standup per developer across all projects, visible to any Dev Lead who shares a project | One document per developer | Shows a lead work from projects they are not on | Not suitable |

Recommendation: A. Policy choice, the team's. Confidence: medium-high. What would change it: a wish for private standups (then B).
Evidence: none external.

### D-28 Similar-item retrieval for the PM prompt — Decided
**Decision:** Postgres full-text search over the epics and tasks of projects the PM is a member of, top 5, in a section of up to 800 tokens, behind a configuration flag so the plan can be generated with and without it.
**Reason:** accepted AI recommendation (2026-10-28).
**Consequences:** it uses the membership-scoped context function (D-25); retrieved text is untrusted and wrapped as data; the Prisma mechanism (raw SQL or a preview feature) and the index are spec choices; demo seed data provides the history; embeddings remain a later option.
**Decided by:** team, 2026-10-28 (accepted AI recommendation).

Original brief (kept for the record):
Why now: G-25; the notes show retrieval as the "retrieve as needed" example and ask for `section_tokens` evidence.

| Option | Pros | Cons | Choose when |
|---|---|---|---|
| A. Postgres full-text search over the epics and tasks of projects the PM is a member of, top 5, shown in a budgeted section of up to 800 tokens, behind a flag so the PM plan can be generated with and without it | No new service or model; membership-scoped by the same function as D-25; the flag gives a with/without experiment; fits the section-budget design (D-17) | Keyword matching only; little history in a fresh database (seed data fills it for the demo) | Retrieval is wanted without extra infrastructure |
| B. Embeddings with `/v1/embeddings` and a vector index | Semantic matches | Needs an embedding-capable model for the key (unverified), a vector extension and extra calls | A large backlog |
| C. No retrieval in the MVP | Least work | No "retrieve as needed" evidence for the PM feature | Tight deadline |

Recommendation: A. Confidence: medium. What would change it: a very short deadline (then C).
Evidence: the Prisma full-text mechanism (raw SQL or a preview feature) was not checked; the spec decides.

### D-29 Environments and dev/prod separation — Decided
**Decision:** three tiers. Local: local Postgres or a Neon dev branch, the Firebase emulator, the gateway in mock mode. Dev: the `development` branch deployed as a Vercel Preview with a stable alias and Preview-scoped variables, with its own Neon project, Firebase project, SoCLaaS key with low caps (G-27) and registration codes. Prod: `main` deployed as Production with Production-scoped variables and its own Neon project, Firebase project, key and codes. Production fails startup when a required setting is missing.
**Reason:** accepted AI recommendation (2026-10-28).
**Consequences:** every pull-request preview shares the dev database; the `env` field on `llm_calls` and `ai_sessions` records which tier a row came from; migrations (G-28), the Vercel plan check (G-29) and the reachability test (G-26) are still needed before deployment; live evaluation runs use the dev key.
**Decided by:** team, 2026-10-28 (accepted AI recommendation).

Original brief (kept for the record):
Why now: R4 and G-15. It decides which resources exist twice, how configuration is scoped, and what the deploy flow is. MP3 used `development` as the integration branch and `main` as the release branch.

| Option | Pros | Cons | Choose when |
|---|---|---|---|
| A. Three tiers. Local: local Postgres or a Neon dev branch, the Firebase emulator, and the gateway in mock mode. Dev: the `development` branch deployed as a Vercel Preview with a stable alias and Preview-scoped variables; its own Neon project, Firebase project, SoCLaaS key with low caps (G-27) and registration codes. Prod: `main` deployed as Production with Production-scoped variables and its own Neon project, Firebase project, key and codes. Production fails startup if a required setting is missing (as MP3 C95) | Clear separation of data, identities, keys and codes; uses Vercel's built-in Production and Preview variable scopes, so no custom environment is needed; same branch flow as MP3 | Every pull-request preview shares the one dev database | A small team with one shared dev environment |
| B. As A, plus an ephemeral Neon branch database per pull request | Isolated previews | Automation to build and tear down; limits unverified | Frequent preview collisions |
| C. Two tiers: local and prod only | Least setup | Does not satisfy R4 | Not suitable |

Recommendation: A. Confidence: medium-high. What would change it: pull-request previews colliding often (then B).
Evidence: Vercel's documentation shows Production, Preview and Development variable scopes and `vercel pull --environment=...`; custom environments also exist, but their plan availability was not found. Whether the chosen Vercel plan allows three collaborators and a team-owned GitHub repository was not found either (G-29).

### D-30 Multi-agent coordination pattern for the development process — Decided
**Decision:** specialised agents (spec writer, implementer, test writer, security reviewer, hand-off writer) defined in `.claude/agents/`, each with inputs, outputs, files it may touch and a definition of done. Hand-offs go through files: spec, plan, code and tests, review report, branch-state note. Each owner advances the stages for their workstream (human orchestrator). The implementer–reviewer loop is capped at two rounds; disagreements are settled by the spec clause the reviewer cites, otherwise by the owner. Across people, coordination is the contracts package, this architecture document and a teammate's review of each pull request. One generalist agent per person is the measured baseline on one comparable task.
**Reason:** accepted AI recommendation (2026-10-28).
**Consequences:** agent definitions, the hand-off template and the stage checklist are repository files (spec work); coordination is verified by checking that each stage's output file exists and by the task log (D-31); MP3's project-state, spec and plan skills are copied in and adapted.
**Decided by:** team, 2026-10-28 (accepted AI recommendation).

Original brief (kept for the record):
Why now: R2 and G-19. The reflection asks how coordination is designed and verified: triggering, context, hand-off and conflicts. MP3 already used `PROJECT_STATE.md`, branch-state notes, spec and plan skills, and reviewer agents; this decision says what carries over.

| Option | Pros | Cons | Choose when |
|---|---|---|---|
| A. Specialised agents with file-based hand-offs and a human orchestrator. Agents (spec writer, implementer, test writer, security reviewer, hand-off writer) are defined in `.claude/agents/`, each with its inputs, outputs, files it may touch and a definition of done. Hand-offs go through files, not chat: spec, plan, code and tests, review report, branch-state note. Each owner advances the stages for their own workstream. The implementer–reviewer loop is capped at two rounds; a disagreement is settled by the spec clause the reviewer cites, otherwise it goes to the owner. Across people, coordination is the contracts package, this architecture document, and review of pull requests by a teammate | Checkable hand-offs (a missing output is visible); bounded cost; reuses MP3's workflow; maps to three people working in parallel | Overhead on small changes | Parallel work and a reflection that needs evidence |
| B. One generalist agent per person with skills | Least setup; fewest tokens on small tasks | No specialist review; weak evidence for the Multi-Agent SE reflection | As the measured baseline |
| C. An autonomous orchestrator that dispatches sub-agents | Little human effort | Higher token use; hand-offs hard to verify; blame is unclear when it fails | Large, well-specified batches |

Recommendation: A, with B kept as a measured baseline on one comparable task per the experiments in the resource-aware notes. Confidence: medium-high. What would change it: a deadline too short for the overhead (then B for small changes).
Evidence: MP3's repository (`AGENTS.md`, project-state and spec skills); the resource-aware notes (specialised agents vs one generalist).

### D-31 Development-process telemetry — Decided
**Decision:** both. Each person exports Claude Code's OpenTelemetry metrics to a local file; a small script aggregates them into a CSV under `docs/telemetry/`; the task log (agent, model, retries, outcome) is a section of every hand-off note.
**Reason:** accepted AI recommendation (2026-10-28).
**Consequences:** the exact variable names, fields and the aggregation script are verified in the spec against current Claude Code documentation; the CSV holds counts only and no prompt text; one person's tooling problem falls back to the task log alone.
**Decided by:** team, 2026-10-28 (accepted AI recommendation).

Original brief (kept for the record):
Why now: R5 and the reflection questions on tokens, cache, reasoning share, retries and heavy tasks. The app's own `llm_calls` covers the runtime; this covers the coding agents.

| Option | Pros | Cons | Choose when |
|---|---|---|---|
| A. Claude Code's built-in OpenTelemetry metrics only | Covers interactive sessions, with tokens split by input, output, cache-read and cache-creation, per model | Not per agent or task unless tagged | Usage totals are enough |
| B. A task log only: agent, model, retries, outcome and, for scripted headless runs, usage saved from the JSON output | Per-agent and per-task view | Interactive sessions are not captured | Few scripted runs |
| C. Both. Each person exports OpenTelemetry metrics to a local file; a small script aggregates them into a CSV under `docs/telemetry/`; the task log is a section of every hand-off note | Totals plus per-task detail; evidence for the heavy-task and cache questions | A little scripting | The reflection needs numbers |

Recommendation: C. Confidence: medium. What would change it: the exporter being inconvenient on one machine (fall back to B for that person).
Evidence: the resource-aware notes describe both mechanisms; the exact environment variable names and fields were not checked here and are for the spec to verify against current Claude Code documentation.

### D-32 Security of the development process — Decided
**Decision:** a baseline enforced by the repository and CI: no secrets in the repository (`.env` ignored, a secret scan in CI and before commit); production credentials never on developer machines, with production deploys and migrations only from CI; protected `development` and `main` with required checks and one teammate review; a dependency audit and a lockfile in CI; a written agent-permission policy (allowlisted commands, no access to production, repository and web content treated as data); security-relevant AI-written code reviewed by the security reviewer agent and by a human.
**Reason:** accepted AI recommendation (2026-10-28).
**Consequences:** CI jobs and repository settings are part of the first slice (WP E); the permission policy is a repository file; if the deadline is short, secret scanning and branch protection come first.
**Decided by:** team, 2026-10-28 (accepted AI recommendation).

Original brief (kept for the record):
Why now: R3 asks for security features in the development process as well as the AI features.

| Option | Pros | Cons | Choose when |
|---|---|---|---|
| A. A baseline enforced by the repository and CI: no secrets in the repository (`.env` ignored, a secret scan in CI and before commit); production credentials never on developer machines, with production deploys and migrations only from CI; protected `development` and `main` with required checks and one teammate review; dependency audit and lockfile in CI; a written agent-permission policy (allowlisted commands, no access to production, repository and web content treated as data, not instructions); AI-written security-relevant code reviewed by the security reviewer agent and a human | Each control is checkable; mirrors MP3's required checks; covers secrets, supply chain and prompt injection into coding agents | CI and settings to set up | A graded security story |
| B. A written policy only | Cheap | Nothing enforces it | Not suitable |
| C. A heavy toolchain (full static analysis suites, signed commits) | Thorough | Time that three people may not have | A production product |

Recommendation: A. Confidence: high. What would change it: a very short deadline (keep secret scanning and branch protection first).
Evidence: MP3's `AGENTS.md` (required `checkstyle` and `build` checks on both branches).

### D-33 Error envelope and status mapping — Decided
**Decision:** the envelope `{ "error": { "code", "message", "details": [{ "field", "message" }], "requestId" } }` with a stable machine-readable `code` held in `packages/contracts`. Mapping: malformed JSON or wrong content type 400; field validation 422 `VALIDATION_FAILED`; missing or invalid token 401; wrong role for the URL namespace 403; resource missing or outside the caller's projects 404; version mismatch, invalid state transition or duplicate 409; upload too large 413; limiter or cap 429 with `Retry-After`; unexpected 500 with only the `requestId`.
**Reason:** accepted AI recommendation (2026-10-28).
**Consequences:** the complete code list and a condition-to-code table per endpoint go in §8 and §6; the request id is logged with the status and code, never credentials or prompts.
**Decided by:** team, 2026-10-28 (accepted AI recommendation).

Original brief (kept for the record):
Why now: §8 and every endpoint in §6. A shape alone is not enough; each condition needs an exact code (the web-service profile).

| Option | Pros | Cons | Choose when |
|---|---|---|---|
| A. Envelope `{ "error": { "code", "message", "details": [{ "field", "message" }], "requestId" } }` with a stable machine-readable `code`. Mapping: malformed JSON or wrong content type 400; field validation 422 (`VALIDATION_FAILED`); missing or invalid token 401; wrong role for the URL namespace 403; resource missing or outside the caller's projects 404 (existence is not revealed); version mismatch, invalid state transition or duplicate 409; upload too large 413; limiter or cap 429 with `Retry-After`; unexpected 500 with only the `requestId` | One shape to handle in the UI; 404 for non-members leaks nothing; contracts hold the code list | Several owners write endpoints |
| B. Same envelope, but 400 for every validation failure and 403 for resources outside the caller's projects | Fewer codes | A 403 reveals that the resource exists | Existence is not sensitive |
| C. RFC 7807 `application/problem+json` | A standard | Less familiar; the same mapping decisions still apply | A public API |

Recommendation: A. Confidence: high. What would change it: nothing foreseeable.
Evidence: web-service profile; MP3's error handling (request id logged with a safe code).

### D-34 How AI failures reach the user — Decided
**Decision:** a per-feature outcome. PM: an error (`AI_UNAVAILABLE` 503, or `AI_BUSY` 429 with `Retry-After`), and the UI offers manual creation; no placeholder plan can be approved. Dev Lead: the computed facts are always returned, with `explanation: null` and `degraded: true`. Developer: a deterministic standup built from task events and item titles, marked `degraded: true`.
**Reason:** accepted AI recommendation (2026-10-28).
**Consequences:** three response shapes in `packages/contracts`; a `degraded` outcome is logged on `llm_calls`/`ai_sessions`; failure matrices per workflow in §9.
**Decided by:** team, 2026-10-28 (accepted AI recommendation).

Original brief (kept for the record):
Why now: the limiter (D-16) and the upstream can fail; each feature needs a defined, non-blank outcome (§9 failure matrix).

| Option | Pros | Cons | Choose when |
|---|---|---|---|
| A. Per feature. PM: no plan can exist without the model, so an error (`AI_UNAVAILABLE` 503, or `AI_BUSY` 429 with `Retry-After`) and the UI offers manual creation. Dev Lead: the computed facts are always returned; the explanation is `null` and `degraded: true`. Developer: a deterministic standup built from task events and item titles is returned with `degraded: true` | Every role keeps a working screen; the code-computed parts never depend on the LLM | Three response shapes | Features differ in what code can still provide |
| B. Every AI endpoint returns an error when the model fails | One rule | The Dev Lead and Developer screens go blank for no reason | Not suitable |
| C. Every AI endpoint returns 200 with `degraded: true` and a placeholder | One shape | A placeholder plan is misleading and must not be approvable | Not suitable for the PM feature |

Recommendation: A. Confidence: high. What would change it: nothing foreseeable.
Evidence: the SoCLaaS guide's rule that every feature has a non-LLM fallback; D-22 (facts computed in code).

### D-35 Concurrent edits and repeated requests — Decided
**Decision:** a `version` integer on project, epic, task, sprint, checkpoint and proposal; an update sends the version it read and receives 409 `CONFLICT_VERSION` on mismatch. No idempotency-key table: repeats are safe by state (approving an already-approved proposal returns the same result; an upload is deduplicated by project and item id or content hash; an epic expansion for the same proposal, epic and prompt version returns the stored result).
**Reason:** accepted AI recommendation (2026-10-28).
**Consequences:** each endpoint's repeat behaviour is stated in §6; the proposal apply is one transaction (§9); a duplicate-effect bug in testing would justify an idempotency key for that endpoint.
**Decided by:** team, 2026-10-28 (accepted AI recommendation).

Original brief (kept for the record):
Why now: three people edit the same plan; the proposal apply, the upload and the per-epic expansion can be retried by the browser or the user.

| Option | Pros | Cons | Choose when |
|---|---|---|---|
| A. A `version` integer on mutable entities (project, epic, task, sprint, checkpoint, proposal); an update sends the version it read and gets 409 `CONFLICT_VERSION` on mismatch. No idempotency header: repeats are safe by state (approving an already-approved proposal returns the same result; an upload is deduplicated by project and item id or content hash; an epic expansion for the same proposal, epic and prompt version returns the stored result) | Simple; matches the transactional apply (D-10); no stored responses | The client must handle 409 | Small team, few retries |
| B. A plus an `Idempotency-Key` header and a table of stored responses for all POSTs | Exact replay semantics | More code and storage | Payments-like flows |
| C. Last write wins | Least code | Silent lost updates on the shared plan | Not suitable |

Recommendation: A. Confidence: medium-high. What would change it: a duplicate-effect bug in testing (then B for that endpoint).
Evidence: web-service profile checklist; design reasoning.

### D-36 Delete lifecycle — Decided (policy)
**Decision:** soft delete (`deleted_at`) for epic, task and checkpoint; a project is archived (read-only). A DONE task cannot be deleted (409). Deleting an epic soft-deletes its tasks and unlinks it from its checkpoint. Deleted rows are excluded from lists, counts and forecasts but kept for audit.
**Reason:** accepted AI recommendation (2026-10-28); velocity history must not change (D-12).
**Consequences:** every list and aggregate filters deleted rows (a shared query helper, §4); restore is an admin database operation, not an MVP feature; whether a sprint can be deleted before it starts is a spec detail (G-22).
**Decided by:** team, 2026-10-28 (accepted AI recommendation).

Original brief (kept for the record):
Why now: velocity and forecasts depend on history, so deleting a finished task would change past sprints (D-12).

| Option | Pros | Cons | Choose when |
|---|---|---|---|
| A. Soft delete (`deleted_at`) for epic, task and checkpoint; a project is archived (read-only). A DONE task cannot be deleted (409). Deleting an epic soft-deletes its tasks and unlinks it from its checkpoint; deleted rows are excluded from lists, counts and forecasts but kept for audit | Velocity history stays intact; deletes can be undone by an admin; consistent rule | Every query filters deleted rows | History matters |
| B. Hard delete with cascade | Simple data | Rewrites velocity history; no undo | Throwaway data |
| C. No delete in the MVP | Least work | Users cannot correct a bad AI-generated plan | Not suitable (plans are AI-generated and must be fixable) |

Recommendation: A. Policy choice, the team's. Confidence: medium-high. What would change it: a wish for a simpler data model (then B, accepting changed history).
Evidence: D-12 (velocity from past sprints); design reasoning.

### D-37 Lists and time — Decided
**Decision:** instants are stored in UTC. "Days" (the standup day, sprint and checkpoint dates) are computed in one configured application time zone, default `Asia/Singapore`. Lists use offset paging: `page` from 0, `size` default 20, maximum 100, a stated sort key with the id as tie-breaker; a page past the end returns an empty list.
**Reason:** accepted AI recommendation (2026-10-28).
**Consequences:** the zone is an environment setting; inclusive or exclusive sprint end dates, and the working-day rule for the standup window, go in §11 (G-22); the SoCLaaS daily budget still resets at 00:00 UTC, and the limiter uses UTC for its own day counts.
**Decided by:** team, 2026-10-28 (accepted AI recommendation).

Original brief (kept for the record):
Why now: §6 list endpoints and §11 time rules. Sprints and checkpoints are calendar dates and the standup is per day (D-27); the team is in Singapore, while the SoCLaaS day resets at 00:00 UTC (08:00 Singapore).

| Option | Pros | Cons | Choose when |
|---|---|---|---|
| A. Store instants in UTC. "Days" (the standup day, sprint and checkpoint dates) are computed in one configured application time zone, default `Asia/Singapore`. Lists use offset paging: `page` from 0, `size` default 20, maximum 100, sorted by a stated key with the id as tie-breaker; a page past the end returns an empty list | One clear day boundary for users; simple paging | One zone for everyone | A single-region team |
| B. UTC days; cursor paging | No zone setting | The standup day rolls over at 08:00 for the team | A global team |
| C. A time zone per project | Flexible | A field and conversions everywhere | Distributed teams |

Recommendation: A. Confidence: medium-high. What would change it: users outside Singapore (then C).
Evidence: the SoCLaaS guide (day boundary 08:00 Singapore time); web-service profile (list and time decisions).

### D-38 Upload limits and summarisation batching — Decided
**Decision:** an upload is at most 1 MB and 100 items; text fields are capped (title 300 characters, body 2,000), an over-long body is truncated and flagged, and a larger file is rejected with 413. Only items inside the standup window (default: the previous working day up to now) are summarised; older items are stored without a summary. Uncached items are summarised in batches of up to 10 per call, each batch its own browser request, with the summary cached per item. The numbers are starting values for the spec.
**Reason:** accepted AI recommendation (2026-10-28).
**Consequences:** the batch endpoint and its per-item result shape are contracts (§6); a failed batch leaves its items unsummarised and retryable; widening the window is a configuration change.
**Decided by:** team, 2026-10-28 (accepted AI recommendation).

Original brief (kept for the record):
Why now: D-20 and D-27 fix the upload shape; D-18 caches summaries per item. One model call per item would be many calls under the limiter (D-16) for a large upload.

| Option | Pros | Cons | Choose when |
|---|---|---|---|
| A. An upload is at most 1 MB and 100 items; text fields are capped (title 300 characters, body 2,000) and an over-long body is truncated and flagged; larger files are rejected with 413. Only items inside the standup window (default: the previous working day up to now) are summarised; older items are stored without a summary. Uncached items are summarised in batches of up to 10 per call, each batch its own browser request (as D-21), with the summary cached per item | Few calls and tokens; progress is visible; older history costs nothing | A batch result must be parsed per item | Typical daily activity |
| B. One call per item | Simplest parsing | Up to 100 calls per upload; slow under 25 requests a minute | Very small uploads |
| C. Summarise every uploaded item on upload | Everything is ready | Spends tokens on items the standup never uses | Not suitable |

Recommendation: A. The numbers are starting values for the spec. Confidence: medium. What would change it: summaries of older history being needed (then widen the window).
Evidence: probe latency (§12) and the limiter defaults (D-16).

### D-39 to D-52 Confirmed defaults of the first pass — Decided
These fourteen were written into the first pass of the architecture document as AI defaults (then numbered A-01 to A-14). The team confirmed all of them on 2026-10-28 ("Assumed defaults are valid. Confirm all 14"). **Decided by:** team, 2026-10-28 (confirmed AI defaults). Alternatives were not tabled; each default was stated with what depends on it.

| ID | Decision | First-pass number | Refined by the review |
|---|---|---|---|
| D-39 | The PM adds Dev Leads; Dev Leads add developers; the creating PM is a member automatically | A-01 | removal follows the same roles (A-02, A-10) |
| D-40 | Forecast uses the last 3 closed sprints, or fewer; with none, no completion date and checkpoints show UNKNOWN | A-02 | formulas in architecture §11 (A-19) |
| D-41 | At most 5 regenerations per session; beyond that 429 `RATE_LIMITED` | A-03 | session caps added (A-07) |
| D-42 | No automatic retention or deletion of `llm_calls`, `ai_sessions`, activity items or summaries in the MVP | A-04 | none |
| D-43 | `GET /api/health` returns `{ "status": "UP" }` only | A-05 | none |
| D-44 | Standup window from 00:00 of the previous working day (Monday to Friday, application time zone) to now; holidays ignored | A-06 | none |
| D-45 | Sprint dates are inclusive calendar dates; sprints of a project do not overlap; one ACTIVE sprint per project | A-07 | none |
| D-46 | A PLAN can be approved only when every epic in it is expanded | A-08 | enforced on `proposal_epics` rows (A-07) |
| D-47 | The role × operation rows of the first pass (PMs and Dev Leads both edit epics, checkpoints and tasks; only Dev Leads and the assignee change task status; usage views show own sessions and aggregates) | A-09 | now the policy map (A-01) |
| D-48 | `users.email` is unique and taken from the verified token; the display name is entered at registration | A-10 | `email_verified` requirement dropped (D-57) |
| D-49 | Only a PLANNED sprint may be deleted | A-11 | none |
| D-50 | The per-endpoint codes `USER_NOT_REGISTERED` and `REGISTRATION_CODE_INVALID` | A-12 | more codes added (A-12) |
| D-51 | Restoring a soft-deleted row is a manual database operation by the team | A-13 | none |
| D-52 | Until the model experiment (D-23b), the MP3 trio is the model set | A-14 | none |

## Review findings: dispositions

Source: `concerns.md`, a secondary attacker review of the first draft (Part 1: D-25 to D-28, C-01 to C-15) and of the restructured draft (Part 2, C-16 to C-39). The team asked for valid concerns to be integrated in the second pass. Because the team delegated the choices, each integration below is an **Assumed (AI default, delegated 2026-10-28)** item A-nn, never Decided until the team confirms; the architecture document's sign-off sheet lists the eight that change a decided decision or are hard to reverse. Overlaps the reviewer flagged were merged (C-08 with C-19, C-02 with C-20).

| Finding | Verdict | Integrated as |
|---|---|---|
| C-01 object-level standup ownership | Accepted | A-01; architecture §7 object-level rules |
| C-02 uploads are self-attested | Accepted | A-05 |
| C-03 proposals validated only when stored | Accepted | A-06 (a row-lock claim inside the single apply transaction replaces the suggested `APPLYING` status; same protection, one fewer state) |
| C-04 client-controlled fields in multi-request flows | Accepted | A-07 |
| C-05 context scoped by membership only | Accepted in part | A-08. Scoping retrieval to the target project only was **not** adopted: it would remove the purpose of D-28 (matching the PM's other projects). Mitigated by an allow-list, titles only, provenance shown, untrusted wrapping |
| C-06 cache leaks and poisoning | Accepted | A-09 |
| C-07 tests do not measure the attack | Accepted | A-17; architecture §7 security verification |
| C-08 one user can starve the limiter | Accepted | A-04 (separate keys per tier remain G-27) |
| C-09 sanitiser under-specified | Accepted | architecture §7 pipeline additions (A-12) |
| C-10 injection flag only on `llm_calls` | Accepted | A-09 |
| C-11 stored XSS through `url` | Accepted | A-05, A-15 |
| C-12 registration code oracle | Accepted | A-10 |
| C-13 full-text search details | Accepted | A-08; `plainto_tsquery` or `websearch_to_tsquery`, a manually migrated GIN index and the plan showing provenance are spec requirements |
| C-14 experiment flags weaken controls | Accepted | A-09 |
| C-15 D-27 confidentiality rests on open items | Already addressed | D-39, D-47; the usage page shows no per-user content for others |
| C-16 authorisation needs more than three checks | Accepted | A-01 |
| C-17 cross-table integrity by convention | Accepted | A-02 |
| C-18 `proposals` cannot be built as drawn | Accepted | A-03 |
| C-19 limiter undercounts | Accepted | A-04 |
| C-20 wrong-owner overwrite in uploads | Accepted | A-05 |
| C-21 parallel expansions write one JSON row | Accepted | A-07 |
| C-22 unverified email, no disable path | Closed by D-57 (Firebase configuration; member-removal rules remain open) | A-10 |
| C-23 dev and prod leaks; deploy-path contradiction | Accepted | A-11 (sign-off item 1). Vercel supports branch-scoped Preview variables (documentation checked) |
| C-24 a third-party 429 switches off AI | Accepted | A-12 |
| C-25 §8 mapping holes | Accepted | A-12; architecture §8 |
| C-26 `check-code` limiter has no table | Accepted | A-10 (`rate_limit_events`, hashed IP) |
| C-27 soft delete relies on a helper | Accepted | A-13 |
| C-28 overload fact can leak | Accepted | A-08; architecture §11 |
| C-29 `ai-context` scheduled last | Accepted | A-18 |
| C-30 deployment obligations dropped | Accepted | A-16; G-26 fallback; G-32 |
| C-31 migrations and recovery | Accepted | A-16; G-28 |
| C-32 browser-side controls missing | Accepted | A-15 |
| C-33 velocity can be rewritten after close | Accepted | A-14 |
| C-34 attack text in the repository | Accepted | A-17 |
| C-35 agents can edit the policy | Accepted | A-17 |
| C-36 supply chain | Accepted | A-17 |
| C-37 branch protection may be unavailable | Accepted as a check | G-29 (not verified here) |
| C-38 reviewer disagreements go to the owner | Accepted | A-17: an owner override of a security finding is recorded and reviewed by a teammate |
| C-39 R2 evidence proves process only | Accepted | A-17 (OpenAPI contract test) |
| Document hygiene items | Already fixed | by the restructure into this log |

## Delegated assumptions (Assumed, 2026-10-28)

Written in delegation mode: the team asked for valid findings to be integrated and did not choose between alternatives. Each item shows what was chosen, the main alternative, and why. Nothing here is Decided; the architecture document's §16 lists the same IDs.

| ID | Chosen | Main alternative | Why | Hard to reverse? |
|---|---|---|---|---|
| A-01 | One policy map (roles plus ownership predicate) enforced in one middleware; CI fails on a route missing from it | Namespace gate plus ad hoc ownership checks | Namespaces cannot express shared endpoints or "own task"; the map is also the input to the generated test | no |
| A-02 | Composite foreign keys (project and id) on epics, sprints, checkpoints and the assignee; removal of a member with open tasks refused | Convention and service checks only | Integrity enforced by the database survives a bug in any module | yes (schema) |
| A-03 | Cross-module use only through exported functions; apply functions take a transaction handle | `proposals` writing `core` tables | Keeps the table-ownership rule true | no |
| A-04 | The reservation is the `llm_calls` row (`IN_FLIGHT`, lease); `llm_slots` dropped; per-user shares; token or cost caps | A separate slots table; count rows after the call | The row is counted before the call, so parallel requests cannot all pass, and a killed function leaves a visible row | yes (schema) |
| A-05 | Items belong to the uploader; key includes uploader and `repo`; `url` is https only; far-future timestamps rejected | Key on project and external id; trust `author` | Stops one developer overwriting or impersonating another | yes (key) |
| A-06 | Row-lock claim inside one apply transaction; strict schema; re-checks | A separate APPLYING state | One transaction needs no extra state | no |
| A-07 | `proposal_epics` rows with leases; requests carry no text or session id; session caps | One JSON payload with a version check | Parallel expansions would conflict or lose updates | yes (schema) |
| A-08 | Context allow-list per feature; parameterised SQL with member ids; titles only; provenance | Scope retrieval to the target project only | Keeps D-28's purpose while closing the leaks | no |
| A-09 | Guard version in the summary key; user and project in the result-cache key; flags recorded; `flagged` stored | Keys on content only | Prevents cross-user leaks and stale summaries after a security fix | no |
| A-10 | Longer registration codes (at least 13 characters, D-63); hashed-IP rate limit table. `email_verified` and `disabled_at` were proposed and dropped (D-57: Firebase configuration) | Open email; no disable path | Brute-forcing a registration code becomes impractical; verification and disabling stay with Firebase | partly |
| A-11 | Branch-scoped dev secrets; previews in mock mode; production only from protected `main`; approved migration job; startup assertions | Keep D-29 and D-32 as written | They contradict each other and previews would read dev secrets | no |
| A-12 | Breaker counts upstream failures only; 429 transient; decaying budget block; new error codes; flagged input marked, not blocked | Global breaker on any failure | One user or an outsider on the shared key cannot switch AI off for everyone | no |
| A-13 | Prisma client extension for soft-delete and archived filters; one `assertWritable` | A helper function | A helper can be bypassed | no |
| A-14 | Carry-over choice at sprint close; frozen tasks in a CLOSED sprint | Free edits after close | Velocity history must not change (D-12) | no |
| A-15 | CSP, frame-ancestors, default token storage, no cookies, no OpenAPI in production | None stated | One origin means any script injection reaches the whole API | no |
| A-16 | Expand and contract migrations; recovery target verified; deployment verifications; `AI_ENABLED=false` fallback | None stated | Old code may run against a new schema; AI must degrade if unreachable | no |
| A-17 | CODEOWNERS and human review for agent files; pinned and frozen dependencies; deny rule on the corpus path; security reviewer can block; contract test; attack success criteria | Dependency audit and lockfile only | Agents can edit their own policy and read attack text; process evidence is not conformance | no |
| A-18 | Contracts, policy map, gateway interface, `AiContext`, `Sessions` frozen first | Freeze contracts and the gateway only | All three role slices depend on them | no |
| A-19 | The forecast and overload formulas of architecture §11 | None stated | Needed to build and test the Dev Lead feature | no |
| A-20 | The Developer prompt sections and budgets | None stated | Closes the G-11 draft | no |

## Round history

Newest first. Dates are 2026-10-28 unless stated.

- Second pass: the team confirmed the 14 first-pass defaults (D-39 to D-52); the findings in `concerns.md` were integrated (dispositions above) as delegated assumptions A-01 to A-20 with an eight-item sign-off sheet in the architecture document; `contracts.md` written; sections 9 to 13 written.

- Lens pass, first look (2026-10-28): G-30 added (small policies surfaced by the core and web-service checklists). Body sections 4 to 13 are still stubs; the consistency audit and readiness gate have not been run.
- Round 6 answers (2026-10-28): D-33 to D-38 Decided (accepted AI recommendations).
- Round 6 (2026-10-28): D-33 to D-38 briefed (error envelope and mapping, AI failure behaviour, concurrency and repeats, delete lifecycle, lists and time, upload limits and batching).
- Round 5 answers (2026-10-28): D-29, D-30, D-31, D-32 Decided (accepted AI recommendations).
- Round 5 (2026-10-28): D-29 to D-32 briefed (environments, agent coordination, development telemetry, development-process security); G-15 and G-19 folded in; G-28 (migrations) and G-29 (Vercel plan limits) added.
- Round 4b answers (2026-10-28): D-25, D-26, D-27, D-28 Decided (accepted AI recommendations); the D-20 upload gains a project reference (D-27).
- Round 4b (2026-10-28): D-25 to D-28 briefed (untrusted text and scoped context with threats T1 to T11, security and evaluation tests, standup scope and visibility, retrieval); G-18, G-24, G-25 folded in.
- D-24 Decided (2026-10-28, accepted AI recommendation): `cost_microusd` added to `llm_calls`; D-15's "no cost column" is superseded.
- SoCLaaS guide (2026-10-28): facts recorded in §12 (limits, prices, model list, reachability); D-24 proposed (estimated cost column, amends D-15); G-26 (Vercel reachability) and G-27 (keys per environment) added; D-23b candidates listed.
- Round 4 answers (2026-10-28): D-20, D-21, D-22 Decided (accepted AI recommendations); D-23 split: D-23a Decided (static set per feature in config, team's choice), D-23b Deferred (model selection by experiment; MP3 trio Assumed meanwhile).
- Round 4 (2026-10-28): D-20 to D-23 briefed (upload format, PM generation, Dev Lead analysis, model routing); G-08 and G-12 folded in; G-24, G-25 added; threat model (G-18) and standup visibility (G-24) follow in round 4b.
- Round 3 close (2026-10-28): D-19 Decided (`ai_sessions`, accepted AI recommendation).
- Round 3 answers (2026-10-28): D-15 Decided with the team's amendment (a `session_id` for per-task spend), D-16, D-17, D-18 Decided (accepted AI recommendations); D-19 added to define sessions and outcome signals.
- Round 3 (2026-10-28): D-15 to D-18 briefed (`llm_calls`, limiter, section budgets, caches); G-07, G-09, G-20 folded into them; model routing (G-08) moved to round 4 with the per-feature design.
- Probe (2026-10-28): G-16 resolved from the team's run; findings recorded in §12 and §3; G-07 reworded; G-23 added.
- Round 2b answers (2026-10-28): D-11, D-12, D-13, D-14 Decided (accepted AI recommendations).
- Round 2b (2026-10-28): D-07 Decided (one role + `project_members`, accepted AI recommendation); D-11 to D-14 briefed (work split, estimation, task states, checkpoint links); G-21 folded into D-12.
- Round 2 answers (2026-10-28): D-08, D-09, D-10 Decided (accepted AI recommendations); D-07 stays Proposed pending a worked example of A vs B.
- Round 2 (2026-10-28): D-07 to D-10 briefed (role model, role assignment, entity set, AI proposal storage); G-05 and G-06 folded into them; G-14 renamed D-11 and deferred to round 2b; G-21, G-22 added.
- Round 1b (2026-10-28): D-01b Decided (Next.js + Hono), D-01c Decided (REST + OpenAPI from zod), D-06 Decided (no cron), all accepted AI recommendations; G-10 reworded; §10 candidate jobs now on-demand.
- Round 1 close (2026-10-28): D-01 split; D-01a Decided (single Hono on one Vercel project, team's choice); D-05 Decided (gateway state in DB), G-17 superseded; D-01b, D-01c, G-20 opened; G-09 reworded (result caching is an experiment, not a baseline); D-02 note: Prisma Accelerate is allowed as an optional experiment.
- Round 1 answers (2026-10-28): D-02 Decided (Postgres + Prisma, team's choice), D-03 Decided (Firebase Auth, team's choice), D-04 Decided (port MP3 design, accepted AI recommendation). D-01 stays Proposed: team asked about a single-Hono Vercel deploy, so option B′ was added.
- Round 1 (2026-10-28): skeleton created; Given items recorded from the brief and the team's framing answers (TypeScript full-stack, SoCLaaS only, team of 3 with one role each); D-01 to D-04 briefed; G-01 to G-19 inventoried.

## Round 7: answers to the sign-off sheet (2026-10-29)

| Item | Team's answer | Recorded as |
|---|---|---|
| 1. A-11 deploy path | No major conflict between D-29 and D-32: the environments are separated by repository gating (pull requests and reviews enforced by CI) and by Vercel's branch-specific deploys and environment-scoped variables | D-53 (the AI had framed this as a contradiction; the team's reading is that it is consistent) |
| 2. A-04 limiter | Asked for a walkthrough, then proposed a separate counter table: a window-start timestamp and a count; first call starts the window with count 1; later calls inside the window increment; a call after the window resets both | Open, see below |
| 3. A-07 plan epics as rows | Asked for the main difference | Open, see below |
| 4. A-02 | Accept | D-54 |
| 5. A-05 | Asked why attribution is needed if the uploaded file is only read by the LLM for that developer's standup | Open, see below |
| 6. A-10 | Configurable in Firebase entirely; out of scope | D-57; the AI kept the code length and the code-guessing limiter as Assumed because the registration codes are ours, not Firebase's |
| 7. A-01 | Approve | D-55 |
| 8. A-08 | Approve; asked what D-28 retrieval is for | D-56; answered below |
| G-01 | Deadline 13 November | Given |
| G-26 | Should be reachable; verify again in implementation | Assumed |
| G-29 | Vercel Hobby (the deployer must be the GitHub owner; no Vercel collaboration); GitHub education plan, all features | Given; consequence G-33 |
| G-27 | One key for prod, one for dev | D-58 |
| G-32 | Should hold; confirm in implementation | Assumed |
| G-28 | Determined in the spec | Deferred |
| D-23b | Decided after testing during implementation | Deferred |

### Open items: AI assessment (awaiting the team's decision)

**A-04 limiter.** The team's counter-table proposal is a fixed-window counter. Compared with D-16 as decided (counts over `llm_calls` plus `llm_slots` rows, under an advisory lock) and with A-04 (the `llm_calls` row is the reservation): it is simpler, needs no lock, and one atomic statement (`INSERT ... ON CONFLICT DO UPDATE` that resets the window by the database clock) is safe under parallel requests. Costs: a burst of up to twice the limit across a window edge, and no cap on calls in flight (the per-minute count bounds them). Spend caps are separate: they stay a sum over `llm_calls` or a second counter keyed by UTC day. The AI recommends adopting it. Parallel requests from one user do occur (the PM's per-epic expansions, D-21), so the atomic statement matters even though one role makes one task at a time.

**A-07 plan epics as rows.** D-10 stored the stage-2 results as one JSON value in the proposal. The stage-2 expansions run as parallel browser requests, so two expansions finishing together would both read the old JSON and the second write would erase the first. A row per epic means each expansion updates only its own row.

**A-05 attribution.** The team's reading is right: items are used only for the uploader's own standup. A-05's rule "the item belongs to the uploader" is just that, and costs nothing (the uploader is the signed-in user, not a field). What the AI now recommends removing is the file's `author` field, which has no use and was the spoofing vector (C-02). The Dev Lead reads the resulting standup, not the items.

**D-28 retrieval.** When the PM asks for a plan, the prompt can include up to five similar epics and tasks from the PM's earlier projects, found by full-text search, so the plan reuses real past work and sizes. It is behind a flag so plans with and without it can be compared as evidence of context engineering (R5).

### Confirmed on 2026-10-29

| ID | Decision | Decided by |
|---|---|---|
| D-53 | Deploy path and secret scoping (A-11); D-29 and D-32 are consistent | team, 2026-10-29 |
| D-54 | Composite foreign keys (A-02) | team, 2026-10-29 (approved the AI default) |
| D-55 | Policy map as the one authorisation mechanism (A-01) | team, 2026-10-29 (approved the AI default) |
| D-56 | Retrieval scope of D-28 (A-08) | team, 2026-10-29 (approved the AI default) |
| D-57 | Out of scope: email verification and disabling users in our code (Firebase configuration) | team, 2026-10-29 |
| D-58 | Two SoCLaaS keys, prod and dev | team, 2026-10-29 |

## Round 8: second reply (2026-10-29)

| ID | Decision | Decided by |
|---|---|---|
| D-59 | Fixed-window counter table limiter (replaces A-04 and the counting part of D-16) | team, 2026-10-29 (the team's own proposal, endorsed by the AI) |
| D-60 | Uploads have no author field | team, 2026-10-29 |
| D-61 | `proposal_epics` rows | team, 2026-10-29 |
| D-62 | A-03, A-06, A-14, A-15, A-18, A-19, A-20 approved | team, 2026-10-29 |
| D-63 | Registration codes at least 13 characters; the demo codes for local and dev | team, 2026-10-29 |

A-17 is Deferred by the team: it is to be woven together with the project's skills.

### Answers to the team's questions (A-09, A-12, A-13, A-16 stay Assumed until the team replies)

**A-09 cache keys.** A cached AI result is reused when its key matches. The summary cache from D-18 was keyed by the content hash and the prompt version. A-09 adds the guard version (the sanitising and injection rules): without it, a summary produced under a weaker guard would survive after the guard is fixed. For the optional generic result cache (an experiment flag) it adds the user and project, so one person's result is never served to another and a cache hit cannot reveal that someone else sent the same text (C-06). It also records the experiment-flag state on every `llm_calls` row, so the evidence tables say which settings produced each number, and keeps those flags server-side. Since D-60 items belong to the uploader, the user part matters only for the generic cache.

**A-12 breaker.** D-05 already decided that the gateway has a circuit breaker: after repeated upstream failures (timeouts, 5xx) it stops calling SoCLaaS for a short cool-off and answers `AI_UNAVAILABLE` at once, so every user does not wait out a timeout. A-12 only sets its rules: it counts upstream failures only (never a bad schema or a blocked input, which a user can cause), treats a 429 as transient, makes a budget block decay, adds the missing error codes (`REQUEST_REFUSED`, `ALREADY_REGISTERED`, `details.reason`), and marks a flagged input rather than blocking it. The AI sees no reason to drop the breaker; if the deadline presses it is the first thing that could be cut to a plain timeout.

**A-13 soft delete and archive.** Deleted rows stay in the database with a deleted flag, and a project can be archived (read-only). Prisma has no automatic filter, so any query that forgets "not deleted" would show deleted tasks in lists, in search and in AI prompts. A Prisma client extension adds the filter to every read by default (an explicit opt-out is needed to see deleted rows). `assertWritable` is the one check that refuses writes to an archived project, called by every write path including the AI-driven ones (uploads, standups, applying a proposal).

**A-16 migrations, recovery and AI-unreachable.** It has four parts: forward-only expand-and-contract migrations (a new schema still works with the previous app version, so a rollback of the app is safe); a stated recovery target checked against the Neon plan; the deployment verifications of G-32; and `AI_ENABLED=false` in an environment where SoCLaaS cannot be reached. Your reading is right for the user-facing part: the behaviour when the LLM is unreachable is already D-34 (the PM gets an error, the Dev Lead keeps the facts, the Developer gets a code-built standup) and the UI can show "LLM unreachable. Please try again later" for `AI_UNAVAILABLE`. `AI_ENABLED=false` is a different thing: a deployment switch that turns the AI features off for a whole environment (for example if Vercel cannot reach SoCLaaS, G-26), so those requests answer `AI_DISABLED` at once. The migration and recovery parts overlap with G-28, which you deferred to the spec. Proposal: keep the switch, show your message text for `AI_UNAVAILABLE`, and move the migration and recovery parts to the spec.

## Round 9: third reply (2026-10-29)

| ID | Decision | Decided by |
|---|---|---|
| D-64 | Breaker and error rules (A-12) | team, 2026-10-29 |
| D-65 | Soft-delete extension and `assertWritable` (A-13) | team, 2026-10-29 |
| D-66 | AI-unreachable message, `AI_ENABLED=false` switch kept, migrations and recovery to the spec (A-16 narrowed) | team, 2026-10-29 |

### A-09: how the keys are used and whether they can match

There are three caches, and they match in different situations.
- **Item summaries** (D-18), keyed by item, content hash, guard version and prompt version. They match when a developer uploads a file again that contains items already summarised and unchanged (a daily upload of a log that overlaps the previous day) or asks for summaries a second time. The item row belongs to the uploader (D-60), so the key already includes the user and project: keys can never match across users, by construction.
- **Standup input hash** (D-06), keyed by project, developer, date and the hash of the standup input. It matches when the developer regenerates a standup and nothing has changed.
- **Generic result cache** (an experiment flag, off by default): it would match only when the same user repeats an identical request. PM prompts contain free text, so repeats are rare; its value is as an experiment, not a saving.

So the user and project part of A-09 is a safeguard that makes cross-user hits impossible, not a feature. It adds nothing to the summary key (already implied by the item) and costs nothing in the generic key. The guard version matters only after the sanitising rules change: old summaries then stop matching and are recomputed. The hit rate itself is measured through `CACHE_HIT` rows in `llm_calls`, which is the evidence for the resource-aware report, since SoCLaaS reports no provider cache.

AI proposal if the team agrees: shrink A-09 to (1) the summary key stays item, content hash, guard version and prompt version, with no extra user or project part; (2) the generic result cache is kept only behind its flag, with the user and project in its key; (3) the experiment-flag state is recorded on every `llm_calls` row. Nothing else changes.

## Round 10: fourth reply (2026-10-29)

| ID | Decision | Decided by |
|---|---|---|
| D-67 | Cache keys (A-09, smaller form; the standup cache stays as D-06) | team, 2026-10-29 |

The team approved the corrected wording: the summary key without an extra user or project part, the generic result cache with user and project in its key behind its flag, the experiment-flag state on every `llm_calls` row with server-side flags, and `flagged` stored on items, summaries, standups and digests.

## Round 11: fifth reply (2026-10-29)

| ID | Decision | Decided by |
|---|---|---|
| D-68 | Tier 1 and Tier 2 cut line of delivery-plan.md section 1; usage page in Tier 2 | team, 2026-10-29 (accepted AI proposal) |

## Round 12: sixth reply (2026-10-29)

| ID | Decision | Decided by |
|---|---|---|
| D-69 | Feature freeze at the end of 10 November 2026 | team, 2026-10-29 |

The team pointed out that the owner of the GitHub repository and the Vercel account does most of the deployment work under Hobby, which the first assignment did not reflect. Section 3 of delivery-plan.md now treats deploy operations as an owner-bound duty. Who owns the accounts, and who takes which slice, is left to the team.

## Round 13: seventh reply (2026-10-29)

| ID | Decision | Decided by |
|---|---|---|
| D-70 | Production deploy on 11 November 2026 | team, 2026-10-29 |

The team added that one person makes all the front-end mockups and asked the AI to split the work across the three roles by suitability. The split (delivery-plan.md section 3) is an AI choice made on that delegation and stays Assumed until the team confirms it.

## Round 14: eighth reply (2026-10-29)

| ID | Decision | Decided by |
|---|---|---|
| D-71 | One person designs the entire UI (mockups with most layouts and states, shell and shared components); the others link their flows to the backend using the mockups | team, 2026-10-29 |

## Round 15: ninth reply (2026-10-29)

| ID | Decision | Decided by |
|---|---|---|
| D-72 | The work split of delivery-plan.md section 3 | team, 2026-10-29 (confirmed the AI split) |
