# 4. Components

## Frontend (`src/fe`)

The W10 prototype remains the frontend handoff:

- `app/[[...slug]]/page.tsx`: one catch-all route. `lib/screens.ts` maps each URL to a screen per role.
- `app/api/as`: sets the role cookie (prototype mode only; 404 otherwise).
- `components/canvas/`: the page layouts, one per screen and role.
- `components/live/`: the parts that read and write through the data layer (board, backlog, sprints, members, checkpoints, health, standups, usage, task drawer).
- `lib/api/`: types, fixtures, store and the endpoint-named functions (see section 3); `http.ts` holds `apiFetch`, the only `fetch` caller, and `errors.ts` its `ApiError`.
- `lib/auth/`: `mode.ts` (`authMode`), `firebase.ts` (the only Firebase import), `session.tsx` (`SessionProvider`, `useSession`), `mode-context.tsx` (`AuthRoot`, `useAuthMode`); `components/auth-gate.tsx` gates pages on the session. `components/live/sign-in.tsx` and `register.tsx` are the live auth screens.
- **Invariants:** `test/source-rules.test.ts` fails the build if Firebase is imported outside `lib/auth/firebase.ts`, `fetch(` appears outside `apiFetch`, `location.assign(` outside `lib/auth/navigate.ts`, `dangerouslySetInnerHTML` anywhere, or client code reads `process.env` beyond the four Firebase values.

## Contracts (`src/be/contracts`)

- **Purpose:** single source for Zod request/response schemas, stable errors, pagination, OpenAPI schemas, route definitions, and the 57-operation policy map.
- **API:** exports the frozen interfaces, schemas, `ROUTES` types, authorization predicates, and OpenAPI helpers from [`src/be/contracts/src/index.ts`](../../src/be/contracts/src/index.ts).
- **Invariants:** every route has a stable operation ID and policy entry; request validation rejects unknown or malformed input; the policy map is the authorization source of truth.

## Database (`src/be/db`)

- **Purpose:** owns the Prisma schema/migrations and the request-facing filtered client.
- **API:** [`createDbClient`](../../src/be/db/src/client.ts), transaction helpers, visibility policy, and maintenance boundaries.
- **Invariants:** soft-deleted and archived data is hidden by default; compound unique reads are normalized through visible reads; raw SQL and extension escape hatches are hidden; nested writes and relation filters still require explicit caller authorization.

## API (`src/be/api`)

- **Purpose:** owns the Hono boundary, request IDs, error mapping, route registration, and authorization seam.
- **API:** [`createApiApp`](../../src/be/api/src/app.ts), [`registerRoute`](../../src/be/api/src/routes/register.ts), the shared [`ROUTES`](../../src/be/api/src/routes/index.ts), and `createPredicateEvaluator`.
- **Invariants:** routes are registered through the policy gate; handlers do not check roles; resource resolvers belong to table-owning modules and must fail closed for hidden or missing resources. A route with `bodyLimitBytes` has its JSON body read with that byte cap after authorization (413 past it); `body-limit.ts` holds the counting helpers.
- **Deviations:** authorization precedes input parsing (D2), and registration is app/dependency-aware (D3).

## Core (`src/be/core`)

- **Purpose:** owns project planning data and the membership/resource-resolution seams used by the API and AI context.
- **API:** [`createCore`](../../src/be/core/src/core.ts), `requireMember`, `lockProjectForMutation`, project/task/epic/checkpoint operations, `applyPlan`, and the registered core context sources ([`src/be/core/src/index.ts`](../../src/be/core/src/index.ts)).
- **Depends on:** `@agile/db` and the caller/project authorization context; it does not import `@agile/ai-context`.
- **Invariants:** archived projects are not writable; hidden or missing resources fail closed; mutation writes lock the project row and preserve task/sprint/checkpoint rules.

## Auth (`src/be/auth`, routes in `src/be/api/src/routes/auth.ts`)

- **Purpose:** verifies Firebase ID tokens, resolves the caller's role from `users` (never from a claim), checks registration codes, and rate-limits sign-up. Serves endpoints 2 (`check-code`), 3 (`register`) and 4 (`me`).
- **API:** `loadAuthSettings`, `createFirebaseTokenVerifier`, `createResolvePrincipal`, `createLookupRegisteredUser`, `createHit` and `clientIpKey` (the AD-59 fixed-window limiter over `@agile/db`'s `incrementRateCounter`), `checkRegistrationCode`, `createUser`, `getUser`, and `getAuthRuntime()` which builds them once from `process.env`.
- **Invariants:** settings are validated at module load, so the app will not start with unsafe values (codes 13 to 128 characters, distinct, no demo codes on prod; `FIREBASE_AUTH_EMULATOR_HOST` refused on every tier). Codes are compared as SHA-256 digests with `timingSafeEqual`. Endpoints 2 and 3 count the attempt per client IP (20 a minute, keyed by an HMAC of the first `x-vercel-forwarded-for` value) and cap the body at 4 KiB before authorization. `requireMember` is not here: W5's `core` owns it (C48, C49).
- **Deviations and limits:** a failed Firebase key fetch is reported as a 500, not a 401 (D14). Tokens of unverified emails are accepted and revoked or disabled users keep access until the token expires (C47; see Known limitations).
- **Frontend:** the sign-in and register screens in `src/fe` use these endpoints (see Frontend). A 401 during registration signs the user out and offers "Sign in instead" (D21); releasing the registration hold re-reads `/api/me` (D20).

## LLM gateway package (`src/be/llm-gateway`)

- **Purpose:** `getLlmGateway().run(call)` is the one path for every model call; `getSessions()` issues and checks AI sessions; usage queries serve W15.
- **API:** [`createLlmGateway`](../../src/be/llm-gateway/src/gateway.ts), [`createSessions`](../../src/be/llm-gateway/src/sessions.ts) (with `regenerate` and `openOrReuse` beside the frozen `Sessions` type; `openOrReuse` returns the caller's newest usable open session for a feature and project, so summary batches share one, C79), `recordCacheHit` (writes the `CACHE_HIT` row AD-18 requires when a feature answers from its cache, C79), `registerMockResponse` and the SoCLaaS provider ([`providers.ts`](../../src/be/llm-gateway/src/providers.ts)), `usageSessions`, `usageSummary` and `failureReason` ([`usage.ts`](../../src/be/llm-gateway/src/usage.ts)), and the guards ([`sanitise.ts`](../../src/be/llm-gateway/src/sanitise.ts), [`output-check.ts`](../../src/be/llm-gateway/src/output-check.ts), [`guards.ts`](../../src/be/llm-gateway/src/guards.ts)). Models, prices and limits live in `config.ts`; every time comes from an injectable clock.
- **Invariants:** no prompt, response, section text, boundary or key is stored or logged; `test` and `preview` tiers must run the mock and `prod` must run live (`LLM_MODE`); the SoCLaaS key goes only to the exact SoCLaaS URL, with redirects refused; `run` refuses to start inside an `@agile/db` transaction; each call writes an `llm_calls` row `IN_FLIGHT`, finalised once, and a failed follow-up write never turns a recorded `OK` into an error.
- **Guards (W3):** untrusted sections are cut, normalised (NFKC), stripped of invisible characters and delimiter tags, redacted for emails, phone numbers and NRIC, FIN, matric and NUSNET ids, and flagged for injection patterns; a section emptied by this is `BLOCKED_INPUT`, a flag only marks the call. The gateway wraps untrusted sections in a random per-call boundary and always appends a fixed security suffix. The output guard accepts the exact `{"refusal":true}` (`REFUSED`) and fails (`SCHEMA_FAIL`) any text with forbidden characters, links, HTML, Markdown links or images, the boundary or the key, including after schema transformation. `GUARD_VERSION` names the rules and is pinned to a fingerprint by a test.
- **Deviations:** the gateway takes two extra test seams and the usage queries take the tier explicitly (D6); internal, non-upstream errors do not count towards the breaker (D7); output checks are broader than the approved rules (D15) and also cover schema-transformed results (D16); live keys under eight characters are rejected (D17).

## AI context (`src/be/ai-context`)

- **Purpose:** the one membership-scoped function that assembles the stored data a feature may send to the model.
- **API:** `getAiContext().assembleWith(caller, feature, targetProjectId, options)`. The frozen `assemble` is kept, but throws `INVALID_ASSEMBLE_INPUT` for `DEV_SUMMARY` and `DEV_STANDUP`, so every feature calls `assembleWith` (D18, signed off under AD-11, C59).
- **How it works:** checks the input, the caller's role for the feature and the caller's membership of the target project (the frozen `Core.requireMember`, registered by W5), calls every allow-listed source of the feature at once behind a 10-second deadline, checks each source's rows (shape, count, type, length, project, owner, requested items), checks membership again, and builds the sections. Any failure returns nothing. Feature modules register their sources with `registerContextSource`; `ai-context` imports no other module.
- **Invariants:** a source-scan test keeps gateway-calling files away from database packages and unsafe raw queries.
- **Options:** `DEV_STANDUP` takes `{ window: { from, to } }` with `from <= to`; an empty window is valid, so the current blockers still reach the standup (C74).
- W5 registers the `core.*` sources; W9 registers `dev.activityItems` and `dev.itemSummaries` (see Developer), and W7/W8 register their own sources.

## Lead (`src/be/lead`)

- **Purpose:** implements Dev Lead facts, forecast, digest generation and the `lead` AI context sources.
- **API:** [`createLeadRuntime`](../../src/be/lead/src/runtime.ts), facts/forecast/flow functions, digest schemas and context-source wiring.
- **Depends on:** `@agile/core`, `@agile/ai-context`, `@agile/llm-gateway`, and `@agile/db` through its owning seams.
- **Invariants:** facts are limited to allow-listed keys and member projects; digest ordering uses persisted `factsAsOf`; cached/public responses do not expose private source rows.

## Developer (`src/be/dev`, routes in `src/be/api/src/routes/dev.ts`)

- **Purpose:** a Developer's activity upload, item summaries and standup: endpoints 49 (upload), 50 (summaries), 51 (generate standup), 52 (my standup) and 55 (the Dev Lead's list).
- **API:** [`createDevRuntime`](../../src/be/dev/src/runtime.ts) (composed in `src/be/api/src/dev-composition.ts`) over [`uploadItems`](../../src/be/dev/src/store/items.ts), [`generateSummaries`](../../src/be/dev/src/flows/summaries.ts), [`generateStandup`](../../src/be/dev/src/flows/standups.ts) and [`inDevWrite`](../../src/be/dev/src/store/writable.ts); `DevError` carries the HTTP code. The `dev.activityItems` and `dev.itemSummaries` context sources and the DEV_SUMMARY and DEV_STANDUP mocks register at boot.
- **Depends on:** `@agile/contracts` (`ActivityItemInputSchema`, `StandupSchema`, the date rules), `@agile/core` (`lockProjectForMutation`, `requireMember`, `core.taskEvents`, `core.blockedTasks`), `@agile/ai-context`, `@agile/llm-gateway`, `@agile/db`.
- **Invariants:** items, summaries and standups belong to the uploader, and both context sources return only the caller's rows. Upload accepts at most 1 MiB and 100 items; bodies over 2,000 UTF-16 units are cut, marked `body_truncated` and flagged. Summaries are cached per item by `GUARD_VERSION` and prompt version. Every write runs in `inDevWrite` (project lock, 409 when archived, membership); write retries that run out return 429 `RATE_LIMITED` with `Retry-After: 1` (C72). No model call runs inside a transaction.
- **Deviations:** `core.blockedTasks` lists every task blocked now, ignoring the window (D23); the DEV_STANDUP window may be empty (D24).
- **Not built:** edit and accept (53, 54) are W16.

## CI and process security (`.github/`, `workflow/`, `scripts/`)

- **Purpose:** pull requests are verified by CI, and changes to process-control files need review.
- **How it works:** one CODEOWNER approval per PR (C30); GitHub reviews are the approval source for sensitive paths, and the trusted workflow re-evaluates review approvals and sets the authoritative security status (C42, C43). An alternate reviewer is permitted when the usual security reviewer authored the PR (C34). Production migrations and deploys run only from CI.
- **Agent policy (C55):** agents may write the workflow's own outputs and run git (except `push`), `node`, `npm` and file commands inside the repository; the process-control files (`workflow/agent-permissions.json`, `workflow/tools/**`, `workflow/skills/**`, `.github/**`, `.githooks/**`, `scripts/**` and others) and the attack corpus stay review-required. The hook is `scripts/agent-pre-tool-hook.mjs`.

The W11 security corpus and authorization suite exercise production registration, auth, limiter,
session, filesystem and network-deny seams from declarative corpus cases. The corpus is reviewed
separately from the guard implementation and does not change production guard rules (C82, C83,
C84).

W13 deployment safety lives in [`scripts/w13/`](../../scripts/w13/),
[`src/be/db/src/tier-targets.ts`](../../src/be/db/src/tier-targets.ts), and
[`w13-production.yml`](../../.github/workflows/w13-production.yml). Recovery accepts only the
code-owned synthetic Neon target; production migration validates the direct host and migration
manifest, then deployment follows through the protected hook (C85, C92, C90, C93).
