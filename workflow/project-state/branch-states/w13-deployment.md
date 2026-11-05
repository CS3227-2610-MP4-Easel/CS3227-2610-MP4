# Branch State — w13-deployment

**What this branch has changed, and how to pick it up.** `workflow/project-state/STATE.md`
describes `INT`; read it for context and write here instead of editing it.

- **Branch:** w13-deployment (from `INT` at `94ebc77134ffd4ab00e0bda3c3fe9c2ff933ef01`)
- **Base:** 94ebc77134ffd4ab00e0bda3c3fe9c2ff933ef01
- **Owner:** operator / repository owner
- **Status:** Draft
- **Approved:** —
- **Last updated:** 2026-11-06 by Codex — Gate 1 approved by operator

---

**Scope.** W13 Environments, seed data and deployment: specify the local/dev/prod configuration,
seed data, migration and recovery evidence, deployment gates, and smoke checks required to make
the W1 application runnable on the dev and production tiers.

---

## 1. How to Resume

**Sessions**

| Session | Started | Agent(s) | Workstream | Status | Doing | Next action | Last touched |
|---|---|---|---|---|---|---|---|
| S1 | 2026-11-06 | Codex | W13 | Active | Writing Gate 2 implementation plan | Verify plan paths, lint, review, then request Gate 2 approval | 2026-11-06 |

**Remaining**

- [x] Complete the requested Implementer/High-risk read-only review and run spec lint; lint passed with 0 errors and 0 warnings.
- [x] Complete the requested Tester/QA High-risk read-only review; findings reported in chat.
- [x] Complete final four-lens High-risk review; spec lint passed with 0 errors and 0 warnings.
- [x] Gate 1: operator approved the W13 spec on 2026-11-06; approved-spec lint passes.

## 2. Workstreams

| ID | Workstream | Status | Spec | Plan | Progress | Guide |
|---|---|---|---|---|---|---|
| W13 | Environments, seed data and deployment | Spec'd | [spec](../../specs/2026-11-06-w13-deployment-design.md) | — | Gate 1 spec drafted; review pending | — |

## 3. Changes

| Date | What changed | Workstream | Ref |
|---|---|---|---|
| 2026-11-06 | Started local W13 branch and drafted the deployment specification using the approved hybrid approach; AD-53 clarified that only `development` receives dev credentials and other previews are mock-only | W13 | 21c1f77 |
| 2026-11-06 | Read-only Tester/QA High-risk re-review: spec lint passes, but deployment-owner execution, API error coverage, seed content, recovery evidence, evidence completeness, and CI/runtime redaction traceability remain incomplete | W13 | review in chat |
| 2026-11-06 | Final Implementer/High-risk read-only review: blocking gaps remain in dev deployment identity, immutable production binding, preview startup, smoke fixtures, and resource allowlists | W13 | review in chat |
| 2026-11-06 | Finalized the Gate 1 spec with W4 local-auth clarification, fixed preview runtime, resource allowlist, immutable SHA/deployment checks, smoke contract, seed/recovery evidence, and CI security boundaries | W13 | 21c1f77 |

## 7. Decisions

> Legend: `C` = project decision. AD-nn entries are in docs/architecture.

### C~1 — Use the hybrid deployment path

- **Date:** 2026-11-06
- **Who asked:** operator, confirming the recommended option 1
- **Decision:** Use Vercel branch deployment for the `development` dev tier; use a protected GitHub Environment job for production migration and deployment from `main`.
- **Why:** This directly satisfies AD-29's tier separation and AD-53's protected production migration boundary while keeping production credentials out of PR workflows.
- **Rejected:** GitHub Actions for both tiers adds deployment-token and workflow machinery; Vercel integration for both tiers does not itself provide the required production migration approval boundary.

### C~2 — Apply AD-53's preview clarification

- **Date:** 2026-11-06
- **Who asked:** operator, asking to proceed after the review found an apparent AD-29 collision
- **Decision:** Interpret AD-29's dev tier as the `development` branch with dev credentials; apply AD-53's later clarification so all other pull-request previews are mock-only and have no data credentials. This is a clarification, not a reversal of AD-29.
- **Why:** AD-53 is the later, more specific deploy-path decision and matches the existing W4 preview settings contract.
- **Rejected:** Treating the older AD-29 consequence in isolation, because it contradicts AD-53 and would expose shared dev services to untrusted PR code.

### C~3 — Apply W4's local auth clarification

- **Date:** 2026-11-06
- **Who asked:** operator, confirming that W4's later contract controls local auth
- **Decision:** Local uses a non-production Firebase project and the existing W4 Admin SDK settings; `FIREBASE_AUTH_EMULATOR_HOST` remains unset. This clarifies AD-29's earlier local emulator wording rather than changing W4.
- **Why:** The merged W4 contract and current runtime reject emulator mode because it accepts unsigned tokens; local must therefore use the supported signed-token path.
- **Rejected:** Re-enabling the emulator for W13, because that would contradict W4 and weaken authentication tests.
