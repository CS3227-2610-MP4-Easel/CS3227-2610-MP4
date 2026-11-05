# W13 — Environments, seed data and deployment

- **Status:** Draft — Gate 1 approval required  
- **Risk tier:** High — production credentials, authentication configuration, database migrations, recovery, and irreversible deployment effects.  
**Lenses:** Implementer, Tester, Maintainer, Attacker.  
**Approach:** Hybrid deployment: Vercel branch deployment for dev; an approved protected GitHub Environment job for production migration and deployment.

Amended 2026-11-06: AD-53 controls preview mapping and W4 controls local auth; only `development` receives dev credentials, other PR previews are mock-only, and local uses a non-production Firebase project without emulator mode.

## 1. Problem and intent

W1 supplies the application, Prisma schema/migration, API health route, and workspace CI skeleton,
but the repository does not yet define the runnable local/dev/prod environment contract, seed
dataset, deployment gates, migration procedure, recovery evidence, or live-tier smoke checks.
W13 makes those contracts explicit so the team can run a stable dev tier and a separately protected
production tier before the 10 November feature freeze and 11 November production deploy.

## 2. Goals

- Make local, dev, preview, and production configuration explicit and tier-safe.
- Make deployment, migration, seed, recovery, and smoke-check outcomes observable and auditable.
- Keep production credentials and live AI access behind the recorded CI and environment boundaries.

The detailed acceptance criteria are in [requirements.md](2026-11-06-w13-deployment-design/requirements.md).

- F1: Local setup can run in mock mode with no production credentials.
- F2: `development` deploys as the dev Vercel Preview with dev-scoped services and secrets.
- F3: Other pull-request previews are mock-only and receive no data credentials.
- F4: Production deploys only from protected `main` through the approved GitHub Environment job.
- F5: Database migration and seed procedures are forward-only, repeatable, and environment-scoped.
- F6: Seed data supports the Tier 1 demonstration and does not contain production secrets.
- F7: Each deployment records health, database, auth, and SoCLaaS verification evidence.
- F8: Recovery evidence records the Neon backup/restore check and seed reapplication.
- N1: Production credentials never enter pull-request jobs, repository files, or developer machines.
- N2: Recovery meets the architecture target of at most 24 hours recovery-point loss and 4 hours recovery time, subject to the Neon plan check.
- N3: CI tests never call live SoCLaaS; only protected post-deploy smoke checks may do so.

## 3. Non-goals

- Building new product endpoints or changing the Prisma data model; W13 consumes W1's existing contracts.
- Hosting Postgres, Firebase, or SoCLaaS inside Vercel; those remain external services.
- Adding scheduled workers, queues, automatic deletion, or automated restore tooling, which are out of scope by the guardrails.
- Making CI call live SoCLaaS; CI remains mock-only under AD-26.

## 4. Components

- [requirements.md](2026-11-06-w13-deployment-design/requirements.md) — observable functional and non-functional obligations.
- [data-model.md](2026-11-06-w13-deployment-design/data-model.md) — environment data, seed scope, migration and recovery contract.
- [api.md](2026-11-06-w13-deployment-design/api.md) — deployment operations, inputs, outputs, security, and evidence.
- [conventions.md](2026-11-06-w13-deployment-design/conventions.md) — environment and secret naming rules.
- [edge-cases.md](2026-11-06-w13-deployment-design/edge-cases.md) — failure, permission, migration, and recovery cases.
- [implementation-order.md](2026-11-06-w13-deployment-design/implementation-order.md) — dependency-ordered implementation tasks.

## 5. Open questions

None. The repository owner supplies the fixed GitHub Environment name, Vercel project identifiers,
stable dev alias, and Neon-plan evidence as implementation inputs; these do not change the W13
behavioral contract.

## 6. Decisions made in this spec

| ID | Decision | Why / rejected alternative | Asked by |
|---|---|---|---|
| SD1 | Use Vercel branch deployment for `development`; production migration and deploy run in an approved GitHub Environment job from protected `main`. | Matches AD-29 and AD-53; keeps production credentials out of PR workflows. Rejected one-path Vercel deployment because migration approval would be implicit. | operator, 2026-11-06 |
| SD2 | PR previews other than `development` use mock mode and receive no data or production credentials. | Applies AD-53's clarification of AD-29 and prevents untrusted PR code from reaching shared databases or external AI services. | operator, 2026-11-06 |
