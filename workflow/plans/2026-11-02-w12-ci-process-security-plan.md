# W12 CI and Process Security Implementation Plan

- **Status:** Approved (Dev Lead, 2026-11-04)
- **Amended 2026-11-04:** T6 now has a one-time first-rollout bootstrap path bound to `development`, base SHA `7bd65440023a0123ac92445e5b6e58ec838ee57c`, and externally configured PR number `W12_BOOTSTRAP_PR_NUMBER`; the head manifest must exactly match the fixed list, then later runs use only validated base/head manifests.
- **Amended 2026-11-04:** T5/T6 now implement canonical base-manifest classification and dual exact-head GitHub review verification; see W12 C~5/C~6.

> **For agents:** tick `- [ ]` -> `- [x]` as each step finishes, in this file and the same commit as the work. Keep the W12 branch state Progress cell current. Spec: [W12 design](../specs/2026-11-02-w12-ci-process-security-design.md).

## Scope

**Goal:** Enforce the selected thin CI and process-security baseline before changes reach `development` or `main`.

**In scope:** F1–F14, N1–N4, E1–E27.

**Non-goals:** Production deployment and migrations (W13); a custom policy-as-code framework; signed commits; full static-analysis suites; runtime security monitoring; changing the policy map, OpenAPI generator, or attack corpus contents.

**Risk tier:** High — repository permissions, secrets, workflow supply chain, and merge authority require fail-closed verification and independent review.

## Task order

| Task | Depends on | Can run concurrently with | Wave | Status |
|---|---|---|---|---|
| T1 Pull-request workflow and isolated checks | W1 merged into INT | T2, T3, T4 | 1 | Done |
| T2 Secret scanning and staged-file hook | — | T1, T3, T4 | 1 | Done |
| T3 Dependency audit and Action-pin verification | — | T1, T2, T4 | 1 | Done |
| T4 Agent policy and protected control paths | — | T1, T2, T3 | 1 | Done |
| T5 Sensitive-path manifest, CODEOWNERS and branch protection | T4, Q1 resolved | — | 2 | Done |
| T6 Security evidence and final verification | T1, T2, T3, T4, T5 | — | 3 | In progress |

## Traceability

| Requirement | Task(s) | Verified by |
|---|---|---|
| F1 | T1 | CI workflow check-context manual verification |
| F2 | T1 | locked-install fixture |
| F3 | T1 | workspace/typecheck/lint CI runs |
| F4 | T1, T6 | OpenAPI parity negative fixtures |
| F5 | T2, T6 | Gitleaks secret fixtures |
| F6 | T3, T6 | controlled audit result and unavailable-service check |
| F7 | T3, T6 | Action-pin and remote-execution fixtures |
| F8 | T4, T6 | agent-policy contract tests |
| F9 | T5, T6 | GitHub branch-rule verification |
| F10 | T5, T6 | CODEOWNERS path fixtures |
| F11 | T1, T6 | fork and same-repository untrusted-branch manual check |
| F12 | T2 | staged-file hook fixture |
| F13 | T4, T5, T6 | head-bound security-review evidence check |
| F14 | T6 | first-rollout bootstrap manifest fixtures |
| N1 | T1, T3, T6 | repeated-run and pinned-input evidence |
| N2 | T1, T4, T5 | workflow/policy permission checks |
| N3 | T1, T2, T6 | command-status and redaction verification |
| N4 | T4, T5, T6 | control-surface inventory |
| E1 | T1 | all required check contexts present |
| E2 | T1 | lock drift and lifecycle-script fixtures |
| E3 | T1, T6 | missing-operation fixture |
| E4 | T2 | secret canary fixture |
| E5 | T2, T6 | narrow allowlist fixture |
| E6 | T3 | audit-service failure fixture |
| E7 | T3 | tag/branch/unapproved-SHA fixture |
| E8 | T4, T5 | protected-policy review fixture |
| E9 | T4, T6 | attack-corpus data-handling fixture |
| E10 | T5, T6 | stale/self approval fixture |
| E11 | T5 | direct/force/deletion/bypass manual checks |
| E12 | T1, T6 | fork and same-repository PR isolation check |
| E13 | T2, T3, T6 | scan/audit configuration protection checks |
| E14 | T1, T2, T6 | redacted failure logs |
| E15 | T1 | W1 dependency gate check |
| E16 | T6 | sensitive `@teleifo` author-approver pairing |
| E17 | T6 | forged artifact without two current GitHub reviews |
| E18 | T6 | sensitive `@ludannnn` author fail-closed case |
| E19 | T6 | dismissed/changed-request review supersession |
| E20 | T6 | paginated GitHub review response |
| E21 | T6 | first-rollout exact bootstrap manifest |
| E22 | T6 | malformed or mismatched bootstrap manifest |
| E23 | T6 | no fallback after rollout |
| E24 | T6 | bootstrap target/base and exact-match semantics |
| E25 | T6 | malformed post-rollout head manifest |
| E26 | T6 | one-time bootstrap PR identity and variable retirement |
| E27 | T6 | independent Gate 3 comparison of bootstrap evaluator/list/manifest |

## Verification gates

- Per task: `npm test`, `npm run typecheck`, `npm run lint`, targeted `node --test tests/process-security/*.test.ts`, and `git diff --check`.
- Before finishing: `npm test`, `npm run typecheck`, `npm run lint`, `npm --workspace @agile/db run prisma:validate`, `node .claude/skills/writing-specs-lite/scripts/lint.mjs spec workflow/specs/2026-11-02-w12-ci-process-security-design.md --approved`, `node .claude/skills/writing-specs-lite/scripts/lint.mjs plan workflow/plans/2026-11-02-w12-ci-process-security-plan.md --approved`, all manual GitHub settings checks, and a clean working tree.

## Gate 2

- [x] **GATE:** Re-ask the operator to approve this materially amended implementation plan before coding. Approved by the Dev Lead on 2026-11-04; the prior approval was superseded by the Option 2 bootstrap amendment.

---

### T1: Pull-request workflow and isolated checks

**Delivers:** A `pull_request` workflow with seven independently required, secretless checks and W1-backed commands. T1 owns the base workflow wiring; later tasks add the scripts it invokes, and only T6 extends the existing `workflow-security` job. **Satisfies:** F1, F2, F3, F4, F11, N1, N2, N3, E1, E2, E3, E12, E15. **Depends on:** W1 merged into INT. **Wave:** 1.

**Files**

| Action | Path | What changes |
|---|---|---|
| Create | `.github/workflows/ci.yml` | Define `pull_request` validation for `development` and `main`, `ubuntu-24.04`, Node `20.19.5`, npm `10.8.2`, `permissions: {}`, `persist-credentials: false`, no environments/secrets, and the seven exact check contexts from the spec. |
| Modify | `package.json` | Add the explicit Prisma generation pretest, the exact `check:workflows`, `check:agent-policy`, `scan:secrets`, and `contract` scripts; `contract` runs `node --import tsx --test src/be/api/test/openapi-parity.test.ts src/be/contracts/test/openapi.test.ts`. |
| Test | `tests/process-security/ci-workflow.test.ts` | Assert trigger, head SHA checkout, permissions, no `pull_request_target`, no secrets/environments, stable job names, and W1 dependency gating; cover E1, E2, E12, E15. |

**Checklist**

- [x] 1. Write failing workflow-shape tests for E1, E2, E12, and E15; expect failure because `.github/workflows/ci.yml` and the process-security commands do not exist.
- [x] 2. Add the workflow with independent jobs named `workspace`, `typecheck`, `lint`, `contract`, `dependency-audit`, `secret-scan`, and `workflow-security`; each job checks out `${{ github.event.pull_request.head.sha }}` with `fetch-depth: 0` and never receives secrets.
- [x] 3. Add the W1-dependent npm scripts, including `contract` with the exact `src/be` test paths and explicit Prisma generation before workspace tests; use `npm ci --ignore-scripts` before checks and never execute lifecycle scripts during install.
- [x] 4. Run the workflow-shape tests and the W1 workspace checks; expect PASS.
- [x] 5. Verify the same commit twice with identical runtime/action inputs and record the required-check names and outcomes; cover N1.
- [x] 6. Update branch state Progress and Changes.
- [x] 7. GATE: Mark the task complete in branch state and use the prescribed subject `feat: add isolated W12 pull request checks (W12)`.

### T2: Secret scanning and staged-file hook

**Delivers:** Gitleaks configuration, protected allowlist, CI tree/range scan, and a local staged-file hook. **Satisfies:** F5, F12, N3, E4, E5, E13, E14. **Depends on:** —. **Wave:** 1.

**Files**

| Action | Path | What changes |
|---|---|---|
| Create | `.gitleaks.toml` | Define the pinned Gitleaks `8.24.2` rules/configuration and narrow reviewed allowlist format. |
| Create | `.githooks/pre-commit` | Run `npm run scan:secrets -- --staged` and fail on a detected secret. |
| Create | `scripts/scan-secrets.mjs` | Implement staged and CI tree/`base_sha..head_sha` scan modes with redacted output and fail-closed range resolution. |
| Create | `scripts/setup-hooks.mjs` | Configure `core.hooksPath` to `.githooks` without writing credentials. |
| Create | `tests/process-security/secret-scan.test.ts` | Test canaries, renames, deleted/reintroduced secrets, narrow allowlists, and redacted output; cover E4, E5, E13, E14. |
| Modify | `package.json` | Add `setup:hooks` and `scan:secrets` scripts. |

**Checklist**

- [x] 1. Write failing scan tests for E4, E5, E13, and E14; expect failure because the scanner/configuration/hook do not exist.
- [x] 2. Add `.gitleaks.toml`, the staged-file hook, and the wrapper with explicit base/head range inputs and redacted output.
- [x] 3. Add `setup:hooks` and verify `--no-verify` cannot bypass the CI scan.
- [x] 4. Run the scanner tests and verify the full tree plus PR range are covered; expect PASS.
- [x] 5. Update branch state Progress and Changes.
- [x] 6. Record the task completion with subject `feat: enforce W12 secret scanning (W12)`.

### T3: Dependency audit and Action-pin verification

**Delivers:** Dependency audit evidence and a validator for approved immutable workflow inputs. **Satisfies:** F6, F7, N1, E6, E7, E13. **Depends on:** —. **Wave:** 1.

**Files**

| Action | Path | What changes |
|---|---|---|
| Create | `workflow/action-pins.json` | Record approved Action repositories, full SHA, source version, and action type for every third-party/local/reusable workflow input. |
| Create | `scripts/check-workflows.mjs` | Reject moving tags/branches, unapproved repositories, non-SHA references, remote bootstrap commands, unpinned images, and unapproved reusable/local actions. |
| Create | `tests/process-security/workflow-security.test.ts` | Test rejected action references, altered allowlists, remote execution, and job-level write permissions; cover E6, E7, E13. |
| Modify | `package.json` | Add `check:workflows` and pin the exact audit command used by `dependency-audit`. |

**Checklist**

- [x] 1. Write failing workflow-security tests for E6, E7, and E13; expect failure because the manifest and validator do not exist.
- [x] 2. Add the manifest schema and validator; require exact repository/SHA/version correspondence and reject unapproved executable supply-chain inputs.
- [x] 3. Configure `dependency-audit` as `npm audit --audit-level=high`, record the lockfile and advisory source, and fail closed on service failure; remediate the audited Next.js, Zod, and Prisma dependency chains.
- [x] 4. Run the validator and controlled audit fixtures; expect PASS.
- [x] 5. Update branch state Progress and Changes.
- [x] 6. Record the task completion with subject `feat: verify W12 dependency and action inputs (W12)`.

### T4: Agent policy and protected control paths

**Delivers:** The canonical fail-closed agent policy, validator, adapter mediation contract, and protected-path inventory. **Satisfies:** F8, F13, N2, N4, E8, E9. **Depends on:** —. **Wave:** 1.

**Files**

| Action | Path | What changes |
|---|---|---|
| Create | `workflow/agent-permissions.json` | Define explicit `allow`, `deny`, `review_required`, and `content_handling` rules with default deny. |
| Create | `workflow/tools/agent-policy.mjs` | Provide the provider-neutral mediation seam that evaluates policy before command, file, network, or secret access. |
| Create | `scripts/check-agent-policy.mjs` | Validate the policy schema and fail closed for missing/malformed rules, production access, protected-path writes, and instruction-like corpus handling. |
| Create | `tests/process-security/agent-policy.test.ts` | Exercise command, file, network, secret, production-host, protected-path, missing-policy, malformed-policy, and corpus-data cases; cover E8 and E9. |
| Modify | `workflow/agents/reviewer.md` | Define the provider-neutral security-reviewer output contract and protected-path review behavior; regenerate provider adapters afterward. |
| Modify | `workflow/config.json` | Register the policy validator and security-review evidence path without adding credentials. |

**Checklist**

- [x] 1. Write failing policy tests for E8 and E9; expect failure because the canonical policy and validator do not exist.
- [x] 2. Add the JSON policy with default-deny rules for production credentials/hosts, all access to `tests/security/attack-corpus/**`, and protected-path writes.
- [x] 3. Add the central adapter mediation contract and reviewer artifact format, bound to the PR head and requiring `@ludannnn` plus a different human owner.
- [x] 3a. Regenerate `.claude/agents/reviewer.md` and `.codex/agents/reviewer.md` from `workflow/agents/reviewer.md` using the repository adapter tooling; do not edit generated adapters directly.
- [x] 4. Run policy tests with missing, malformed, bypass, and instruction-like fixtures; expect PASS and no side effects.
- [x] 5. Update branch state Progress and Changes.
- [x] 6. Record the task completion with subject `feat: add W12 agent process policy (W12)`.

### T5: CODEOWNERS and branch protection

**Delivers:** Protected-path ownership and GitHub settings for `development` and `main`. **Satisfies:** F9, F10, N2, N4, E8, E10, E11. **Depends on:** T4, Q1 resolved. **Wave:** 2.

**Files**

| Action | Path | What changes |
|---|---|---|
| Modify | `workflow/security-sensitive-paths.json` | Maintain the versioned `{version: 1, paths: [...]}` canonical sensitive-path manifest consumed from the base revision by T6. |
| Modify | `.github/CODEOWNERS` | Assign `@teleifo`, `@ludannnn`, and `@Xiao-Congchen` to every canonical sensitive path; retain the repository owner on other protected paths. |
| Modify | `tests/process-security/codeowners.test.ts` | Verify every protected path is covered and owner/reviewer entries are concrete; cover E8 and E10. |
| Modify | `workflow/project-state/branch-states/w12.md` | Record the GitHub settings evidence and any owner handoff. |

**Checklist**

- [x] 1. Write failing CODEOWNERS coverage tests for E8 and E10; expect failure because `.github/CODEOWNERS` does not exist.
- [x] 2. Add the canonical sensitive-path manifest and exact CODEOWNERS rows for workflows, CODEOWNERS, package manifests/scripts, hooks, scanner config, agent files, workflow files, `src/be/contracts/**`, `src/be/*/test/**`, tests, and security corpus; assert obsolete `packages/**` patterns are absent and every manifest row requests all three sensitive reviewers/owners.
- [x] 3. GATE: Ask the operator to apply and confirm GitHub rules on both `development` and `main`: seven required checks, one CODEOWNER approval, stale-approval dismissal, latest-push approval, no self-approval, no administrator bypass, no direct/force/deletion pushes, and up-to-date-branch enforcement.
- [x] 4. GATE: After operator confirmation, capture the settings verification and negative direct/force-push, bypass, stale/self-approval results; expect PASS. GitHub's protection API confirms the seven contexts, strict status checks, review settings, admin enforcement, and disabled force pushes/deletions on both branches.
- [x] 5. Update branch state Progress and Changes.
- [x] 6. Record the task completion with subject `feat: protect W12 repository paths (W12)`.

### T6: Security evidence and final verification

**Delivers:** Head-bound dual GitHub-review check, one-time first-rollout bootstrap, post-rollout manifest validation, complete failure-case evidence, and closeout verification. **Satisfies:** F4, F5, F6, F7, F8, F9, F10, F11, F13, F14, N1, N2, N3, N4, E3, E5, E6, E7, E8, E9, E10, E11, E12, E13, E14, E16, E17, E18, E19, E20, E21, E22, E23, E24, E25, E26, E27. **Depends on:** T1, T2, T3, T4, T5. **Wave:** 3.

**Files**

| Action | Path | What changes |
|---|---|---|
| Modify | `scripts/check-security-review.mjs` | Read the base-branch manifest, or use the fixed bootstrap list only for `development` at the immutable pre-rollout base SHA and configured bootstrap PR number when the base manifest is absent; read the head manifest by SHA with duplicate-key-aware parsing, enforce exact schema/list semantics, validate changed/deleted head manifests, normalize logins, parse complete paginated reviews, and require latest exact-head approvals. |
| Modify | `tests/process-security/security-review.test.ts` | Test bootstrap exact-match, immutable target/base/PR-number guards, missing/malformed/mismatched manifests, duplicate/unknown-key/order cases including duplicate JSON keys, post-rollout fail-closed behavior, forged artifacts, exact-head approvals, author pairing, superseded states, pagination, sensitive `@ludannnn` authors, and Gate 3 bootstrap evidence; cover F13/F14 and E16–E27. |
| Modify | `.github/workflows/ci.yml` | Extend `workflow-security` with job-level `pull-requests: read`, `gh api --paginate --slurp` review retrieval to `$RUNNER_TEMP`, and `--reviews-file`; do not add an eighth required status. |
| Modify | `workflow/agents/reviewer.md` | Require actual GitHub approvals from `@ludannnn` and the author-dependent human approver for sensitive paths; the artifact is supporting evidence. |
| Modify | `workflow/config.json` | Register the canonical sensitive-path manifest and dual-review evidence contract without credentials. |
| Modify | `.claude/agents/reviewer.md`, `.codex/agents/reviewer.md` | Regenerate provider adapters from the amended reviewer contract. |
| Modify | `workflow/project-state/branch-states/w12.md` | Record verification results, changes, and final handoff. |

**Checklist**

- [x] 1. Extend the security-review tests with failing cases for missing/stale/forged artifacts, exact-head GitHub reviews, author pairing, review-state precedence, pagination, and sensitive `@ludannnn` authors; expect failure because the amended checker contract is not implemented.
- [x] 2. Add the base-manifest sensitive-path classifier, normalized author-dependent approver selection, review-file parser, and deterministic latest-state evaluator; fail closed when sensitive paths change without two current exact-head approvals.
- [x] 3. Add the workflow review fetch with only `pull-requests: read`, invoke the checker with `--reviews-file`, and verify the artifact cannot substitute for either GitHub approval.
- [x] 4. Add regression tests for E3–E14 and E16–E20, including forged artifacts, normalized GitHub logins, dismissed/changed-request states, equal-timestamp ID tie-breaking, and multi-page responses; verify no secret canary appears in logs.
- [x] 5. Replace the fixed `human_owner` config with the author-dependent approver mapping, amend the provider-neutral reviewer contract, regenerate the provider adapters, and add assertions that both required GitHub reviews are distinct from the PR author.
- [x] 5a. Add the exact normative bootstrap list, require `development`, base SHA `7bd65440023a0123ac92445e5b6e58ec838ee57c`, and PR number equal to `W12_BOOTSTRAP_PR_NUMBER`, read the head manifest by SHA with duplicate-key-aware parsing, reject unknown keys/duplicates/order changes, validate changed or deleted manifests after rollout, and ensure later missing or malformed base manifests fail closed.
- [ ] 6. Run `npm test`, `npm run typecheck`, `npm run lint`, `npm --workspace @agile/db run prisma:validate`, `node .claude/skills/writing-specs-lite/scripts/lint.mjs spec workflow/specs/2026-11-02-w12-ci-process-security-design.md --approved`, `node .claude/skills/writing-specs-lite/scripts/lint.mjs plan workflow/plans/2026-11-02-w12-ci-process-security-plan.md --approved`, and `git diff --check`.
- [ ] 7. Update the plan, branch state, and Changes line; confirm the working tree is clean.
- [ ] 8. Record the task completion with subject `test: verify W12 process security controls (W12)`.
- [ ] 9. GATE: After the first merge, verify `development` contains the manifest, remove `W12_BOOTSTRAP_PR_NUMBER`, run missing-base and leftover-variable fixtures that fail outside the allowlisted rollout identity, and record the bootstrap base SHA, target branch, configured PR number, merged head, reviewer comparison of evaluator/list/manifest, variable removal, and result in branch state.

### Close-out

- [ ] Every Traceability row has passing evidence or a named manual verification.
- [ ] W1 dependency is merged into `development`; all W12 task statuses, spec status, and branch-state Progress agree with reality.
- [ ] The W12 branch state is set to `In review`, session rows are removed, and all Changes refs are complete.
- [ ] **GATE:** Ask the operator to review the completed W12 branch at Gate 3; do not push, open a PR, or merge before approval.
- [ ] **Handover:** After merge, ask the operator for Gate 4 `sync-project-state`; report the fold at Gate 5 and ask for Gate 6 developer-guide confirmation.
