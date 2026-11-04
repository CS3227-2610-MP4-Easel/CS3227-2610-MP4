# W12 CI and Process Security Design

- **Status:** Approved (Dev Lead, 2026-11-05)
- **Amended 2026-11-05:** For every sensitive PR, the author is excluded and the other two trusted people, `@teleifo`, `@ludannnn`, and `@Xiao-Congchen`, fill the security-reviewer and human-approver roles in either order; Gate 1 approval is required before implementation.
- **Amended 2026-11-05:** Findings 2–5 add trusted review-event re-evaluation, CLI base-argument coverage, rename-safe sensitive-path classification, and cross-platform test discovery; Gate 1 approval is required before implementation.
- **Amended 2026-11-04:** T6 no longer requires a committed security-review JSON artifact; current exact-head GitHub approvals from `@ludannnn` and the author-dependent human approver are the complete sensitive-path approval evidence.
- **Amended 2026-11-04:** T6 adds a one-time bootstrap classification when the base branch lacks the manifest; the head manifest must exactly match the fixed bootstrap list, and normal base-manifest verification remains mandatory afterward.
- **Amended 2026-11-04; rebased 2026-11-05:** Bootstrap is now bound to base SHA `68d639a067ce514085a8074b9f18fa0c3ab3ed06`, target branch `development`, and externally configured repository variable `W12_BOOTSTRAP_PR_NUMBER`; exact manifest parsing, post-rollout validation, and reviewer evidence are specified.
- **Amended 2026-11-05:** Every sensitive PR excludes its author and assigns the security-reviewer and human-approver roles to the other two trusted people in either order; see branch-state C~13.
- **Amended 2026-11-03:** reconciled protected paths and contract-test locations with the merged W1 source-root layout; see branch-state C~3.
- **Risk tier:** High - the work controls repository permissions, secrets, supply-chain inputs, and merge authority.
- **Workstream:** W12 | **Plan:** [implementation plan](../../plans/2026-11-02-w12-ci-process-security-plan.md)
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
- A fully trusted first-rollout evaluator — the bootstrap checker is part of the initial PR; the residual risk and compensating human review are explicit below.

## 4. Components

- [Requirements](2026-11-02-w12-ci-process-security-design/requirements.md) — observable CI and repository-control requirements.
- [API](2026-11-02-w12-ci-process-security-design/api.md) — the review-evidence input and GitHub review verification contract.
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
| SD5 | Sensitive-path PRs require actual GitHub `APPROVED` reviews from the two trusted people other than the PR author, with one serving as security reviewer and the other as human approver. No committed review artifact is required. | The PR author cannot approve their own change, and either trusted reviewer may fill either role; GitHub's current exact-head review records are the authoritative and sufficient approval evidence. | Dev Lead, 2026-11-04; revised 2026-11-05 |
| SD6 | During the first rollout only, if the base branch lacks the sensitive-path manifest, T6 uses a fixed bootstrap list compiled into the checker and requires the PR manifest to match it exactly. Once the manifest exists on the base branch, the fallback is unavailable. | Allows one W12 merge without a direct protected-branch push; reading an arbitrary PR manifest is rejected because it would let the PR define its own sensitive surface. | Dev Lead, 2026-11-04 |
| SD7 | Bootstrap is permitted only for target branch `development`, base SHA `68d639a067ce514085a8074b9f18fa0c3ab3ed06`, and the pull-request number equal to externally configured repository variable `W12_BOOTSTRAP_PR_NUMBER`; the exact ordered manifest in API SD7 is normative. The variable is removed after merge. | Makes the one-time transition mechanically identifiable and prevents parallel, `main`, later-base, or deleted-manifest re-entry. | Dev Lead, 2026-11-04; rebased 2026-11-05 |
| SD8 | Review approval changes are re-evaluated by a separate trusted `pull_request_review` workflow on `submitted`, `edited`, and `dismissed`; it runs the checker from the trusted base workflow revision and reads the PR head only through Git objects. Findings 3–5 are fixed in the existing checker and test command. | Prevents stale approval status while keeping PR-controlled workflow and scripts out of the review-event enforcement path. | Dev Lead, 2026-11-05 |

## 7. Residual bootstrap risk

The first PR contains the evaluator and the manifest, so a malicious PR could attempt to change
both. The mitigation is the immutable rollout base SHA and target-branch guard, the normative list
recorded in the approved API contract, exact schema comparison, CODEOWNERS protection, and actual
GitHub approvals from `@ludannnn` plus the author-dependent human approver. The first rollout is
not equivalent to a base-branch-seeded policy; Gate 3 must record the bootstrap base SHA, target,
configured PR number, merged head, the security-reviewer and human comparison of evaluator/list/
manifest against the approved contract, removal of `W12_BOOTSTRAP_PR_NUMBER`, and a post-merge
check proving that a missing base manifest no longer activates bootstrap.
