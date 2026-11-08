# W13 Deployment Safety Corrections Design

- **Status:** Approved (operator, 2026-11-08)
- **Risk tier:** High — these checks protect production deployment identity, database writes, migration execution, and production startup.
- **Workstream:** W13 | **Plan:** pending approval
- **Lenses:** Implementer, Tester, Maintainer, Attacker
- **Constraints consulted:** AD-32 production deploys and migrations only from CI; AD-53 only `development` receives dev credentials; approved W13 deployment requirements; C~4 reverses the no-token implementation detail; no schema change and no new dependency.

Amended 2026-11-07 after Implementer, Tester, Maintainer, and Attacker review: canonical target maps, exact Vercel API evidence, protected token boundary, full-manifest validation, child-process redaction, and unconditional production validation are now explicit.

Amended 2026-11-08 under continuation branch C~5: the removed automated development-check workflow and verifier are retired. T4 now uses an owner-operated, read-only Vercel inspection plus fixed development health/auth smoke checks; the unimplemented Developer standup/AI probe is no longer a T4 prerequisite. No Vercel token is used by repository workflows or application runtime.
Amended 2026-11-09 under C~8: production Git auto-deploy is disabled; the protected production workflow invokes an owner-created Vercel Deploy Hook only after migration and build validation, preserving the no-token boundary while preventing deployment/migration races.

## 1. Problem

The current automated development-check workflow was removed before continuation. The seed command checks only `APP_TIER`, the production migration runner calculates but does not enforce the committed checksum manifest, and production resource validation expects Vercel's Preview environment.

The desired behavior is that deployment evidence comes from Vercel, seed writes are bound to the configured tier target before Prisma is constructed, migration execution stops on manifest mismatch, and production accepts Vercel's `production` environment value.

## 2. Goals

See [requirements.md](2026-11-07-w13-deployment-safety-design/requirements.md).

## 3. Non-goals

- No production deployment promotion, Neon restore, or live SoCLaaS smoke test; those remain later W13 gates under AD-32 and the approved W13 plan.
- No database schema or seed-content change.
- No Vercel deployment token in repository workflows or application runtime; development evidence is owner-operated and read-only.

## 4. Components

- [requirements.md](2026-11-07-w13-deployment-safety-design/requirements.md) — testable functional and non-functional requirements.
- [api.md](2026-11-07-w13-deployment-safety-design/api.md) — verifier, seed, migration, and settings contracts.
- [conventions.md](2026-11-07-w13-deployment-safety-design/conventions.md) — target matching, redaction, and Vercel metadata rules.
- [edge-cases.md](2026-11-07-w13-deployment-safety-design/edge-cases.md) — abuse, mismatch, failure, and rollback cases.
- [implementation-order.md](2026-11-07-w13-deployment-safety-design/implementation-order.md) — dependency-ordered implementation tasks.

## 5. Open questions

| ID | Question | Blocks | Owner |
|---|---|---|---|

## 6. Decisions made in this spec

| ID | Decision | Why / rejected alternative | Asked by |
|---|---|---|---|
| SD1 | Use owner-inspected Vercel deployment metadata and fixed requests against the exact `development` alias; compare project ID, deployment ID, alias ownership, ready state, commit SHA, and creation time, then recheck identity after smoke. | A hard-coded GitHub SHA is not evidence of a Vercel deployment. The operator now rejects the token-bearing workflow and accepts an owner-operated, redacted evidence gate instead. | operator, 2026-11-08 |
| SD2 | Bind seed and migration target safety to an immutable code-owned tier target map; environment target labels are checked against that map, never used as the source of truth. | APP_TIER, NEON_HOST, and NEON_PROJECT can otherwise be changed together to make a production URL look like development. | operator, 2026-11-07 |
| SD3 | Read and validate every entry in the committed migration manifest before either Prisma command, with an injectable child-process executor and a minimal child environment. | A unit-only checksum helper and inherited direct URL do not protect production execution. | operator, 2026-11-07 |
| SD4 | Add separate `vercelEnv` values to the tier manifest; application tier `prod` maps to Vercel `production`, while `dev` maps to Vercel `preview`. | One field cannot safely represent both the application label and Vercel's system environment names. | operator, 2026-11-07 |
| SD5 | Remove the Developer standup and AI smoke probe from the manual T4 completion gate; retain deployment metadata, health, authenticated identity, foreign-project rejection, and tier checks. | Endpoint 51 belongs to unstarted W9; blocking W13 deployment evidence on that route would couple deployment safety to an unrelated feature workstream. | operator, 2026-11-08 |
| SD6 | Sequence production deployment through a protected Vercel Deploy Hook invoked only after migration/build validation; disable Vercel's automatic production deployment from Git. | Tokenless Git auto-deploy races the migration workflow; a Deploy Hook preserves C~5 without using a Vercel deployment token. | operator, 2026-11-09 |
