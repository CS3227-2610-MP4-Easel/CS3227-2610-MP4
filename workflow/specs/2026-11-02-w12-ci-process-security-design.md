# W12 CI and Process Security Design

- **Status:** Approved (Dev Lead, 2026-11-02)
- **Risk tier:** High - the work controls repository permissions, secrets, supply-chain inputs, and merge authority.
- **Workstream:** W12 | **Plan:** —
- **Constraints consulted:** `guardrails.md` AD-32; architecture AD-53; decision-log AD-32, A-17; architecture §14.
- **Review lenses:** Implementer, Tester, Maintainer, Attacker.

## 1. Problem

The current INT base has no repository CI workflow, no committed agent-permission policy, and no
repository-level evidence that tests, contract parity, dependency checks, or secret scans run before
integration. W1 supplies the npm workspace scripts and OpenAPI parity test, but those checks are not
yet enforced by GitHub.

W12 establishes the thin enforceable baseline selected by the Dev Lead. A pull request must produce
machine-readable evidence for the workspace checks and security scans, while GitHub repository rules
must prevent bypassing those checks. Production credentials and deployment remain outside W12 and
follow AD-53/W13.

## 2. Goals

Functional and non-functional requirements are in [requirements](2026-11-02-w12-ci-process-security-design/requirements.md).

## 3. Non-goals

- Production deployment, migrations, Vercel projects, or environment secrets — W13 and AD-53.
- A custom policy-as-code framework — Option 2 was rejected by C~1 in the branch state.
- Signed commits, a full static-analysis suite, or runtime security monitoring — not required by AD-32's baseline.
- Replacing the policy map, OpenAPI generator, or attack corpus — W1 and W11 own those artifacts.
- Granting agents production access or allowing secrets in PR-triggered workflows — prohibited by AD-32 and AD-53.

## 4. Components

- [Requirements](2026-11-02-w12-ci-process-security-design/requirements.md) — observable CI and repository-control requirements.
- [Conventions](2026-11-02-w12-ci-process-security-design/conventions.md) — workflow, permissions, review, and local-scan rules.
- [Edge cases](2026-11-02-w12-ci-process-security-design/edge-cases.md) — failure, abuse, and recovery expectations.
- [Implementation order](2026-11-02-w12-ci-process-security-design/implementation-order.md) — dependency order for the later plan.
- No data model or API component: W12 persists no application data and adds no runtime endpoint.

## 5. Open questions

| ID | Question | Blocks | Owner |
|---|---|---|---|

## 6. Decisions made in this spec

| ID | Decision | Why / rejected alternative | Asked by |
|---|---|---|---|
| SD1 | Use one pull-request workflow with npm workspace checks, OpenAPI parity, dependency audit, and Gitleaks secret scanning; enforce repository settings separately. | Implements AD-32 with a small auditable surface; a custom policy engine was rejected as Option 2. | Dev Lead, 2026-11-02 |
| SD2 | Use `CODEOWNERS` for `.github/`, `.claude/`, `.codex/`, `workflow/`, contracts, and security-test paths; require one human teammate review for protected branches. | Protects controls from self-modification while preserving the three-person workflow. | Dev Lead, 2026-11-02 |
| SD3 | CI runs without production credentials and uses mock mode for any environment-dependent test. | PR workflows must not receive secrets; production access is CI-environment gated by AD-53. | Dev Lead, 2026-11-02 |
| SD4 | `@teleifo` administers `development` and `main` and owns protected repository paths; `@ludannnn` is the independent human security reviewer. | These handles provide concrete CODEOWNERS and branch-protection ownership without making the W12 owner the sole security reviewer. | Dev Lead, 2026-11-02 |
